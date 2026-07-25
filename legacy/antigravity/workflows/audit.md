---
name: /audit-design
description: Audits the active directory against Clean Architecture rules, SOLID principles, and GoF design patterns. Run by the independent code-reviewer, not the Lead Architect, to avoid grading your own homework.
---

# Workflow: Architectural Compliance Audit

/mention @Code Reviewer

When this command is triggered, the `code-reviewer` persona executes the following steps inside the sandbox — not the Lead Architect, since the Lead Architect authored the rules being checked against:

1.  **Codebase Scan:** Analyze all recently modified source files or files currently sitting in the git staging area.
2.  **Bibliographic Assessment:** Cross-reference the discovered file structures, class declarations, and architectural boundaries against the guidelines established in `AGENTS.md`:
    * *Clean Architecture Check:* Are dependencies pointing strictly inward? Are framework leaks present in the domain?
    * *S.O.L.I.D. Verification:* Are there long classes breaking SRP? Are modules tightly coupled instead of relying on DIP abstractions?
    * *GoF Pattern Review:* Is structural complexity handled with appropriate reusable design patterns?
3.  **Output Compilation:** Generate a clean, interactive Markdown report directly in the chat panel with the following headings:
    * **Compliant Areas:** Where the code successfully hits our engineering standards.
    * **Architectural Risks & Violations:** Clear callouts of coupling, breaking boundaries, or pattern mismatches.
    * **Refactoring Strategy:** Practical, step-by-step code samples showing exactly how to refactor those specific files to be fully compliant.
