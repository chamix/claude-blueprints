# ADR-006: Externalize agent knowledge base from role-contract definitions

## Status
Accepted

## Context

`full-stack-engineer.md`'s "Foundational Technical Bibliography" section
bakes three literary references directly into the same file as the agent's
role contract (Task Boundary Contract, TDD Operational Flow, Scope
Contract):

1. **Kent Beck, *Test Driven Development: By Example*** — TDD process.
2. **Addy Osmani, *Learning JavaScript Design Patterns*** — JS/React
   patterns.
3. **Resig/Bibeault/Maras, *Secrets of the JavaScript Ninja*** — JS engine
   mechanics.

Auditing this section against what it's actually used for surfaced two
distinct problems, not one:

- **Item 1 is redundant, not just stack-neutral.** The Red-Green-Refactor
  cycle it cites is already fully specified, in more actionable detail,
  in this same file's own "TDD Operational Flow" section. The citation
  adds nothing beyond attribution.
- **Items 2 and 3 are genuinely stack-conditional**, and hardcoding them
  makes `full-stack-engineer.md` non-portable: pointing this agent at a
  Python/Django project still ships JS-specific bibliography into that
  session's context window, working against the concrete cost-usage
  finding (Aug 2026 data) that flagged `full-stack-engineer`'s context
  length as a cost driver.

The same "role contract mixed with reference material" shape recurs
elsewhere in the system, at three more sites, once looked for
deliberately rather than assumed absent:

- `CLAUDE.md` itself carries a "Foundational Technical Bibliography &
  Frameworks" section (Clean Architecture, SOLID, GoF).
- `code-reviewer.md`'s Review Checklist references this same material by
  pointer ("same bibliography as the Lead Engineer, applied
  independently") rather than by a shared, readable artifact — the
  claim of sameness is currently a prose assertion, not something either
  file can be diffed against.
- `technical-writer.md` carries its own "Foundational Industry Standards"
  section (Diátaxis Framework, GitLab Documentation Style Guide),
  unreferenced by anything else.

Separately, while evaluating `goldbergyoni/nodebestpractices` as a
candidate reference, it became clear that **neither `full-stack-engineer.md`
nor `code-reviewer.md` addresses security at all** — a real capability gap.
There was no existing convention for where agent-consumable reference
knowledge should live, distinct from role-contract prose.

Two consumption mechanisms are available, and they behave differently —
this matters for what "externalizing" actually buys in each case:

- **`CLAUDE.md` supports native `@path/to/import` syntax.** Imported files
  are automatically loaded into context at launch. Per Claude Code's own
  documentation, this is an organizational feature, not a context-saving
  one: imported content is pulled in at load time exactly as if it were
  inline. So moving `CLAUDE.md`'s bibliography to a shared file removes
  duplication and makes the "single source of truth" claim mechanically
  true — it does **not** reduce the Lead's own context footprint.
- **Subagents (`full-stack-engineer`, `code-reviewer`, `technical-writer`)
  get a fresh context window per delegation**, with no automatic import
  mechanism of their own. What they read is exactly what the Lead's
  delegation prompt points them at, fetched via their own `Read` tool.
  This is where externalizing content actually pays for itself in context
  budget: a task can point `full-stack-engineer` at `nodejs/*` and skip
  `python-django/*` entirely, something an `@import` can't do since it
  always loads in full.

On network access specifically: the current agent definitions don't
grant `WebFetch`/`WebSearch` in their `tools:` frontmatter, but this is a
configuration choice, not a platform limitation — Claude Code subagents
can be granted these tools, and "doc-fetching subagent" is a documented,
common pattern. Whether to grant it here is addressed explicitly in the
Decision below, not assumed away.

Licensing adds a real constraint on the nodebestpractices instance
specifically: `goldbergyoni/nodebestpractices` is **CC-BY-SA-4.0**; this
repository is **MIT** (`LICENSE`). A curated extract vendored from that
source is a derivative work and cannot silently inherit this repo's
blanket MIT license — it needs its own license header, attribution, and
a tracked notice.

## Decision

1. **Introduce `claude/knowledge/` as a new top-level directory under
   `claude/`.** It deploys automatically to `.claude/knowledge/` via
   `scripts/deploy.ps1`'s existing recursive `Copy-Item claude\* -Recurse`
   — no deploy-script change required. It also falls under
   `protect-governance.mjs`'s existing `.claude/` prefix protection with
   no hook change required — verified against the hook's actual matcher
   before proposing this, not assumed.

2. **Organize it along two independent axes:**

   ```
   claude/
   └── knowledge/
       ├── architecture/
       │   └── principles.md        # Clean Architecture + SOLID + GoF
       │                            # (CLAUDE.md + code-reviewer.md)
       ├── documentation/
       │   └── style-guide.md       # Diátaxis + GitLab style guide
       │                            # (technical-writer.md)
       ├── security/
       │   └── general.md           # cross-stack: injection, secrets,
       │                            # authn/authz, dependency hygiene
       ├── nodejs/
       │   ├── bibliography.md      # Osmani + Resig, moved verbatim
       │   └── security.md          # Node-specific additions only
       │                            # (npm audit tooling, framework
       │                            # middleware, etc.)
       └── python-django/           # placeholder; populated when a
                                     # Django project actually needs it
   ```

   A stack folder's `security.md` is **additive to, never a substitute
   for,** `security/general.md`. General principles live once; a stack
   contributes only the mitigations that don't generalize — mixing
   Node-specific advice into the cross-stack file would leak it into
   every other stack's context by default, the same failure this split
   exists to prevent one level up.

3. **Two distinct consumption patterns, matched to whether the content
   varies per task:**

   - **Fixed pointer** — for knowledge that's invariant across every task
     for that agent: `code-reviewer.md` always reads
     `architecture/principles.md` at the start of every review;
     `technical-writer.md` always reads `documentation/style-guide.md`;
     `CLAUDE.md` `@imports` `architecture/principles.md` directly. No
     per-task declaration — baked into the persona file once.
   - **Declared-per-task** — for knowledge that varies by project or
     stack: `full-stack-engineer`'s stack bibliography and the
     cross-cutting/stack security modules relevant to the current task.
     This is the fourth element of the Task Boundary Contract (below).

4. **Trim `full-stack-engineer.md`'s bibliography** to drop the Kent
   Beck/TDD citation (redundant, see Context) and replace the Osmani/
   Resig citations with an instruction to consult whichever
   `claude/knowledge/**` paths are declared in the current delegation
   prompt. Apply the equivalent trim to `CLAUDE.md`, `code-reviewer.md`,
   and `technical-writer.md` per the fixed-pointer pattern above.

5. **Extend the Task Boundary Contract from three required elements to
   four**, in both `full-stack-engineer.md` and `CLAUDE.md`'s Step 2
   ("Implementation Delegation"): in-scope file paths, output format,
   definition of done, and now **knowledge modules** — the
   `claude/knowledge/**` paths relevant to this task's stack plus any
   applicable cross-cutting modules beyond the reviewer's/writer's fixed
   pointers. If omitted, the engineer stops and asks — the same behavior
   already specified for the other three elements, extended rather than
   special-cased.

6. **Do not grant `WebFetch`/`WebSearch` to any agent as part of this
   ADR.** This system's design rests on deterministic, git-tracked
   artifacts and on `code-reviewer` independently re-deriving compliance
   against a *fixed, shared* baseline. A live fetch breaks both: the same
   task run twice (or audited later) can see different content, and an
   engineer's fetch at time T1 is not guaranteed to match a reviewer's
   fetch of "the same" URL at T2 — silently undermining the "same
   bibliography, applied independently" invariant review depends on. It
   also introduces a class of risk the existing hooks don't model at all:
   fetched content is untrusted input reaching an agent that also holds
   `Edit`/`Write`/`Bash`, and none of `protect-governance.mjs`,
   `enforce-scope.mjs`, or `guard-destructive-git.mjs` defend against an
   agent's *instructions* being hijacked by something it fetched — they
   only constrain what an already-behaving agent can touch. Reliably
   vetting arbitrary fetched content for injected instructions is at
   least as unbounded a problem as the Bash-write detection ADR-002
   already declined to heuristically solve.

7. **Resolve the nodebestpractices integration as the first concrete
   instance of the stack-specific pattern**, per the split in (2):
   - `claude/knowledge/security/general.md` — principles from
     nodebestpractices' security section that generalize beyond Node.
   - `claude/knowledge/nodejs/security.md` — the remaining Node-specific
     practices.
   - Each vendored file carries a header stating source URL, license
     (CC-BY-SA-4.0), and that it is a curated/modified extract, not a
     verbatim copy.
   - A new root-level `THIRD-PARTY-NOTICES.md` catalogs every such
     vendored knowledge module.

## Alternatives considered

- **Keep bibliography inline per-agent; add a stack parameter instead of
  separate files.** Rejected: a static persona `.md` file has no
  conditional-rendering mechanism, so every stack's content would still
  ship in the agent definition regardless of which stack a task actually
  uses.
- **Put Node-specific security guidance inside `security/general.md`**
  rather than splitting it into `nodejs/security.md`. Rejected: a Django
  project would inherit npm-audit/helmet.js-style advice it can't act on
  — the same cross-stack leakage the directory split exists to prevent.
- **Grant `full-stack-engineer` a scoped `WebFetch`, allow-listed to a
  small set of official doc domains, instead of vendoring.** Considered
  seriously, not dismissed out of hand — it would keep bibliography
  current and sidestep the CC-BY-SA vendoring/attribution overhead
  entirely. Deferred rather than rejected outright: it needs its own
  threat-model and reproducibility analysis (see Decision item 6) that
  is out of scope for this ADR. Worth revisiting as its own decision if
  a concrete, narrow need emerges (e.g., cross-checking live CVE data,
  which `npm audit` via the already-granted `Bash` tool covers more
  deterministically today anyway).
- **Relicense the vendored extract under this repo's MIT license.**
  Rejected: not this project's call to make. CC-BY-SA-4.0 is share-alike;
  the source's terms govern its derivatives regardless of the consuming
  repo's own license elsewhere.
- **Auto-detect project stack from `package.json` /
  `requirements.txt` instead of explicit declaration.** Rejected for
  now: would require a new stack-sniffing hook or script — a new
  dependency-shaped problem — to replace a Lead decision that already
  happens once per project during Step 0/1. Same posture as ADR-002's
  rejection of speculative Bash-write coverage: revisit only if manual
  declaration proves unreliable in practice.

## Consequences

- `full-stack-engineer.md` becomes stack-agnostic. Pointing it at a
  Python/Django project no longer ships irrelevant JS/Node bibliography
  into that session's context — direct progress against the Aug 2026
  cost-usage finding.
- `code-reviewer.md`'s "same bibliography as the Lead Engineer" claim
  becomes mechanically true (both read `architecture/principles.md`)
  instead of a prose assertion trusting the model to already know it.
  It also gains an actual, declared basis to raise security findings.
- `CLAUDE.md`'s own context footprint is unchanged by its `@import` —
  this refactor buys consistency and single-sourcing for the Lead, not
  a smaller context window; the context-budget win is specific to the
  subagent delegation path.
- New governance surface to keep current: every additional stack needs
  its own `claude/knowledge/<stack>/` folder before that stack's
  projects can run without ad hoc, undocumented bibliography.
- `THIRD-PARTY-NOTICES.md` must be kept in sync whenever a knowledge
  module is vendored from an externally-licensed source — a manual,
  Lead-authored discipline, same posture as `backlog.md` under ADR-002.
- Network access for agents remains an open, deliberately deferred
  question, not a closed one — flagged for a future, dedicated ADR if a
  concrete need for live fetching arises.
- Must be ported to md-view's deployed `.claude/knowledge/` copy after
  landing here, per this repo's role as source of truth.
