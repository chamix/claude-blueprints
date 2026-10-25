# ADR-017: Promote run-tests-if-src.mjs to a seed-if-missing extension point

## Status
Accepted (2026-10-25)

## Context

Surfaced incidentally while fixing GOV-DOC-001 (the `.agents/`-"git-
tracked" contradiction in `CLAUDE.md`'s Governance Integrity Rules):
`stackfold`'s `.claude/hooks/run-tests-if-src.mjs` carries a deliberate,
documented local divergence from this blueprint's upstream default. The
upstream hook tiers test runs by blast radius, assuming an Electron app
with a main↔preload↔renderer contract boundary and a three-tier
`test:unit`/`test:integration`/`test:e2e` script split in `package.json`.
`stackfold` is a plain Node CLI with none of that — no contract
boundary, no e2e suite, and exactly one test script (`"test": "vitest
run"`). Running the upstream hook as-is fails on every single edit under
`src/` or `tests/`.

`scripts/deploy.ps1`'s step 2 does a wholesale `Copy-Item claude\* -Force`
into the target's `.claude/`, with no skip-guard for anything inside that
tree. Every redeploy silently reverts `stackfold`'s override back to the
failing upstream default — the hook file's own header comment already
flagged this exact risk before this ADR existed. The workaround used
once so far (`git checkout -- .claude/hooks/run-tests-if-src.mjs` run by
hand immediately after `deploy.ps1`) is manual, easy to forget, and the
same class of problem **ADR-011** already solved for `CLAUDE.md`'s
Branching & Merge Strategy section — including the exact remedy:
fixed-pointer / seed-if-missing extension points, with `deploy.ps1`'s own
`$ExtensionPoints` comment explicitly inviting new entries to that list
"rather than inventing a new mechanism per point" (ADR-011 item 5's
stated promise).

## Decision

1. Move `claude/hooks/run-tests-if-src.mjs` out of the wholesale-copied
   `claude/` tree into `agents-templates/run-tests-if-src.mjs` — content
   unchanged, now playing the same generic-default role
   `agents-templates/branching.md` already plays for new consumer
   projects.
2. Add one entry to `deploy.ps1`'s `$ExtensionPoints` array:

   ```powershell
   @{ Template = "run-tests-if-src.mjs"; TargetRelative = ".claude\hooks\run-tests-if-src.mjs" }
   ```

   No new code — reuses the existing seed-if-missing loop verbatim.
3. Update `deploy.ps1`'s header `.DESCRIPTION` comment to list this path
   among project-specific state that is never overwritten.
4. No `CLAUDE.md` change — unlike `branching.md`, this hook has no
   in-file pointer section to replace; this is purely a deploy-mechanism
   change.

## Alternatives considered

- **Backup/restore around the wholesale copy** (capture the target's
  existing file before `Copy-Item -Force`, restore it after). Rejected:
  a bespoke mechanism duplicating exactly what ADR-011's extension-point
  loop already does more simply, for no additional benefit.
- **Leave the manual `git checkout` workaround as documented process.**
  Rejected: the same "status quo that already produced a near-miss"
  reasoning ADR-011 used for `CLAUDE.md` — a human has to remember a
  project-specific exception on every single deploy, forever.
- **Generalize now into a broader "any file can be marked
  project-ownable via a manifest/frontmatter flag" mechanism.** Rejected
  per regla de tres: exactly one real instance so far. ADR-011 item 5
  already promises the array-based mechanism generalizes without a new
  ADR once a second or third case shows up.

## Consequences

- Positive: `stackfold`'s test-tiering override survives every future
  `deploy.ps1` run without manual intervention; the `git checkout` step
  is no longer needed.
- Positive: zero new code paths — same seed-if-missing loop, one more
  array entry.
- Positive: a brand-new consumer project still gets a working default
  test-tiering hook on first deploy (seeded from `agents-templates/`,
  same initial content as before, just a different copy mechanism).
- Negative (same tradeoff ADR-011 already accepted for `branching.md`):
  a consumer that already has an *unmodified* copy of this hook — never
  customized, just deployed as-is — becomes permanently
  seed-if-missing-protected too. If this blueprint later improves the
  generic default, that project won't pick it up automatically; it has
  to delete its local copy to re-seed. No currently-deployed consumer is
  known to be in that state — `stackfold`'s is the only known deployed
  copy, and it is the customized one.
- Purely a deploy-mechanism change; `CLAUDE.md`'s prose is untouched.

## Verification

- `claude/hooks/` no longer contains `run-tests-if-src.mjs`;
  `agents-templates/run-tests-if-src.mjs` holds it, content byte-identical
  to the pre-move upstream version (moved via `cp` + `rm`, not retyped).
- `deploy.ps1`'s `$ExtensionPoints` array and header comment updated;
  PowerShell syntax not executed by a `pwsh` interpreter from this
  session (same caveat ADR-011 logged for its own deploy.ps1 change) —
  real verification is the actual `deploy.ps1 -TargetRepo
  C:\Source\stackfold` run performed in the same session, confirming (a)
  `stackfold`'s local hook override is left untouched and (b)
  `CLAUDE.md` plus the pending ADR-016 knowledge files land correctly.
  See `.agents/metrics/RUN_LOG.md` for the result.
