# ADR-013: Step 1 blast-radius checklist before delegation

## Status
Accepted (2026-10-04) — approved by Camilo as drafted, from
`.agents/specs/backlog.md` item 4, grounded in two concrete incidents
from md-view's history (Task 45 B3 and Task 46). Implemented the same
day: `CLAUDE.md` Step 1 gains the Blast-radius checklist bullet, placed
between Stack declaration and Calibration suggestion (ADR-007), per
Decision item 1's resolved ordering. The CLAUDE.md bullet carries the
compressed rule only; the full legitimate-vs-hollow-N/A worked example
below in Decision item 1 is the canonical reference for a Lead needing to
resolve an ambiguous real case.

## Context

Two incidents from md-view, both caught by `code-reviewer` at Step 2.5,
neither caught earlier:

- **Task 45 B3:** the Lead's Step 0 described something as "a runtime
  dependency" without checking what that label actually implies for the
  package manifest (production vs. dev dependency, and whether it needs
  to ship in the packaged build at all).
- **Task 46:** the task's `in_scope` list omitted
  `window-chrome.spec.ts`, a test that asserted a contract the task
  actually changed. The omission wasn't caught until `code-reviewer`'s
  regression-risk pass.

Camilo's own diagnosis in the backlog entry: "the recurring first-round
Blocking verdicts trace to planning completeness, not implementation."
That framing matters — `code-reviewer` is not failing to catch these. It
is catching them correctly, every time, which is exactly the problem:
by Step 2.5, `full-stack-engineer` has already spent a full delegation
round (one or more RGR cycles, per ADR-007's Stopping Condition) against
a scope that was incomplete from the start. The Blocking verdict doesn't
prevent wasted work, it just confirms that work was wasted. This is the
same "catch it earlier" logic ADR-007 and ADR-010 both already lean on
elsewhere in this project: a check that fires after real work has
happened is strictly more expensive than the identical check fired
before that work is delegated.

The backlog entry's three sub-items are md-view/Electron-specific
illustrations of one underlying gap: Step 1 (the Lead's own planning,
before user approval and before any delegation) has no required
checklist forcing it to reason about what a change actually touches
beyond the files the task description names explicitly. Generalized for
this blueprint's stack-neutral audience:

(a) What actually ships in the deliverable — production vs. dev
    dependencies, and the contents of whatever packaging/build
    configuration this stack uses (e.g. electron-builder's `files`/
    `extraResources` in an Electron app, a bundler's entry/output config
    elsewhere) — not a one-line label like "a runtime dependency" without
    checking what it implies for the package manifest.
(b) Every test that asserts a contract this task changes — grep for the
    affected exported names, IDs, or channel/API names (e.g. menu IDs,
    IPC channel names in an Electron app) — added to the eventual
    `in_scope` list with a narrow limit on what may change. This has to
    happen during planning, not be discovered reactively during
    `code-reviewer`'s Step 2.5 pass.
(c) Which test tier actually exercises each changed surface (unit/
    integration only, vs. the full e2e suite), declared as part of the
    plan itself — consistent with the existing test-tiering work
    (`run-tests-if-src.mjs`), not a separate afterthought at delegation
    time.

## Decision

1. **Add a required "Blast-radius checklist" bullet to `CLAUDE.md` Step 1
   (Technical Specification Mapping)**, presented for the same explicit
   user approval the existing Stack declaration and Calibration
   suggestion bullets already get — not a separate decision point.
   **Placement, resolved:** immediately after Stack declaration and
   before Calibration suggestion. Ordering follows information
   dependency, not convention: the checklist's sub-item (a) needs to know
   which stack's packaging/build configuration applies before it can be
   checked, so Stack declaration has to come first; and the checklist's
   findings can validly change the Calibration suggestion that follows it
   — a task that looks simple on its face but turns out to touch a wide
   set of contracts (per sub-item (b)) is a legitimate reason to suggest
   `hardened` even when nothing else about the task's description would
   have argued for it. Calibration should be suggested with the blast
   radius already known, not before.

   Proposed wording for the bullet:

   > **Blast-radius checklist:** before presenting the blueprint for
   > approval, work through: (a) what actually ships in the deliverable —
   > production vs. dev dependencies and the relevant packaging/build
   > configuration, not a one-line label; (b) every test that asserts a
   > contract this task changes (grep for affected exported names, IDs,
   > or channel/API names), each added to the eventual `in_scope` list
   > with a narrow limit on what may change; (c) which test tier actually
   > exercises each changed surface, declared up front rather than left
   > to delegation time. Where a sub-item genuinely doesn't apply to this
   > task, say so explicitly in the blueprint rather than omitting it
   > silently — **but a bare "N/A" does not satisfy this.** The stated
   > reason must name why, tied to the actual files/contracts this task's
   > scope touches — not just assert irrelevance. For example, on a
   > pure-documentation task touching only `docs/decisions/*.md` and
   > `CLAUDE.md`:
   > - **Legitimate:** "(a) N/A — this task edits only
   >   `docs/decisions/*.md` and `CLAUDE.md`; no `package.json` or build
   >   config changes, confirmed by the file list itself." This is
   >   checkable: it names the actual scope and why that scope makes the
   >   sub-item inapplicable.
   > - **Hollow — treat as equivalent to the sub-item being skipped, not
   >   satisfied:** "(a) N/A" alone, or "(a) N/A — not relevant to this
   >   task," with no stated connection to what the task actually
   >   touches. A reason that doesn't reference the task's actual scope
   >   doesn't satisfy the gate; per Decision item 2, that blocks
   >   proceeding to Step 2 exactly as an omitted sub-item would.

2. **This is a hard gate on proceeding to Step 2, not Lead judgment with
   no enforcement.** The Lead may not present the blueprint for user
   approval, and therefore may not delegate, until all three sub-items
   are either addressed or explicitly marked not applicable with a
   stated reason. This mirrors the existing enforcement shape of
   `full-stack-engineer`'s Task Boundary Contract, where a missing
   required element blocks proceeding rather than being treated as
   optional — applied here to the Lead's own Step 1 output instead of a
   subagent's. The justification is the same one that motivates this ADR
   in the first place: if the checklist is only a suggestion the Lead can
   skip under time pressure, the system is back to relying on Step 2.5 to
   catch the gap after a delegation round has already been spent — which
   is the exact cost this ADR exists to remove, not relocate.

3. **No hook enforces this mechanically.** Unlike `protect-governance.mjs`
   (a pure, syntax-level check — is a diff append-only) or
   `enforce-scope.mjs` (a pure path-membership check), "did the Lead
   actually reason about packaging contents and grep for affected
   contracts" is not a property a hook can verify without re-doing the
   analysis itself. The compensating control is the same one ADR-010
   relies on for test-authorship disclosure and ADR-012 relies on for
   fault-injection denial: an explicit, checkable statement in the
   blueprint the user is asked to approve, not a silent internal step.
   `code-reviewer`'s existing Step 2.5 checks (Boundary Contract
   compliance, regression risk) remain in place unchanged as the second
   line of defense for anything the checklist still misses — this ADR
   does not remove or weaken them, it aims to reduce how often they're
   the *first* line.

## Alternatives considered

- **Leave this entirely to `code-reviewer`'s existing Step 2.5 checks
  (Boundary Contract compliance, regression risk).** Rejected — this is
  the status quo the backlog entry is about, and it's demonstrably not
  "no check," it's "the right check, one full delegation round too late."
  Both incidents were caught, correctly, by Step 2.5; the cost this ADR
  targets is the wasted `full-stack-engineer` round that preceded the
  catch, not a missing detection capability.
- **Leave it as the Lead's own judgment call, documented as a
  recommendation but not gating Step 2.** Rejected per Decision item 2:
  a non-gating recommendation is exactly as skippable under pressure as
  no recommendation at all, and the two incidents motivating this ADR
  both happened under a Lead that presumably already intended to be
  careful — the gap wasn't absence of intent, it was absence of a
  required, named checkpoint forcing the reasoning to happen before
  moving on.
- **Enforce the checklist with a hook**, e.g. requiring
  `initial_scaffold.md` to contain specific section headers before a
  delegation can proceed. Rejected for now, same reasoning ADR-010 used
  to reject a hook-enforced test-assertion freeze: whether the checklist
  content is *actually correct* (did the Lead really grep for every
  affected contract name, not just claim to) is not a syntactic property
  a hook can verify — a header-presence check would be security theater,
  catching an omitted section while rubber-stamping a hollow one.
- **Make this a new, separate step (Step 0.5) rather than a bullet inside
  the existing Step 1.** Rejected: Step 1 already is the Lead's technical
  mapping and already gates on the same user-approval point; adding a
  new numbered step for one checklist creates a second decision point
  where ADR-007 and ADR-009 both already established the pattern of
  folding calibration-style additions into Step 1's existing gate instead
  of multiplying steps.

## Consequences

- Should directly reduce the specific failure pattern the backlog entry
  names: first-round Blocking verdicts caused by planning gaps rather
  than implementation defects, by moving the check to before a
  delegation round is spent rather than after.
- Lengthens Step 1's output by one required checklist per task. Accepted
  friction, same trade-off ADR-007 already made explicit for its own
  calibration-suggestion bullet: a small, bounded cost on every task in
  exchange for not discovering a scope gap only after it's already been
  paid for once.
- Does not remove or weaken `code-reviewer`'s existing Step 2.5 checks —
  Boundary Contract compliance and regression risk stay exactly as they
  are. This ADR is about where the *first* check happens, not about
  having only one check.
- No new hook, no new persisted file — consistent with ADR-007's and
  ADR-009's posture that per-task planning additions don't need their own
  protected state, only a required line in an already-approved document.
- Depends entirely on the Lead actually doing the grep/analysis work
  rather than writing a checklist that looks complete. This ADR does not
  close that trust gap; it names the required checkpoint and leaves
  `code-reviewer`'s existing independent checks as the backstop for a
  checklist that was filled in dishonestly or carelessly — the same
  self-report-plus-independent-backstop shape ADR-010 and ADR-012 already
  use elsewhere in this project.
- Must be ported to deployed consumer projects (e.g. `stackfold`,
  `md-view`) after acceptance, same dependency ordering as every prior
  `CLAUDE.md`-touching ADR.

## Follow-ups (post-acceptance)

- Camilo's approval and the implementation both landed 2026-10-04 — the
  insertion point in `CLAUDE.md` Step 1 was re-confirmed against current
  on-disk text before editing, per the re-confirm discipline ADR-007/
  010/011/012 established.
- No `RUN_LOG.md` evidence yet either way — not a blocker, same posture
  ADR-010 and ADR-012 both took for their own initially-unvalidated
  judgment calls. Worth checking after a few real tasks whether the
  checklist actually catches a gap before delegation, or whether it
  becomes boilerplate the Lead fills mechanically without the underlying
  grep actually happening.
- Must be ported to deployed consumer projects (e.g. `stackfold`,
  `md-view`) after landing here, same dependency ordering as every prior
  `CLAUDE.md`-touching ADR.
