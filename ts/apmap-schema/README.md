# `@auto-pigeon/apmap-schema`

The canonical JSON Schema for **APMap**, the native JSON geometry document shared by AI Map Copilot,
Auto-Pigeon, and the collaboration service.

**Schema and conformance vectors only — no runtime code.** The TypeScript reader, writer, and
validator are a separate package.

```text
schema/apmap-1.1.schema.json   the current contract; validates 1.0 and 1.1 documents
schema/apmap-1.0.schema.json   1.0, frozen, byte-identical to what 1.0 documents were validated against
test-vectors/                  documents that must be accepted and documents that must be rejected
```

## The compatibility promise

**Every valid APMap 1.0 document is a valid APMap 1.1 document.** 1.1 is strictly additive: it adds
one `derived_from` kind and one optional brush member, and changes nothing that 1.0 already defined.
A producer that has never heard of 1.1 keeps working, and a 1.1 consumer reads its output.

This is not asserted and left there. `test/schema.test.mjs` walks both schema documents and fails if
1.1 changed or removed anything 1.0 defined, and `test/corpus.test.mjs` validates the real corpus
under `$MAPPER_ROOT` — the published examples and vectors, the clean full-map corpus, and the AIM
codec exports — against 1.1. Sixty-three real 1.0 documents, written before 1.1 existed, are the
evidence.

The frozen `apmap-1.0.schema.json` stays for converters and archived documents, which need a fixed
reference rather than a moving one. A test asserts it is still byte-identical to the published
`$MAPPER_ROOT/formats/apmap/1.0/apmap.schema.json`, and another asserts it still refuses a document
declaring 1.1 — a frozen copy that quietly thawed would be worse than no copy.

## What 1.1 adds

### `derived_from` kind `operation`

Provenance that stays truthful after an edit.

In 1.0 an object's `derived_from` says where it came from — `source_map`, `package`, `authored`, or
`synthetic`. The moment an operation rewrites an object, a `source_map` record becomes a false
statement: the geometry no longer matches the named location in the named file. The `operation` kind
replaces it with something still true — *this object exists because operation X replaced its
ancestor.*

```json
{
  "kind": "operation",
  "operation_id": "op-4f1c8a20",
  "operation": "csg_carve",
  "ordinal": 0,
  "replaces": ["brs_ancestor00000a"],
  "intent": "carve a doorway through the north wall"
}
```

`kind` and `operation_id` are the whole of what is required; everything else is optional.

**It is not the same as `authored`,** which 1.0 already had and which also carries an `operation_id`.
`authored` records an object an operation *created*, and its identity is derived from
`document_id` + `operation_id` + `ordinal`. `operation` records an object that *supersedes* one that
was already there, and names what it superseded in `replaces`. A carve produces both kinds of
history and the two are not interchangeable.

**`intent` and `metadata` are annotation, never authorization.** Nothing may read either field to
decide whether an operation was permitted, what it was allowed to touch, or how to re-apply it. They
are written by whoever ran the operation, they are checked against nothing, and a document is not a
trusted channel. They exist so that a human reading provenance months later can tell why the geometry
changed. `additionalProperties` is `false` on the kind, so a producer cannot introduce a field a
consumer might mistake for permission — one of the rejection vectors is exactly that attempt.

### `broken` on a brush

```json
{ "kind": "brush", "brush_id": "brs_...", "faces": [...], "broken": true }
```

Optional boolean; absent means false, and there is no third state. It records that a brush is known
not to be a well-formed convex solid **and is being kept anyway** — CSG repair can fail, and the user
may decide the result is what they want for now.

It crosses the wire in collaborative sessions and survives Save. Export to `.map` warns and exports
anyway; that behaviour belongs to exporters rather than to this schema, and the schema says so in the
field's description so implementers inherit one intent instead of each inventing one.

Consistent with the repository's first product rule, the flag is not a validation result and this
schema never requires it to be present on a brush that is in fact broken. Nothing here validates
geometry on its own, and nothing may refuse to load, silently repair, or drop a brush because the
flag is set. A level in that condition is ordinary work in progress.

## Using it

```js
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '@auto-pigeon/apmap-schema/1.1' with { type: 'json' };

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
if (!validate(document)) console.log(validate.errors);   // when you ask, and only then
```

`@auto-pigeon/apmap-schema` resolves to the 1.1 schema; `/1.0` to the frozen copy.

`ajv/dist/2020` is the reference validator because it is what Auto-Pigeon's own APMap pipeline
compiles this schema with. Any 2020-12 validator will do.

## What the schema cannot say

JSON Schema covers structure. The APMap rules numbered `SEM-*` — one id per object, relationship
endpoints that exist, a brush that encloses a finite volume, plane points that are not collinear,
numbers that are finite — are not expressible in it and are a validator's job. Seven of the published
1.0 rejection vectors pass this schema for exactly that reason; that is the design, not a gap. See
`$MAPPER_ROOT/formats/apmap/1.0/README.md` for the rule catalogue.

## Tests

```bash
npm test            # from this directory
./run.sh test       # from the repository root, with every other package
```

The corpus tests need `$MAPPER_ROOT`; from a bare public clone they skip and say so, and the rest
still runs.
