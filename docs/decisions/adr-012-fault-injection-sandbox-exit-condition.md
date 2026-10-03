# ADR-012: Exit condition for sandbox-blocked fault-injection in code-reviewer

## Status
Accepted (2026-10-03) — drafted by the Lead from
`.agents/handoff-review-wallclock.md`, an external handoff documenting a
real (not hypothetical) incident from `stackfold`'s Cycle B1 review round.
Approved by Camilo as drafted, same session. Implemented the same day:
`claude/agents/code-reviewer.md` (Evidence Requirements item 5 gains the
sandbox-denial exit condition, network-gated-test guidance, and
delegated-confirmation recommendation bullets); `CLAUDE.md` Step 2.5
(new item 5, the D3 delegated-confirmation option).

## Context

Comparing `stackfold`'s Cycle B1 delegation round against its review round
(same task — build pipeline/packaging/placeholder renderer for the
`electron-ts` plugin), *(verified, from `stackfold/.agents/specs/review_report.md`
and `stackfold/.agents/metrics/RUN_LOG.md`, 2026-10-03)*:

| | Tokens | Wall-clock |
| --- | --- | --- |
| `full-stack-engineer` (implementation) | ~145.8k | ~12m |
| `code-reviewer` (review) | ~80.9k | ~61m 49s |

Fewer tokens, ~5x the wall-clock — the signature of time lost waiting on
real processes that fail or are slow, not of extra reasoning or text
generation (which would show up as proportionally higher token use).

`review_report.md` documents the cause directly, without the Lead having
to infer it. Two distinct causes compounded:

1. **The specific Tier-4 test does a real `npm install` against the npm
   registry** (a deliberate design choice from that session, to genuinely
   prove the build produces the expected artifacts). Unlike the other
   three tiers (in-memory, seconds), this one runs in minutes by design.
2. **The reviewer's fault-injection attempt was denied by the Claude Code
   harness's own sandbox auto-approval classifier** when it tried to
   mutate a generated file — *despite* `code-reviewer.md` already
   prescribing exactly the right technique to avoid `guard-destructive-git.mjs`
   (captured-patch + `git apply -R`/`git apply`, ADR-005, lines 44-49).
   This is not a `guard-destructive-git.mjs` or `protect-governance.mjs`
   bug (the ones ADR-008 fixed) — it's a different, higher layer: the
   harness sandbox, which `code-reviewer.md`'s protocol has no exit
   condition for. The reviewer did not misbehave: it followed the
   protocol, hit a block the protocol doesn't name, tried every
   alternate route it could find, failed all of them, and correctly
   reported the limitation and substituted static verification instead
   of fabricating a RED/GREEN result it hadn't actually observed.

The report states the reviewer "intenté cada ruta alternativa" after the
first denial — and each attempt against a test that itself runs a real
`npm install` re-pays that cost on every retry, which is what inflates
wall-clock without inflating tokens proportionally (handoff §3).

What the current protocol already does right, and this ADR does not
revisit: `code-reviewer.md` line 43 already explains *why*
fault-injection isn't optional (the ADR-010 test-authorship-integrity
backstop), and lines 44-49 already prescribe the correct technique
against `guard-destructive-git.mjs`. The gap is narrower: no stated
behavior for "the correct technique is itself blocked by a layer above
the project's own hooks."

The handoff frames three decisions as open (D1, D2, D3). This ADR records
the Lead's recommended resolution of each, for Camilo's approval.

## Decision

**D1 — adopt both (a) and (c), per the handoff's own observation that
they attack different causes and aren't exclusive:**

1. **(a) First-attempt exit condition, worded generically rather than
   scoped to generated artifacts (resolves D2 toward the broader
   reading):** if the prescribed patch technique
   (`git diff -- <file> > /tmp/<name>.diff` + `git apply -R` / `git apply`)
   is denied by the harness sandbox's auto-approval classifier on the
   **first attempt**, the reviewer stops immediately — no alternate
   routes, no retries — reports the limitation explicitly in
   `review_report.md`, and substitutes **static verification**: read the
   causal path by hand, trace why the specific hunk under test produces
   the claimed behavior, and cite the exact lines that would have to
   change for the test to go RED, in place of an observed RED/GREEN pair.
   Reasoning for the generic wording over a narrower "generated artifacts
   only" rule: the sandbox classifier's block is a property of the
   harness layer, orthogonal to whether the mutated file happens to be
   `mkdtemp` output or a tracked repo file. A rule scoped to generated
   artifacts would silently under-cover the identical block occurring on
   a tracked file, which is the more common fault-injection target
   day-to-day. The generic version is also simpler to state and verify.
2. **(c) Network-gated/slow tests never get *live* fault-injection
   attempted at all**, scoped specifically to tests the reviewer can
   identify as doing real network I/O or an equivalent slow operation by
   design (e.g. a real `npm install`, not an in-memory or `tsc --noEmit`
   check). For these, the reviewer defaults directly to static
   verification plus **one** real, non-mutating run to confirm the test
   currently passes — never a mutate/observe/restore cycle. This
   addresses cause #1 (the test is slow by design) independently of
   whether the sandbox would have blocked the mutation at all.

**D2 — resolved by D1(a)'s generic wording above**, not as a separate
rule: the sandbox-denial exit condition is "any fault-injection denied by
the harness sandbox," not "fault-injection on generated artifacts
specifically." D1(c) already carries the narrower, test-speed-based scope
where one is actually needed.

**D3 — add the delegated-confirmation path as an available, non-mandatory
option in `CLAUDE.md` Step 2.5**, per the reviewer's own report
("if the Lead considers that live confirmation essential before
sign-off, it needs to happen through a route this subagent doesn't
have"): when a reviewer's static-verification substitute (from D1a or
D1c) leaves the Lead judging live RED/GREEN confirmation as essential
before sign-off, the Lead may route a narrowly-scoped follow-up task to
`full-stack-engineer` (which holds Edit/Write) asking it to perform the
described revert/restore itself and report both raw outputs. This is an
option the Lead exercises by judgment, not a new mandatory step — most
static-verification substitutes will not warrant the extra round-trip.

### Where the change lands

- `claude/agents/code-reviewer.md`, Evidence Requirements item 5 (lines
  43-49): add the D1(a) exit condition as a new bullet immediately after
  the existing patch-technique bullets, and the D1(c) network-gated-test
  guidance as a sibling bullet.
- `CLAUDE.md` Step 2.5: add the D3 delegated-confirmation option as an
  explicit, named escalation path — the current text has no language for
  "the reviewer couldn't confirm live; here's the route if the Lead
  decides it's needed."
- No hook changes. Confirmed in the handoff and re-confirmed here: this
  is a harness-level limit, not a `guard-destructive-git.mjs` or
  `protect-governance.mjs` gap — nothing in ADR-005/ADR-008's territory
  is touched.

## Alternatives considered

- **(b) Leave it to reviewer judgment, as happened this time.** Rejected
  as the sole answer: it worked, but cost ~60 real minutes on a single
  task and gives every future reviewer the same expensive discovery to
  make from scratch. Documenting the exit condition converts a one-time
  correct judgment call into a standing, cheap default.
- **Scope D1(a) narrowly to "mutations of generated/temp-directory
  content only."** Rejected — see D1(a)'s reasoning above: the sandbox
  block is about the harness layer, not the file's provenance, and a
  narrow rule would miss the same block on a tracked-file fault
  injection, arguably the more common case.
- **(c)-only, i.e. ban live fault-injection for network-gated tests but
  say nothing about sandbox-blocked attempts on other tests.** Rejected:
  leaves cause #2 (the sandbox block itself, independent of test speed)
  completely undocumented, which is the cause that actually produced
  most of the ~60 minutes here (repeated alternate-route attempts, not
  the `npm install` itself).
- **Make D3's delegated-confirmation route mandatory whenever a
  static-verification substitute is used.** Rejected: that reintroduces
  a full engineer round-trip on every sandbox-blocked or network-gated
  case, which is close to the same cost problem this ADR exists to
  reduce. Leaving it as Lead judgment matches how the rest of Step 2.5's
  escalation decisions already work (e.g. routing Blocking items back as
  a new task).

## Consequences

- A sandbox-blocked fault-injection attempt now costs one denied attempt
  plus a static-verification pass, not an unbounded search over alternate
  routes — directly targets the ~60-minute cost observed in the
  triggering incident.
- Static verification is a strictly weaker guarantee than an observed
  RED/GREEN pair for the ADR-010 test-authorship-integrity backstop. This
  ADR accepts that trade explicitly, the same way ADR-007 explicitly
  accepted `fast-iteration`'s weaker review coverage — it does not pretend
  static verification is equivalent, and D3 exists precisely as the
  escalation path for when that weaker guarantee isn't good enough for a
  specific task.
- Depends on the reviewer honestly reporting a first-attempt denial
  rather than silently skipping fault-injection and claiming static
  verification was the plan all along. No new hook enforces this — same
  self-report-plus-transparency posture ADR-010 already relies on for its
  own disclosure requirement.
- Must be ported to `stackfold`'s deployed copy (the project that
  surfaced this) and any other consumer once accepted, same dependency
  ordering as ADR-006/007/009/010/011.

## Follow-ups (post-acceptance)

- Camilo's approval and the implementation both landed 2026-10-03 —
  insertion points in `code-reviewer.md` and `CLAUDE.md` were
  re-confirmed against current on-disk text before editing, per the
  re-confirm discipline ADR-007/010/011 established.
- Handoff §7 (three separate incidents of environment/tooling friction
  discovered after the fact across `stackfold`'s lifecycle — hardcoded
  script names, wrong-platform `node_modules`, and this one) is
  explicitly out of scope for this ADR per the handoff's own note, but is
  recorded as a backlog entry (see `.agents/specs/backlog.md`) so the
  "catalog these as a class" idea isn't lost before someone picks it up.
- Must be ported to `stackfold`'s own deployed copy after acceptance,
  same as every prior ADR touching `code-reviewer.md`/`CLAUDE.md`.
