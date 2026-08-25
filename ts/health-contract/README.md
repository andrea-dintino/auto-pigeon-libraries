# `@auto-pigeon/health-contract`

The two documents every long-lived Auto-Pigeon HTTP service answers with, and the
topology-independent half of the stack's Gatus configuration. Schemas and one static template — no
runtime code, and no running service. AULIBS owns the *contract*; `auto-pigeon-tools` owns the
*integration*.

## The version format

```text
1.<commit-count>            git rev-list --count HEAD
```

`AUP 1.842`, `AUB 1.517`, `AUC 1.304`. Each repository counts its own history: the numbers are
independent and are not meant to agree. The version is **never** a commit hash, a timestamp, a
branch name or a package manager's `0.1.0-dev`. A hash may travel beside it as `commit_hash`, which
is diagnostic metadata and is never what a person is shown.

`dirty` is separate metadata rather than a suffix. `1.842-dirty` would be a second version string
for one commit and would break the property the format was chosen for — that two versions compare
by reading two numbers.

## `GET /version`

Unauthenticated, cheap, and closed: [`schema/version-response.schema.json`](schema/version-response.schema.json)
sets `additionalProperties: false` on purpose.

```json
{
  "component": "auto-pigeon-backend",
  "version": "1.517",
  "commit_count": 517,
  "commit_hash": "a1b2c3d4e5f6",
  "dirty": false
}
```

No filesystem path, no environment, no configuration, no dependency inventory, no branch. Those are
the fields a version endpoint accumulates once it is allowed to become a diagnostics endpoint, and
each one is something an unauthenticated caller learns about a deployment it does not own.

A component that already has a canonical status document (AUP's `/api/status`) may carry the
version there as well. `/version` stays the uniform cross-stack probe, so a monitor needs one route
rather than one route per component.

## `GET /healthz`

Unauthenticated liveness, carrying the component's identity **and its version**:

```json
{ "status": "ok", "component": "auto-pigeon-backend", "version": "1.517" }
```

That one extra field is what makes stale-version detection need no code at all: the monitor already
polls this route, and asserting `[BODY].version == 1.517` in the same check it uses for liveness is
a condition, not a program.

[`schema/healthz-response.schema.json`](schema/healthz-response.schema.json) is deliberately open
where `/version` is closed — `/healthz` is where a component reports the one or two facts only it
can know (AUB's database readiness; the AUE image its scheduler is configured with), and closing it
would mean a schema change per component. What stays forbidden is unchanged: secrets, paths,
environment, unbounded work, and any downstream cascade. A health check that queries three services
turns one component's outage into four red lights.

`/readyz` is optional and belongs only to a component with a readiness genuinely distinct from
liveness. AUC has one and already serves it at `/ready`.

## The Gatus base configuration

[`gatus/base.yaml`](gatus/base.yaml) holds what is identical on every machine: the dashboard's
title, SQLite history, the container port, probe concurrency. It contains no endpoint, no host, no
port mapping and no secret, because none of those is knowable here.

`auto-pigeon-tools` reads it, appends the `endpoints:` block for the topology it just launched — from
the same port/origin resolver that started the stack, never a second hard-coded list — and writes
the result into that stack's runtime directory. Editing this file changes every stack; editing a
generated file changes one launch and is overwritten by the next.

Gatus itself is third-party: [github.com/TwiN/gatus](https://github.com/TwiN/gatus), Apache-2.0. It
is run from its official image, pinned to an exact release and digest by `auto-pigeon-tools`, and it
is reported by its own upstream version (`v5.36.0`) — never relabelled as `1.<count>`, which would
claim Auto-Pigeon authorship of somebody else's release.

## AULIBS has no `/version`

AULIBS is not a service, so it has no endpoint to add one to. Its `1.N` is published the two ways a
library can publish one: `auto-pigeon-tools` prints it in the launch manifest and shows it on the
dashboard, and the APMap contract bundle's provenance manifest records the AULIBS version the
schemas were staged from.

## Tests

```bash
npm test          # from this directory
./run.sh test     # from the repository root, for every package
```
