# APMap 1.1 — deprecated, and readable

**Deprecated means "not current / never written", not "unreadable".** 1.1 is a supported legacy
READ format: a service opens a 1.1 document, validates it against the frozen 1.1 contract, and
promotes it to current before anything is written or sent to collaboration.

Two different things carry the 1.1 name, and the distinction is the whole point of this file:

```text
schema/deprecated/apmap-1.1.schema.json   the CONTRACT — a runtime input, shipped with the package,
                                          loaded at startup by every backward-reading service
deprecated/1.1/  (this directory)         the CORPUS — historical evidence, not shipped, not a
                                          runtime input, referenced only by this repo's own tests
```

The contract file was **moved, not rewritten**, when 1.2 was promoted. Git records it as a pure
rename with zero content changes, and `test/schema.test.mjs` asserts its `apmap_version` enum is
still exactly `["1.0", "1.1"]` and that it never grew a `groups` member. A frozen contract that
gets edited stops being the record of what that version said.

## What was current when 1.1 was current

```text
one-one-document.apmap        a valid, otherwise-ordinary 1.1 document. The fixture a consumer
                              uses to prove its version gate refuses a deprecated document — it
                              must fail for its VERSION and for no other reason.
test-vectors/valid/           the six documents 1.1 required to be accepted
test-vectors/invalid/         the five it required to be rejected, each naming its rule
```

Their 1.2 descendants are in the package root's `test-vectors/`: the same documents promoted, plus
what 1.2 added.

## Why 1.1 stopped being current

1.2 made **groups** map working state. A named selection set has to be saved with the document,
undone with the document and seen by every collaborator; a record kept anywhere else is none of
those things. 1.1 had no place to put one, and `groups` is required of a 1.2 writer, so a producer
that emits groups is a 1.2 producer by definition.

Promotion from here is a header rewrite plus `groups: []` — see `promoteToCurrent` in
`test/helpers.mjs`, which is the one place these tests express it.
