#!/usr/bin/env node
/**
 * PreToolUse hook — destructive-git-command guard.
 * Blocks Bash calls that would discard uncommitted work via a whole-file
 * or whole-tree git revert (`git checkout -- <path>`, `git restore
 * <path>` without `--staged`, `git reset --hard`, `git clean -f`/`-fd`).
 *
 * Root cause this closes: code-reviewer holds no Edit/Write tools "by
 * design" (code-reviewer.md), but its `tools:` frontmatter still grants
 * bare `Bash`, which achieves the same write effect via `sed -i`,
 * heredocs, `git apply`, etc. — including git commands that snap a file
 * back to HEAD, silently discarding uncommitted changes made by a
 * DIFFERENT actor earlier in the same session (see ADR-005). This is
 * distinct from ADR-002's gap: ADR-002 covers Bash writes bypassing
 * scope-EXPANSION checks; this covers Bash DESTROYING already-legitimate,
 * in-scope work that just happens to still be uncommitted.
 *
 * Deliberately narrow: only blocks when the target path (or, for
 * tree-wide commands, the whole working tree) actually HAS uncommitted
 * changes right now. Checkout/reset/clean on already-clean state is a
 * harmless no-op and stays allowed — this must not get in the way of
 * routine, safe use of these commands.
 *
 * Verified by hand (see ADR-005 "Verification" addendum) against a
 * throwaway git fixture: checkout/restore/reset-hard block correctly on
 * dirty tracked content and allow on clean; `restore --staged` is
 * correctly excluded. `git clean -f`/`-fd` needed a second check —
 * `git diff --quiet HEAD` only inspects TRACKED content, so a brand-new
 * file that was never `git add`-ed is invisible to it, and the original
 * draft let `git clean -f` delete such files unblocked. Fixed by adding
 * an untracked-file check (`git status --porcelain`, which itself
 * respects .gitignore, matching what `git clean -f` actually targets)
 * for clean specifically; checkout/restore/reset --hard don't need it
 * since none of them touch untracked files.
 *
 * Exit 2 = block; stderr is fed back to Claude as the reason.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // Fail CLOSED, same convention as protect-governance.mjs.
  process.stderr.write(
    "BLOCKED: destructive-git-guard hook received unparseable input; " +
      "refusing the command as a safety default.\n"
  );
  process.exit(2);
}

const command = String(input.tool_input?.command ?? "");
if (!command) process.exit(0);

const projectDir =
  process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();

// Deliberately simple string/regex matching, same philosophy as the
// other hooks — no shell-parsing dependency, this doesn't need one.
// `includeUntracked` on the `clean` pattern only: reset --hard and
// checkout/restore never touch untracked files, but `clean -f`/`-fd`'s
// whole purpose is to remove them, so it needs the wider check.
const PATTERNS = [
  { re: /\bgit\s+checkout\s+(?:--\s+)?(\S+)/, kind: "path" },
  {
    re: /\bgit\s+restore\s+(?:--staged\S*\s+)?(\S+)/,
    kind: "path",
    excludeIf: /--staged\b/, // --staged only touches the index, not working-tree content
  },
  { re: /\bgit\s+reset\s+--hard\b/, kind: "tree" },
  { re: /\bgit\s+clean\s+-[a-z]*f[a-z]*\b/, kind: "tree", includeUntracked: true },
];

function hasUncommittedChanges(target, { includeUntracked = false } = {}) {
  const t = JSON.stringify(target ?? ".");
  try {
    // Exit 0 = clean (no diff on TRACKED content). execSync throws on
    // git diff's exit 1 (dirty) — the throw IS the "dirty" signal here.
    execSync(`git diff --quiet HEAD -- ${t}`, { cwd: projectDir, stdio: "pipe" });
  } catch {
    return true;
  }

  if (includeUntracked) {
    // git diff HEAD is blind to files that were never `git add`-ed.
    // git status --porcelain also respects .gitignore, same as
    // `git clean -f` itself, so this won't false-positive on ignored
    // build artifacts sitting in the tree.
    const status = execSync(`git status --porcelain -- ${t}`, {
      cwd: projectDir,
      encoding: "utf8",
    });
    if (status.trim().length > 0) return true;
  }

  return false;
}

for (const { re, kind, excludeIf, includeUntracked } of PATTERNS) {
  const match = command.match(re);
  if (!match) continue;
  if (excludeIf && excludeIf.test(command)) continue;

  const target = kind === "path" ? match[1] : ".";
  if (hasUncommittedChanges(target, { includeUntracked })) {
    process.stderr.write(
      `BLOCKED: '${command.trim()}' would discard uncommitted changes ` +
        `${kind === "path" ? `on '${target}'` : "in the working tree"}. ` +
        `If this is your own fault-injection revert, use a narrower method ` +
        `that only undoes YOUR edit (git apply -R on a captured patch, or a ` +
        `direct string revert) — a whole-file/tree checkout can't ` +
        `distinguish your change from someone else's still-uncommitted work. ` +
        `If you genuinely intend to discard everything here, stop and say so ` +
        `explicitly rather than running this directly.\n`
    );
    process.exit(2);
  }
}

process.exit(0);
