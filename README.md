# chamix-claude-blueprints

Configuration-as-Code lab for multi-agent workflows on Claude Code.
Successor to `chamix-antigravity-blueprints`; same governance model
(Lead / Engineer / Reviewer with blocking gates), now with deterministic
enforcement via hooks.

## Structure

- `CLAUDE.md` — governance rulebook, deployed to the target repo root
- `claude/` — deployed as `.claude/` in target repos
  - `agents/` — subagent definitions (separate contexts, restricted tools)
  - `commands/` — slash commands (`/audit-design`, `/audit-docs`, `/log-run`)
  - `hooks/` — Node.js enforcement hooks (cross-platform, no Git Bash dependency)
  - `knowledge/` — agent-consumable reference material, separate from role-contract prose (ADR-006); fixed-pointer modules for `code-reviewer`/`technical-writer`, declared-per-task stack modules for `full-stack-engineer`
  - `settings.json` — hook wiring
- `agents-templates/` — seeds for the target repo's `.agents/` workspace
- `scripts/deploy.ps1` — copies the system into a target repo
- `legacy/` — archive of the original Antigravity `.agents/` folder

## Deploy

```powershell
.\scripts\deploy.ps1 -TargetRepo C:\Source\json-mapper
```

Then inside Claude Code: `/agents` to confirm subagents loaded, `/hooks` to
confirm hook registration, `/doctor` for a setup checkup.

## Self-Application

`CLAUDE.md`'s workflow also governs Claude Code sessions working
directly in this repo — editing an agent persona, a hook, a command, or
`CLAUDE.md` itself. Steps 0/1 don't apply to a governance edit (there's
no functional domain to map for a prose/config patch), but Steps 2/3
still do: a scoped `.agents/current_scope.json` and a real `/log-run`
entry in this repo's own `.agents/metrics/RUN_LOG.md` — distinct from
`agents-templates/RUN_LOG.md`, the empty seed `deploy.ps1` copies into
consumer projects. This repo has no `.claude/` of its own, so none of
the hooks above fire here; compliance is discipline, not a technical
gate, until this content is deployed elsewhere.

## Enforcement model

Prose rules request; hooks enforce:

- `protect-governance.mjs` (PreToolUse) — `CLAUDE.md`, `.claude/**`, and
  approved specs are read-only during execution
- `enforce-scope.mjs` (PreToolUse) — edits outside
  `.agents/current_scope.json` are rejected (machine-checked Task
  Boundary Contract)
- `run-tests-if-src.mjs` (PostToolUse) — independent test signal after
  every source edit; failures are reported by the hook, not self-reported

`code-reviewer` can also assemble a consolidated **Verification Bundle**
on request — real diffs, the review report, this task's new `RUN_LOG.md`
row, and fresh `git status`/`git diff --stat` — typically before a
merge/PR approval decision, never by pasting whole growing files.

## Calibration

Not every task needs the same rigor. Per ADR-007, the Lead suggests a
`code_profile` (`fast-iteration` or `hardened`) and, when the task
includes documentation, a `docs_profile` (`delivery` or `blog-detailed`)
during Step 1, for the user to approve alongside the rest of the
blueprint — a per-task decision, not a project-wide setting.

`fast-iteration` is the one profile that removes a governance mechanism
outright rather than adjusting a threshold: the independent
`code-reviewer` gate (Step 2.5) is skipped entirely, not run with
lighter standards. The Lead states this explicitly in its final report
whenever it happens — the absence of review is never left implicit.
