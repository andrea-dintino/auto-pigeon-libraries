# TypeScript packages

One folder per package.

| package | what it is |
| --- | --- |
| [`apmap-schema/`](apmap-schema/) | the canonical APMap JSON Schema (1.1, and 1.0 frozen) and its conformance vectors. Schema and tests only, no runtime code. |

The APMap reader/writer/validator library is the next to land here, and consumes
`apmap-schema` rather than embedding a copy of it.

Each package folder contains, at minimum:

```text
ts/<package-name>/
├── README.md       # what it is, how to use it, its public surface
├── used-by.json    # consumers, validating against ../../meta/used-by.schema.json
├── package.json    # with a `test` script — ./run.sh test calls it
└── src/ …  tests …
```

Rules that apply to every package here:

- **A package with no tests is not accepted.** `./run.sh test` runs each
  package's own `test` script from its own directory, so the package chooses its
  runner.
- **`used-by.json` is not optional**, and neither half of its protocol is. Read
  it and check the listed consumers before changing anything; a consumer repo
  adopting the package adds itself to it. See `AGENTS.md` §3.
- **Validation is on-demand only.** No checking on import, on construction, on
  load, on save, or on a timer. See `AGENTS.md` §2.1.
- Package names are lowercase kebab-case, matching the folder name, and the
  folder name is what `used-by.json`'s `package` field records (`ts/<name>`).

Consumers depend on a package by local path during development; see `AGENTS.md`
§5, including the unsolved Docker-build-context issue that the first adoption in
each consuming repository has to decide on.
