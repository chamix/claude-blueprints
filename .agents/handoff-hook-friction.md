# Handoff: dos fricciones de hooks del workflow — orden `/log-run` vs `current_scope.json`, y el hook `run-tests-if-src.mjs` en Windows

> **Propósito.** Insumo para uno o dos ADRs en `chamix-claude-blueprints`
> (próximos números libres: **ADR-016** y **ADR-017**; el último existente es
> ADR-015). Pensado para implementarse allí y después migrarse (`deploy.ps1`)
> a los consumers (`stackfold`, `md-view`, `md-presenter`).
>
> **Estatus de los datos.** *(verificado)* = leído directamente de archivos del
> repo o ejecutado, con la fuente citada. *(propuesta)* = criterio del Lead de
> esa sesión, sujeto a decisión acá. *(no verificado)* = hipótesis que nadie
> pudo reproducir. Fecha del handoff: 2026-10-10.

---

## PARTE 1 — El orden de Step 3 contradice al hook

### 1.1 El síntoma *(verificado)*
Al cerrar Cycle B2 de `stackfold`, `/log-run` no pudo escribir la fila en
`.agents/metrics/RUN_LOG.md` porque `enforce-scope.mjs` la bloqueó mientras
`.agents/current_scope.json` todavía existía, incluso con el trabajo aprobado.
El Lead lo resolvió borrando el manifiesto primero y logueando después
(`stackfold/.agents/metrics/RUN_LOG.md`, fila 2026-10-10, "Process note").

### 1.2 Causa raíz: la prosa y el hook prescriben órdenes opuestos *(verificado)*
- `CLAUDE.md` Step 3 (líneas 64-68): ítem 1 "Run `/log-run` … before closing
  out", ítem 2 "Delete `.agents/current_scope.json`". Orden: **loguear, luego
  borrar**.
- `claude/commands/log-run.md`: paso 2 apende la fila; paso 4 "Delete
  `current_scope.json` if it still exists". Mismo orden.
- `claude/hooks/enforce-scope.mjs`: mientras exista el manifiesto, bloquea todo
  `Edit`/`Write` fuera de `in_scope`. Solo hay **dos** auto-exenciones: el
  manifiesto mismo (ADR-003) y `.agents/specs/review_report*.md` (ADR-004).
  `RUN_LOG.md` no está exento ni, por diseño, figura en ningún `in_scope`
  (es una acción de logging del Lead, fuera del contrato de edición).
- Resultado: seguir la prosa al pie de la letra **siempre** choca con el hook.

### 1.3 No es la primera vez *(verificado)*
ADR-003 (Contexto) documenta la misma coreografía en `md-view`: en las Tasks 7
y 9 el Lead tuvo que escribir `RUN_LOG.md`/el review report con el manifiesto
activo y lo resolvió "deleting the manifest first … matching the order the
hook's design already implies". ADR-004 después eximió el review report, pero
**nunca eximió `RUN_LOG.md` ni corrigió el orden de Step 3**. El workaround
quedó como procedimiento tácito, redescubierto en cada proyecto. (Cuidado: la
fila de `stackfold` lo llama "first occurrence" — lo es solo para el log de
ese proyecto.)

### 1.4 Un dato que acota las opciones *(verificado)*
`protect-governance.mjs` (v4) **ya** impone que `RUN_LOG.md` sea append-only,
independientemente del estado del scope: `Write` siempre bloqueado; `Edit`
solo si `old_string` es sufijo del contenido actual y `new_string` lo extiende.
Es un chequeo sobre el contenido, más fuerte que los backstops "por convención"
que justificaron las exenciones de ADR-003/004.

### 1.5 Decisión a tomar (ADR-016)

**D1 — ¿Cómo se reconcilian prosa y hook?**

| Alternativa | Descripción | Pros | Contras |
| --- | --- | --- | --- |
| (a) *(propuesta)* | Invertir el orden en la prosa: `CLAUDE.md` Step 3 y `log-run.md` → primero borrar el manifiesto (el contrato se cierra una vez superado el gate de review), después apendar la fila. | Cero superficie nueva; ya es el procedimiento de facto; no toca hooks. | Entre el borrado y el log hay una ventana sin enforcement (irrelevante: el trabajo ya está hecho). Si `/log-run` falla después (p. ej. `/cost`), el manifiesto ya no está. |
| (b) | Agregar `.agents/metrics/RUN_LOG.md` a las auto-exenciones de `enforce-scope.mjs`, apoyándose en el append-only de `protect-governance.mjs` como backstop. | El orden documentado pasa a funcionar tal cual. | Ensancha la exención: el hook no distingue actor, así que un subagente con scope podría apendar filas. El backstop "git status del reviewer" **podría no ver `.agents/`** en el layout de `stackfold`, donde `.agents/` es un repo git anidado excluido vía `.git/info/exclude` (SK-ADR-004) — *(no verificado)*, revisar contra ADR-008 (hooks de git asumen repo único). |
| (c) | Poner `RUN_LOG.md` en el `in_scope` de cada manifiesto. | — | Contradice el diseño ("Lead-only, fuera del contrato") y le da al engineer permiso de editar el log. Descartada. |

Nota de quien arma este handoff: (a) es la más barata y la que menos amplía
superficie de bypass; (b) solo se justifica si se quiere que el orden
"loguear, luego cerrar" sea el canónico por una razón de fondo (p. ej. que el
log quede como último acto antes de cerrar). Decisión del dueño.

**D1' — (opcional, aplica a (a))** Que `log-run.md` falle rápido con un mensaje
claro ("borrá el manifiesto primero") si detecta que `current_scope.json`
existe, en vez de dejar que el hook devuelva un `BLOCKED` genérico.

### 1.6 Dónde vive el cambio
- (a): `CLAUDE.md` Step 3 y `claude/commands/log-run.md` (reordenar; el paso 4
  de `log-run.md` queda como red de seguridad o se elimina).
- (b): `claude/hooks/enforce-scope.mjs` (+ test del hook si existe).

---

## PARTE 2 — `run-tests-if-src.mjs` falla en Windows y nadie sabe por qué con certeza

### 2.1 El síntoma *(verificado)*
`stackfold/.agents/metrics/test-tier-invocations.ndjson` (generado por el
propio hook), 2026-09-28 → 2026-10-10:
- 116 invocaciones: **1** con `exitCode 0` (2026-09-29,
  `src/core/orchestrator.ts`) y **115** con `exitCode 1`.
- Duración: mínimo 479 ms, mediana 1763 ms, máximo 13587 ms.
- Los engineers lo bypassearon repetidamente corriendo `npx vitest run`
  directo (RUN_LOG filas Cycle A, Tier 2 y B2).

**Salvedad importante (no sobreinterpretar el 115/116):** `exitCode 1` no
prueba una falla de entorno. El hook corre en *cada* `Edit`/`Write` bajo
`src/` o `tests/`, incluidas las fases rojas legítimas del ciclo TDD. Y el
ndjson **no registra stderr**, así que hoy es imposible contestar "¿cuántas de
esas 115 fueron fallas reales de test y cuántas fallas del entorno?".

### 2.2 Qué se ha afirmado sobre la causa, y qué se sostiene
Hay tres capas, a distinto nivel de evidencia:

1. **Nombres de script hardcodeados** *(verificado)*. El hook upstream
   (`claude/hooks/run-tests-if-src.mjs`) tiera por `test:unit` /
   `test:integration`; `stackfold` solo tiene `"test": "vitest run"`. El
   fork local de `stackfold` (cabecera del archivo) lo resolvió colapsando a
   `npm test` y advierte que un `deploy.ps1` posterior lo sobreescribiría y
   reintroduciría la falla. `deploy.ps1` copia el árbol `.claude/` completo
   (línea ~33, "agents, commands, hooks, settings.json").
2. **Letra de unidad en minúscula rompe vitest** *(observado, no
   reproducido)*. RUN_LOG fila Cycle A (2026-09-29): "Test hook broken twice
   over: `test:unit` script name + lowercase drive letter breaks vitest".
   El origen plausible de la minúscula: Git Bash reporta `/c/Source/stackfold`
   mientras Node reporta `C:\Source\stackfold`, y el recordatorio de cwd del
   entorno cambió de capitalización a mitad de sesión (fila Tier 2). El hook
   usa `process.env.CLAUDE_PROJECT_DIR ?? input.cwd` tanto para calcular rutas
   como para el `cwd` del `spawnSync("npm", …)`.
3. **Hipótesis posterior: `node:path.relative()`/`startsWith()` distingue
   mayúsculas** *(verificado como INCORRECTA)*. La fila Tier 2 y el reviewer
   la propusieron. Ejecutado en Node v22.22.2:
   `path.win32.relative('c:\\Source\\stackfold','C:\\Source\\stackfold\\src\\x.ts')`
   → `'src\\x.ts'` (idem en el sentido inverso). En Windows, `relative()`
   compara sin distinguir mayúsculas, así que el cálculo de `rel` y el filtro
   `startsWith("src/")` **no** son el punto de falla. La hipótesis de la
   capa 2 (el `cwd` en minúscula del proceso hijo que corre vitest) queda
   como la candidata viva — pero *sin reproducir*: quien arma este handoff no
   tiene Windows donde probarlo.

### 2.3 Decisiones a tomar (ADR-017)

**D2 — ¿Investigar antes de arreglar?** *(propuesta: sí)*
Reproducir primero, en Windows: correr `npx vitest run` desde un `cwd` con
`c:\…` y otro con `C:\…` sobre el mismo repo, y comparar. Si reproduce, el
ADR documenta la causa real; si no, el ADR documenta que se descartó y se
pasa a D3 para poder diagnosticar la próxima vez. Mandar un fix a ciegas
repetiría el error de la capa 3 (arreglar una hipótesis).

**D3 — Observabilidad del hook** *(propuesta: sí, independiente de D2)*
Registrar en el ndjson un fragmento de stderr/stdout (últimas N líneas,
acotado) y el `cwd` efectivo usado. Es barato, no cambia comportamiento, y
convierte "¿cuántas fueron entorno?" en una consulta. Debería ir **antes**
que cualquier fix, para poder medirlo.

**D4 — Si D2 confirma el `cwd` en minúscula: ¿cómo normalizar?**
Candidato *(no verificado en Windows)*: canonicalizar `projectDir` al inicio
con `fs.realpathSync.native(projectDir)`, que en Windows devuelve la
capitalización canónica en disco, y usar ese valor para `LOG_PATH`,
`relative()` y el `cwd` del `spawnSync`. Aplicable por consistencia a
`enforce-scope.mjs` y `protect-governance.mjs` (menor prioridad: ya toleran
mayúsculas por la propiedad de `win32.relative`). Alternativa: no tocar el
hook y documentar "abrí la sesión desde un shell con la unidad en mayúscula".

**D5 — El hook upstream y los forks locales.**
Hoy cada proyecto sin los tres scripts de test necesita un fork que el
próximo `deploy.ps1` pisa. Dos caminos *(propuesta: el primero)*:
- Hacer el hook upstream *consciente de scripts*: leer `package.json`,
  ejecutar solo los scripts que existen, y loguear los omitidos. Elimina el
  fork de `stackfold`.
- Un punto de extensión por proyecto, como el de `branching.md` (ADR-011,
  "nunca sobrescribir lo específico del proyecto").

**Orden obligatorio al migrar:** resolver D5 *antes* de re-ejecutar
`deploy.ps1` sobre `stackfold`; de lo contrario el deploy pisa el fork local y
el hook vuelve a fallar en cada edit por el nombre de script.

### 2.4 Dónde vive el cambio
`claude/hooks/run-tests-if-src.mjs` (D3, D4, D5); un test del hook si existe;
`scripts/deploy.ps1` solo si se elige el punto de extensión de D5.

---

## PARTE 3 — Para el catálogo meta de fricciones de entorno

Cada una costó tiempo real y ninguna bloqueó la entrega:
1. Hook con nombres de script hardcodeados (`test:unit`) — Parte 2, capa 1.
2. `node_modules` instalado en la plataforma equivocada (bridge Linux vs
   Windows real). Reapareció el 2026-10-10: `vitest` falló desde el shell del
   bridge con "Cannot find module '@rolldown/binding-wasm32-wasi'"; `tsc`
   funcionó. Los tests hay que correrlos en la terminal de Windows.
3. Fault-injection bloqueada por el sandbox en tests lentos — ya cerrado
   (ADR-012).
4. Orden de Step 3 vs `enforce-scope.mjs` — Parte 1.
5. Letra de unidad en minúscula y vitest — Parte 2.
6. *(nuevo)* **Archivos de lock huérfanos por git vía el bridge.** El shell del
   bridge no puede borrar en carpetas conectadas ("Operation not permitted"),
   así que cada `git commit` ejecutado ahí deja `.git/HEAD.lock` y
   `objects/*/tmp_obj_*`. Observado en cada commit hecho por el bridge
   durante esta sesión (3 veces). El `HEAD.lock` rompe los git siguientes del
   usuario ("File exists"); se mitigó renombrándolo (`mv HEAD.lock
   stale-HEAD-lock-N`). Alternativa de fondo: pedir una vez
   `device_request_delete_permission` sobre la carpeta, o no hacer commits por
   el bridge. Es una fricción del *harness*, no del proyecto.

Patrón común: el comportamiento real del entorno diverge de lo que la prosa
del workflow asume, y se descubre por tropezón, proyecto por proyecto. Un ADR
"meta" que catalogue la clase (y fije una regla: "toda prosa de proceso se
verifica contra los hooks que la enfrentan") sería más barato que seguir
documentándolas una por una. **No es parte del pedido de este handoff.**

---

## Apéndice — Referencias exactas
- `chamix-claude-blueprints/CLAUDE.md`, Step 3 (líneas 64-68) y sección
  "Scope Contract" (línea ~71+).
- `chamix-claude-blueprints/claude/commands/log-run.md` (pasos 2 y 4).
- `chamix-claude-blueprints/claude/hooks/enforce-scope.mjs` (auto-exenciones).
- `chamix-claude-blueprints/claude/hooks/protect-governance.mjs` (v4,
  append-only de `RUN_LOG.md`) — copia desplegada en `stackfold/.claude/hooks/`.
- `chamix-claude-blueprints/claude/hooks/run-tests-if-src.mjs` (upstream) y
  `stackfold/.claude/hooks/run-tests-if-src.mjs` (fork local, cabecera).
- `chamix-claude-blueprints/docs/decisions/adr-003-…`, `adr-004-…`,
  `adr-008-…`, `adr-011-…`, `adr-012-…`.
- `chamix-claude-blueprints/scripts/deploy.ps1` (copia `.claude/`; siembra
  `.agents` sin sobrescribir estado del proyecto).
- `stackfold/.agents/metrics/RUN_LOG.md`: filas 2026-09-29 (Cycle A),
  2026-10-09 (Tier 2) y 2026-10-10 (B2).
- `stackfold/.agents/metrics/test-tier-invocations.ndjson` (116 filas).
- Verificación de `path.win32.relative`: Node v22.22.2, ejecutada el
  2026-10-10 (comando en §2.2 punto 3).
