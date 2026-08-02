# ADR-002: Recursive glob support in enforce-scope.mjs, and an accepted gap in Bash coverage

## Status
Accepted

## Context
`enforce-scope.mjs` matched `current_scope.json`'s `in_scope` entries via
exact string equality only. A pattern like `"tests/e2e/**"` — intended as
a directory grant — never matched any real file path, so any scope
contract using a glob-style entry silently granted nothing. Discovered
during md-view Task 6: the Lead's own scope contract for new e2e test
files was effectively empty, blocking the engineer until manually
amended with literal per-file paths.

While investigating, a second, more serious gap surfaced: the hook only
inspects `Edit`/`Write` tool calls (`tool_input.file_path`). It has no
visibility into the `Bash` tool at all. A subagent writing a file via
Bash (redirection, `cp`, `tee`, etc.) bypasses scope enforcement
entirely, silently. This is how `.agents/specs/backlog.md` reached disk
during Task 6 — an out-of-grant file, undetected by the hook, only
caught because the `code-reviewer` independently ran `git status` as
part of its own verification discipline, not because any preventive
control stopped it.

## Decision
1. Add minimal support for a trailing `/**` pattern (recursive directory
   match, any depth including direct children). No new dependency —
   same minimal hand-rolled matcher philosophy as
   `protect-governance.mjs`. Only the one pattern shape actually in use
   is implemented; a single-level `*` wildcard is intentionally not
   supported until something actually needs it.
2. Do **not** attempt to extend coverage to the `Bash` tool at this
   time. Reliably detecting file-write side effects from an arbitrary
   shell command is not a well-bounded problem — there are too many
   ways to write a file (`>`, `>>`, `cp`, `mv`, `tee`, pipes, subshells)
   to cover with a heuristic and trust the result. A rushed fix here
   would produce false confidence — appearing covered while still
   leaving real gaps — which is worse than an honestly documented
   limitation.
3. Document the gap explicitly (CLAUDE.md and this ADR) rather than
   pretend it's closed. The de facto backstop for Bash-issued
   out-of-scope writes is the `code-reviewer`'s independent `git status`
   check — already standard practice, and already proven effective:
   it's literally how this gap was caught.
4. Backlog entries: `.agents/specs/backlog.md` is Lead-authored only.
   An engineer who finds a backlog-worthy concern reports it in their
   close-out, and the Lead transcribes it deliberately — not a new
   enforcement mechanism, just a stated convention, since the hook gap
   above means this can't be enforced today anyway.

## Alternatives considered
- Parse `Bash` tool_input.command with regex heuristics for common
  write patterns (`>`, `cp`, `mv`, `tee`, ...) and block on match.
  Rejected: inevitably incomplete, and an incomplete preventive control
  disguised as a complete one is a worse failure mode than a documented
  gap — it stops people from double-checking.
- Add a general glob-matching dependency (`minimatch`/`picomatch`) for
  full glob support. Rejected: the project's zero-unnecessary-
  dependency stance, and only one pattern shape is actually in use
  today — same reasoning `protect-governance.mjs` already established.
- Block the `Bash` tool entirely whenever a scope contract is active.
  Rejected: would break read-only operations engineers and reviewers
  already rely on within a governed task (`git status`, `git diff`,
  `npm test`, ...) — too broad a restriction for a narrow risk.

## Consequences
- Directory-style grants (`"tests/e2e/**"`) in `current_scope.json` now
  work as originally intended; the literal-path-listing workaround is
  no longer needed for new scope contracts.
- `enforce-scope.mjs` remains, explicitly, an `Edit`/`Write`-only
  preventive control. Bash-issued writes are not preventively enforced.
  The reviewer's independent `git status` verification is the
  documented, load-bearing backstop for this specific gap — not a
  preventive control in itself, and every future task should keep
  relying on it for this reason, not treat it as optional diligence.
  