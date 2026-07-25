# Step 0 & Step 1 Document Spec: User Documentation Audit & Upgrades (v3)

This document formalizes the documentation audit and updates retroactively executed for the root `README.md` to support the multi-file, glob, and directory processing features.

---

## 1. Documentation Audit Details

An ad-hoc audit was executed on the existing repository documentation to ensure maximum clarity, proper formatting, and style guide alignment.

### Evaluated Criteria
- **The Storefront Rule**: Checked that the README quickly details the project's purpose clearly and is free of vague marketing fluff (e.g. avoiding "simply", "just", "easily").
- **Diátaxis Compliance**: Ensure clear separation of Tutorials (Quick Start), How-To Guides (Multi-File & Directory Guide), and Reference (CLI, Telemetry, Architecture, Testing).
- **GitLab Style Guide**: Ensured neutral, technical tone, clear parallel list styling, and single H1 header constraints.
- **Single H1 Boundary**: Validated that there is exactly one top-level H1 header (`# json-mapper`) in the root `README.md`.

---

## 2. README.md Updates

The following key sections were upgraded in the root `README.md`:

### A. CLI Options Reference Table
Updated options to include the upgraded input capabilities and the new topology configuration:
- Upgraded description of `-i, --input <path>` to detail directory and wildcard glob patterns.
- Upgraded description of `-o, --output <path>` to accept file or directory paths.
- Added `-m, --mode <mode>` (default `1:1`) to specify target mapping topologies.

### B. Multi-File & Directory Processing Guide (How-To Examples)
Added concrete shell-executable examples for the two mode configurations:
1. **1-to-1 Mapping**: Example detailing directory-to-directory processing where inputs `data/inputs/users_us.json` and `data/inputs/users_eu.json` map respectively inside `data/outputs/`.
2. **Many-to-1 Mapping**: Example detailing glob pattern mapping where files matching `"data/inputs/*.json"` merge into a single target file `data/merged.json`.

### C. Telemetry Metrics Payload Update
Documented the expanded pino structured metric event (`mapping_execution_telemetry`), outlining the exact aggregate fields and describing their roles:
- `durationUs`: High-precision microsecond execution time.
- `processedFileCount`: Total files processed in the batch execution.
- `aggregateObjectCount`: Total JSON records compiled and transformed.
- `mode`: Active topology mode (`1:1` or `many:1`).
- Included explanation for retained fields (`durationMs`, `recordCount`, `inputFile`, `outputFile`) ensuring backward-compatible integrations.

---

## 3. Compliance and Test Execution

We executed the entire automated test runner suite to verify that no structural formatting rules were broken. The test execution was completed with zero warnings and all tests green:

```bash
npm test
```
Result: **43 passing tests**.
