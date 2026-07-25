---
command: /audit-docs
description: Executes an ad-hoc quality and compliance audit over repository documentation using GitHub Docs-as-Code standards.
persona: .agents/skills/technical-writer/SKILL.md
---

/mention @Technical Writer

Please perform an immediate, comprehensive audit of all user-facing and technical documentation within this repository (specifically the root `README.md` and any files inside `.agents/specs/`).

Execute your analysis against your foundational guidelines:
1. The Storefront Rule: Ensure the README is highly concise, introduces the project's exact purpose, and is 100% free of vague fluff words (e.g., "simply", "just", "easily").
2. Diátaxis System Compliance: Verify that documentation clearly separates Tutorials, How-To Guides, Technical References, and Explanations.
3. Typography & Formatting: Check for single H1 page boundaries, parallel dashed list items, and ensure code snippets are 100% copy-pasteable and wrapped in proper language syntax blocks.

Output:
Generate a comprehensive evaluation report and save it to `.agents/specs/documentation_audit_report.md`. Detail any style violations, layout deficiencies, or broken command examples. Do not modify the source documentation files yet; present the audit summary to the user first.
