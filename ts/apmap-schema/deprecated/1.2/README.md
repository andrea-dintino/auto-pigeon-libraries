# APMap 1.2 — deprecated, and readable

**Deprecated means "not current / never written", not "unreadable".** 1.2 is a supported legacy
READ format: a service opens a 1.2 document, validates it against the frozen 1.2 contract, and
promotes it to current before anything is written or sent to collaboration.

Two different things carry the 1.2 name, and the distinction is the whole point of this file:

```text
schema/deprecated/apmap-1.2.schema.json   the CONTRACT — a runtime input, shipped with the package,
                                          loaded at startup by every backward-reading service
deprecated/1.2/  (this directory)         the CORPUS — historical evidence, not shipped, not a
                                          runtime input, referenced only by this repo's own tests
```

The contract file was **moved, not rewritten**, when 1.3 was promoted. Git records it as a pure
rename with zero content changes, and `test/schema.test.mjs` asserts its `apmap_version` enum is
still exactly `["1.0", "1.1", "1.2"]` and that its `group` definition never grew a `source` member.
A frozen contract that gets edited stops being the record of what that version said.

## What was current when 1.2 was current

```text
one-two-document.apmap        a valid, otherwise-ordinary 1.2 document. The fixture a consumer
                              uses to prove its version gate reads a deprecated document as that
                              version — it must differ from a current one by its header alone.
test-vectors/valid/           the nine documents 1.2 required to be accepted
test-vectors/invalid/         the thirteen it required to be rejected, each naming its rule
```

Their 1.3 descendants are in the package root's `test-vectors/`: the same documents promoted, plus
what 1.3 added.

One of the invalid vectors here declares `"1.3"` — the version 1.2 had never heard of, which is
exactly what it was testing. That vector is **why the current set no longer uses the next minor as
its unknown-version sentinel**: promoting 1.3 turned a rejection fixture into a valid document
overnight. The current one declares `999.999`, which no promotion will ever reach.

## Why 1.2 stopped being current

1.3 made **where a group came from** part of the document. A group created by placing a prefab knew
that fact only in browser memory: it survived until the tab was reloaded and no further, because
1.2's group object is `additionalProperties: false` and had nowhere to put it. So the "from prefab"
tag, the prefab screenshot on the group card, and the Create-Prefab gate that depends on them all
evaporated on reload. `group.source` is that fact, made durable.

It is **optional**, which is what keeps promotion from here free: a 1.2 group becomes a 1.3 group
with the same `group_id`, the same name, the same members and no `source` at all. Nothing invents
provenance for a group that never had any — see `promoteToCurrent` in `test/helpers.mjs`, which is
the one place these tests express the promotion.
