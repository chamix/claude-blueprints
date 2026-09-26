# Backlog

- [Pending] enforce-scope.mjs has no out-of-repo early exit, unlike protect-governance.mjs
  (which exits for paths outside the project). While a manifest is active, every Edit/Write
  outside the repo is blocked, including session scratchpads. Occurrences: md-view Task 44
  (Lead, during close-out) and Task 45 (engineer, which bypassed it with a Bash heredoc, and the
  Lead during the re-review). It is now a pattern, not a one-off: the block pushes agents toward
  ADR-002-gap workarounds. Decide: add the same early exit (then port via deploy.ps1), or
  document the block as intended in ADR-002. Fix candidate for the next governance task.
- [Pending] full-stack-engineer.md / code-reviewer.md: add an explicit rule: "When a hook
  blocks a write, stop and report. Never route around it via Bash." Triggered by the md-view
  Task 45 heredoc bypass (recorded in that task's RUN_LOG row and review report).
- [Pending] Carried over (standing finding): RUN_LOG rows get marked Success before Lead
  evaluation. The fix belongs in the Output sections of code-reviewer.md and
  full-stack-engineer.md. md-view has worked around it since Task 44 with a "stop before
  /log-run" gate in each delegation prompt.
  