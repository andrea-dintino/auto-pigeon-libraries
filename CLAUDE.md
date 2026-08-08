@AGENTS.md

# Orientation

**auto-pigeon-libraries** (`AULIBS`) is the public, Apache-2.0 home of the
shared libraries the other Auto-Pigeon repositories consume — TypeScript now,
Go later. It ships libraries, not a service. `AGENTS.md`, imported above, is
the authority; this file is the short orientation.

Because the repository is public, nothing committed here may contain
credentials, internal hostnames, or references to private infrastructure.

# The two product rules

1. **Validation is on-demand only.** Library functions may check maps — schema,
   convexity, holes, anything — when called. Nothing here may be designed to run
   automatically: not at load time, not at save time, not on a timer, not in the
   background. Levels are routinely "broken" because someone is still working on
   them; no component ever wakes up and declares a map broken. A verdict is a
   returned value the caller asked for.
2. **Every package declares its consumers**, in its own `used-by.json`.

# The `used-by.json` protocol, both halves

- **Changing a package here:** first read its `used-by.json`, inspect every
  listed consumer in the sibling repos, grep the siblings for usage the manifest
  missed, and state in the handoff which consumers were checked and how — the
  commands and their results, not the claim.
- **Adopting a package from a consumer repo:** add your repository to that
  package's `used-by.json`. That is the one sanctioned cross-repo write into
  AULIBS, and it covers that file only.

`AGENTS.md` §3 has the full protocol; §4 the layout rules; §5 the consumption
mechanism and its unsolved Docker-build-context issue; §7 why this repo has no
Dockerfile.

# The observability doctrine

`$MAPPER_ROOT/LLM/DOCTRINE.md` is binding here: for anything touching timing,
concurrency, or geometry a consumer renders, instrument before theorising, and
name the logged field that changed before naming the fix. When a symptom is
likely beyond your own perception, stop iterating fixes and ask HITL for an
observation session. `AGENTS.md` §10 says what it means here.

# Prompts and handoffs

- Prompts: `$MAPPER_ROOT/LLM/prompts/auto-pigeon-libraries/`
- Handoffs: `$MAPPER_ROOT/LLM/handoffs/auto-pigeon-libraries/`
- Protocol: `$MAPPER_ROOT/LLM/WORKFLOW.md`

The terminal is a work surface, not the user handoff. Before ending any
non-trivial task, write the canonical handoff and reproduce its substance in the
final assistant response — status, requirement-by-requirement completion, files
changed, exact commands and results, generated paths, caveats, Git state, the
handoff path, and the `Next Recommended Task` section.

Create the handoff early with `status: in_progress` and refresh it after each
coherent phase, so a fresh session can continue without replaying the transcript.

Commit normally on task completion (`AGENTS.md` §8) — this repo does not follow
AUP's ask-first rule.

# The backlog

Deferred work lives in `$MAPPER_ROOT/LLM/backlog/` — this repo's file would be
`backlog/auto-pigeon-libraries.md` (nothing deferred here yet, so the first
deferral creates it), cross-repo items are in `backlog/workspace.md`, and
`backlog/README.md` is the authority. Read it at task start alongside the
prompt, and check it before writing a `Next Recommended Task`. Two duties bind:
a handoff that defers work **appends** the entry in the same task; whoever files
a prompt covering an entry **deletes** that entry in the same change. Never
reorder or reprioritise — that is HITL's. `AGENTS.md` has the full section.

# End-of-task marker

The literal last line of every final response is `WORKFLOW.md`'s marker,
`I <STATUS> PROMPT <N> ON: AULIBS`. Unconditional, whatever the status and
however the session was started. If there was no prompt file, print
`I COMPLETED MANUAL WORK ON: AULIBS`.
