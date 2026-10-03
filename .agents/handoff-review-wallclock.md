# Handoff: code-reviewer fault-injection protocol — excessive wall-clock on sandbox-denied / slow-I/O tests

> **Propósito.** Insumo para un ADR en `chamix-claude-blueprints` sobre un patrón de
> fricción real, observado en producción (no hipotético) durante el desarrollo de
> `stackfold`. Pensado para implementarse ahí y después "exportarse" (deploy) a
> `stackfold` y cualquier otro consumidor de la gobernanza.
>
> **Estatus de los datos.** Todo lo marcado *(verificado)* sale de
> `stackfold/.agents/specs/review_report.md` (ronda de Cycle B1, 2026-10-03) y
> `stackfold/.agents/metrics/RUN_LOG.md`, ambos accesibles en el repo privado de
> gobernanza de `stackfold`. Lo marcado *(propuesta)* es criterio del Lead de esa
> sesión y está sujeto a decisión acá.

---

## 1. El síntoma *(verificado)*

Comparando el delegation round contra el review round de la misma tarea
(Cycle B1 — build pipeline, packaging, placeholder renderer del plugin
`electron-ts` de `stackfold`):

| | Tokens | Wall-clock |
| --- | --- | --- |
| `full-stack-engineer` (implementación) | ~145.8k | ~12m |
| `code-reviewer` (review) | ~80.9k | ~61m 49s |

El reviewer usó **menos tokens** que el engineer pero tardó **~5x más** en
wall-clock. Un ratio tokens/tiempo tan bajo es la firma característica de
"esperando procesos reales que fallan o son lentos", no de "pensando o
generando texto de más" — si fuera lo segundo, el consumo de tokens sería
proporcionalmente alto.

## 2. Causa raíz, con cita directa *(verificado)*

`review_report.md` (líneas 135, 146, 180) documenta el proceso completo, sin
que el Lead tuviera que inferirlo:

> "I attempted to verify the Tier-4 test's causal claim ('this is the test
> that would have caught the Cycle A gap') by temporarily neutralizing the
> `cpSync(from, to)` line inside the generated `BUILD_SCRIPT` template (to
> simulate a silent asset-copy skip), expecting RED, then restoring and
> expecting GREEN — per the review protocol's fault-injection technique,
> using a backup-and-sed approach rather than `git checkout`/`restore`
> (which the destructive-git guard blocks on files with uncommitted changes,
> correctly)."

> "[...] the sandbox's auto-mode classifier denied the in-place mutation and
> every alternate route I tried, and per its own instructions I stopped
> pursuing workarounds rather than circumventing it."

Dos causas distintas, compuestas:

1. **El test Tier-4 en cuestión hace un `npm install` real** contra el
   registry npm (una decisión de diseño del Lead en esa misma sesión, para
   probar genuinamente que el build genera los tres artefactos esperados —
   ver `initial_scaffold.md`, sección "Cycle B1"). A diferencia de los otros
   tres tiers (lógica pura, aserciones de contenido, `tsc --noEmit`), que
   corren en memoria en segundos, este corre en minutos por el `npm
   install` en sí.
2. **El intento de fault-injection del reviewer fue bloqueado por el
   clasificador de auto-aprobación del sandbox de Claude Code** (una capa
   del *harness*, no del proyecto) al intentar mutar el archivo generado
   — **a pesar de que `claude/agents/code-reviewer.md` ya prescribe
   exactamente la técnica correcta para evitar el guard de
   `guard-destructive-git.mjs`** (`git apply -R` sobre un patch capturado,
   líneas 44-49 de ese archivo, ADR-005). El reviewer no incumplió el
   protocolo — lo siguió al pie de la letra y aun así fue bloqueado por una
   capa distinta y más alta (el sandbox del harness, no el hook del
   proyecto). Reportó la limitación explícitamente en vez de simular una
   verificación que no pudo hacer — comportamiento correcto, documentado en
   el propio reporte.

**Importante:** esto *no* es un bug de `guard-destructive-git.mjs` ni de
`protect-governance.mjs` (los que arreglamos en ADR-008) — es un límite
distinto, a nivel del harness de ejecución, que el protocolo de
fault-injection del reviewer no contempla como caso de salida.

## 3. El costo real de "agotar cada ruta alternativa" *(verificado)*

El propio reporte dice que, tras el primer bloqueo, el reviewer **"intentó
cada ruta alternativa"** antes de resignarse a verificación estática. Cada
intento sobre un test que de por sí corre un `npm install` real multiplica
el costo: no es solo el tiempo del intento bloqueado, es el tiempo de volver
a preparar el estado para el siguiente intento. Esto es lo que infla el
wall-clock sin inflar proporcionalmente los tokens.

## 4. Lo que el protocolo actual sí hace bien *(verificado, para no
relitigar)*

`code-reviewer.md` (línea 43) ya es explícito sobre *por qué* la
fault-injection no es opcional ("the test-authorship-integrity backstop
ADR-010 relies on"), y (líneas 44-49) ya prescribe la técnica correcta para
no chocar con `guard-destructive-git.mjs`. El problema no es que falte esa
guía — es que no hay guía para **qué hacer cuando la técnica correcta igual
es bloqueada por una capa más alta (el harness), específicamente en un test
que además es lento por diseño (I/O de red real).**

## 5. Decisión a tomar (ADR)

### D1 — Condición de salida explícita para fault-injection bloqueada por el sandbox

| Alternativa | Descripción |
| --- | --- |
| (a) *(propuesta del Lead de esa sesión)* | Agregar una regla explícita: si la técnica prescrita (patch + `git apply -R`/`git apply`) es denegada por el sandbox del harness en el **primer intento**, el reviewer reporta la limitación de inmediato y sustituye con verificación estática — sin probar rutas alternativas adicionales. |
| (b) | Dejarlo como está: confiar en que el reviewer use buen criterio caso a caso (lo que ya pasó esta vez, pero a costa de ~60 min). |
| (c) | Prohibir fault-injection en vivo para cualquier test marcado como network-gated/lento, sustituyendo siempre por verificación estática + una única corrida real (sin mutar) para confirmar que el test pasa de verdad — nunca se intentaría fault-injection ahí, ni una vez. |

**Nota de quien arma este handoff:** (a) y (c) no son excluyentes — (c)
ataca la causa #1 (el test es lento por diseño), (a) ataca la causa #2 (el
sandbox bloquea la técnica ya correcta). Podrían adoptarse ambas.

### D2 — ¿Esto aplica solo a tests network-gated, o a cualquier mutación de un *artifact generado* (contenido de un template, no código fuente del propio repo)?

El caso concreto fue mutar `BUILD_SCRIPT` (contenido de `templates.ts`
embebido como string, que termina siendo un archivo generado dentro de un
`mkdtemp`, no un archivo trackeado del repo). Vale la pena decidir si la
regla nueva es específica a "tests que mutan contenido generado en un
directorio temporal" (más angosto, más seguro) o genérica a "cualquier
fault-injection bloqueada por el sandbox" (más simple, más amplio).

### D3 — ¿Vale la pena que el Lead pueda pedir la confirmación RED/GREEN en vivo como un paso aparte, delegado explícitamente al engineer (que sí tiene permisos de escritura), cuando el reviewer no puede?

El propio reporte lo sugiere como opción no explorada: "if the Lead
considers that live confirmation essential before sign-off, it needs to
happen through a route this subagent doesn't have (e.g. the engineer
running the described revert/restore themselves and reporting both
outputs)." Esto evitaría perder la confirmación en vivo del todo, a costa
de una vuelta más de delegación.

## 6. Dónde vive el cambio, una vez decidido

- `claude/agents/code-reviewer.md` — la condición de salida nueva (D1),
  probablemente como una viñeta más en el bloque de las líneas 43-49.
- Posiblemente `CLAUDE.md` (Step 2.5) si D3 se adopta — el Step 2.5 actual
  no contempla "el reviewer no pudo confirmar en vivo, así que el Lead
  decide si delega esa confirmación al engineer."
- No toca ningún hook (`guard-destructive-git.mjs`,
  `protect-governance.mjs`) — esto es un límite del harness, no del
  proyecto; nada que "arreglar" ahí.

## 7. Para no perder de vista (fuera de alcance de este ADR puntual)

Esta es la **tercera** vez en el ciclo de vida de `stackfold` que un
proceso tarda más de lo esperado por una fricción de *tooling*/entorno
documentada después de los hechos, no por una falla de diseño del código
revisado:
1. Hook con nombres de script hardcodeados (`test:unit` inexistente).
2. `node_modules` instalado en plataforma incorrecta (bridge Linux vs.
   Windows real).
3. Esto — fault-injection bloqueada por el sandbox en un test lento por
   diseño.

Ninguna de las tres bloqueó la entrega, pero las tres costaron tiempo real.
Podría valer la pena, en algún momento, una sección propia en
`claude-blueprints`' documentación (o un ADR "meta") que catalogue estos
patrones de fricción de entorno como clase, en vez de documentarlos uno por
uno cuando aparecen. **No es parte del pedido de este handoff** — se
menciona para que quede escrito en algún lado antes de que se pierda.

---

## Apéndice — Referencias exactas

- `stackfold/.agents/specs/review_report.md`, sección final (Cycle B1),
  líneas ~42-49, ~135, ~146, ~180.
- `stackfold/.agents/metrics/RUN_LOG.md`, fila 2026-10-03.
- `chamix-claude-blueprints/claude/agents/code-reviewer.md`, líneas 43-49
  (protocolo de fault-injection actual, el que ya hace lo correcto contra
  `guard-destructive-git.mjs` y necesita la condición de salida nueva).
- `chamix-claude-blueprints/docs/decisions/ADR-005_reviewer-bash-write-access.md`
  (razón de ser de `guard-destructive-git.mjs` bloqueando reverts de
  archivos con cambios sin commitear).
- `chamix-claude-blueprints/docs/decisions/adr-010-test-authorship-integrity.md`
  (por qué la fault-injection no es opcional — el backstop de integridad de
  tests que `code-reviewer.md` línea 43 cita).
