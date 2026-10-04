# Stackfold Cycle B1 — Review-Time Report & Handoff

**Review took \~3x longer on Cycle B1 (approx. 90 min) than on the three prior stackfold tasks (approx. 17-30 min each)** — but almost none of that increase was wasted motion in the useful sense of "the reviewer went in circles." Two things stacked:

1. **Legitimate, user-facing rework** — a real spec/invariant conflict (branding text in index.html violating the no-branding-leakage rule) surfaced mid-task and needed your explicit decision, plus a genuine Should-fix (missing HTML-escaping) that got routed back and closed before delivery. Both were correct uses of time.
2. **Pure overhead with no payoff** — the reviewer's mandatory live fault-injection step (mutate code, expect RED, restore, expect GREEN) hit a wall: the file had uncommitted changes, so claude-blueprints's own git-safety hook blocked git checkout/restore as the restore path, forcing a sed-based mutate-and-manually-revert approach instead — which the platform sandbox's destructive-action classifier then denied outright, along with three follow-up attempts to verify some other way. All four attempts failed; the reviewer fell back to static code reading, which worked fine, but the session paid for several denied round-trips before admitting defeat and taking the route that was always going to work.

The second point is the one worth fixing structurally — it's described in full below.

## Time comparison across tasks

| Date | Task | RGR cycles | Est. tokens | Est. wall-clock | Reviewer verdict |
| --- | --- | --- | --- | --- | --- |
| 2026-09-28 | Plugin contract (Interfaces + Template Method) | 3 + 2 (fix round) | \~415k | \~25 min | CHANGES REQUIRED -> APPROVED WITH NOTES |
| 2026-09-29 | electron-ts Tier-1 shell (Cycle A) | 3 total | \~300k | \~30 min | CHANGES REQUIRED -> APPROVED WITH NOTES |
| 2026-10-02 | Cycle A fix round (N1/N3/N4) | 2 | \~231k | \~17 min | APPROVED (no Blocking) |
| 2026-10-03 | Cycle B1 — build pipeline, packaging, renderer | 2 + 2 narrow follow-ups | \~227k | \~90 min | APPROVED (1 Should-fix, 1 Nit, 2 Notes) |

Note the token count for B1 is actually in line with the other tasks (\~227k, the lowest of the four) — the time cost wasn't from more agent work being done, it was from more wall-clock elapsed per unit of agent work: user-decision latency on the spec conflict, plus the reviewer's blocked fault-injection attempts, both of which cost real minutes without costing proportionally more tokens.

## Where Cycle B1's time actually went

Reconstructed from RUN\_LOG.md, the Cycle B1 delegation prompt, and review\_report.md (the only artifacts available — the Claude Code session transcript itself isn't accessible from here):

1. **Engineer implementation, 2 RGR cycles** — round 1 covered the content/packaging tier (renderer HTML/CSS, electron-builder.yml, package.json extension); round 2 added the build-integrity tier (the real npm install + build test). This is normal scope, not inflation — Cycle B1 was always going to need a 4th test tier beyond Cycle A's three.
2. **Mid-task spec conflict -> user decision** — the engineer caught that the spec's literal index.html content included a "Scaffolded by stackfold init electron-ts" line, which directly violates functional\_domain.md §3 item 4 (no branding leakage). This stopped the pipeline until you decided to enforce the rule literally, with the line stripped from both the implementation and the spec text. This is exactly the kind of judgment call the workflow is designed to surface rather than silently resolve — not overhead to eliminate.
3. **Reviewer's evidence-gathering, routine** — re-reading functional\_domain.md and the relevant initial\_scaffold.md section, running the diff, the full test suite, a real opt-in network run of the new build-integrity test (confirmed genuine, not mocked), and checking the two new dependency pins against the live npm registry. All ordinary review protocol, consistent with prior tasks.
4. **Reviewer's fault-injection attempt — 4 denied operations, no result** — this is the one genuinely anomalous cost (detailed in the next section).
5. **Two narrow post-review follow-ups** — the HTML-escaping Should-fix and the stale test-name Nit were both routed back and closed by the Lead directly rather than triggering a full second review round. This was efficient: the fix was small, verified directly (grep for the helper, full suite re-run, tsc --noEmit), and didn't need the reviewer to re-engage.

162/163 tests passing, tsc --noEmit clean, APPROVED with no Blocking items — the deliverable quality was fine. The time cost sat almost entirely in steps 2 and 4.

## Root cause: two safety layers blocking each other

claude-blueprints's review protocol asks the code-reviewer subagent to do a live fault-injection: temporarily break the code under test, confirm the test goes RED, restore it, confirm GREEN — proof the test actually tests what it claims to, not just that it exists.

On Cycle B1, the reviewer tried this against templates.ts, which at review time had uncommitted working-tree changes (the diff under review hadn't been committed yet). That one fact broke both of the available restore paths:

- **Path 1 — git checkout/restore:** claude-blueprints's own guard-destructive-git.mjs hook blocks this on a file with uncommitted changes. Correct behavior on its own terms — it exists specifically to stop a destructive git command from silently eating uncommitted work.
- **Path 2 — backup-and-sed mutate/restore (the fallback when Path 1 is blocked):** the platform sandbox's own auto-mode classifier denied the sed -i call outright as "Irreversible Local Destruction" — and this classifier doesn't know about claude-blueprints's backup step, so it can't tell the mutation was going to be reverted.

With both normal routes closed, the reviewer tried three more verification angles (git status --porcelain, git diff | grep -c, a throwaway tsx script against the real plugin module) — each one also denied, flagged as pursuing the same outcome through a different tool. Per the classifier's own instructions, the reviewer correctly stopped trying workarounds at that point rather than escalating further, and substituted direct code reading of the test's assertions instead (documented honestly in the review report as a known limitation, not silently glossed over).

**The structural problem:** fault-injection is only reachable at all when the file under review happens to be fully committed already — review timing (uncommitted diff vs. committed diff) now silently decides whether this verification step is even attemptable, and nobody designed it that way on purpose. On a clean/committed file, Path 1 would have worked fine and cost nothing. On a dirty file, as here, the protocol asks for something neither of its own two routes can deliver, and the only way to find that out is to actually try and get denied four times.

## Recommendations

1. **Make the dirty-tree case for fault-injection a known, cheap branch — not a discovery.** Add a line to the code-reviewer persona or the review protocol itself: "If git status shows uncommitted changes in the file to be mutated, skip live fault-injection and go straight to static verification — say so in one line, don't attempt the mutate/restore dance." This turns a 4-denial discovery into a 1-line decision, with the same end state (static verification, honestly disclosed) at a fraction of the cost. It doesn't weaken the gate: fault-injection stays mandatory on committed code, which is the common case anyway.
2. **Separate "spec conflict requiring user judgment" from "process overhead" in RUN\_LOG.md itself.** Right now both get folded into one wall-clock estimate per row. A task could note: wall-clock: \~90 min (approx. 30 min user-decision + engineer/reviewer work, approx. X min reviewer fault-injection denials). That turns "why did this take so long" from an investigation (like this one) into a number you can read directly off the log next time.
3. **Consider whether guard-destructive-git.mjs's uncommitted-file block should have a reviewer-specific exception.** The hook is right to stop a careless git checkout from eating real work — but a review-only, read-and-restore mutation on a file that's about to be committed anyway is a narrower, lower-risk case than the one the hook was built to stop. Worth a deliberate decision (yours, per the governance rule that only you amend claude-blueprints itself), not a default.
4. **This is a two-task sample for the "3x" pattern.** Treat \~90 min as a data point, not a trend, until the fix in #1 is in place and you've watched one or two more hardened-profile reviews on dirty trees.

## Handoff — for the Engineering Agents project

**Scope of this report:** built entirely from artifacts on disk in C:\\Source\\stackfold.agents\\ — RUN\_LOG.md, the Cycle B1 delegation prompt, and review\_report.md. No access to the actual Claude Code session transcript (tool calls, turn-by-turn timing, token counts per step) — all timing figures above are the Lead's own self-reported estimates in RUN\_LOG.md, not automated telemetry. If "Engineering Agents" has a way to pull real session telemetry (API usage logs, /cost output captured per-run rather than estimated), that would sharpen point #2 under Recommendations considerably.

**Open items carried over, not yet acted on:**

- initial\_scaffold.md line 461 still has stale spec text (the old branding line) that needs correcting now that current\_scope.json is deleted and the governance read-only lock has lifted — flagged in the review but not yet fixed as of this report.
- Cycle B2 (Playwright e2e, CI workflows, the actual "app must start" verification per functional\_domain.md §3.8) is fully unstarted.
- The fault-injection/dirty-tree gap (this report's main finding) lives in claude-blueprints itself, not in stackfold — any fix belongs in the governance tool's repo, then redeploys to stackfold and any other project running it.

**Suggested next action in Engineering Agents:** decide on Recommendation #1 (the cheapest, lowest-risk fix) first, since it's a small persona/protocol edit with no architectural implications, before touching the git-guard hook itself (#3), which has real safety trade-offs worth deliberating separately.
