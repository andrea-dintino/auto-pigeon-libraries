# @auto-pigeon/offline-workspace-contract

The cross-stack contract for **Offline Shared Workspaces**: the durable, AUB-authoritative
collaboration model that sits beside — and is deliberately not — an AUC Real-time session.

It ships **data plus a reference implementation**. There is no persistence here, no endpoint, no UI,
no discovery and no running service. The persistence is AUB's, the editor is AUP's, the live session
is AUC's and the public listing is AUG's; what this package owns is the vocabulary all four have to
agree on before any of them writes a line of it.

```js
import {
  can, rolesWith, canTransition, nextStates, createRefusal,
  validateEntity, LEASE_INACTIVITY_TIMEOUT_MS,
} from "@auto-pigeon/offline-workspace-contract";

can("knight", "asset.upload");                 // true  — Knights contribute new assets
can("knight", "asset.save");                   // false — and never overwrite an existing one
rolesWith("asset.detach");                     // ["overlord"]
nextStates("asset_collaboration", "offline_editing", "detach");  // [] — blocked, not queued
LEASE_INACTIVITY_TIMEOUT_MS;                   // 1800000
```

## What is in it

| File | What it fixes |
| --- | --- |
| `schema/offline-workspace-entities-1.0.schema.json` | Every durable object, closed, plus the refusal envelope |
| `schema/offline-workspace-roles.json` | The Offline role → capability table, `aub-offline-workspace-roles/1.0` |
| `schema/offline-workspace-reason-codes.json` | 58 stable refusal codes, each with an HTTP status and a remedy |
| `schema/offline-workspace-state-machines.json` | 9 machines, 48 transitions, their guards, timestamps and idempotency identities |
| `schema/offline-workspace-policy.json` | The durations and bounds, each labelled `product` or `contract_default` |
| `schema/offline-workspace-asset-types.json` | What can be attached, and which types are mutable or Real-time eligible |
| `fixtures/` | The cross-language fixture set, including the two exhaustive golden matrices |

The JSON is the authority; `src/` is a **reader** for it, not a second copy. AUB is Go, AUC and AUP
are TypeScript, and anything that exercises this later will be Python — a capability matrix written
down in JavaScript would have to be written down twice more, and three sincere transcriptions of one
table is exactly the drift this package exists to remove. Adding a capability, a reason or a
transition is an edit to one JSON file and its tests, and no edit at all to `src/`.

## The product model, in one page

**Offline is AUB-authoritative and is not a Real-time session.** A Shared Workspace is durable, holds
many independently owned assets, and survives every participant being offline for a week.

- **Workspace ownership and asset ownership are separate.** The workspace Overlord administers the
  workspace and owns none of the assets contributed to it. Editing never transfers ownership, and
  **storage is always charged to the asset owner**, never to whoever pressed Save.
- **An asset belongs to at most one workspace.** Structurally: `asset_record.workspace_id` is one
  nullable id, so there is nowhere to write a second one.
- **One mutable asset has at most one Offline writer.** Different members editing different assets in
  one workspace is the normal case; two members editing one map is the case that does not exist.
- **Revision CAS is mandatory even under a lease.** The lease is concurrency policy; the CAS is the
  correctness guarantee. There is no merge, no CRDT, no operational transform and no last-write-wins.
- **A collision becomes an invitation, not a queue.** The blocked editor asks the incumbent, and the
  incumbent — the person holding the current work — decides whether to escalate into Real-time.
- **Stable ids bind everything.** Renaming a workspace, a map or a nickname breaks no membership, no
  lease, no invitation and no dependency.

Roles are the same four names as Real-time — Overlord, Lord, Knight, Pilgrim — in a **different
scope**, which is why the capability model has its own version string. Overlord and Lord edit and
save existing assets; a Knight contributes new ones and annotates but touches nothing that already
exists; a Pilgrim reads. Only the Overlord administers membership, roles, visibility and deletion.

Two capabilities deliberately **do not nest**: `member.leave` and `role_request.create` are held by
every role *except* Overlord. An owner who left would leave the workspace ownerless, and there is no
role above Overlord to request. Anything reasoning "higher rank implies the capability" is wrong
about those two today, not hypothetically — `capabilities.test.mjs` pins it.

## The state machines

Nine of them. The important one is `asset_collaboration`, and its shape is the product decision that
the older backlog got wrong:

```text
unattached ──attach──▶ workspace_idle ──acquire_lease──▶ offline_editing
                            ▲                                 │
                            │                     accept_escalation
        release / expire ───┘                                 ▼
                            ▲                        realtime_starting
                            │                          │           │
             session_ended ─┴──── realtime_active ◀────┘    session_failed
                                                                   │
                                          (lease alive) offline_editing
                                          (lease gone)  workspace_idle
```

There is **no workspace-wide Offline/Live mode**. Collaboration state belongs to the asset, so one
workspace can hold a map in a session, a map with an Offline editor, an idle map and a freshly
uploaded WAD at the same instant, and none of them freezes the others.

`realtime_starting` is server-owned and short, and it has a timeout. A transition state without one
is how a phantom lock is born, and a phantom lock on somebody's map is indistinguishable from the
product being broken.

**A transition that is not listed is not legal.** `nextStates` returns `[]` and `canTransition`
returns `false` for anything unlisted, so a server built on this refuses by default rather than by
remembering to. The guards are returned as data and evaluated by AUB, because every one of them is a
question about durable state inside a transaction and nobody else can answer it.

## Refusals are not incidents

A refusal is an expected, correct outcome of a rule: an asset already shared elsewhere, a lease
somebody else holds, a revision that moved. Reporting these to the incident backend would bury the
signal that something is *actually* broken under the noise of the product working as designed. The
taxonomy marks the one exception, `linked_session_creation_failed`, which is a component failing
rather than a rule refusing.

Every reason carries an HTTP status and a **remedy**, so the sentence a user reads names a real
action. `createRefusal` takes the status from the taxonomy rather than from the caller, so one reason
cannot be a 409 in AUB and a 403 in AUC.

```js
createRefusal("stale_asset_revision", { subject_type: "asset", subject_id: id, current_revision: 18 });
// { schema_version: "1.0", reason: "stale_asset_revision", http_status: 409, ... }
```

Clients pick their copy from `reason`. The optional `message` is diagnostic text for a log and is
never parsed — that is the whole reason the vocabulary is stable.

## Validation is on demand, and it returns

Per AULIBS rule 2.1: nothing here runs on import, on construction, on a save path or on a timer, and
nothing throws.

```js
const { valid, errors } = validateEntity("asset_edit_lease", record);
```

`src/validate.mjs` is a reader for the schema subset the entity file uses, so that a browser bundle
need not carry a general JSON Schema engine to check a fifteen-field object. It is allowed to exist
beside a real schema only because `test/contract.test.mjs` runs **ajv** over the identical cases and
fails if the two disagree.

## Cross-language fixtures

`fixtures/index.json` is the shared case list: 29 valid documents, 20 refused ones each naming the
field that refuses it, and two **exhaustive golden matrices** — 92 capability verdicts (4 roles × 23
capabilities) and 199 transition cells (every machine × state × event).

The goldens are generated from the contract and committed. A change to a table that nobody meant to
make fails a test instead of propagating into four repositories. Regenerate them in the same commit
as a deliberate change, never afterwards.

Each consuming repository runs the same files through its own reader, so a Go implementation that
disagrees with the JavaScript about one capability fails its own suite rather than being discovered
later by a user.

## Versioning

Contract `1.0` is **additive-only**. A new capability, reason, state or field may appear inside it; a
rename or a removal is a `2.0`, because four repositories read these names off the wire.
`test/versioning.test.mjs` spells the whole 1.0 surface out in full and fails on a deletion.

The capability model has its own version, `aub-offline-workspace-roles/1.0`, deliberately distinct
from AUB's Real-time `aub-collaboration-roles/1.0`. The four role names are shared and nothing else
is: the two vocabularies are disjoint apart from `annotation.read` and `annotation.write`, which mean
the same thing in both scopes.

A record declaring a version this build does not implement is refused with
`unsupported_contract_version`, never reinterpreted.

## What this contract deliberately does not contain

No discovery. The public-workspace extensions — `max_members`, `join_policy`, `workspace_public_card`
— are in the schema so that a listing can be built against a shape that was agreed rather than
invented, and nothing here lists, searches or joins anything.

No geometry merge, no CRDT, no operational transform, no branches, no forks, no lease takeover, no
force-kick of an active editor, no whole-workspace session, and no per-annotation recipient lists.
Those are non-goals, not omissions.

## Tests

```sh
cd ts/offline-workspace-contract && npm test     # 70 tests
# or, from the repository root, for every package:
./run.sh test
```

## Consumers

See `used-by.json`. Per AGENTS.md §3, a repository adopting this package adds itself there, and an
agent changing the package reads that file first and goes and looks at every consumer named in it.
