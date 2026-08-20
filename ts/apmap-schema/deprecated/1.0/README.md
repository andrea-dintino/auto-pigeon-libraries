# APMap 1.0 — deprecated, and readable

**Deprecated means "not current / never written", not "unreadable".** 1.0 is a supported legacy
READ format: a service opens a 1.0 document, validates it against the frozen 1.0 contract, and
normalizes it to current before anything is written or sent to collaboration.

Two different things carry the 1.0 name, and the distinction is the whole point of this file:

```text
schema/deprecated/apmap-1.0.schema.json   the CONTRACT — a runtime input, shipped with the package,
                                          loaded at startup by every backward-reading service
deprecated/1.0/  (this directory)         the CORPUS — historical evidence, not shipped, not a
                                          runtime input, referenced only by this repo's own tests
```

This directory exists for three purposes and no others:

1. **historical evidence** — what the 1.0 contract actually said, frozen;
2. **conformance/history tests** in this repository, which reference these paths explicitly;
3. **migration fixtures** — the vectors a 1.0 → 1.1 promotion is proved against.

## The runtime doctrine this sits underneath

```text
READ        current + every supported legacy format   (today: 1.0 and 1.1)
WRITE       current only                              (today: 1.1)
VALIDATE    with the schema matching the document being read
WIRE/COLLAB current only
```

A document declaring `"apmap_version": "1.0"` is validated against the frozen 1.0 schema beside the
current one — **not** against the current schema. That the current schema's `apmap_version` enum
still contains `1.0`, so it would structurally accept a 1.0-shaped document, is irrelevant to how a
1.0 document is actually read, and creates no promise about what anything writes.

The writer's door stays closed: `exports` resolves to the current schema, there is no `/1.0`
subpath, and no producer may select a contract.

## What is here

```text
schema/deprecated/apmap-1.0.schema.json   the frozen 1.0 contract (one directory up, beside the current one)
deprecated/1.0/test-vectors/valid/        11 published 1.0 vectors + index.json + README.md
deprecated/1.0/test-vectors/invalid/      21 published rejection vectors + index.json + README.md
deprecated/1.0/examples/                  the two published 1.0 examples
deprecated/1.0/one-zero-document.apmap    a 1.0-declaring document, the canonical fixture consumers
                                          use to prove they can READ 1.0 and still write 1.1
```

`one-zero-document.apmap` sat in the current `test-vectors/valid/` set until PREPROD-01B, described
as "the compatibility promise, in one file: a 1.0 document is a valid 1.1 document". PREPROD-01B
made it prove the opposite — that 1.0 was refused. It is now neither: a 1.0 document is *read* as
1.0, against 1.0's own contract, and promoted before it is written back. The file has never
changed; its meaning has, twice, which is why the account of it lives here rather than in a commit
message.

Every file here is byte-identical to what was published at `$MAPPER_ROOT/formats/apmap/1.0/`.
Do not edit them to make a test pass; a frozen contract that quietly thawed would be worse than no
frozen contract.
