# Third-Party Notices

This repository is MIT-licensed (`LICENSE`). Some knowledge modules under
`claude/knowledge/` are curated extracts derived from externally-licensed
sources and retain that source's license — they are not covered by this
repo's MIT license. See ADR-006 (`docs/decisions/`) for the design
decision that introduced this convention.

---

## claude/knowledge/security/general.md

- **Source:** [goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices), security section
- **Source license:** CC-BY-SA-4.0
- **Nature of use:** curated, reworded extract of general security
  principles (secrets management, password storage, input validation,
  transport security, rate limiting, dependency hygiene, logging) — not
  a verbatim copy. Cross-referenced against the OWASP Top 10.
- **File license:** CC-BY-SA-4.0 (inherited per share-alike terms)

## claude/knowledge/nodejs/security.md

- **Source:** [goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices), security section
- **Source license:** CC-BY-SA-4.0
- **Nature of use:** curated, reworded extract of Node.js-specific
  security practices (dependency-audit tooling, HTTP middleware
  hardening, untrusted-code sandboxing, environment configuration) — not
  a verbatim copy.
- **File license:** CC-BY-SA-4.0 (inherited per share-alike terms)

---

Any future knowledge module vendored from an externally-licensed source
must be added here at the time it's added under `claude/knowledge/`, per
ADR-006's Consequences section. This file is Lead-authored, same
discipline as `.agents/specs/backlog.md` under ADR-002 — not something a
hook enforces.
