# Backlog

- [Pending] full-stack-engineer.md / code-reviewer.md: add an explicit rule: "When a hook
  blocks a write, stop and report. Never route around it via Bash." Triggered by the md-view
  Task 45 heredoc bypass (recorded in that task's RUN_LOG row and review report).
- [Pending] Carried over (standing finding): RUN_LOG rows get marked Success before Lead
  evaluation. The fix belongs in the Output sections of code-reviewer.md and
  full-stack-engineer.md. md-view has worked around it since Task 44 with a "stop before
  /log-run" gate in each delegation prompt.
- (append to the "stop and report" entry) Also: temporary or scratch files never go inside the
  repo; use the OS temp directory. Trigger: md-view Task 46, where a Bash `cp` created
  src/main/index.ts.__tmp outside scope (deleted immediately and self-reported).
- [Pending] Step 1 blast-radius checklist in the planning template: (a) what ships in the
  package (dependencies vs devDependencies, electron-builder contents); (b) every test that
  asserts a changed contract (grep for menu IDs, IPC channel names, exported names) goes into
  in_scope with a narrow limit on what may change; (c) which CI tier runs each check (unit and
  integration only, not e2e). Triggers: md-view Task 45 B3 (Lead's Step 0 said "runtime
  dependency") and Task 46 (scope list missed window-chrome.spec.ts). The recurring
  first-round Blocking verdicts trace to planning completeness, not implementation.
- [Pending] Fault-injection revert under core.autocrlf=true: use
  `git -c core.autocrlf=false apply -R`, then `cmp` against the pre-fault copy. A plain
  `git apply -R` rewrote an LF file to CRLF (md-view Task 46, N6). Change code-reviewer.md
  and full-stack-engineer.md.
- [Pending] Branch prefixes by change type: `feature/`, `fix/`, `chore/`, `docs/` +
  `<NNN>-<desc>` (Conventional Branch style), instead of `feature/` for everything.
  Touches: CLAUDE.md branching section (blueprint first, then deploy.ps1), md-view ADR-007
  (amend or supersede) and docs/CONTRIBUTING.md. Trigger: md-view Task 47 (a race fix
  that had to use `feature/`).
- [Pending] `scripts/deploy.ps1` does a `Force` whole-file overwrite of the target's
  `CLAUDE.md` (and the entire `.claude/` tree). Found while porting ADR-010 to `md-view`:
  `md-view/CLAUDE.md` has its own local-only "Branching & Merge Strategy" section, added
  after initial deploy and never reflected back into this repo's `CLAUDE.md`, which a blind
  rerun of `deploy.ps1` would have silently destroyed. Ported ADR-006/007/010 by hand this
  time instead. Decide: give `deploy.ps1` a merge/preserve strategy for root `CLAUDE.md`
  local sections (e.g. a marked "local additions" region it never touches), or document that
  any consumer-project addition to `CLAUDE.md` must be hand-ported back here first before
  a redeploy. Fix candidate for the next governance task.
- [Pending] Catalog "environment/tooling friction discovered after the fact" as its own
  documented class, instead of writing up each occurrence only when it happens. Three
  instances across `stackfold`'s lifecycle so far: a hook referencing a hardcoded,
  nonexistent `test:unit` script name; `node_modules` installed for the wrong platform
  (Linux bridge vs. real Windows); and ADR-012's sandbox-blocked fault-injection on a
  network-gated test. None blocked delivery, all cost real wall-clock time after the fact.
  Surfaced via `.agents/handoff-review-wallclock.md` §7, explicitly flagged there as out of
  scope for ADR-012 itself. Candidate shape: a short "known environment friction patterns"
  section in this blueprint's docs, or a "meta" ADR, rather than one-off writeups per
  occurrence.
