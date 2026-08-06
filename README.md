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
├── fixtures/                 # shared apmap fixtures (see fixtures/README.md)
├── ts/                       # one folder per TypeScript package
└── go/                       # one folder per Go package (none yet)
```

Every package folder carries its own `README.md` and its own `used-by.json`,
which names the repositories that consume it and validates against
`meta/used-by.schema.json`.

There are no packages yet. The apmap schema and the TypeScript apmap library
are the first to land.

## Running the tests

```bash
./run.sh test
```

It runs every TypeScript package's own `test` script and, once Go packages
exist, `go test ./...`. With no packages present it exits 0 and says so:

```text
run.sh: no packages yet — nothing to test.
run.sh: ts/ and go/ hold no package; this is the expected state until the first package lands.
```

## Using a package

Local-path dependencies are preferred during development; a git-URL dependency
pinned to a commit is the fallback. npm and Go module publication are deferred.

Note that a local-path dependency points outside a consuming repository's Docker
build context, so a consumer that builds an image has to decide how `docker
build` resolves it. See [`AGENTS.md`](AGENTS.md) §5.

## Contributing

[`AGENTS.md`](AGENTS.md) is the authority on how work is done here: the two
product rules, the `used-by.json` protocol, layout, testing, and commit policy.
