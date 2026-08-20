# APMap 1.0 — deprecated, historical only

**Nothing in this directory is a runtime surface.** No product code loads it, no service resolves
it, and it is outside the package's `exports` by construction. It exists for three purposes and no
others:

1. **historical evidence** — what the 1.0 contract actually said, frozen;
2. **conformance/history tests** in this repository, which reference these paths explicitly;
3. **future explicit migration tooling**, if and when someone writes it.

## The runtime doctrine this sits underneath

```text
READ       current only
WRITE      current only
VALIDATE   current only
```

A document declaring `"apmap_version": "1.0"` is refused by every service's **version gate, before
schema validation is reached**. That the current schema's `apmap_version` enum still contains `1.0`
— so it would structurally accept a 1.0-shaped document — creates no support promise whatsoever.
The gate runs first, and the gate is what the doctrine is enforced by.

## What is here

```text
schema/deprecated/apmap-1.0.schema.json   the frozen 1.0 schema (one directory up, beside the current one)
deprecated/1.0/test-vectors/valid/        11 published 1.0 vectors + index.json + README.md
deprecated/1.0/test-vectors/invalid/      21 published rejection vectors + index.json + README.md
deprecated/1.0/examples/                  the two published 1.0 examples
deprecated/1.0/one-zero-document.apmap    a 1.0-declaring document, kept as the canonical fixture
                                          consumers use to prove their version gate REFUSES 1.0
```

`one-zero-document.apmap` used to sit in the current `test-vectors/valid/` set, described as "the
compatibility promise, in one file: a 1.0 document is a valid 1.1 document". That promise is no
longer the product's doctrine. The file is unchanged; only its meaning is, and it now proves the
opposite thing — that a 1.0 document is refused.

Every file here is byte-identical to what was published at `$MAPPER_ROOT/formats/apmap/1.0/`.
Do not edit them to make a test pass; a frozen contract that quietly thawed would be worse than no
frozen contract.
