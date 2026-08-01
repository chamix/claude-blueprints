# ADR-00X: Scope protect-governance specs protection to execution phase

## Status
Accepted

## Context
protect-governance.mjs hardcoded functional_domain.md and initial_scaffold.md
as unconditionally PROTECTED. CLAUDE.md's own Step 0/1 instructs the Lead to
author exactly those two files before any scope contract exists — the hook
blocked the first step of its own defined workflow. Discovered during md-view
Step 0 scaffolding (2026-08-01).

## Decision
Split PROTECTED into ALWAYS_PROTECTED (CLAUDE.md, .claude/) and
SPECS_PROTECTED_DURING_EXECUTION (the two spec files), the latter gated on
existence of .agents/current_scope.json — i.e. specs freeze only once a
scope contract is active, not during initial authoring.

## Alternatives considered
- Leave specs unconditionally protected, have the user create them outside
  Claude Code entirely. Rejected: pushes governance-adjacent work outside
  the governed workflow, no audit trail.
- Time-box protection to "first N minutes of repo life." Rejected: fragile,
  unrelated to actual task state.

## Consequences
- Specs are now editable pre-contract by design, not by hook failure.
- Any future spec-like file needing the same lifecycle must be added to
  SPECS_PROTECTED_DURING_EXECUTION explicitly — not automatic.