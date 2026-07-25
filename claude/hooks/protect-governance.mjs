#!/usr/bin/env node
/**
 * PreToolUse hook — governance file protection.
 * Blocks Edit/Write tool calls targeting governance artifacts.
 * Exit 2 = block the tool call; stderr is fed back to Claude as the reason.
 * Cross-platform: invoked as `node .../protect-governance.mjs` (Windows-safe,
 * no Git Bash dependency).
 */
import { readFileSync } from "node:fs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // Fail CLOSED: a governance guard that crashes must block, not wave through.
  process.stderr.write(
    "BLOCKED: protect-governance hook received unparseable input; " +
      "refusing the edit as a safety default.\n"
  );
  process.exit(2);
}
const filePath = String(input.tool_input?.file_path ?? "").replaceAll("\\", "/");

const PROTECTED = [
  "CLAUDE.md",
  ".claude/",
  ".agents/specs/functional_domain.md",
  ".agents/specs/initial_scaffold.md",
];

const hit = PROTECTED.find((p) => filePath.includes(p));
if (hit) {
  process.stderr.write(
    `BLOCKED: '${filePath}' matches protected governance pattern '${hit}'. ` +
      `Governance files are read-only during task execution. If a change is ` +
      `genuinely required, stop and ask the user explicitly — never self-edit ` +
      `the rulebook.\n`
  );
  process.exit(2);
}
process.exit(0);
