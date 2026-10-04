# ADR-011: Per-project extension points via fixed-pointer import + seed-if-missing

## Status
Accepted (2026-10-03) — approved by Camilo as drafted, made right after the
`CLAUDE.md` port incident where `md-view`'s local-only "Branching & Merge
Strategy" section was briefly destroyed by a staging mixup during the
ADR-006/007/010 catch-up port.

## Context

`md-view/CLAUDE.md` has a "Branching & Merge Strategy" section that does
not exist in this blueprint's `CLAUDE.md` at all. Camilo's own account:
it was developed directly in `md-view` and judged, at the time, to be
exclusive to that project — so it was never ported back here. Nothing
wrong with that call itself; the actual gap is that this blueprint's own
tooling has no concept of "a section a consumer project is allowed to own
and a redeploy must never touch." `scripts/deploy.ps1` does a `Force`
whole-file overwrite of the target's root `CLAUDE.md`, so the very first
real redeploy would have erased it — and today's incident (a staging-path
mixup across two near-identical `CLAUDE.md` files in the same session)
produced exactly that outcome by a different route, which is what
surfaced the gap and generated the backlog entry this ADR resolves.

Camilo's stated goal: the blueprint should be genuinely identical across
every project it's deployed into, with explicit, named extension points
for the parts that legitimately vary per project — not implicit drift
inside a shared file that a tool doesn't know how to respect.

This blueprint already has the exact mechanism needed, under a different
name:

- **ADR-006** established fixed-pointer imports (`@.claude/knowledge/**`)
  for content that must load in full but shouldn't be hand-copied inline.
- **`scripts/deploy.ps1`** already seeds `.agents/metrics/RUN_LOG.md` from
  a template **only if the target doesn't already have one** — "Project-
  specific state in the target... is never overwritten," per the script's
  own header comment. This is already a working seed-if-missing pattern;
  it just isn't applied to anything inside `CLAUDE.md` itself yet.

This ADR is the two ideas combined, applied to the one demonstrated case.

## Decision

1. **`CLAUDE.md`'s "## Branching & Merge Strategy" section becomes a
   fixed-pointer import**, same shape as ADR-006's knowledge modules:

   ```markdown
   ## Branching & Merge Strategy

   @.claude/project/branching.md

   Note (ADR-011): this is a per-project extension point, not a fixed
   policy — `scripts/deploy.ps1` seeds this file from
   `agents-templates/branching.md` only if the target doesn't already
   have one. Once a project has its own, a redeploy never touches it,
   the same "never overwrite project-specific state" guarantee this
   repo's tooling already gives `RUN_LOG.md`.
   ```

2. **New template: `agents-templates/branching.md`.** Content: `md-view`'s
   current policy verbatim (protected `main`, `feature/<task>-<desc>`
   branches, user-only commits/pushes, squash merge, CI gate before
   merge, release tags from `main` only) minus its internal
   `(see ADR-007)` cross-reference — that pointed at an **`md-view`-local**
   ADR number, not this blueprint's ADR-007, and would be a false pointer
   once this becomes the generic default. This is the only proven policy
   this system has ever actually run under; shipping it as the default
   is evidence-based, not invented.

3. **`scripts/deploy.ps1` gains one step**, mirroring its existing
   `RUN_LOG.md` logic almost verbatim:

   ```powershell
   # 5. Seed per-project extension points (never overwrite existing ones)
   $BranchingFile = Join-Path $TargetRoot ".claude\project\branching.md"
   if (-not (Test-Path $BranchingFile)) {
       New-Item -ItemType Directory -Path (Split-Path $BranchingFile) -Force | Out-Null
       Copy-Item -Path (Join-Path $BlueprintRoot "agents-templates\branching.md") -Destination $BranchingFile
       Write-Host "  [ok] Seeded .claude\project\branching.md"
   } else {
       Write-Host "  [skip] .claude\project\branching.md exists (project-owned, preserved)"
   }
   ```

   Target path spelling: `.claude/project/branching.md` — chosen to read
   consistently next to `.claude/knowledge/**`, rather than a flatter
   `.claude/branching.md`.

4. **One-time migration for `md-view`** (already deployed): move its
   current Branching & Merge Strategy content, verbatim, into
   `md-view/.claude/project/branching.md`; replace the section in
   `md-view/CLAUDE.md` with the same pointer as item 1. After this,
   `md-view/CLAUDE.md` and this blueprint's `CLAUDE.md` are byte-identical
   except where the Self-application governance bullet applies (see
   item 6) — Camilo's stated goal, achieved.

5. **The mechanism generalizes without a new ADR.** Any future section
   that needs per-project override follows the identical recipe: a
   fixed-pointer line, a default in `agents-templates/<name>.md`, one
   seed-if-missing step in `deploy.ps1`. A later ADR only needs to
   *declare* the new extension point, not re-derive why this shape is
   the right one — same economy ADR-006 already gives knowledge modules.

6. **Out of scope, deliberately:** the Governance Integrity Rules'
   "Self-application to `claude-blueprints` itself" bullet. That's the
   opposite direction — the blueprint repo has content consumer projects
   don't need, not a consumer project owning content the blueprint lacks
   — and is already correctly excluded by the existing self-application
   rule. Nothing in this ADR touches it.

## Alternatives considered

- **Merge markers / protected regions, parsed by `deploy.ps1`.** Rejected:
  needs a custom parser inside the deploy script — genuinely new state
  and failure surface to maintain, for a problem the pointer approach
  solves with zero new parsing. Same reasoning ADR-007/009 already used
  to prefer removing the object that needs protecting over protecting it
  better.
- **Document "don't blindly rerun `deploy.ps1` on a project with local
  `CLAUDE.md` edits" and leave it at that.** Rejected: that's the status
  quo, and the status quo is what produced today's near-miss — an
  undocumented special case a human (or an agent acting as Lead) has to
  remember per project, instead of a tool that's safe by construction.
- **Three-way/diff-based auto-merge on redeploy.** Rejected: real
  machinery (diffing, conflict resolution) for a problem with exactly one
  demonstrated instance so far. Same "don't build for a case that hasn't
  shown up yet" reasoning ADR-006 used to reject speculative multi-stack
  scaffolding.
- **Make all of `CLAUDE.md` project-overridable wholesale instead of
  specific sections.** Rejected: that's also the status quo (there's
  nothing stopping a project from editing anything in its deployed copy
  today), and it's precisely how drift accumulates silently and how a
  redeploy becomes destructive. Section-level extension points keep the
  shared workflow (Steps 0-3, Scope Contract, Governance Integrity Rules)
  genuinely identical everywhere — Camilo's actual stated goal — while
  naming the specific parts allowed to vary.

## Consequences

- `deploy.ps1` gains one new seed step, low-risk, structurally identical
  to its existing `RUN_LOG.md` handling.
- `md-view` needs a one-time migration (move the section's content out,
  replace with the pointer) — done once, same session as acceptance.
- This blueprint's `CLAUDE.md` becomes shorter and loses its only
  project-flavored section; from this point on it is genuinely identical
  across every deployment, which was the actual goal.
- A future project wanting a different branching policy than `md-view`'s
  just edits its own `.claude/project/branching.md` once — never touches
  `CLAUDE.md`, never collides with a redeploy again.
- Today's specific incident (a `CLAUDE.md` content mixup during a manual
  port) couldn't recur in this shape once Branching & Merge Strategy no
  longer lives inside the file a redeploy overwrites wholesale — though
  it doesn't prevent every possible mixup; it removes this one's object.
- Any later extension point is a declaration, not a redesign.

## Follow-ups (post-acceptance)

- Camilo's approval landed 2026-10-03, same session as this ADR's draft.
- **Still required before this is actually implemented:** re-confirm the
  exact current on-disk text of `scripts/deploy.ps1` and both `CLAUDE.md`
  files against this ADR's excerpts — same re-confirm discipline ADR-007
  flagged, doubly warranted given the incident that triggered this ADR —
  then apply Decision items 1-4. The copy of `chamix-claude-blueprints`
  available to this session does not yet contain the item-1 pointer or
  item-6-adjacent Branching section, so the edits to `CLAUDE.md`,
  `scripts/deploy.ps1`, and the new `agents-templates/branching.md` are
  **pending**, not yet landed — do not commit those files as if this
  ADR's Decision is already reflected in them until that edit pass runs.
- Must be ported to `md-view`'s deployed copy (item 4's migration) in the
  same implementation pass, not as a separate later task — leaving
  `md-view/CLAUDE.md` with its current inline Branching section while
  this blueprint's copy switches to the pointer would reintroduce drift
  between the two on day one.

## Follow-up: branch-naming convention superseded (ADR-014)

Decision item 2's quoted default content for `agents-templates/branching.md`
— `feature/<task>-<desc>` branches, singular, for every change type — was
accurate when this ADR landed but is no longer the shipped default.
ADR-014 replaces it with a type-prefixed, Conventional-Branch-style
convention (`<type>/<task-number>-<short-description>`, `<type>` ∈
`feature`, `fix`, `chore`, `docs`). This note exists so a future reader
of this ADR's Decision text isn't misled into thinking `feature/`-only
naming is still current; the Decision section above is left untouched as
the historical record of what this ADR actually decided at the time.
