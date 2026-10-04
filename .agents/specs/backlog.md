# Backlog

- [Pending] `scripts/deploy.ps1` does a `Force` whole-file overwrite of the target's
  `CLAUDE.md` (and the entire `.claude/` tree). Found while porting ADR-010 to `md-view`:
  `md-view/CLAUDE.md` has its own local-only "Branching & Merge Strategy" section, added
  after initial deploy and never reflected back into this repo's `CLAUDE.md`, which a blind
  rerun of `deploy.ps1` would have silently destroyed. Ported ADR-006/007/010 by hand this
  time instead. Decide: give `deploy.ps1` a merge/preserve strategy for root `CLAUDE.md`
  local sections (e.g. a marked "local additions" region it never touches), or document that
  any consumer-project addition to `CLAUDE.md` must be hand-ported back here first before
  a redeploy. Fix candidate for the next governance task.
