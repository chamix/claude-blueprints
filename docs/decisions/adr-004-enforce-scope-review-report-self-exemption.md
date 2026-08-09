# ADR-004: Extend enforce-scope.mjs self-exemption to review-report paths

## Status
Accepted

## Context
ADR-003 exempted `.agents/current_scope.json` itself from `enforce-scope.mjs`'s
Edit/Write check, closing the friction that had surfaced at md-view Tasks 6,
7, and 9. That ADR explicitly considered and rejected broadening the
exemption further, reasoning that "only `current_scope.json` itself has ever
caused this problem" and that review reports already have their own
Lead-authored/append-only conventions, so extending the exemption to them was
"no demonstrated need."

That reasoning has since been falsified. Two further md-view tasks — Task 10
and Task 12, both delivered after ADR-003 was accepted and deployed —
independently hit a narrower but still-live variant of the same friction:
writing `.agents/specs/review_report_task*.md` while `.agents/current_scope.json`
is still open. This differs from what ADR-003 fixed:

- ADR-003 restored the ability to *amend* the manifest itself (add/remove
  `in_scope` entries).
- It did not, and was not intended to, pre-authorize any specific *content*
  path — including the review-report path every task eventually needs to
  write.

The two situations don't bite at the same moment:
- `.agents/metrics/RUN_LOG.md` is only ever written at genuine Step 3 close,
  the same moment `current_scope.json` is deleted anyway — it never
  independently needs an exemption.
- `.agents/specs/review_report_*.md` sometimes needs to be written *while the
  contract is legitimately still open* — specifically, a first-pass Blocking
  verdict, where the task isn't done and deleting the manifest early would
  incorrectly signal closure. This is exactly what happened at Task 10
  (resolved via a reactive manifest amendment) and Task 12 (two reactive
  amendments, one per review pass).

Task 11, the one intervening task, didn't hit this — not because the
underlying gap was fixed, but because the Lead happened to pre-declare the
review-report path in that task's initial `current_scope.json`. Relying on
the Lead remembering to do this every time is exactly the "documentation
alone isn't surfacing it reliably" failure mode ADR-003 already rejected, in
the analogous case of the manifest-editing gap.

## Decision
Add a second, narrowly-scoped self-exemption to `enforce-scope.mjs`,
immediately after the existing `current_scope.json` check: any path matching
`.agents/specs/review_report*.md` (prefix/suffix check, no glob dependency,
same minimalism as the existing `matchesPattern` helper) is always writable,
active contract or not.

```js
const isReviewReport =
  rel.startsWith(".agents/specs/review_report") && rel.endsWith(".md");
if (isReviewReport) process.exit(0);
```

This carries the identical safety case ADR-003 already established for the
manifest exemption, not a new one:
- **Same actor.** `code-reviewer` holds `Read, Grep, Glob, Bash` — no
  `Edit`/`Write` — by explicit design. It cannot be the one whose Write call
  this hook is gating; the write is necessarily performed by the Lead,
  persisting the reviewer's returned findings — the same trusted actor
  ADR-003 already exempted for the manifest.
- **`full-stack-engineer` is structurally excluded.** Its scope is always a
  declared file-path list under `src/`/`tests/`; `.agents/specs/**` is never
  a legitimate `in_scope` grant for that subagent.
- **Same backstop.** The reviewer's independent `git status`/diff check runs
  on every task regardless — it's literally how prior scope anomalies (e.g.
  Task 6's stray `backlog.md`) were caught, and it continues to cover this
  path too.
- **No new bypass surface beyond what ADR-003 already accepted** — one
  additional, narrowly-matched path pattern, not a directory-wide relaxation.

## Alternatives considered
- **Keep pre-declaring the review-report path in every task's initial
  `current_scope.json` (Task 11's approach).** Rejected: a procedural
  discipline, not a structural fix — already failed to hold twice (Tasks 10,
  12) since being demonstrated once. ADR-003 rejected the equivalent
  "just remember the order" strategy for the manifest-editing case on
  identical grounds.
- **Broaden the exemption to all of `.agents/specs/**`.** Rejected, for the
  same reason ADR-003 rejected blanket-relaxing all of `.agents/**`:
  `backlog.md`, `functional_domain.md`, and `initial_scaffold.md` have no
  independent write-timing problem the way review reports do, and the latter
  two are meant to stay read-only during execution per the Governance
  Integrity Rules — a directory-wide exemption would blunt that for no
  demonstrated need.
- **Extend `enforce-scope.mjs` to also gate `Bash`**, closing this and the
  ADR-002 Bash gap together. Rejected: out of scope — ADR-002 already
  examined this and rejected it as not well-bounded; nothing here changes
  that.
- **Key the exemption off a caller-identity signal instead of a path
  pattern.** Rejected for the same reason ADR-003 rejected it: hooks have no
  caller-identity field to key off today.

## Consequences
- `.agents/specs/review_report_*.md` (and the un-suffixed `review_report.md`)
  can be written at any point in a task's lifecycle, including mid-Blocked-
  cycle while `current_scope.json` is still open — no reactive manifest
  amendment required.
- Task 11's "pre-declare the review-report path" workaround is no longer
  necessary, though harmless if a Lead does it out of habit.
- The hook's enforcement of *who* may write governance/spec content remains
  entirely behavioral (agent instructions + the reviewer's `git status`
  backstop) — unchanged from ADR-003, no new preventive control claimed.
- Must be ported to md-view's `.claude/hooks/enforce-scope.mjs` copy after
  landing here. While porting, also correct md-view's currently-deployed
  copy, which has an unrelated cosmetic defect — the ADR-003 exemption
  comment's opening line is duplicated three times (functionally inert, a
  porting copy-paste artifact) — by re-pasting the corrected block cleanly.