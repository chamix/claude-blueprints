# ADR-003: Self-exemption for `current_scope.json` in enforce-scope.mjs

## Status
Accepted

## Context
`enforce-scope.mjs` blocks `Edit`/`Write` calls to any path not listed in
`current_scope.json`'s `in_scope` array while a contract is active. The
manifest itself was never exempted from this check — editing
`.agents/current_scope.json` to amend scope was therefore blocked by the
very file that defines what's allowed, unless `in_scope` happened to
already list itself, which no task's contract ever did.

This surfaced repeatedly, in a worsening pattern, across three md-view
tasks:

- **Task 6**: the Lead needed to amend scope mid-task (a glob-matching
  bug, since fixed in ADR-002, meant a directory-style grant matched
  nothing). The amendment itself required editing the manifest, which the
  hook blocked. Worked around via `Bash` instead of `Edit`/`Write` — which
  the hook doesn't cover at all (ADR-002's second, separate finding) — an
  unintentional exploitation of one gap to route around another.
- **Task 7**: recurred at contract close-out, when the Lead needed to
  write `RUN_LOG.md`/the review report while `current_scope.json` still
  existed. Resolved by deleting the manifest first (no manifest = no
  restriction, per the hook's own first check), then writing the
  close-out files, matching the order the hook's design already implies.
- **Task 9**: identical recurrence, identical workaround. Three
  occurrences of the same manual dance, each independently discovered
  rather than treated as standing procedure, is the trigger for this ADR
  — per this project's own drift-flagging discipline (`RUN_LOG.md`), a
  repeated pattern warrants a real decision, not a fourth deferral.

The Task 7/9 workaround — delete the whole manifest to make one edit
possible — is broader than the problem requires: for however long the
manifest is absent, enforcement is off for **every** file, not just
`current_scope.json`. That's a wider bypass surface than a fix scoped to
the one file that actually needs it.

## Decision
Add a single self-exemption check to `enforce-scope.mjs`: if the
normalized relative path being edited is exactly
`.agents/current_scope.json`, allow it (`process.exit(0)`) regardless of
whether a contract is active or what `in_scope` contains. Placed
immediately after the path is normalized, before the manifest is parsed
or matched against `in_scope`.

This does not weaken the boundary the hook exists to enforce. The
behavioral rule — only the Lead, with user awareness, amends scope; a
`full-stack-engineer` subagent that thinks it needs to must stop and
report back rather than self-amend — is stated in
`claude/agents/full-stack-engineer.md` and was never something this hook
enforced on its own in the first place; it enforced *which files an
already-scoped agent could touch*, not *who is allowed to touch the
scope-defining file*. A subagent that ignored its own instructions and
edited `current_scope.json` directly would leave that edit sitting in
`git status` — exactly the kind of unexpected change the `code-reviewer`'s
independent `git status`/diff check already looks for as a matter of
course (this is precisely how Task 9's own N-1 nit — a stale manifest
still on disk at review time — was caught). Same backstop pattern already
accepted for the Bash gap in ADR-002: not a preventive control, a
detective one, and already proven to work.

Net effect versus the status quo: this narrows the bypass window from
"every file, for as long as the manifest is deleted" to "exactly one
file, always" — a strictly smaller surface, not a larger one.

## Alternatives considered
- **Leave the hook as-is; formalize "delete the manifest before
  close-out writes" as documented standing procedure instead of a code
  fix.** Rejected: zero engineering cost, but three independent
  discoveries of the same workaround shows documentation alone isn't
  surfacing it reliably — each task re-derived it rather than looking it
  up. A structural fix removes the need to remember the order at all.
- **Gate the exemption on some caller-identity signal (e.g., an
  environment variable set only when the Lead — not a delegated subagent
  — invokes the edit), so the hook itself enforces the *who*, not just
  the *what*.** Rejected for now: `enforce-scope.mjs`'s only input is the
  tool call itself (`input.tool_input`, `input.cwd`); there's no
  caller-identity field available to key off, and fabricating one (e.g.
  a subagent-settable env var) would be trivially self-defeating — a
  subagent could set it too. Worth revisiting only if Claude Code
  exposes a real identity signal to hooks in the future; not worth
  inventing a fragile one now.
- **Blanket-relax `enforce-scope.mjs` to allow any edit to any file
  under `.agents/**` while a contract is active**, reasoning that
  governance-adjacent bookkeeping files are lower-risk than source. 
  Rejected: far broader than the actual friction point (only
  `current_scope.json` itself has ever caused this problem — 
  `backlog.md`, `RUN_LOG.md`, and review reports have their own
  Lead-authored/append-only conventions already, and weakening
  enforcement across all of `.agents/**` would blunt the hook's coverage
  of `.agents/specs/**` for no demonstrated need.
- **Extend hook coverage to the `Bash` tool at the same time**, since
  it's the same class of problem (a gap in what the hook can see).
  Rejected: out of scope for this ADR — ADR-002 already examined this
  specific question in depth and rejected it as not well-bounded. Nothing
  about this fix changes that reasoning; conflating the two would revisit
  a settled decision without new information.

## Consequences
- `current_scope.json` can be amended or deleted at any point in a
  task's lifecycle — mid-task scope amendments and close-out writes no
  longer require first disabling enforcement for every other file.
- The Task 7/Task 9 "delete manifest before Step 3 writes" workaround is
  no longer necessary, though deleting the manifest at contract close
  remains correct practice for its original purpose (signaling the
  contract is closed), not as a means of unblocking unrelated writes.
- The hook's enforcement of *who* may amend scope remains entirely
  behavioral (agent instructions + reviewer `git status` review), not
  technical — unchanged from today. This ADR closes the friction gap, not
  a security gap; no new preventive control is introduced or claimed.
- Must be ported to `md-view`'s `.claude/hooks/enforce-scope.mjs` copy
  after landing here, per this repo's role as source of truth — not
  applied to the deployed copy directly.