<#
.SYNOPSIS
  Deploys the chamix-claude-blueprints agentic system into a target repository.

.DESCRIPTION
  Copies CLAUDE.md and the claude/ tree (as .claude/) into the target repo,
  and seeds the .agents/ workspace (specs/, metrics/) if missing.
  Project-specific state in the target (.agents/specs, RUN_LOG rows,
  current_scope.json) is never overwritten.

.EXAMPLE
  .\scripts\deploy.ps1 -TargetRepo C:\Source\json-mapper
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRepo
)

$ErrorActionPreference = "Stop"
$BlueprintRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $TargetRepo)) {
    throw "Target repo not found: $TargetRepo"
}

Write-Host "Deploying blueprints -> $TargetRepo" -ForegroundColor Cyan

# 1. Governance file (root)
Copy-Item -Path (Join-Path $BlueprintRoot "CLAUDE.md") `
          -Destination (Join-Path $TargetRepo "CLAUDE.md") -Force
Write-Host "  [ok] CLAUDE.md"

# 2. .claude/ tree (agents, commands, hooks, settings)
$TargetClaude = Join-Path $TargetRepo ".claude"
New-Item -ItemType Directory -Path $TargetClaude -Force | Out-Null
Copy-Item -Path (Join-Path $BlueprintRoot "claude\*") `
          -Destination $TargetClaude -Recurse -Force
Write-Host "  [ok] .claude\ (agents, commands, hooks, settings.json)"

# 3. Seed .agents workspace (never overwrite existing project state)
$TargetAgents = Join-Path $TargetRepo ".agents"
foreach ($dir in @("specs", "metrics")) {
    New-Item -ItemType Directory -Path (Join-Path $TargetAgents $dir) -Force | Out-Null
}
$RunLog = Join-Path $TargetAgents "metrics\RUN_LOG.md"
if (-not (Test-Path $RunLog)) {
    Copy-Item -Path (Join-Path $BlueprintRoot "agents-templates\RUN_LOG.md") `
              -Destination $RunLog
    Write-Host "  [ok] Seeded .agents\metrics\RUN_LOG.md"
} else {
    Write-Host "  [skip] RUN_LOG.md exists (append-only, preserved)"
}

# 4. Warn about stale scope manifests
$ScopeFile = Join-Path $TargetAgents "current_scope.json"
if (Test-Path $ScopeFile) {
    Write-Warning "A current_scope.json exists in the target. If no task is in flight, delete it — a stale manifest blocks edits."
}

Write-Host "Deploy complete. Verify inside Claude Code with /agents, /hooks, and /doctor." -ForegroundColor Green
