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

## 0a. The backlog — where deferred work lives

`$MAPPER_ROOT/LLM/backlog/` holds deferred work. Unlike handoffs, which are
immutable case law (`DOCTRINE.md` pillar 7, see §10), the backlog is **mutable
by design**, and order within a file is priority: top = sooner. This repo's file
would be `backlog/auto-pigeon-libraries.md` — as of 2026-08-08 it does not exist
yet, because nothing has been deferred here; the first deferral creates it.
Items spanning repos live in `backlog/workspace.md`, and `backlog/README.md` is
the authority on the rules, deliberately not restated here.

- **Read it at task start, alongside the prompt.** An entry may be the very thing
  the current prompt supersedes — in which case see the deletion duty below — or
  context this task must not contradict. Read `backlog/workspace.md` too: a
  cross-repo item is more likely to concern a shared library than a
  single-consumer entry is. Before recommending follow-up work in a handoff,
  check the backlog so the recommendation extends an entry instead of duplicating
  it.
- **Duty: append on deferral.** A handoff that defers work adds the entry in the
  *same* task — a title, then one to three sentences, enough for a fresh agent
  with no conversational context to write the prompt from, ending with the
  originating handoff's filename as pointer. This extends the `Next Recommended
  Task` discipline rather than replacing it: that section names the next step,
  the backlog entry preserves it beyond the handoff's readership.
- **Duty: delete on adoption.** Whoever files a prompt covering an entry removes
  that entry in the same change — the prompt file becomes the tracker. An agent
  executing a prompt that plainly covers a still-present entry deletes it as part
  of the task and says so in the handoff.
- **What agents never do:** reorder entries, change priorities, or edit another
  repo's backlog file beyond those two duties. Ordering is HITL's. This matters
  more here than elsewhere: agents from every consumer repo have write access to
  this repository (§3, §5), but that access has never extended to writing another
  repo's backlog entries, and does not now.

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

## 9. Component addresses live in `.env`, never in code

**No component may compile in where another component lives.** Not as a constant, not as a
fallback, not as a "last resort" default, not in a test fixture that production code reads. No
`localhost`, no `127.0.0.1`, no `192.168.*`, no port number standing in for a service.

### Why this is a rule and not a preference

`20260807_02` was reported like this: *"'Active Sessions' sends me to `http://127.0.0.1:5174/` even
though in auto-pigeon `.env` there is `AUTO_PIGEON_GALLERY_BASE_URL=http://192.168.0.33:5174/`."*
Both halves were true at once. Two things had gone wrong and each was invisible on its own:

1. a **duplicate** `AUTO_PIGEON_GALLERY_BASE_URL` line had been appended below the hand-written one,
   and a `.env` is *sourced*, so the last line silently won;
2. `launch-aup.sh` set AUG's address in AUP's sibling but never set AUP's copy of AUG's — the link
   was wired in one direction only.

Neither would have reached a user if the code had had no opinion about where AUG was. Instead a
compiled-in `127.0.0.1:5174` turned a misconfiguration into a plausible-looking wrong answer, on a
LAN, where a loopback address means *the reader's own machine* and can never work. A missing address
that says so gets fixed in an afternoon; a wrong address that looks right gets reported three times.

### What to do instead

- **Add a variable to that component's `.env` / `.env.example`, with a comment saying what reads it.**
- **Test it**, by running the thing and watching it use the configured value.
- **Then document it** in this file and in the component's `README.md`.
- **If you cannot put it in `.env` — stop and ask the human.** Do not invent a fallback address to
  keep moving.
- Whoever brings the stack up wires **both** directions. `launch-aup.sh` is the one place that knows
  the ports that were actually claimed, so it is the one place that writes them into each `.env`.

### The one permitted derivation

A page may use **its own origin** — `location.hostname`, `location.protocol`. That is not a
hardcoded location, it is the single address the reader is already known to be able to reach, and it
is the right answer whenever two services are served from one host. A **port** cannot be derived
that way, so an origin that needs a port needs a variable.

### When the address is missing

Say so, in the place the user is. An unconfigured address is an error the user must act on — in AUP
that means a modal per `DESIGN.md` §10, naming the variable — never a silent fallback and never a
button that goes somewhere wrong.

## 10. The observability doctrine binds

`$MAPPER_ROOT/LLM/DOCTRINE.md` is this workspace's observability doctrine,
written out of `20260807_06` (AUP's manipulator flicker: four fixes proposed on
theory, all wrong; the fifth instrumented first and found the cause in the first
properly-read log). It is **binding here**, in full. Its seven pillars:
observation before theory; durations are evidence; log at transitions and
decisions, on change, with sequence counters, never per frame; the structured
observation request; the human's right to deny and the transfer of risk that
comes with recording the denial; artifacts flow both ways; handoffs are the case
law.

A library has a particular obligation under it. Code here runs inside somebody
else's timing budget, and when a consumer instruments a bug the trail may lead
into an AULIBS package — so a package that does anything with time, ordering, or
geometry must be diagnosable from the outside: deterministic, and honest about
what it did. **Do not add a logging transport to a library.** Each consumer
already has one (`DEV_MODE`, its own shape), and a library that logs on its own
lands lines in a file nobody attached. Return or expose what the consumer needs
in order to log it.

### AULIBS clock table (doctrine pillar 2)

The first package with a characteristic time of its own is
`ts/offline-workspace-contract`, whose `validateEntity` is a validation sweep a
consumer may call on a save path. Measured on this machine under Node 24,
`node --test` warm, 20 000 iterations per case (`AULIBS`, `AUP 151`):

| operation | measured | what it is |
| --- | --- | --- |
| `can(role, capability)` | **0.02 µs** | one `Set.has` behind two map lookups. An authorization check is free; nothing needs to cache one. |
| `canTransition(machine, from, event)` | **0.17 µs** | a linear scan of one machine's transitions. Ten times `can`, still nothing. |
| `validateEntity("asset_edit_lease", …)` | **7.1 µs** | the reference validator over a 15-field entity — the number that matters, because it is the one a consumer might put on a save path. |
| `validateEntity("dependency_manifest", …)` | **9.8 µs** | the same, over a manifest with two dependency entries. |
| full 92-cell capability sweep | **57 µs** | every role against every capability, which is what rendering a whole permissions table costs. |
| full 199-cell transition sweep | **272 µs** | every machine, state and event. |
| module load, all six documents | **0.74 ms** | once, at import. |

Read as a budget: validating every entity in a 200-asset workspace listing is
about **2 ms**, and a consumer that finds validation expensive is validating in a
loop it did not mean to write rather than meeting a cost this package imposes.
None of these numbers justifies a cache, and a cache over a frozen contract would
be the wrong thing to add.

The next package with a time of its own — a codec pass, anything a consumer will
sit inside a frame budget for — records it here, in the task that introduces it,
alongside the consumer and map size it was measured against.

## Incident observability

Every user-impacting failure in this workspace is reported in **one shape**, with **one taxonomy of
codes**, carrying **one correlation id**, cleaned by **one set of redaction rules**. All four live
in `auto-pigeon-libraries/ts/incident-contract`, and none of them is restated here on purpose: a
contract copied into seven files is seven contracts that agree until the day they do not.

| what | where |
| --- | --- |
| the envelope, the codes, the correlation convention, redaction | `auto-pigeon-libraries/ts/incident-contract/` (schema + `README.md`) |
| the backend | self-hosted **GlitchTip** (MIT), pinned by tag AND digest in `auto-pigeon-tools/docker-compose.glitchtip.yml` |
| its lifecycle | `auto-pigeon-tools/launch-aup.sh` starts and stops it in every mode, offset-namespaced like everything else |
| the DSN this stack issued | `<mapper-root>/runtime/auto-pigeon-observability/stack[-N]/instance.env`, and `./launch-aup.sh --print-config` |
| the acceptance | `auto-pigeon-tools/scripts/aup/observability-smoke.sh` |
| the public bug target | `https://github.com/auto-pigeon/bug-reports/issues` — nothing auto-files there |

**GlitchTip does not replace Gatus and must not duplicate it.** PREPROD-05 gave uptime and health
to Gatus, and that stands. Gatus answers *is this component up, and is it serving the version it
should be*; GlitchTip answers *what went wrong for a person, and what was true when it did*.

**Sentry-compatible SDKs point at the self-hosted GlitchTip and never at sentry.io.** The SDKs
themselves (`@sentry/node`, `sentry-go`, `sentry-sdk`) are MIT and are used as clients; the server
is ours.

### What binds every change here

1. **A new user-impacting error path maps to a canonical incident code, or ADDS one to
   `incident-codes.json`.** A failure string invented at a call site is exactly what the taxonomy
   exists to prevent — it makes *"which errors does this product have"* a question you answer by
   reading six repositories.
2. **Propagate the correlation id.** Read it from the request, put it on every outbound request,
   job and message, and put it on every incident raised along the way.
   `X-Auto-Pigeon-Correlation-Id` over HTTP; `correlationId` on a Colyseus message and on an AUB
   job record. A malformed value is treated as absent, never forwarded — a component that forwards
   whatever it was sent turns one client's typo into a value three services then record.
3. **Say something true to the user.** A real reason, and a real action where one exists. Never a
   generic *"something went wrong"*, never an invented suggestion, and — when the honest answer is
   that the cause is unknown — say that instead of guessing.
4. **Emit telemetry when it is available, and carry on when it is not.** The backend being down is
   `reporting.telemetry_unavailable`: recorded locally, never escalated to the user, and never able
   to fail a request, a render or a launch. **Nothing in the product may depend on the incident
   backend.** An error backend that can break the thing it observes is a component that causes
   outages instead of explaining them.
5. **Never leak.** No auth headers, cookies, passwords, invitation tokens, e-mail addresses,
   private APMap geometry, annotation or chat text, private prefab contents, or absolute local
   paths. The envelope is closed and central redaction runs on the way out — but the usual way this
   gets undone is an SDK's DEFAULT INTEGRATIONS, which attach environment variables, argv, hostnames
   and local file paths. Turn them off deliberately and say why.
6. **Do not swallow an error into a console-only log.** If a person is affected, it is an incident.
7. **A new expensive operation is TIMED**, and the duration goes in `duration_ms`. Doctrine pillar
   2: a message without a duration is an opinion.
8. **A critical new path gets failure-injection and stress coverage in the same task.** Reports go
   to `$MAPPER_ROOT/LLM/stress-reports/<run-id>/`; the scaffold and the machine-fact capture are
   `auto-pigeon-tools/scripts/stress_report.py`.

### In this repository

AULIBS **owns** the contract — `ts/incident-contract/` — and owns nothing else about incidents. It
has no DSN, no SDK, no transport and no opinion about where events go, exactly as §1 requires: this
repository ships libraries and is not a service.

Two rules apply with full force to any change there. `used-by.json` protocol (§3): read it, inspect
every listed consumer, grep the siblings for consumers it missed, and report what was checked.
Validation on demand (§2.1): `validateIncident` returns `{ valid, errors }` and never throws, because
an incident is usually reported from a path that is already failing and a validator that threw would
turn a report about a bug into a second bug.

Widening the envelope, the taxonomy or the redaction rules means editing the JSON *and* its tests.
`src/validate.mjs` is allowed to exist beside a real schema engine only because `test/contract.test.mjs`
runs **ajv** over the same cases and fails if the two disagree.
