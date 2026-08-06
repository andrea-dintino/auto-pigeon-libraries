# AGENTS.md — Auto-Pigeon Libraries (shared libraries)

## 0. Mapper workspace and task lifecycle

This repository holds the shared libraries consumed by the other Auto-Pigeon
repositories, abbreviated **AULIBS**. Its expected location is:

```text
mapper-code/auto-pigeon-libraries/
```

The sibling source workspace is `..`; durable mapper data and task outputs are
under `../../mapper` or `$MAPPER_ROOT`.

At the beginning of every task:

1. Read `../AGENTS.md`.
2. Read the newest handoff in
   `$MAPPER_ROOT/LLM/handoffs/auto-pigeon-libraries/`, when present.
3. Resolve the next prompt from
   `$MAPPER_ROOT/LLM/prompts/auto-pigeon-libraries/`.

See `$MAPPER_ROOT/LLM/WORKFLOW.md` for the full mapper-wide protocol — prompt
and handoff layout, how the next prompt is selected, prerequisite declarations,
manual-work handoffs, and the end-of-task marker. This repo follows it exactly
and does not restate it here.

What is specific to *this* repo:

- New prompts: `YYYYMMDD_NN_Title-Case-With-Dashes.md`, with both a
  `## Prerequisite` prose section and a `requires:` frontmatter block
  (`requires: []` when there is none).
- End of every task: print `WORKFLOW.md`'s end-of-task marker as the literal
  last line of the final response, unconditionally. This repo's `<ALIAS>` is
  `AULIBS`, recorded in `.agent-repo.json`.
- `agent_task.py checkpoint` targets the *newest* prompt in the queue by
  default, which is wrong whenever more than one is outstanding. Pass
  `--prompt`, or verify the resulting handoff's `prompt_path` before finishing.

Agents may read and run sibling repositories. Do not edit, stage, commit, or
push a sibling unless the active prompt names it as a mutation target. The one
sanctioned exception runs the other way and is described in §3.

## 1. What this repository is

**auto-pigeon-libraries** is a **public**, Apache-2.0 repository of shared
libraries — TypeScript now, Go later — consumed by the other repositories in
this workspace (`auto-pigeon`, `auto-pigeon-backend`,
`auto-pigeon-collaboration`, `auto-pigeon-gallery`, `auto-pigeon-extractor`,
and any added later).

It ships libraries. It is not a service, it has no runtime of its own, and it
owns no data.

Because it is public: **no credentials, no internal hostnames, no references to
private infrastructure in committed content.** The `$MAPPER_ROOT/LLM/` workflow
paths referenced above are the workspace convention every sibling AGENTS.md
already carries, and are the only non-public paths permitted here.

## 2. The two product rules

These govern everything that will ever live in this repository. They are rules,
not preferences.

### 2.1 Validation is on-demand only

Library functions may check maps — schema, convexity, holes, anything — **when
called**. Nothing in AULIBS may be designed to run automatically: not at load
time, not at save time, not on a timer, not in a background worker, not as a
side effect of a constructor or an import.

The reason is a fact about how the product is used. Levels are routinely
"broken" simply because someone is still working on them; a half-carved brush
is a normal intermediate state, not an error. **No component ever wakes up and
declares a map broken.** A caller who wants a verdict asks for one and decides
what to do with it.

This shapes the API surface, not just the scheduling: a validation result is a
returned value, never a thrown exception on a load path, never a log line
emitted from a code path the caller did not ask to validate.

### 2.2 Every package declares its consumers

Each package folder carries a `used-by.json` naming the repositories that use
it. See §3 for the protocol that makes the file worth having.

## 3. The `used-by.json` protocol

Both halves are obligatory. The file is worthless if either is skipped: half (b)
is what keeps it accurate, half (a) is what makes it useful.

### (a) Changing a package here

An agent that adds to or changes a package in this repository must, **before**
making the change:

1. Read that package's `used-by.json`.
2. Inspect every listed consumer. Sibling repositories are readable; go and look
   at how they actually call the thing being changed.
3. Grep the siblings for usage the manifest may have missed — a consumer that
   adopted the package without updating the file, or a call site added after the
   entry was written. The manifest is a starting point, not an authority.
4. State in the handoff **which consumers were checked and how** — the repos
   inspected, the greps run, and what was found. "Checked the consumers" is not
   a handoff entry; the commands and their results are.

A change that breaks a listed consumer is not forbidden — it is *reportable*.
Say what breaks and where, so the consuming repo's next prompt can be written.

### (b) Adopting a package from a consumer repo

An agent working in a consumer repository that starts using an AULIBS package
must add its repository to that package's `used-by.json`:

```json
{ "repo": "auto-pigeon", "usage": "one line on what it uses this for", "added": "2026-08-06" }
```

**This is the one sanctioned cross-repository write into AULIBS from
elsewhere, and it is limited to that single file.** It does not extend to any
other file in this repository, and it does not turn AULIBS into a mutation
target for the rest of that task.

## 4. Layout

```text
auto-pigeon-libraries/
├── LICENSE                  # Apache-2.0
├── README.md
├── AGENTS.md                # this file — the authority
├── CLAUDE.md
├── run.sh                   # ./run.sh test
├── meta/
│   └── used-by.schema.json  # JSON Schema for every package's used-by.json
├── fixtures/                # apmap fixtures, shared across packages
├── ts/                      # one folder per TypeScript package
└── go/                      # one folder per Go package (none yet)
```

Rules:

- **One folder per package** under `ts/` and `go/`. No nesting packages inside
  packages, no shared-source folder that several packages reach into.
- **Every package folder contains its own `used-by.json`**, validating against
  `meta/used-by.schema.json`, and its own `README.md` saying what the package
  is and how to use it.
- `fixtures/` is shared and has its own conventions — see `fixtures/README.md`.
  Read it before adding a fixture; the conventions were agreed before the first
  fixture existed precisely so they would hold.

## 5. Consumption mechanism — partially open

How a consumer depends on a package here is **settled for development and open
for deployment**. Stated honestly rather than presented as finished:

- **Preferred:** a local-path dependency (`file:../auto-pigeon-libraries/ts/<pkg>`
  or a Go `replace` directive). Simplest, and it makes a change visible to its
  consumer immediately.
- **Fallback:** a git-URL dependency, pinned to a commit.
- **Deferred:** npm publication and Go module publication. Not done, not
  scheduled, and not to be introduced as a side effect of another task.

### Known unsolved issue: Docker build context

**A local-path dependency points outside a consuming repository's Docker build
context.** `docker build` cannot see `../auto-pigeon-libraries/`, so a consumer
that works locally will fail to build its image, and it will fail at image-build
time rather than at development time — the least convenient moment to discover
it.

This is written down so no one trips on it silently. **The decision about how a
given repository's `docker build` resolves the dependency** — a larger build
context, a vendoring step, a git-URL dependency for the image only, or
publication — **belongs to the adoption prompt in that consuming repository, not
to this repository.** The first adoption in each repo makes that call and
records it there.

## 6. Testing

- `./run.sh test` runs everything. It is the entrypoint; a task that ran the
  tests some other way still has to leave `./run.sh test` passing.
- TypeScript packages run through the package manager's own `test` script.
- Go packages run through `go test ./...`, once any Go package exists.
- With no packages present, `./run.sh test` exits 0 and reports that there is
  nothing to test. It reports it — it does not print a green summary implying a
  suite ran.
- **A package with no tests is not accepted.** Not "add tests later", not "the
  consumer's tests cover it".

## 7. No Dockerfile

This repository ships libraries, not a service. The standing workspace rule
that a repository must be Docker-deployable has a precondition — a deployable
image — and that precondition does not hold here.

**Do not add a Dockerfile to this repository out of habit.** If a task appears
to need one, the need belongs to a consuming repository (§5).

## 8. Commit policy

Commit normally on task completion. This repository follows the PB/AUC/AUG
convention, **not** AUP's ask-first rule.

One commit per prompt. Commit only what the library needs to build, test, and
be understood: source, tests, fixtures, package/config files, `used-by.json`,
and documentation. Never `node_modules/`, build output, generated logs, `.env`
files, or temporary scripts. Do not use `git add .` or `git add -A`.

Handoffs live under `$MAPPER_ROOT/LLM/` and are never staged or committed.
