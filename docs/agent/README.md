# `docs/agent/` — the selectively-read agent modules

Every detailed rule this repository has lives in exactly one file here. **Nothing in this directory
is loaded at startup.** The repository-root `AGENTS.md` holds the rules that bind nearly every
task, the source-of-truth order and the routing table;
`../../../auto-pigeon-tools/scripts/agent_context_router.py` resolves a task to the modules it
needs and answers with **paths and reasons, never contents**.

```sh
../auto-pigeon-tools/scripts/agent_context_router.py --repo-root "$PWD" route --topic used-by
../auto-pigeon-tools/scripts/agent_context_router.py --repo-root "$PWD" route --path ts/incident-contract/schema.json
../auto-pigeon-tools/scripts/agent_context_router.py --repo-root "$PWD" gate
../auto-pigeon-tools/scripts/agent_context_router.py --repo-root "$PWD" sections | grep '3\.'
```

## The architecture is not this repository's

`NEW_246B_AUT_Workspace-Agent-Documentation-Router-And-Budget-Gate` established it and
`auto-pigeon-tools/docs/agent/README.md` is the authority on the module schema
(`aut-agent-module/1`), the route shape, the reason ranking, the `context_docs:` prompt key and the
budgets. This file says what is specific to **auto-pigeon-libraries**.

There is ONE `agent-context-manifest.json` and it lives in `auto-pigeon-tools`, because the
budgets, the eager-import allowlist and the repository roll-call are workspace facts. Each
repository splits its own `AGENTS.md` into its own `module_dir`, which is `docs/agent` here.

## Why the directory exists, when this repository was already under budget

`AGENTS.md` was 427 lines and 3,649 words and `CLAUDE.md` 555, so the fixed AULIBS startup cost was
**4,204 words against a 5,000-word cap** — under it, and `246G`'s prompt said so: a repository
already below budget may receive only a manifest entry and reference validation, and splitting for
symmetry is not a reason.

Two things made a small split worth doing anyway, and neither is symmetry.

**A duplicate.** §9 was a byte-identical second copy of a workspace-root section, which is a second
place for one rule to drift. `aulibs.component-addresses` is a POINTER at the authority — and says
the one thing that is genuinely different here, which is that a public library has no `.env` to
move an address into and therefore may not carry one at all.

**A routed set that an agent can actually use.** The modules are the domains this repository
really has: the consumer protocol, the product rules, the layout, the consumption mechanism, the
incident contract, the doctrine and its measurements, the backlog. A task about the incident
envelope now gets `aulibs.incidents` and `aulibs.used-by` and not the clock table; a task adding a
package gets the layout and the testing rules and not the incident taxonomy.

The repair is not deletion. Every rule is still here, in one place, and `section-manifest.json`
proves it: every heading AND every LINE of the pre-split file is accounted for, and
`agent_context_router.py gate` re-derives that accounting on every run rather than trusting it.

| | before | after |
| --- | --- | --- |
| `AGENTS.md` | 427 lines / 3,649 words | see `gate --json` |
| `CLAUDE.md` | 84 lines / 555 words | see `gate --json` |
| fixed AULIBS startup (both files) | 4,204 words | see `gate --json` |
| routed, selectively read | 0 | 9 modules |

## What the split preserved, exactly

- **Every stable section id still resolves.** The module bodies keep their **original heading lines
  verbatim**, so `## 3. The \`used-by.json\` protocol` is still spelled that way and
  `sections | grep '3\.'` answers *which file* in one command.
- **The bytes are unchanged.** Every module body was copied out of the pre-split file by line range
  — not rewritten, not summarised, not reordered — except `aulibs.component-addresses`, the pointer
  described above.
- **§2 stayed half in the root**, and `section-manifest.json`'s `rules_without_headings` records
  it: the heading and the two sentences saying that the two product rules govern everything here
  are root material, and the rules themselves are `aulibs.on-demand-validation` and
  `aulibs.used-by`. §2.2 is four lines that say what §3 then specifies, so the two travel together
  in one module rather than being one rule in two files.
- **`aulibs.consumption` carries two headings**, §5 and §7, because *how a consumer depends on a
  package* and *why there is no Dockerfile here* are the same decision read from two directions:
  a local-path dependency points outside a consuming repository's Docker build context, and the
  call about resolving that belongs to the adoption prompt in the consuming repository.

### `CLAUDE.md` lost only duplicates

It restated four `AGENTS.md` sections in shorter form — the two product rules, the `used-by.json`
protocol, the doctrine and the backlog. Those are not lost: they are `aulibs.on-demand-validation`,
`aulibs.used-by`, `aulibs.observability` and `aulibs.backlog`, all named in the root routing table.
What stayed is what is genuinely Claude-specific: the delivery rules, the marker, the compact
instructions, and one pointer at the router — with the reminder that the consumer audit happens
*before* a package change, not in the handoff afterwards.

## The module set

| group | modules |
| --- | --- |
| the two product rules | `aulibs.on-demand-validation`, `aulibs.used-by` |
| what a package is and how it is consumed | `aulibs.layout`, `aulibs.consumption` |
| the one contract this repository owns | `aulibs.incidents` |
| observing it | `aulibs.observability`, `aulibs.clock-table` |
| the workspace around it | `aulibs.component-addresses`, `aulibs.backlog` |

One prerequisite edge is declared rather than left to a reader: `aulibs.observability` pulls
`aulibs.clock-table`, because doctrine pillar 2 is *a message without a duration is an opinion* and
this repository's durations are in the table.

## `README.md` and the package READMEs are documentation, not instruction

The repository `README.md` and each package's own `README.md` are public, consumer-facing
documentation. No `SessionStart` hook loads them, no `@import` reaches them, and neither
`AGENTS.md` nor `CLAUDE.md` asks for them to be read whole. The README rule is unchanged — a task
that changes what a consumer sees updates them in the same task, and `aulibs.layout` requires every
package folder to have one — but they must not become instruction sources.
