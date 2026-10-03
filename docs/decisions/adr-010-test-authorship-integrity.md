# ADR-010: Test-authorship integrity in the agentic TDD workflow

## Status
Accepted (2026-10-02) — approved by Camilo as drafted, from a design
discussion on whether an agent-driven workflow should keep a TDD
Red-Green-Refactor cycle at all, or move to spec-first-then-tests-at-
the-end. Implemented the same day: `CLAUDE.md` Step 2.5 (ADR-010
exception), `full-stack-engineer.md` (Test Correction Discipline +
Context Protocol disclosure line), `code-reviewer.md` (Evidence
Requirements item 5 framing).

## Context

The question that triggered this ADR: when almost all code is written by
an agent rather than a human, does the classical TDD cycle still earn
its place, or is "write the spec, implement, write tests at the end"
the better fit?

TDD bundles two separable benefits: (a) a design benefit — writing the
test first pushes toward a usable interface and small increments — and
(b) a verification benefit — the test becomes an oracle independent of
whoever wrote the implementation. For an agent, (a) is largely moot: a
model doesn't feel the design pressure of an awkward API the way a human
does across a multi-minute cycle, and it routinely drafts a test and its
implementation in the same turn anyway. Benefit (b) is not moot — it's
more important, not less, because the dominant risk with an agent is not
"bad incremental design," it's an actor that can satisfy its own success
criterion: grading its own work invites exactly the confirmation bias
`code-reviewer.md`'s "Operating Principle: Separation from Authorship"
already names for spec-vs-review. Spec-first-then-tests-at-the-end makes
this worse, not better — by the time a test is written, a complete
implementation already exists to write it against, so the test tends to
describe what the code does rather than what the spec required.

Auditing this repo's actual current design (not assumptions about it)
shows it already rejected spec-first-then-tests-at-the-end implicitly:

- `full-stack-engineer.md`'s **TDD Operational Flow** already runs
  integrated Red-Green-Refactor per cycle: a minimal test is written and
  confirmed to fail *before* the production code that satisfies it.
- `code-reviewer.md`'s **Evidence Requirements item 5** already performs
  a causal RED/GREEN check independent of the engineer's own claim: it
  reverts the specific hunk under test via a captured patch (not
  `git checkout`/`restore`, which `guard-destructive-git.mjs` blocks per
  ADR-005), confirms the test fails for the claimed reason, restores it,
  and confirms it passes again.
- **Review Checklist item 5** ("Test quality, not just presence") already
  instructs the reviewer to flag tautological tests — assertions that
  only confirm a function was called, not that it behaves correctly.

So the real question this ADR answers is narrower than "TDD vs.
spec-first": it's whether the *existing* integrated-TDD-plus-independent-
review design has a gap in who can rewrite a test and when, and if so,
where. It does, and the gap traces directly to ADR-007:

- `full-stack-engineer` authors both the test and the implementation
  within the same RGR cycle. Nothing in its Task Boundary Contract or
  TDD Operational Flow distinguishes "fixing a test I wrote that turns
  out to be wrong" from "loosening an assertion because the
  implementation won't satisfy it" — both are just an `Edit` to a file
  already listed in `current_scope.json` (which routinely includes both
  the source file and its test file side by side — see
  `agents-templates/current_scope.template.json`).
- The only backstop for that is `code-reviewer`'s Evidence Requirements
  item 5 and Review Checklist item 5 above — and per ADR-007 §4,
  **`code-reviewer` is not invoked at all under `code_profile:
  fast-iteration`**. Under that profile there is currently zero defense
  against a test quietly weakened to match the implementation instead of
  the other way around — not a weaker check, its complete absence,
  exactly the shape of trade-off ADR-007 already flagged as the
  materially higher-risk mode it knowingly accepted.

## Decision

1. **Keep the integrated Red-Green-Refactor cycle, single-author, as-is.**
   Do not move to spec-first-then-tests-at-the-end (it's strictly worse
   for the verification property this system actually depends on — see
   Context), and do not split test-authorship into a separate subagent
   from implementation (see Alternatives — rejected for the same
   round-trip-cost reason ADR-007 §Alternatives rejected routing the
   calibration suggestion through a subagent with no more insight than
   the Lead already has).

2. **`full-stack-engineer.md`'s TDD Operational Flow gains an explicit
   rule:** once a test has been run and confirmed RED in a cycle, it may
   only be edited again *within that same cycle* to correct a mistake in
   the test's own expectation — never to relax an assertion so that an
   otherwise-unchanged implementation passes. Any such correction must be
   named explicitly in the cycle (what was wrong with the original
   assertion, not just "updated test") and carried into the final
   structured report (Context Protocol) as its own line, not folded into
   "files touched."

3. **The profile gate on `code-reviewer` (ADR-007 §4) gains one
   exception, reusing an existing per-task signal rather than inventing
   new machinery** — the same pattern ADR-009 §2 uses for its own
   security-module escalation: if `full-stack-engineer`'s final report
   discloses any test correction under item 2 above, **Step 2.5 is not
   skippable for this task regardless of the declared `code_profile`.**
   `fast-iteration` still skips review by default; a self-disclosed test
   correction is the specific, narrow signal that un-skips it for that
   diff only, rather than removing `fast-iteration` as a mode or adding
   a hook to police it.

4. **No new hook, no new persisted file.** The compensating control for
   a disclosure that's wrong, incomplete, or omitted is the same one
   ADR-007 already relies on for `fast-iteration`'s larger, already-
   accepted blind spot: Step 3's transparency requirement, which must
   state explicitly whether review ran and why — never let its absence
   go unmentioned. This ADR does not attempt to make the self-report
   unfalsifiable; it makes the one case where it matters most (a test
   quietly rewritten to pass) the specific case that re-enables the
   independent check that would catch a false disclosure on the next
   `hardened` task touching the same file anyway, via Evidence
   Requirements item 5.

5. **`code-reviewer.md`'s Evidence Requirements item 5 gets a one-line
   framing addition**, not a new check: state explicitly that this causal
   RED/GREEN reversion check is the test-authorship-integrity backstop
   this ADR relies on in `hardened`, not merely a nice-to-have proof
   technique — so a future edit to that item doesn't loosen it without
   someone recognizing what it's actually load-bearing for.

6. **`RUN_LOG.md`**: no new column. A task with a disclosed test
   correction already gets a `Should-fix`/`Blocking` note-worthy row
   through the existing Notes column and the reviewer-verdict column
   once Step 2.5 runs under item 3 above — consistent with ADR-007 §5
   treating profile data as a metric, not inventing a second tracking
   mechanism for the same fact.

## Alternatives considered

- **Move to spec-first, write tests at the end.** Rejected — this is
  the actual question that opened this ADR. It trades away the
  independent-oracle property for no real design benefit with an agent
  (see Context); the existing integrated-TDD design already outperforms
  it on the property that matters most when the author isn't human.
- **Separate test authorship into its own subagent** (e.g., a
  `test-writer` persona that writes tests from spec before
  `full-stack-engineer` ever sees the task). Rejected for now, same
  reasoning as ADR-007's rejection of routing the calibration suggestion
  through a subagent: a fresh-context subagent given the spec has no more
  insight into "is this test right" than `code-reviewer`'s existing
  post-hoc causal check already provides, and it adds a full round-trip
  (and `model_tier` cost, per ADR-009) to every task rather than only the
  tasks where a test actually got rewritten. Revisit only if real
  `RUN_LOG.md` evidence shows the disclosure-based backstop (item 3) is
  being missed in practice — same "add it once a real task needs it"
  bar ADR-006 and ADR-007 both used.
- **Hook-enforce a test-file freeze** once a cycle's test goes RED (a
  `protect-test-assertions.mjs` in the shape of `protect-governance.mjs`,
  blocking any `Edit` to a test file that weakens an assertion after a
  recorded RED state). Rejected for now: `protect-governance.mjs` can
  enforce RUN_LOG's append-only invariant because "append-only" is a
  pure, syntax-level property of the diff (does `new_string` extend
  `old_string`). "Does this edit weaken an assertion" is not a syntactic
  property a hook can check without running the test itself — which is
  exactly what `code-reviewer`'s item 5 already does, independently,
  after the fact. Building a hook that re-implements a weaker version of
  that check is more state to maintain for a guarantee item 3 already
  gets more cheaply by re-enabling the real check on the right signal.
- **Just disable `fast-iteration` for any task with a test file in
  scope.** Rejected: that's nearly every task this system handles, and
  it reintroduces the exact friction ADR-007 was written to remove —
  paying for review on tasks where nothing went wrong, instead of on the
  signal that something might have.

## Consequences

- Directly answers the question that opened this ADR: the agentic
  workflow keeps TDD, not spec-first-then-tests, specifically because
  the verification-independence property matters more with a
  non-human author, not less.
- Closes a real, previously undocumented gap in `fast-iteration`:
  it no longer means "zero test-authorship defense," only "no defense
  unless a correction is disclosed" — the same honest, narrower
  framing ADR-007 already uses for what `fast-iteration` does and
  doesn't give up.
- Depends entirely on `full-stack-engineer` disclosing test corrections
  honestly; this ADR does not close that trust gap, it reuses the
  existing Step 3 transparency requirement as the backstop, same as
  ADR-007 does for the bigger gap it already accepted. Worth revisiting
  if RUN_LOG ever shows a `hardened` review catching an undisclosed test
  rewrite from a prior `fast-iteration` task on the same file.
- `full-stack-engineer.md` and `code-reviewer.md` both need the exact
  text additions in Decision items 2, 3, and 5 — small, targeted edits,
  not rewrites, consistent with this repo's own warning (ADR-007
  Consequences) that calibration-adjacent changes need the current file
  text re-confirmed before editing, not assumed.
- Must be ported to `md-view`'s deployed copy after landing here, same
  dependency ordering already used for ADR-006/007/009.

## Follow-ups (post-acceptance)

- Camilo's approval and the implementation both landed 2026-10-02 —
  insertion points in `CLAUDE.md`, `full-stack-engineer.md`, and
  `code-reviewer.md` were re-confirmed against current on-disk text
  before editing, per the re-confirm discipline ADR-007 flagged.
- No `RUN_LOG` evidence yet either way — this was a judgment call, not a
  data-driven fix like ADR-009. Worth a note in `RUN_LOG.md` the first
  time item 3's exception actually fires in practice, to check the
  signal works as intended rather than never firing or firing too often.
- **Ported to `md-view` on 2026-10-03**, as a full catch-up (ADR-006 +
  ADR-007 + ADR-010 together, by user decision) rather than this ADR
  alone — `md-view`'s deployed copy had never received ADR-006 or
  ADR-007 either, despite both being queued. Hand-applied, not via
  `scripts/deploy.ps1`: a blind deploy would have overwritten
  `md-view/CLAUDE.md`'s own Branching & Merge Strategy section, which
  exists only in `md-view` and isn't part of this blueprint's `CLAUDE.md`
  — a gap in `deploy.ps1`'s own design (it does a `Force` overwrite of
  the whole file) worth its own backlog entry. Logged in `md-view`'s own
  `.agents/metrics/RUN_LOG.md`, not here.
