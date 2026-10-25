# Dependency Evaluation — Node.js/npm Tooling

Additive to `claude/knowledge/security/dependency-evaluation.md` — read
both. This file holds only the npm/Node-specific tooling for the
framework's gating and comparative checks; the criteria themselves live
in the cross-stack file.

## Tooling by criterion

| Need | Tool |
|---|---|
| Known CVEs/advisories | `npm audit`; Snyk Advisor; GitHub Advisory Database; OSV.dev |
| Suspicious package behavior (obfuscation, install-time exfiltration) | Socket.dev |
| Maintenance health / Scorecard | Snyk Advisor's maintenance classification; `npx @ossf/scorecard` or https://securityscorecards.dev/ |
| Download/adoption volume | npm trends (npmtrends.com); `npm view <pkg> downloads` |
| Transitive dependency count | `npm ls <pkg> --all` or `npm info <pkg> dependencies` |
| License | `license-checker` (`npx license-checker --packages <pkg>`), or the package's own `LICENSE`/`package.json` `license` field |

## Practical checks before adding a dependency

```bash
# license + dependency count, fast
npm info <candidate> license dependencies

# published versions and release cadence
npm view <candidate> time --json

# audit the current lockfile state (run after adding, before committing)
npm audit
```

Cross-reference the result against `security/dependency-evaluation.md`'s
gating criteria explicitly — a clean `npm audit` today says nothing
about historical incidents on compromised-and-since-patched versions;
check Snyk Advisor or the GitHub Advisory Database for that.

## Worked example: picocolors vs. chalk

See `security/dependency-evaluation.md`'s worked example for the full
reasoning. The Node-specific commands that produced the comparison:

```bash
npm info picocolors dependencies   # {} -- zero dependencies
npm info chalk dependencies        # ansi-styles, supports-color, ...
```

Zero transitive dependencies was the single strongest tooling signal —
it's also, independently, why picocolors had nothing in its own tree
exposed to the September 2025 attack, unlike chalk.
