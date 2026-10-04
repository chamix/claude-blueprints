# ADR-014: Branch prefixes by change type

## Status
Accepted (2026-10-04) — approved by Camilo as drafted.

## Context

`agents-templates/branching.md` (the branching convention seeded into
every consumer project per ADR-011, only if that project doesn't already
have its own `.claude/project/branching.md`) currently names every branch
`feature/<task-number>-<short-description>`, regardless of what kind of
change it is — a real feature, a bug fix, a dependency bump, a docs-only
edit. `md-view` Task 47 was a race-condition fix that had no honest name
to go under except `feature/047-...`, which is what surfaced this as a
backlog entry.

Outside this repo, `md-view` additionally has its own ADR-007 (a
`md-view`-local decision, a different number than this blueprint's own
ADR-007 on agent calibration profiles — the two numbering sequences are
independent and this is not a reference to this repo's ADR-007) and a
`docs/CONTRIBUTING.md`, both of which document or depend on the current
`feature/`-only convention. Neither file is reachable from this session
(`md-view` isn't connected here); porting the resulting change into both
is a follow-up, same as every prior ADR that touched a `md-view`-owned
file.

## Decision

1. **`agents-templates/branching.md`'s branch-naming bullet becomes
   type-prefixed, Conventional-Branch style:**

   ```markdown
   - Before implementation begins, create a branch named
     `<type>/<task-number>-<short-description>` off the latest `main`,
     zero-padded to match `RUN_LOG.md`'s task sequence. `<type>` is one
     of `feature`, `fix`, `chore`, `docs` — picked by what the change
     *is*, not by which persona or task template produced it:
     - `feature/` — new capability or behavior.
     - `fix/` — corrects existing behavior (a bug, a race condition,
       a wrong default).
     - `chore/` — maintenance with no behavior change a user would
       notice (dependency bumps, config, tooling, renames).
     - `docs/` — documentation-only (README, ADRs, comments) with no
       code change at all.
     (e.g. `fix/047-race-condition`, `docs/048-readme-friction-section`)
   ```

   The task number stays a single global sequence shared across every
   prefix — it already is, in `RUN_LOG.md` — so `<NNN>` continuing to
   climb regardless of type needs no change on its own.

2. **No change to the CI gate.** The existing "CI must pass before
   merge" rule applies uniformly to every prefix. A `docs/` or `chore/`
   branch is not exempted from `test:unit`/`test:integration` just
   because its *intent* was non-functional — the whole point of running
   CI rather than trusting intent is that a change self-described as
   "docs-only" can still accidentally touch code (a broken code sample
   in a Markdown file, a renamed file breaking an import). Branch
   protection in GitHub gates on the target branch, not the source
   branch's name, so this needs no new configuration either — the
   prefix is informational, not a CI trigger condition.

3. **Ambiguous cases default to `fix/` over `feature/`.** When a change
   doesn't cleanly fit one bucket (e.g. a fix that also adds a small new
   guard), pick by what a reader of the PR title would want to know
   first: "did behavior change because something was broken" beats
   "something new was added." This is a judgment call left to whoever
   opens the branch, not a rule the hooks enforce — same posture as
   everything else in `branching.md`, which is prose guidance, not a
   hook-checked contract.

4. **`md-view`'s ADR-007 and `docs/CONTRIBUTING.md` need hand-porting**
   once this is implemented here, same as ADR-010/011/012's porting
   notes — not reachable from this session.

## Alternatives considered

- **Add every Conventional Commits type (`refactor/`, `test/`,
  `perf/`, `style/`, ...).** Rejected for now: the backlog's own
  motivating case only needed four, and `branching.md` is prose a human
  reads before naming a branch — more categories means more time spent
  deciding which bucket a change falls into, for types this system
  hasn't actually produced a branch under yet. Easy to add a fifth
  prefix later the same way; nothing about this decision closes that
  door.
- **Gate CI differently per prefix (e.g. skip tests on `docs/`).**
  Rejected: see Decision item 2 — this is exactly the "trust intent
  instead of verifying it" failure mode the rest of this system (the
  reviewer persona, the hooks) is built to avoid elsewhere. A single
  mis-prefixed or under-tested `docs/` branch is a cheap enough mistake
  that it isn't worth building a second CI path to prevent.
- **Derive the type automatically from the task's `functional_domain.md`
  or `current_scope.json` instead of a human picking it.** Rejected:
  there's no reliable signal in either file to classify by today (a
  scope manifest lists paths, not change intent), and inventing one
  would be new machinery for a problem a one-line human judgment call
  already solves. Same "don't build for a case that hasn't shown up"
  reasoning ADR-006/ADR-011 used elsewhere.

## Consequences

- `agents-templates/branching.md` changes for every future project that
  gets seeded from it; any project with its own
  `.claude/project/branching.md` already (per ADR-011's seed-if-missing
  rule) is unaffected until it chooses to adopt this convention itself.
- No hook, CI config, or `deploy.ps1` change — this is a prose-only
  convention update, same shape as the template content ADR-011 already
  seeds.
- `md-view`'s ADR-007 and `CONTRIBUTING.md` are now slightly stale
  against the new default until hand-ported (tracked as a Follow-up,
  not blocking this ADR's acceptance here).

## Follow-ups (post-acceptance)

- Port to `md-view`: amend or supersede its local ADR-007, update
  `docs/CONTRIBUTING.md`, and update `md-view/.claude/project/branching.md`
  (its own copy, per ADR-011 — a redeploy of this blueprint's template
  will never touch it).
- Consider appending a short pointer note to ADR-011 noting that its
  Decision item 2's quoted default content (`feature/<task>-<desc>`) has
  since been superseded by this ADR, so a future reader of ADR-011 isn't
  misled into thinking that's still the shipped default — without
  rewriting ADR-011's own historical Decision text.
