# Auto-Pigeon Libraries

Shared libraries for the Auto-Pigeon project — TypeScript now, Go later —
consumed by the Auto-Pigeon editor, backend, collaboration server, gallery, and
extractor.

This repository ships libraries. It is not a service and has no runtime of its
own.

## Licence

Apache License 2.0. See [`LICENSE`](LICENSE).

## Validation happens only when you ask for it

Functions in these libraries may check a map — its schema, the convexity of its
brushes, holes in its geometry, anything else — **when you call them**. Nothing
here validates on its own: not when a document is loaded, not when it is saved,
not on a timer, not in a background worker. This is a deliberate API decision
rather than an implementation gap. Levels are routinely "broken" simply because
someone is still working on them, and a half-carved brush is an ordinary
intermediate state, not an error. So a validation result is a value returned to
a caller who asked for it, and the caller decides what it means. Nothing in
these libraries wakes up and declares your map broken.

## Layout

```text
auto-pigeon-libraries/
├── meta/used-by.schema.json  # schema for each package's consumer manifest
├── workspace/                # the canonical Auto-Pigeon workspace manifest (see workspace/README.md)
├── fixtures/                 # shared apmap fixtures (see fixtures/README.md)
├── ts/                       # one folder per TypeScript package
└── go/                       # one folder per Go package (none yet)
```

Every package folder carries its own `README.md` and its own `used-by.json`,
which names the repositories that consume it and validates against
`meta/used-by.schema.json`.

| package | what it is |
| --- | --- |
| [`ts/apmap-schema`](ts/apmap-schema/) | the canonical APMap contract. **1.1 = current READ + WRITE contract; 1.0 = deprecated legacy READ contract.** Exactly one current schema, the legacy contracts beside it under `schema/deprecated/`, the normative `SEMANTICS.md`, and the conformance vectors. Contract material only, no runtime code. |

The TypeScript APMap reader/writer/validator is next; it will consume
`apmap-schema` rather than carry its own copy.

## Running the tests

```bash
./run.sh test
```

It runs every TypeScript package's own `test` script and, once Go packages
exist, `go test ./...`. A package whose dependencies are not installed yet gets
them installed on that first run. With no packages present at all it exits 0 and
says there is nothing to test, rather than failing or printing a green summary
for a suite that never ran.

Some tests read the generated corpora at `$MAPPER_ROOT`, which are not part of
this repository. From a bare clone each skips by name, and everything else runs —
including the whole published contract, current and deprecated.

## The APMap contract, in one sentence

`ts/apmap-schema/schema/` holds **exactly one** `apmap-*.schema.json` — the current contract, the
only format anything writes — and `schema/deprecated/` holds the supported legacy READ contracts
beside it; every service loads the whole directory at startup, derives each version from its
filename, validates a document against the schema matching what that document declares, and refuses
a version the bundle does not hold.

```text
READ        current + supported legacy   (today: 1.0 and 1.1)
WRITE       current only                 (today: 1.1)
VALIDATE    with the schema matching the document
WIRE/COLLAB current only
```

Depth is the mechanism: current discovery reads direct children only, so a deprecated schema can
never become the writer's contract, and `exports` offers no per-version subpath for a producer to
reach for.

## The workspace manifest

[`workspace/auto-pigeon-workspace.json`](workspace/) names the repositories that make up an
Auto-Pigeon workspace, with their aliases, directory names and clone URLs. It is the single
canonical list: `auto-pigeon-tools` resolves workspace topology from it, derives the APMap schema
directory from its AULIBS entry, and its clone and pull scripts derive what to clone and pull from
it rather than each carrying a copy.

Topology only. No machine paths, no `$MAPPER_ROOT`, no ports, no secrets — and no schema path, which
AUT derives rather than reads.

## Using a package

Local-path dependencies are preferred during development; a git-URL dependency
pinned to a commit is the fallback. npm and Go module publication are deferred.

Note that a local-path dependency points outside a consuming repository's Docker
build context, so a consumer that builds an image has to decide how `docker
build` resolves it. See [`AGENTS.md`](AGENTS.md) §5.

## Contributing

[`AGENTS.md`](AGENTS.md) is the authority on how work is done here: the two
product rules, the `used-by.json` protocol, layout, testing, and commit policy.
