# ADR-016: Dependency-evaluation knowledge module and gate

## Status
Accepted

## Context

A dependency-selection case (picocolors vs chalk, for terminal-color
output) surfaced a real gap: neither `full-stack-engineer.md` nor
`code-reviewer.md` declares any standard for evaluating a *new*
third-party dependency before it's added to a project. The decisive
criterion in that case — chalk@5.6.1 being one of ~25 packages
compromised in the September 2025 npm supply-chain attack (the
maintainer's account was phished; malicious versions published that
stole data and hijacked crypto-wallet addresses; several of chalk's own
transitive dependencies — `ansi-styles`, `strip-ansi`, `wrap-ansi`,
`supports-color`, `debug`, `color-convert` — were compromised in the
same attack) — is exactly the kind of thing a model's training-data
cutoff can miss or get wrong. It can't be left to agent judgment alone;
it needs an externalized, explicitly-consulted knowledge module, the
same pattern ADR-006 already established for `security.md`.

`claude/knowledge/security/general.md`'s existing "Dependency hygiene"
section already anticipated this gap without closing it: *"Stack-
specific tooling for this lives in the relevant stack's own knowledge
module"* — but no cross-stack evaluation framework or stack-specific
tooling file existed yet for *choosing* a dependency, only for auditing
ones already installed (`npm audit` in `nodejs/security.md`).

This is distinct from ADR-013's Step 1 blast-radius checklist, which
asks what ships in the deliverable (production vs. dev dependencies,
packaging) — a scope question. This ADR answers a different question:
given a specific candidate package, is it safe to depend on at all. The
two are complementary, not overlapping.

The core criteria (license, supply-chain security history, maintenance
health) are stack-agnostic; only the tooling to check them varies by
ecosystem (npm/Snyk/Socket.dev for Node, pip-audit/Safety for Python,
etc.) — the same stack-agnostic-core / stack-specific-tooling split
ADR-006 already uses for `security/general.md` + `nodejs/security.md`.

This content is original (authored in a companion Claude Project, not
vendored from an externally-licensed source) — unlike
`security/general.md` and `nodejs/security.md`, it carries no CC-BY-SA
header and needs no `THIRD-PARTY-NOTICES.md` entry.

## Decision

1. Add `claude/knowledge/security/dependency-evaluation.md` — the
   cross-stack framework: three **gating** criteria (license,
   supply-chain security, maintenance activity), four comparative
   criteria (adoption/de-facto-standard, technical quality, API
   stability, community/governance), a list of automatic
   disqualifiers, a step-by-step evaluation process, and a decision-
   matrix template. Declared as a knowledge module per ADR-006, not
   inlined into any agent persona.

2. Add `claude/knowledge/nodejs/dependency-evaluation.md` — the Node/
   npm-specific tooling mapping (`npm audit`, Snyk Advisor, Socket.dev,
   OSV.dev, OpenSSF Scorecard, `license-checker`) plus the picocolors/
   chalk case as a worked example. Additive to
   `security/dependency-evaluation.md`, same relationship
   `nodejs/security.md` already has to `security/general.md`.

3. `CLAUDE.md` Step 2's existing "which knowledge modules apply"
   element (already the fourth of five Task Boundary Contract
   elements — no new element added) now also names this module:
   declare `security/dependency-evaluation.md` plus the stack's own
   dependency-evaluation file whenever a task adds a new direct
   dependency or replaces an existing one.

4. `full-stack-engineer.md` gains a **Dependency Change Discipline**
   subsection, structured like the existing Test Correction Discipline
   (ADR-010): when a task adds or replaces a dependency, run the three
   gating checks against the declared module *before* using the
   package, cite what was checked for each (not just "checked"), and
   disclose the outcome as its own explicit line in the final report —
   never folded into "files touched." A failed gate or an unresolved
   red flag is reported to the Lead, not silently worked around.

5. `code-reviewer.md`'s Review Checklist gains a **Dependency changes**
   item: when `git diff --name-only` touches a dependency manifest,
   verify the three gating criteria independently — look up the actual
   advisory/maintenance data itself (Snyk Advisor, OSV.dev, OpenSSF
   Scorecard, or equivalent), never accept the engineer's report of
   having checked. A failed gate, or a dependency change with no
   disclosed check at all, is **Blocking**.

6. The three gating checks run **regardless of `code_profile`**
   (`fast-iteration` or `hardened`, ADR-007). They are cheap, upfront,
   evidence-citing checks performed by `full-stack-engineer` itself —
   not a review cycle — so they cost nothing close to what skipping
   Step 2.5 is meant to save. `fast-iteration` still skips the
   independent `code-reviewer` gate itself (item 5 above only applies
   when Step 2.5 runs); it does not exempt the engineer's own gate
   check in item 4. This mirrors ADR-010's existing precedent of a
   narrow, named condition that survives a profile skip, applied here
   to a different trigger.

## Alternatives considered

- **Hook that blocks a dependency-manifest edit unless this module was
  declared in scope.** Rejected for now, same reasoning ADR-006 used to
  reject a stack-sniffing hook: a new dependency-shaped problem
  replacing a decision the Lead already makes once per task at Step 1.
  Revisit only if manual declaration proves unreliable in practice.
- **Also force the full `code-reviewer` gate (Step 2.5) to run under
  `fast-iteration` whenever a dependency changes**, the same way
  ADR-010's test-correction disclosure re-enables it. Considered, not
  adopted: the engineer's own gate check (item 4) already surfaces a
  failed gate to the Lead, who can escalate to a full review at that
  point same as any other `fast-iteration` judgment call. Forcing it
  unconditionally would make every trivial dependency bump (a patch-
  level bump with no gate failure) pay the full review cost — revisit
  if engineer self-disclosure proves insufficient in practice, the same
  conditional posture ADR-012's static-verification/live-confirmation
  choice already uses.
- **Inline the framework directly into `code-reviewer.md`.** Rejected:
  contradicts ADR-006's motivation (stack-agnostic, context-lean agent
  personas); also duplicates content `full-stack-engineer` needs too.
- **One combined file instead of core + per-stack split.** Rejected per
  ADR-006's "no speculative scaffolding ahead of demonstrated need" —
  kept as two files here only because the Node tooling mapping already
  exists and is non-trivial.

## Consequences

- `full-stack-engineer` and `code-reviewer` gain an actual, declared,
  offline-readable basis for evaluating dependencies, closing a gap
  that previously relied on undocumented model judgment and a training
  cutoff that can miss recent supply-chain incidents.
- Adds one more knowledge-module declaration condition (same
  acknowledged friction pattern as ADR-006/ADR-007) and one more
  disclosure line in the engineer's final report (same pattern as
  ADR-010/ADR-015).
- The engineer's gate check surviving `fast-iteration` is a deliberate,
  narrow exception to that profile's "removes governance outright"
  posture (see Decision item 6) — small in cost, but worth naming
  explicitly rather than leaving as an implicit carve-out.
- Must be ported to `md-view`'s and `stackfold`'s deployed `.claude/`
  copies after landing here, per this repo's role as source of truth —
  same outstanding obligation every prior ADR in this log carries.

## Follow-ups

- Port to `md-view` and `stackfold` deployed copies (same open item
  every recent ADR here has carried).
- Run one real dependency-addition task through the declared module
  and log it in `RUN_LOG.md` to validate the process in practice,
  particularly whether engineer self-disclosure (Decision item 4,
  Alternatives) proves sufficient without forcing full review under
  `fast-iteration`.
