# ADR-009 (draft): Per-task model calibration for subagents

## Status
Proposed — drafted from a Claude Code usage audit (2026-09-26 data: 75% of
usage from subagent-heavy sessions; full-stack-engineer 26%, code-reviewer
20%). Not yet reviewed/committed by Camilo into docs/decisions/.

## Context

Audited `claude/agents/full-stack-engineer.md`, `claude/agents/code-reviewer.md`,
and `claude/agents/technical-writer.md`: none declare a `model:` frontmatter
field.

Claude Code's documented model resolution order (confirmed against
https://code.claude.com/docs/en/sub-agents, v2.1.251+):
1. Per-invocation `model` parameter on the delegating Task/Agent call
2. The subagent's own `model:` frontmatter (`inherit` = main session's model)
3. `CLAUDE_CODE_SUBAGENT_MODEL` env var
4. The main conversation's model

With none of (1)-(3) set, all three subagents fall through to (4) — the
Lead session's own model. If the Lead runs on Opus (plausible for Step 0/1
architecture work), every TDD cycle and every routine review inherits
Opus pricing regardless of task complexity. This is a direct, mechanical
explanation for the 46% combined usage share in exactly these two agents.

This is the same shape of problem ADR-007 already solved (uniform rigor
regardless of task): per-task, Lead-suggested, user-approved calibration
declared in the delegation prompt, no persisted settings file.

## Decision

1. Add `model_tier` as a third calibration axis beside `code_profile` /
   `docs_profile`, decided at Step 1, same user-approval gate, no
   persisted file (same posture as ADR-007 §1 — nothing new to protect
   at the hook level).

2. Default tiers (the Lead's baseline suggestion absent a reason to
   deviate):
   - `full-stack-engineer`: **sonnet**. Escalate to `opus` only when
     Step 1's blueprint flags cross-module/architectural complexity,
     concurrency, or data migrations — or a prior RGR cycle hit the
     Stopping Condition cap.
   - `code-reviewer`: **sonnet**. Escalate to `opus` when the task's
     declared knowledge modules (ADR-006) include
     `security/general.md` or a stack security file — reusing an
     existing per-task signal rather than inventing a new one.
   - `technical-writer`: **haiku** default (its rules are mechanical —
     heading restraints, dash-lists, banned marketing words).
     Escalate to `sonnet` only under `docs_profile = blog-detailed`.

3. Declared as an explicit delegation-prompt element, same pattern as
   ADR-007 §3 (full-stack-engineer's Task Boundary Contract gains a
   sixth element). Unlike scope/output-format/definition-of-done, an
   *omitted* `model_tier` does NOT trigger stop-and-ask — it falls
   through to the agent's own default (item 2). The default is
   unambiguous and safe; asking every time would reintroduce the exact
   friction ADR-007 avoided for routine tasks.

4. Mechanism: the Lead passes `model` on its per-invocation Task call
   (confirmed highest-precedence mechanism). No `tools:` or hook change
   required — this is a `CLAUDE.md` Step 1/2 prose addition only.

5. Also set each agent's frontmatter `model:` to its item-2 default, as
   a safety net for a delegation that forgets the per-invocation
   override. Not a replacement for item 4 — frontmatter alone can't
   express per-task escalation.

6. `/log-run` records `model_tier` used, alongside `code_profile` /
   `docs_profile`, so escalation drift becomes visible the same way
   RGR-cycle drift already is.

## Alternatives considered

- **Global `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`.** Sits below frontmatter
  in precedence — once item 5 lands this becomes a no-op for the three
  named agents. Worth keeping as a floor for any future, undeclared
  agent, not as the primary fix.
- **`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`.** Per docs this disables both
  frontmatter and per-invocation overrides entirely — no escalation
  path for genuinely hard tasks. Useful as an emergency brake near a
  usage-window limit, not as standing policy.
- **Persist `model_tier` in a calibration file.** Rejected for the
  identical reason ADR-007 rejected `.agents/calibration.json` — new
  unenforceable state, no hook to protect it from silent drift.

## Consequences

- Should directly reduce the 26%/20% subagent usage share for routine
  tasks.
- The Lead's own (expensive) model choice stops silently propagating to
  every delegated subagent.
- Adds one more declared element per delegation (acknowledged friction,
  consistent with ADR-007's accepted trade-off).
- Must be ported to md-view's deployed copy after landing here, per this
  repo's role as source of truth.

## Open items before this can be promoted to docs/decisions/

- Confirm what model the Lead session actually runs on today (this
  audit inferred Opus from role seniority, not from a `/model` check).
- Decide whether `full-stack-engineer`'s escalation trigger needs a more
  concrete threshold than "Lead judgment" (ADR-007 left similar calls to
  judgment deliberately — may be fine as-is).
- Run one task under each tier and log it in RUN_LOG.md to validate the
  defaults before treating them as settled.
