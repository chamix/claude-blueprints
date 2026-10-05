# ADR-015: Minimum coverage threshold as a Pre-Delivery/Review checkpoint (not a per-edit hook)

## Status
Accepted (2026-10-04) — approved by Camilo as drafted, including the
"why a gate still earns its place under disciplined TDD" addition in
Context (added after Camilo's own observation that TDD should cover this
by design, confirmed here as partial: true for RGR-driven code, not for
undriven defensive branches or pre-existing aggregate coverage).
Implemented the same day: `full-stack-engineer.md` gains a coverage run
in Pre-Delivery Verification, `code-reviewer.md` gains independent
coverage verification in Evidence Requirements.

## Context

`run-tests-if-src.mjs` already runs `test:unit` (always) and
`test:integration` (on contract-boundary paths) on every `Edit`/`Write`
under `src/` or `tests/`. Its own header comment is explicit that this is
"a static, auditable path -> tier mapping, not real test-impact-analysis
(no coverage-data infra here)" — a deliberate, documented gap, not an
oversight. `e2e` is, by the same header's reasoning, never auto-triggered
by this hook at all: it is reserved for one explicit run per task, inside
`full-stack-engineer`'s "Pre-Delivery Verification" section, with
`code-reviewer`'s own independent full-suite run as the real, final gate
(`CLAUDE.md` Step 2.5 / `code-reviewer.md` Evidence Requirements item 2,
`npm run test:all`).

A minimum coverage threshold doesn't fit the per-edit hook shape for the
same reason `e2e` doesn't:

- **It's an aggregate property, not a per-file provable one.** RED/GREEN
  on a single new test is a claim about one file's one behavior, checkable
  in isolation. "Did overall coverage stay ≥80%" is a claim about the
  whole changed surface (often the whole suite) — it can't be judged from
  one edit's diff the way the existing hook's per-file RED/GREEN checks
  can.
- **Coverage instrumentation has real per-run overhead.** Running every
  `test:unit`/`test:integration` invocation with `--coverage` on every
  single `Edit`/`Write` repeats, at hook cadence, exactly the cost/benefit
  trade the hook's header already rejected for `e2e` ("paying that cost on
  every RGR cycle is exactly the anti-pattern this flow exists to avoid" —
  `full-stack-engineer.md`'s own wording for the same shape of problem).

This mirrors the test pyramid reasoning (Cohn, *Succeeding with Agile*,
2009) the hook's header already cites: fast/cheap checks subsidize the
tight edit loop; a slower, whole-surface check belongs at an explicit,
once-per-task checkpoint, not inside the loop itself.

**Why a gate still earns its place under disciplined TDD.** Code that
exists *because* a failing test demanded it (RED→GREEN) is covered almost
by definition — there's no way to reach GREEN without executing that
path. But that doesn't make the threshold redundant with TDD discipline
itself, for three concrete reasons: (1) defensive branches added during
REFACTOR without a driving test — a `try`/`catch`, a `switch` default, a
null-check added "just in case" — are exactly the gap `test.coverage.
thresholds`' separate branches figure (75%, below the 80% used for
lines/statements/functions) is sized to catch, and they're common even
under strict RGR discipline; (2) a project-or-file-level aggregate
threshold (Vitest's default scope) can be dragged down by pre-existing,
untouched code this task never touched, independent of how well this
task's own TDD cycle went; (3) this is a backstop for the *result*
meeting a number, not a re-verification that TDD was actually followed —
that's `code-reviewer`'s existing Test Correction Discipline check
(ADR-010). The two checks are independent and both already follow the
same "self-report is not verification, an independent backstop is" shape
this project uses elsewhere (ADR-010, ADR-012).

## Decision

1. **Add a required coverage run to `full-stack-engineer.md`'s
   "Pre-Delivery Verification" section**, alongside the existing one-time
   `test:e2e` run: after RGR cycles are complete, run the project's
   coverage script once (e.g. `npm run test:coverage`) and include the raw
   coverage summary table in the final report — same "once, not per
   cycle" cadence already established for `test:e2e` in that section.
2. **Add to `code-reviewer.md`'s Evidence Requirements** (item 2 territory,
   alongside the existing `npm run test:all` run): the reviewer runs the
   coverage command **itself** — never accepts the engineer's reported
   numbers — and paste the raw output. A run that exits non-zero because a
   configured threshold wasn't met is a **Blocking** finding, evidenced
   the same way every other Blocking category already is in that file:
   raw command output, not a restated claim.
3. **Enforce the actual numeric threshold at the tool-config level**
   (Vitest's `test.coverage.thresholds`), not by having either agent
   manually parse a percentage out of a report and compare it by hand.
   Vitest already exits non-zero when a configured threshold isn't met,
   so this reuses the "non-zero exit ⇒ Blocking" evidence-handling both
   agent files already have — no new parsing logic, just one more named
   command. This keeps the same "static, auditable path, cheap to reason
   about" property the hook's own header claims for itself.
   **Thresholds:** lines/statements/functions ≥ 80%, branches ≥ 75% — the
   de-facto industry baseline for a project without heavy legacy debt
   (consistent with, e.g., Google's internal guidance and Martin Fowler's
   writing on coverage as a diagnostic, not a target to game).
4. **Scope of this ADR is the governance side only** —
   `full-stack-engineer.md` and `code-reviewer.md` in `claude-blueprints`.
   The actual `vitest.config.ts` `coverage.thresholds` block and a
   `test:coverage` npm script in `md-view`'s (or any other consumer's)
   `package.json` are **not** part of this ADR's implementation — tracked
   below as a Follow-up, same dependency ordering every prior
   `CLAUDE.md`/agent-file-touching ADR has used (ADR-010 through ADR-014
   all needed a separate porting step into `md-view` after acceptance
   here).

## Alternatives considered

- **Add coverage to the per-edit hook (`run-tests-if-src.mjs`).**
  Rejected — see Context: coverage is a whole-surface aggregate, not a
  per-file provable property the way one new RED/GREEN test is, and it
  adds real wall-clock cost to the hook's "fast tier" on every single
  edit, the exact anti-pattern the hook's own header already rejects for
  `e2e`.
- **Hook-enforce the threshold by having a `PostToolUse` hook parse a
  `coverage-summary.json` file after the fact.** Rejected for a second,
  independent reason beyond the one above: a hook checking "does a
  coverage file exist with numbers above X" is trivially satisfiable by a
  stale or cached report left over from an earlier run, not one tied to
  this diff's actual current state — the same "security theater" risk
  ADR-013 already named for header-presence checks that can't verify
  correctness, only presence.
- **Mutation testing (e.g. StrykerJS) instead of, or in addition to, line
  coverage.** Out of scope here — Camilo explicitly declined to adopt
  Stryker on 2026-10-04, consistent with this repo's standing pattern
  (ADR-007/009/010/012) of not introducing new tooling for this class of
  problem unless evidence shows the cheaper existing control is actually
  insufficient. Vitest's built-in coverage reporting is config on an
  already-present test runner, not a new tool.

## Consequences

- `full-stack-engineer`'s Pre-Delivery Verification step grows by one more
  "run once, report raw" command — bounded cost, same shape as the
  existing `test:e2e` step, not open-ended.
- `code-reviewer`'s Blocking category gains one new named failure mode
  (coverage threshold miss), evidenced the same way every other Blocking
  category already is.
- No new hook, no new persisted file in `claude-blueprints` itself —
  consistent with ADR-007's, ADR-009's, and ADR-013's posture of not
  introducing new protected state for a single new checkpoint.
- Requires the consumer project (`md-view` first) to actually have a
  coverage reporter (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`)
  installed, a `test:coverage` script, and a `coverage.thresholds` block
  in `vitest.config.ts` before this is enforceable there at all — purely
  documentation in this repo until that port happens.
- README's existing "Known Environment Friction Patterns" section (the
  `test:unit`/`test:integration` script-name-mismatch entry) will likely
  gain a sibling case the first time a consumer project lacks a
  `test:coverage` script — not pre-emptively added as a fourth entry
  until actually observed once, per that section's own rule.

## Follow-ups (post-acceptance)

- Port to `md-view`: add/confirm a coverage reporter dependency, a
  `test:coverage` npm script, and a `coverage.thresholds` block
  (lines/statements/functions 80, branches 75) in `vitest.config.ts`.
  `md-view` is not connected in the session that drafted this ADR — this
  step is explicitly deferred, not done.
- Not yet validated against a real task/`RUN_LOG.md` entry — same
  "revisit after real evidence" posture ADR-010/012/013 all took for
  their own first cut. Worth checking, after a few real tasks, whether
  the threshold catches an actual under-tested change or just becomes a
  number nobody looks at.
