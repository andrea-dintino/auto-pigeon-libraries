# `@auto-pigeon/apmap-schema`

The canonical JSON Schema for **APMap**, the native JSON geometry document shared by AI Map Copilot,
Auto-Pigeon, and the collaboration service.

**Schema and conformance vectors only — no runtime code.** The TypeScript reader, writer, and
validator are a separate package.

```text
1.1 = current runtime contract
1.0 = deprecated historical contract
```

```text
schema/apmap-1.1.schema.json          THE current contract — exactly one file lives here
schema/deprecated/apmap-1.0.schema.json   frozen history; not exported, not discoverable
SEMANTICS.md                          the normative specification, SCH-* and SEM-* rules
test-vectors/                         conformance vectors for the CURRENT contract
deprecated/1.0/                       the published 1.0 corpus, examples, and the rejection fixture
workspace/ (repository root)          the canonical workspace manifest
```

## The runtime doctrine

```text
READ       current only
WRITE      current only
VALIDATE   current only
```

A document declaring a deprecated version is **refused by every service's version gate, before
schema validation is reached**. There is no compatibility matrix, no version chooser, and no
fallback: `schema/` holds exactly one `apmap-*.schema.json`, its filename carries the current
version, and every service derives that version by reading the directory at startup. Promoting 1.2
is one file rename.

The current schema's `apmap_version` enum still contains `1.0`, so it would *structurally* accept a
1.0-shaped document. **That creates no support promise.** The gate runs first, and the gate is what
the doctrine is enforced by — a test in `contract-integrity.test.mjs` says so, precisely so that
nobody later "fixes" the enum believing it is the mechanism.

## What is deprecated, and what that means

`schema/deprecated/` and `deprecated/1.0/` exist for historical evidence, this repository's own
history tests, and future explicit migration tooling. No product code loads them; they are outside
`exports` by construction, and discovery reads direct children of `schema/` only, so a deprecated
schema cannot be found even by accident. `deprecated/1.0/README.md` is the full account.

## How 1.1 relates to 1.0 — history, not a promise

1.1 was built **additively** from 1.0: it adds one `derived_from` kind (`operation`) and one
optional brush member (`broken`), and changes nothing 1.0 already defined. `test/schema.test.mjs`
walks both documents and fails if that stops being true.

That matters for exactly one reason: it means a future migration can rewrite a document's declared
version and nothing else. `test/deprecated-history.test.mjs` proves it over the whole published 1.0
corpus, and `test/corpus.test.mjs` proves it over the generated corpora when they are mounted. It
does **not** mean a 1.0 document is accepted anywhere — it is refused at the gate.

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
