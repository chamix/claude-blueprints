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

## Enforcement model

Prose rules request; hooks enforce:

- `protect-governance.mjs` (PreToolUse) — `CLAUDE.md`, `.claude/**`, and
  approved specs are read-only during execution
- `enforce-scope.mjs` (PreToolUse) — edits outside
  `.agents/current_scope.json` are rejected (machine-checked Task
  Boundary Contract)
- `run-tests-if-src.mjs` (PostToolUse) — independent test signal after
  every source edit; failures are reported by the hook, not self-reported
