# `@auto-pigeon/apmap-schema`

The canonical JSON Schema for **APMap**, the native JSON geometry document shared by AI Map Copilot,
Auto-Pigeon, and the collaboration service.

**Schema and conformance vectors only — no runtime code.** The TypeScript reader, writer, and
validator are a separate package.

```text
1.1 = current READ + WRITE contract
1.0 = deprecated legacy READ contract
```

```text
schema/apmap-1.1.schema.json              THE current contract — exactly one file lives here
schema/deprecated/apmap-1.0.schema.json   a supported LEGACY READ contract — never written
SEMANTICS.md                              the normative specification, SCH-* and SEM-* rules
test-vectors/                             conformance vectors for the CURRENT contract
deprecated/1.0/                           the published 1.0 corpus and examples
workspace/ (repository root)              the canonical workspace manifest
```

## The runtime doctrine

```text
READ        current + every supported legacy format
WRITE       current only
VALIDATE    with the schema matching the document being read
WIRE/COLLAB current only
```

Today that resolves to: read 1.0 and 1.1, write 1.1.

**It is not a compatibility matrix.** Nothing here, and nothing in any consumer, maintains a list of
supported versions. The directory layout IS the policy, and every service derives both halves of it
by reading the directory at startup:

```text
the ONE direct schema/apmap-*.schema.json   CURRENT — the only format anything writes
each schema/deprecated/apmap-*.schema.json  LEGACY  — readable, never written
```

Depth is the whole mechanism. The current-schema scan reads **direct children only**, so a
deprecated contract can never be mistaken for the writer's; a reader that wants backward
compatibility enumerates `deprecated/` deliberately. Promoting 1.2 is one file rename and one file
move.

`deprecated` means **"not current / never written"**, not "unreadable". A format that becomes
genuinely unreadable does not stay here — it moves out of the readable tree into an explicitly
unsupported archive, and that decision has not been taken for any version.

A document declaring a version this bundle does not hold is refused at the version gate, before
schema validation is reached. Unknown future versions are still refused; that has not changed.

The current schema's `apmap_version` enum still contains `1.0`, so it would *structurally* accept a
1.0-shaped document. **That is not how a 1.0 document gets read.** A reader picks the schema
matching the declared version, so a 1.0 document is validated against the frozen 1.0 contract and
never against this one. `contract-integrity.test.mjs` asserts it, precisely so that nobody later
"fixes" the enum believing it is the mechanism behind either rule.

## Reading a legacy document, and why nothing writes one

`schema/deprecated/` ships with the package (`files` lists `schema`, which carries the subdirectory
with it) because a runtime reader consumes the contract **directory**, not a single file. A
published tarball missing the legacy contract would be a build that cannot open the maps its own
users already have.

What stays closed is the *writer's* door. There is no `/1.0` export, no per-version export subpath,
and no package API that lets a producer select a contract: `exports` resolves to the current schema
and nothing else, and `contract-integrity.test.mjs` fails if a versioned subpath ever appears. A
consumer that can choose a version is a consumer that will eventually choose the wrong one.

`deprecated/1.0/` — the published corpus and examples, as distinct from the contract — is historical
evidence for this repository's own tests. It is not shipped and is not a runtime input.
`deprecated/1.0/README.md` is the full account.

## How 1.1 relates to 1.0 — additive, which is what makes migration cheap

1.1 was built **additively** from 1.0: it adds one `derived_from` kind (`operation`) and one
optional brush member (`broken`), and changes nothing 1.0 already defined. `test/schema.test.mjs`
walks both documents and fails if that stops being true.

That matters for exactly one reason: a 1.0 → 1.1 migration can rewrite a document's declared version
and nothing else — no geometry, no identity, no provenance. `test/deprecated-history.test.mjs`
proves it over the whole published 1.0 corpus, and `test/corpus.test.mjs` proves it over the
generated corpora when they are mounted. That is what lets a consumer open a legacy document,
promote it in memory, and write current bytes without a migration wizard or a lossy conversion.

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

Writing, or validating something you are about to write — the package default, and the only
contract a producer may ever hold:

```js
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '@auto-pigeon/apmap-schema' with { type: 'json' };

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
if (!validate(document)) console.log(validate.errors);   // when you ask, and only then
```

`@auto-pigeon/apmap-schema` and `@auto-pigeon/apmap-schema/schema` both resolve to the current
schema. There is no `/1.0` subpath and no version argument.

Reading, where a legacy document may arrive: take the schema **directory** and load the bundle, the
way a service does at startup. `test/helpers.mjs`'s `loadContractBundle` is the reference shape —
one current schema, every `deprecated/apmap-*.schema.json` beside it, keyed by the version each
filename carries — and every fault in it is a startup failure, including a broken legacy contract
nothing has asked for yet.

`ajv/dist/2020` is the reference validator because it is what Auto-Pigeon's own APMap pipeline
compiles this schema with. Any 2020-12 validator will do.

## What the schema cannot say

JSON Schema covers structure. The APMap rules numbered `SEM-*` — one id per object, relationship
endpoints that exist, a brush that encloses a finite volume, plane points that are not collinear,
numbers that are finite — are not expressible in it and are a validator's job. Seven of the published
1.0 rejection vectors pass this schema for exactly that reason; that is the design, not a gap.
`SEMANTICS.md` in this package is the rule catalogue.

## Tests

```bash
npm test            # from this directory
./run.sh test       # from the repository root, with every other package
```

The corpus tests need `$MAPPER_ROOT`; from a bare public clone they skip and say so, and the rest
still runs.
