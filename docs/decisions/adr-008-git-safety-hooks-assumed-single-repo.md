# ADR-008: git-safety hooks assumed a single repo — nested governance repo blindness and RUN_LOG.md gap

## Status
Accepted

## Context

`guard-destructive-git.mjs` (ADR-005) and `protect-governance.mjs`
(ADR-001) were both written assuming this repository is a single git
repo. That assumption broke the day a consumer project actually adopted
the privacy pattern this project's own extraction work had proposed:
`.agents/` excluded from the outer repo via `.git/info/exclude` (not
`.gitignore` — no trace in the public repo's history) and, separately,
turned into its **own** nested git repo with its own remote, for backup
and history of the governance layer without public exposure. That
pattern is documented as SK-ADR-004 in the consuming project
(`md-presenter`/`stackfold`'s skeleton extraction), which explicitly
flagged as an outstanding, blocking, unverified assumption: *"guard-
destructive-git.mjs and protect-governance.mjs were built assuming a
single git repo. Their behavior against a nested git repository at
`.agents/` has not been verified and is not safe to assume."*

### Discovery (spike on `stackfold`)

Ran the deferred verification directly, rather than continuing to treat
it as an open question:

1. Deployed this project onto `stackfold` (`deploy.ps1`), applied
   SK-ADR-004's A+C mechanism (`.git/info/exclude` + `.agents/` as its
   own nested repo with a private GitHub remote), confirmed both repos
   coexist cleanly (`git status` clean in each, no cross-contamination).
2. Made an uncommitted change inside the nested `.agents/` repo
   (`metrics/RUN_LOG.md`).
3. Simulated `guard-destructive-git.mjs`'s exact invocation (`CLAUDE_
   PROJECT_DIR` set to the outer repo root, matching how Claude Code
   actually invokes it) against two commands that should have been
   blocked: `git checkout -- .agents/metrics/RUN_LOG.md` and `cd .agents
   && git reset --hard`. **Both returned exit 0 (allowed).**
4. Confirmed this wasn't a simulation artifact by actually running the
   `reset --hard` for real: the uncommitted line was destroyed.

Root cause: every dirty-state check in `guard-destructive-git.mjs` ran
with `cwd: projectDir` (`CLAUDE_PROJECT_DIR`, the outer repo), regardless
of the command's actual target or any `cd` inside the command text. The
outer repo has no knowledge of an excluded nested repo's tracked
content, so `git diff --quiet HEAD` / `git status --porcelain` against
it always came back clean — the guard was checking the wrong repository
entirely, not failing to detect dirt within the right one.

### Second, unrelated finding from the same spike

While probing the same scenario, also tested `protect-governance.mjs`
against a direct `Edit` on `.agents/metrics/RUN_LOG.md` — also exit 0
(allowed). This gap is **independent of nesting**: `RUN_LOG.md` was
never in `ALWAYS_PROTECTED` in the first place, in any project, nested
or not. `CLAUDE.md` and `log-run.md` both document it as append-only
("never rewrite or delete prior rows"), but nothing enforced that
invariant against a plain Edit/Write call.

## Decision

**`guard-destructive-git.mjs` (v4):** track `cd <path>` clauses to know
the command's effective cwd, resolve the verdict's target to an absolute
path from that cwd (not always `projectDir`), then walk up from the
resolved path to find the **nearest enclosing git repo** (a directory
containing `.git`) and run the dirty check there, with the target
expressed relative to that repo's root. This handles both the `cd
.agents && ...` case and the no-`cd`, path-argument case (`git checkout
-- .agents/...`) through the same mechanism, since both are driven by
the resolved target path rather than by cwd-tracking alone. Tree-wide
verdicts (`reset --hard`, `clean -f`) check the *whole* enclosing repo,
matching actual git semantics — these commands are never scoped to a
subdirectory regardless of cwd.

**`protect-governance.mjs` (v4):** add `RUN_LOG.md` protection, but as
content-based enforcement, not a blanket path block — a new row
legitimately lands via `/log-run` on every task close, so blocking all
Edit/Write on the path would break the documented workflow. `Write`
(whole-file overwrite) is always rejected: there's no legitimate reason
an append-only log needs a full-file rewrite. `Edit` is allowed only
when `old_string` is an exact suffix of the file's *current* content and
`new_string` strictly extends it (starts with that same `old_string`) —
enforcing "append-only" against actual file content, not against how the
caller frames the edit.

### Deliberately left open, not decided here

Whether other single-repo assumptions exist elsewhere in this project's
hooks (`enforce-scope.mjs` was not re-audited as part of this pass) is
not resolved here — this ADR closes the two gaps a real spike actually
surfaced, not a general audit of every hook against nested repos.

## Consequences

- Positive: closes a real, empirically-confirmed data-loss path — not a
  theoretical one. The spike destroyed real (test) content before the
  fix, and the same command was correctly blocked after it.
- Positive: `RUN_LOG.md`'s append-only invariant is now actually
  enforced, independent of nesting — this gap existed in every project
  using this system, not just ones with a nested governance repo.
- Positive: fixed once, upstream, in the source tree — propagates to
  every consumer project's next `deploy.ps1` run rather than needing a
  per-project patch (`stackfold`'s deployed copy was hand-verified
  identical to source before the fix, and updated in place after).
- Negative: `guard-destructive-git.mjs` is now meaningfully more complex
  (repo-boundary walk-up, effective-cwd tracking) — more surface for a
  future edge case, though the added logic is narrowly scoped to path
  resolution, not to the destructive-command detection itself.
- Negative: the `cd`-tracking is still a plain token scan, not a shell
  parser (consistent with this hook's existing accepted-gap posture —
  see ADR-002, ADR-005) — quoting, variable expansion, and subshells in
  a `cd` argument aren't resolved.
- Open: whether `enforce-scope.mjs` or other hooks have the same
  single-repo assumption is unaudited.

## Verification

Run by hand against the real `stackfold` deployment (a live consumer
project with the actual nested-repo layout), not a synthetic fixture —
this needed the real A+C structure to reproduce, not an approximation of
it.

- Reproduced both failing scenarios exactly as they'd occur in practice:
  `git checkout -- .agents/metrics/RUN_LOG.md` and `cd .agents && git
  reset --hard`, both with real uncommitted content in the nested repo.
  Confirmed exit 0 (allowed) on the pre-fix hook; confirmed the second
  one actually destroys the change when run for real.
- Post-fix: both scenarios now block (exit 2), with the message
  correctly identifying the nested repo by relative path (e.g. "nested
  repo at '.agents'").
- Regression check: recreated a dirty, *non-nested* file at the outer
  repo root (`src/core/types.ts`) and confirmed `git checkout --
  src/core/types.ts` still blocks when dirty and still allows when
  clean — the fix doesn't change behavior for the common, non-nested
  case.
- `protect-governance.mjs`: confirmed a `Write` call to `RUN_LOG.md`
  blocks; confirmed an `Edit` that rewrites an earlier row (changes the
  table header) blocks; confirmed a real, file-content-derived append
  (old_string = actual current file tail, new_string = that tail plus a
  new row) is allowed. First attempt at the positive case produced a
  false block — traced to the test harness capturing the "current tail"
  through a shell command substitution that silently strips trailing
  newlines, making the captured string not a true suffix of the real
  file; re-tested reading the file's actual bytes directly, which passed
  the append-only check as expected. Not a hook bug — noted here so a
  future re-verification doesn't waste time on the same false lead.
