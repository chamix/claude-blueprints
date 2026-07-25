---
name: /log-run
description: Appends a row to the CLEAR-lite run log after a task closes (success, escalation, or rescope).
---

# Workflow: Log Run Metrics

Trigger this immediately after Step 3 (Deliver) of `AGENTS.md`, once a task
has reached a terminal state (delivered, escalated, or rescoped).

1.  **Gather:** task description, personas involved, number of Red-Green-Refactor
    cycles the engineer needed, the reviewer's top-line verdict from
    `.agents/specs/review_report.md`, and wall-clock time for the session.
    Pull cost/latency from the Antigravity session panel if visible; otherwise
    estimate and mark `(est.)`.
2.  **Append:** add one row to `.agents/metrics/RUN_LOG.md`. Never rewrite or
    delete prior rows — this is an append-only log.
3.  **Flag drift:** if RGR cycles-to-green has risen for 2+ consecutive tasks,
    or the reviewer has issued 2+ consecutive `Blocked` verdicts, say so
    explicitly to the user before closing out. That pattern usually means the
    specs are getting vaguer, not that quality is dropping.
