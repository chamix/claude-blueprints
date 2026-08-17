# ADR-005: code-reviewer's Bash access can write despite "read-only, by design"

## Status
Accepted

## Context

`code-reviewer.md`'s frontmatter grants `tools: Read, Grep, Glob, Bash`.
Its own prose states: "You hold no Edit or Write tools; this is by
design." That sentence is true and misleading at the same time — `Bash`
is unrestricted shell and can achieve any effect `Edit`/`Write` could
(`sed -i`, heredocs, `node -e "...writeFileSync..."`, `git apply`).

Neither existing PreToolUse hook (`enforce-scope.mjs`,
`protect-governance.mjs`) can see this: both are registered in
`settings.json` with `"matcher": "Edit|Write"` and key off
`tool_input.file_path`, a parameter Bash calls don't have. This is not a
weak enforcement of Bash — it's structural blindness to it. The same gap
means `protect-governance.mjs` cannot stop a Bash call from touching
`CLAUDE.md` or `.claude/*` either, not just review artifacts.

This is adjacent to, but distinct from, ADR-002. ADR-002 accepts that
Bash writes bypass scope-*expansion* checks, with the reviewer's own
`git status`/diff verification as the explicit backstop. That model
assumes the reviewer itself is the trustworthy check — it does not cover
the case where the reviewer's *own* sanctioned verification work (a
fault-injection revert) damages someone else's already-legitimate,
still-uncommitted work by mistake.

### Incident that surfaced this (Task 14)

During independent fault-injection verification, `code-reviewer` ran
`git checkout -- src/main/index.ts` intending to revert its own
one-line temporary edit (an injected `preload` key, added to reproduce
the leak-detection proof). `git checkout -- <path>` restores the entire
file to `HEAD`, not to "one edit ago" — it discarded the full,
legitimate, still-uncommitted Task 14 diff on that file (58 lines).

The reviewer self-detected via the next `tsc` failure, reconstructed the
patch from a `git diff` it had captured earlier in its own session,
validated with `git apply --check`, applied it, and confirmed the
restored diff matched. The recovery held — verified independently by the
Lead afterward, diff-for-diff. But the recovery depended entirely on the
reviewer happening to have captured a full diff earlier in the same
session. That's not a guaranteed safety net; it's what this particular
session happened to have on hand.

### Why "just remove Bash" is wrong

`code-reviewer` needs Bash for `git diff`, running the test suite, and —
per this project's own standing practice since Task 3/5 — *independently
reproducing* fault injections (temporarily mutate, rebuild, observe RED,
revert, observe GREEN). Removing Bash removes the reviewer's ability to
verify anything beyond a code read, which defeats the role.

Notice also: `full-stack-engineer` *has* `Edit`/`Write`, and its own
fault-injection reverts this task went through those tools — which means
they *were* covered by both existing hooks. Denying `code-reviewer`
`Edit`/`Write` to make it safer pushed its equivalent writes onto the one
channel with zero governance coverage. The control relocated the risk
instead of removing it.

## Decision

Add a new PreToolUse hook, matched on `"Bash"`, that blocks specifically
the class of command that caused the incident — whole-file/whole-tree
git reverts (`git checkout -- <path>`, `git restore <path>` without
`--staged`, `git reset --hard`, `git clean -f`/`-fd`) — **and only when
the target actually has uncommitted changes right now** (checked via
`git diff --quiet HEAD -- <target>`). A checkout/reset/clean against
already-clean state is a harmless no-op and stays allowed.

This is deliberately narrower than restricting Bash generally:
- It doesn't touch `full-stack-engineer`'s Bash access at all (registered
  project-wide in `settings.json`, same as the other two hooks, so it
  applies to every agent — but for any agent, discarding uncommitted work
  via a blanket revert is a mistake worth catching, not just for the
  reviewer).
- It doesn't block `git diff`, test runs, `sed`/`cat`/`git apply` used
  for a *scoped* fault-injection-and-revert — only the specific
  "snap back to HEAD, discard everything uncommitted" operations.
- It correctly stays silent on the 95%+ of `git checkout`/`reset` calls
  that are safe no-ops in practice.

Also: correct `code-reviewer.md`'s "You hold no Edit or Write tools;
this is by design" line — replace with accurate framing (Bash is granted
for verification and fault-injection reproduction; destructive
whole-tree reverts are hook-blocked; "no authored fixes, findings only"
remains a behavioral instruction, not something fully closeable without
losing the reproduction capability this role exists for).

### Deliberately left open, not decided here

`code-reviewer.md`'s Output section instructs: "Since you cannot write
files, return the complete report as your final message... for the Lead
to save." In practice, this session's reviewer used Bash heredocs to
append its section to `review_report_task14.md` directly, bypassing that
instruction — Bash made it possible, same root cause as above. Whether to
(a) hook-block writes to `.agents/specs/review_report*.md` specifically
to force the "return as message" path, or (b) accept direct writes to
that one, lower-stakes path and update the prose to match, is a separate
call the Lead/user hasn't made yet. Not resolved by this ADR.

## Consequences

- Positive: closes the specific failure mode observed in Task 14 without
  losing independent fault-injection verification.
- Positive: incidentally protects `full-stack-engineer` (and the Lead)
  from the same mistake, at effectively zero cost to legitimate work.
- Negative: one more hook to maintain; regex-based command matching is
  inherently approximate (won't catch every conceivable phrasing of a
  destructive command, e.g. commands built up across multiple `&&`-joined
  Bash calls or unusual quoting).
- Open: the review-report direct-write question above remains
  unresolved.
- Follow-up: implement as its own Task — TDD unit tests on the
  matching/uncommitted-detection logic, plus a fault-injection proof that
  it (a) blocks the exact Task-14 scenario and (b) does not block routine
  safe usage — before wiring into `settings.json`. A draft implementation
  exists but is unaudited and untested; treat it as `initial_scaffold.md`
  content for that task, not a drop-in.

## Verification

Run by hand against a throwaway git fixture, not via subagent delegation
(no test harness exists in this repo, and one isn't warranted for a
handful of hook scripts — see handoff notes).

- Confirmed clean-state no-ops for checkout/restore/reset --hard/clean
  all allow (exit 0); dirty-state variants all block (exit 2);
  `restore --staged` correctly excluded.
- Reproduced the Task-14 incident shape directly: a real uncommitted
  diff + `git checkout -- <file>` is blocked, and the diff survives.
  Confirmed the message's suggested recovery (`git apply -R` on a
  captured patch) actually reverts cleanly.
- Found and fixed a gap: `git diff --quiet HEAD` only inspects tracked
  content, so `git clean -f`/`-fd` could delete a never-`git add`-ed
  file unblocked. Added an untracked-file check (`git status
  --porcelain`, .gitignore-respecting, scoped to the `clean` pattern
  only) and re-verified the full matrix plus a gitignore-respecting
  no-false-positive check.
- Known, accepted gap (documented, not fixed, same posture as ADR-002's
  Bash coverage gap): long-form flags (`git clean --force`, bare
  `git checkout -f`/`--force` with no path target) are not matched by
  the current regex set and pass through unchecked. Backstop remains
  the reviewer's independent `git status` check, per ADR-002's
  precedent.

### Follow-up: flag-order and long-form-flag gap (closed)

The short-flag-only, position-anchored regexes missed `--force`-style long
flags AND reordered short flags (`git reset -q --hard` slipped through) —
same root cause, not two bugs. Replaced with a per-clause token scan
(command split on top-level `&&`/`||`/`;`/`|`) that checks for the
relevant flag anywhere in the subcommand's argument list. Added: bare
`git checkout -f`/`--force` (tree-wide, previously unhandled) and
corrected `git restore --staged --worktree` (previously excluded by the
`--staged`-alone check even though `--worktree` makes it touch the
working tree too). Full regression matrix re-verified against a fixture
repo; no prior passing case regressed.