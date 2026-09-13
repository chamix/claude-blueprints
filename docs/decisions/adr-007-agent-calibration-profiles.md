# ADR-007: Two-axis calibration for agent rigor and documentation depth

## Status
Accepted

## Context

Agents currently behave identically regardless of project phase. The
full TDD/review pipeline and exhaustive documentation apply uniformly
whether the task is a disposable POC or a long-term maintained delivery.
md-view itself demonstrates why this doesn't fit: it was built initially
as a harness-testing project with deliberately exhaustive documentation
intended for blog content, and is now shifting toward tool delivery and
evolution, where that same documentation depth is pure overhead rather
than value.

Two independent axes emerged during design, not one — conflating them
was considered and explicitly rejected (see Alternatives):

- **Code rigor** (`code_profile`): governs TDD stopping-condition cycle
  caps and, most significantly, whether the independent `code-reviewer`
  gate (`CLAUDE.md` Step 2.5) runs at all.
- **Documentation depth** (`docs_profile`): governs `technical-writer`'s
  verbosity, independent of code rigor — a task can call for rapid
  iteration on code while still wanting exhaustive narrative
  documentation, or any other combination.

An earlier version of this design persisted the choice as a
project-level file, `.agents/calibration.json`, decided once per project
phase rather than per task. That version surfaced a real problem worth
recording rather than quietly dropping: since `fast-iteration` disables
`code-reviewer`'s Step 2.5 gate entirely, and that gate's own independent
`git status`/`git diff` check is this project's existing backstop against
unauthorized or accidental edits elsewhere (it's literally how Task 6's
and Task 9's scope anomalies were caught, and the backstop ADR-002 relies
on for the Bash-write gap it otherwise accepts) — a persistent file
controlling that removal would itself need hook-level protection, and
that protection has a documented, unclosable gap (`protect-governance.mjs`
only inspects `Edit`/`Write`, not `Bash`) precisely at the moment the
reviewer that would normally catch such a bypass is turned off.

Rather than accept that gap, this ADR decides calibration **per task,
through the Lead's existing Step 1 evaluation and approval gate**, with
no persisted settings file at all. This doesn't solve the file-protection
problem better — it removes the object the problem was about. The
trade-off, made deliberately and knowingly: a suggestion-and-approval
exchange on every task instead of a one-time project-level setting. For
a project with many small tasks in the same phase, that's real,
repeated friction. It's accepted in exchange for never letting a
calibration choice go stale silently, which was the actual risk the
file-based version couldn't fully close.

## Decision

1. **No persistent calibration file.** `.agents/calibration.json` does
   not exist in this design. There is nothing calibration-related to
   protect at the hook level, and no Bash-bypass gap to document for it
   — the earlier version's Decision items on hook protection and a
   `RUN_LOG.md` compensating control are superseded, not carried
   forward.

2. **The Lead suggests calibration during Step 1** (Technical
   Specification Mapping), alongside the rest of the blueprint it
   already produces there. Step 1 already evaluates the task and already
   gates on explicit user approval before any delegation happens —
   this reuses that existing gate rather than adding a new one:
   - Always suggest a `code_profile` (`fast-iteration` or `hardened`).
   - Suggest a `docs_profile` (`delivery` or `blog-detailed`) only when
     the task's definition of done includes documentation output.
   - Default suggestion when nothing about the task argues otherwise:
     `hardened` / `delivery` — fail-safe toward the stricter, leaner
     defaults, same posture the file-based version applied to a missing
     file, now applied to an unremarkable task.
   - The user approves or overrides this alongside the rest of the
     blueprint in the same Step 1 approval step — not a separate
     decision point.

3. **Once approved, declared explicitly in the relevant subagent's Task
   Boundary Contract** — a per-task declaration, not a fixed pointer,
   since it's decided fresh each time:
   - `full-stack-engineer`'s Task Boundary Contract gains a fifth
     element: **Calibration** — the approved `code_profile` for this
     task only. Not `docs_profile`; this agent never touches
     documentation, and passing it that value would be noise it has no
     use for.
   - `technical-writer`'s delegation gains an equivalent explicit
     element: the approved `docs_profile` for this task only. Not
     `code_profile`, for the same reason in reverse.
   - `code-reviewer` gets no calibration element at all: in
     `fast-iteration` it's simply never invoked (see 4), and in
     `hardened` its behavior doesn't vary by profile — there is no
     "calibrated" version of `code-reviewer` to declare.

4. **Effects of each profile value, per task:**
   - `code_profile = fast-iteration`: `CLAUDE.md`'s Step 2.5 is skipped
     entirely for this task. No `code-reviewer` invocation, no
     `review_report.md`, no Blocking gate — not a lighter version of
     the gate, its absence.
   - `full-stack-engineer`'s Stopping Condition cycle cap: 3 under
     `hardened` (unchanged), 2 under `fast-iteration` — escalate to the
     Lead sooner rather than iterate against a target no one is
     independently checking. Adjustable if 2 proves too tight in
     practice; not derived from anything load-bearing.
   - Everything else in `full-stack-engineer.md` — the tiered TDD
     Operational Flow, Pre-Delivery Verification's mandatory one-time
     `test:e2e` run, and Context Protocol — stays identical regardless
     of profile. With Step 2.5 off in `fast-iteration`, Pre-Delivery
     Verification is the only check left standing; weakening it too
     would leave nothing.
   - `code-reviewer.md`'s Evidence Requirements section is untouched,
     full stop. It doesn't get a lighter mode — in `fast-iteration` it
     doesn't run at all; in `hardened` it always runs in full. There is
     no in-between state where it runs with relaxed evidence standards.
   - `docs_profile = blog-detailed` vs `delivery`: `technical-writer`
     depth, as originally scoped — exhaustive narrative documentation
     versus lean, minimal-viable documentation scoped to using the
     thing rather than reading about how it was built.

5. **`RUN_LOG.md` still logs the `code_profile`/`docs_profile` used per
   task** — now purely as a metric, useful for cross-referencing against
   the existing cost/usage backlog, not as a compensating control for a
   security gap, since there's no gap left to compensate for.

6. **Transparency requirement, unchanged:** Step 3's final report to the
   user must state explicitly whether independent review ran for this
   task and which profile was used. The absence of a review gate must
   never be silently implied by its absence from the report.

## Alternatives considered

- **Persist calibration as a project-level file
  (`.agents/calibration.json`), decided once per project phase.** This
  was the original design. Rejected in favor of per-task decisions
  specifically because of the protection problem described in Context:
  the file would need hook-level protection to prevent silently
  disabling the review gate, and that protection has a real,
  documented gap with no backstop while the very state it controls
  is active. Deciding per-task through an already-existing approval
  gate removes the artifact that needed protecting, rather than
  protecting it imperfectly.
- **Let `full-stack-engineer` suggest its own calibration** rather than
  the Lead. Rejected: `full-stack-engineer` starts with a blank context
  window per delegation and has no visibility into project stakes or
  history unless the Lead explains it first — at which point the Lead
  has already done the evaluation work a suggestion requires, and
  routing it through the subagent just adds a round trip.
  Step 1 already exists as the point where the Lead evaluates a task
  before anyone is delegated to.
- **Loosen `code-reviewer`'s verdict thresholds in `fast-iteration`
  instead of skipping it entirely.** Rejected per the same reasoning as
  the original design: a reviewer that still runs but cares less isn't
  faster in any way that matters, since it still pays the full cost of
  a `test:all` run for a diluted verdict.
- **Couple `docs_profile` to `code_profile`** into one combined enum.
  Rejected: the two vary independently in practice, and this ADR's
  own per-task design makes that independence easy to express — a task
  simply gets whichever combination fits it, with no need to force one
  axis to imply the other.
- **A continuous rigor scale instead of two discrete profiles per
  axis.** Rejected for the same reason ADR-006 rejected speculative
  multi-stack scaffolding ahead of demonstrated need: two profiles
  cover the actual observed case (md-view's own POC-to-delivery
  transition); add a third only once a real task needs something in
  between.

## Consequences

- Every task now carries a small additional decision point: the Lead's
  Step 1 output includes a calibration suggestion, and the user
  confirms or overrides it alongside the rest of the blueprint. This is
  deliberate, accepted friction, not an oversight — see Context.
- `fast-iteration` remains a materially higher-risk mode: it's the only
  agent behavior in this system that removes a governance mechanism
  outright rather than adjusting a threshold. Deciding it per task, in
  the open, with the user's explicit sign-off each time, is the
  mitigation this ADR relies on in place of a persisted, hook-protected
  setting.
- No new hook, no new protected file, no new documented security gap —
  this design is simpler than the file-based alternative specifically
  because it has less state to protect, not because the underlying
  risk of `fast-iteration` itself got smaller.
- `full-stack-engineer.md`'s Stopping Condition, `code-reviewer.md`'s
  Evidence Requirements, and Pre-Delivery Verification all needed
  re-confirming against their actual current text before this design
  was finalized — a repeat, in miniature, of the exact drift ADR-006's
  implementation surfaced. Any future calibration-adjacent change to
  these files should re-verify current content the same way.
- Must be ported to md-view's deployed copy after landing here, once
  the already-queued ADR-006 port happens first — same dependency
  ordering already chosen.
