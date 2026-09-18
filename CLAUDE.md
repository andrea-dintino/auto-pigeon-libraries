@AGENTS.md

# Claude Code delivery rules

`AGENTS.md` above holds this repository's always-rules, its source-of-truth order and the routing
table for `docs/agent/`. Claude Code must follow it. What is below is the part that is specifically
about how a Claude Code session here reports its work — it is not repeated in `AGENTS.md`, and
`AGENTS.md`'s rules are not repeated here.

**auto-pigeon-libraries** (`AULIBS`) is the public, Apache-2.0 home of the shared libraries the
other Auto-Pigeon repositories consume. It ships libraries, not a service. Because the repository
is public, nothing committed here may contain credentials, internal hostnames, or references to
private infrastructure.

## Resolving the task

Read the newest handoff in `$MAPPER_ROOT/LLM/handoffs/auto-pigeon-libraries/`, then resolve the
next prompt from `$MAPPER_ROOT/LLM/prompts/auto-pigeon-libraries/`. Then ask the router what this
task should read, rather than reading everything:

```sh
../auto-pigeon-tools/scripts/agent_context_router.py --repo-root "$PWD" route --prompt <the resolved prompt path>
```

It answers with module paths and the reason each was selected. It never prints a module's contents,
and reading a routed module is your decision. For a change to a package, `aulibs.used-by` is the
one to read before touching anything: the consumer audit happens **before** the change, not in the
handoff afterwards.

## The terminal is a work surface, not the user handoff

Before ending any non-trivial task, write the canonical handoff and reproduce its substance in the
final assistant response — overall status; a requirement-by-requirement completion matrix; files
added, modified, deleted and intentionally untouched; implementation and design decisions; exact
commands, exit status and pass/fail/skip/timeout totals; generated artifact paths; blockers,
caveats and disproven hypotheses; branch, commit SHA and message, push result and final
`git status --short`; the canonical handoff path; the complete `Next Recommended Task` section; and
the end-of-task marker as the literal last line.

Do not respond only with a path, a terse summary, or "see terminal", and do not claim completion
until both the handoff and the final response are complete. If work stops early, write a partial
handoff before yielding, stating what is complete, where work stopped and what remains in the
working tree.

Create the handoff early with `status: in_progress` and refresh it after each coherent phase, so a
fresh session can continue without replaying the transcript. **Context lifecycle belongs to
`run-sequence.sh`, not to you** — do not work out how full your window is, adopt a threshold,
compact by hand, or stop an unattended run to ask for a session reset.

Commit normally on task completion (`AGENTS.md` §4) — this repo does not follow AUP's ask-first
rule.

## End-of-task marker

The literal last line of every final response is `WORKFLOW.md`'s marker,
`I <STATUS> PROMPT <N> ON: AULIBS`. Unconditional, whatever the status and however the session was
started. If there was no prompt file, print `I COMPLETED MANUAL WORK ON: AULIBS`.

## Compact instructions

When compacting, preserve only the exact task objective and requirement status; accepted design
decisions; files changed and their material state; decisive command/test results and unresolved
failures; current Git state; the canonical handoff path; and the exact next executable step.
Discard verbose command output, repeated exploration, superseded hypotheses, and conversational
narration already captured in the handoff.
