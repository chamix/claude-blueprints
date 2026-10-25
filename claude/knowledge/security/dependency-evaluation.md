# Dependency Evaluation Framework (Cross-Stack)

> Original content (not vendored from an externally-licensed source) —
> no CC-BY-SA header or `THIRD-PARTY-NOTICES.md` entry applies, unlike
> this directory's other two files.

Consumed as a **declared-per-task** knowledge module (ADR-006, ADR-016):
the Lead references this path whenever a task adds a new direct
dependency or replaces an existing one, for any stack. Stack-specific
tooling lives alongside its own stack (e.g. `nodejs/dependency-
evaluation.md`) — this file stays free of anything that only applies to
one ecosystem. Additive to `security/general.md`'s "Dependency hygiene"
section — read both.

## Why this exists

Popularity and familiarity are not safety signals on their own. chalk —
far more widely known than picocolors — had one of its versions
(5.6.1) compromised in the September 2025 npm supply-chain attack (the
maintainer's npm account was phished; malicious versions published that
stole credentials and hijacked cryptocurrency-wallet addresses). Several
of chalk's own transitive dependencies were compromised in the same
attack. picocolors, by contrast, ships zero dependencies of its own and
has no such history. The decisive factor was supply-chain security
history, not download counts, which were high for both. A model's
training data can be stale about exactly this kind of recent incident —
this framework exists so the check happens explicitly, against current
sources, rather than from memory.

## Gating criteria (any failure here is disqualifying on its own)

### 1. License
- MIT / Apache-2.0 / BSD: free for commercial use.
- GPL/AGPL/LGPL (copyleft): may force license obligations on code it
  links against — flag for explicit review, don't default to "it's
  fine."
- Red flag: no declared license, or a recent relicense toward more
  restrictive terms.

### 2. Supply-chain security
- Check CVE/advisory history (not just currently-open CVEs) via GitHub
  Advisory Database, Snyk Advisor, or OSV.dev.
- Check for **any historical supply-chain incident** — a compromised
  maintainer account, a malicious version ever published, typosquatting
  reports — even if since remediated. History matters more than today's
  clean slate.
- Count the package's own dependency tree. Zero or few transitive
  dependencies materially shrinks the attack surface; a large tree
  (especially one with its own history of compromised members) is a
  red flag worth weighing even without a direct incident on the
  package itself.
- Check for risky install-time behavior (`postinstall` scripts that
  fetch or execute remote code).

### 3. Maintenance activity
- Last release date — more than ~12-18 months with no release, on a
  package with real security surface, is a red flag.
- An OpenSSF Scorecard run (https://securityscorecards.dev/) or Snyk's
  maintenance classification ("Sustainable"/"Healthy" vs. "Inactive")
  gives an automated second opinion worth citing alongside manual
  checks.
- Bus factor: a single, unbacked maintainer on a widely-depended-on
  package is a real (if softer) risk signal.

## Comparative criteria (use once candidates pass the gate)

- **Adoption / de-facto standard:** download counts are a weak signal
  alone; being a transitive dependency of tier-1 tooling (e.g. a build
  tool, framework, or widely-used library) is stronger corroboration.
- **Technical quality:** native types or well-maintained type
  definitions, visible/passing CI, reasonable bundle/footprint size,
  real documentation and changelog.
- **API stability:** adherence to SemVer, frequency and clarity of
  breaking changes, supported runtime version range.
- **Community/governance:** foundation backing (OpenJS, Apache, CNCF),
  a `SECURITY.md` with a responsible-disclosure process.

## Automatic disqualifiers

- Undeclared license, or one incompatible with the project's own
  license with no clear legal exception.
- A confirmed supply-chain incident with no remediation or changed
  practice since (no maintainer rotation, no enforced 2FA, etc.).
- An open critical/high CVE with no patch or workaround.
- No release in 18+ months on a package with real security surface.
- Install-time scripts that fetch/execute code from unverifiable
  sources.

## Process

1. Name 2-4 real candidates — don't evaluate in a vacuum.
2. Apply the three gating criteria to each; discard any that fail a
   disqualifier.
3. Score survivors on the comparative criteria.
4. Verify with actual current tooling (this framework's stack-specific
   file) — do not rely on trained-in memory for CVE/incident history;
   it can be stale about exactly the events that matter most.
5. State which criterion was decisive, not just the final pick.

## Decision-matrix template

| Criterion | Weight | Candidate A | Candidate B |
|---|---|---|---|
| License compatible | Gate | | |
| No supply-chain incident history | Gate | | |
| Maintained (release < ~18mo) | Gate | | |
| Own dependency count | High | | |
| Adoption / tier-1 usage | Medium | | |
| OpenSSF Scorecard | High | | |
| Types / tests / docs | Medium | | |
| API stability (SemVer) | Medium | | |
| Institutional backing | Low | | |

## Worked example: picocolors vs. chalk (Node.js)

chalk was discarded despite greater historical recognition: version
5.6.1 was one of ~25 packages compromised in the September 2025 npm
supply-chain attack — the maintainer's account was phished and
malicious versions published that stole data and hijacked crypto-wallet
addresses. The same attack hit several of chalk's own dependencies
(`ansi-styles`, `strip-ansi`, `wrap-ansi`, `supports-color`, `debug`,
`color-convert`) — the whole dependency tree carries that history, not
just the root package.

picocolors was chosen instead: zero dependencies of its own, no known
incidents, Snyk-classified "Sustainable," and a de-facto standard as a
transitive dependency of Vite, PostCSS, Next.js, and TypeScript tooling
— stronger adoption evidence than raw download counts, which were high
for both packages. Both are MIT-licensed; licensing was not the
deciding factor here. Supply-chain security history was.
