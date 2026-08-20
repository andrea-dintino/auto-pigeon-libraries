<!--
  CANONICAL LOCATION: auto-pigeon-libraries/ts/apmap-schema/SEMANTICS.md

  The normative APMap specification: document shape, identity, coordinate frame, canonical
  serialization, and — §10 and §11 — the split between what JSON Schema enforces (SCH-*) and what a
  consumer must enforce in code (SEM-*).

  THIS IS CURRENT CONTRACT MATERIAL, not history. The SEM-* rules are what every consumer's semantic
  checker implements, and the current contract inherits them unchanged. The title says 1.0 because
  that is the version the document was written for and 1.0 is frozen; 1.1 adds one `derived_from`
  kind and one optional brush member and changes nothing here.

  It was published at $MAPPER_ROOT/formats/apmap/1.0/README.md until this repository became the
  authority, so that a public clone can read the normative rule catalogue without a data root.

  The DEPRECATED 1.0 material — the frozen schema, its conformance vectors and its examples — is
  under schema/deprecated/ and deprecated/1.0/. None of it is a runtime surface.
-->

# APMap 1.0

APMap is the native JSON geometry-document format shared by **AI Map Copilot**
(AIM), **Auto-Pigeon** (AUP), and the future collaboration service.

One `.apmap` file is **one geometry document or one prefab geometry layer**. It
carries geometry, stable identity, coordinate-frame information, the object
metadata needed to interpret that geometry, and the references required by
geometry relationships.

It does **not** carry package classification, behaviour, validation results,
recipes, or review evidence. Those stay in their existing sidecars
(`prefab.json`, `classification.json`, `provenance.json`, `validation.json`,
`recipe.json`).

| file | content |
| --- | --- |
| `apmap.schema.json` | JSON Schema 2020-12, `$id` `https://auto-pigeon.org/schemas/apmap/1.0/apmap.schema.json` |
| `examples/minimal.apmap` | the smallest legal document |
| `examples/prefab-core.apmap` | a real extracted Quake 1 `func_door` prefab core |
| `test-vectors/valid/` | 10 documents that must be accepted |
| `test-vectors/invalid/` | 21 documents that must be rejected, each naming its rule |

---

## 1. Package layout

A prefab package uses **same-stem geometry siblings**. The `.map` files remain
exactly as they are; the `.apmap` files are added beside them.

```text
prefab.map                 prefab.apmap             role: prefab_core
context.map                context.apmap            role: reference_context
context-cropped.map        context-cropped.apmap    role: cropped_context
```

A standalone map uses `role: full_map`.

---

## 2. Document shape

```json
{
  "$schema": "https://auto-pigeon.org/schemas/apmap/1.0/apmap.schema.json",
  "apmap_version": "1.0",
  "document_id": "01jqapmapprefabcoredoor01",
  "revision": 0,
  "role": "prefab_core",
  "game": "quake1",
  "map_dialect": "quake_standard",
  "id_policy": "derived",
  "frame": { },
  "provenance": { },
  "entities": [ ],
  "relationships": [ ],
  "extensions": { }
}
```

`$schema`, `provenance`, `relationships` and `extensions` are optional. Every
other member is required. The member order above is the canonical order
(rule SER-5).

### `role`

| role | meaning | insertable |
| --- | --- | --- |
| `full_map` | a complete map document | — |
| `prefab_core` | the insertable prefab geometry | yes |
| `reference_context` | the host geometry around the core, review evidence | no |
| `cropped_context` | context clipped to a box around the core, display-only | no |

`cropped_context` documents contain invented cap faces (§7) and must never be
committed into an active map.

### `game` and `map_dialect`

APMap 1.0 normatively specifies **Quake 1 only**, with both classic and Valve
220 face syntax. Both members are constrained strings, and these names are
reserved so a later version adds semantics rather than fields:

```text
game:        quake1  quake2  quake3  half_life
map_dialect: quake_standard  valve_220  quake2_extended  quake3_extended  vmf
```

A 1.0 consumer that does not implement a reserved name must reject the document
rather than guess. Quake 2-style trailing numeric face values still round-trip
verbatim in `face.tail` (§6.3) because AIM's parser already carries them; 1.0
does not interpret them.

---

## 3. Identity

Keep four concepts separate.

| field | meaning |
| --- | --- |
| `apmap_version` | file-format and schema version |
| `document_id` | permanent identity of this independent document |
| `revision` | durable revision number of the document |
| `entity_id` / `brush_id` / `face_id` | stable identity **within** the document |

### 3.1 Complete identity is `(document_id, object_id)`

```json
{ "document_id": "document-B", "object_id": "brs_1c77e0a942fb5d38" }
```

No API, lease, operation, or database record may treat `brs_1c77e0a942fb5d38`
alone as globally unique.

### 3.2 Cloning

A clone receives a **new `document_id`** and initially **preserves every
internal object id**:

```text
Original: document-A / brs_1c77e0a942fb5d38
Clone:    document-B / brs_1c77e0a942fb5d38
```

These are different objects, because `(document-A, X) ≠ (document-B, X)`.
Preserving internal ids avoids rewriting references, constraints, prefab
relationships, and annotations; the two documents are independent immediately
because every operation and lease is scoped by `document_id`.

### 3.3 Object id syntax

```text
entity  ent_<16 hex>       ^ent_[0-9A-Za-z]{8,64}$
brush   brs_<16 hex>       ^brs_[0-9A-Za-z]{8,64}$
face    fac_<16 hex>       ^fac_[0-9A-Za-z]{8,64}$
```

The typed prefix makes a relationship endpoint self-describing and makes a
brush id used where an entity id belongs a schema error, not a silent bug.

### 3.4 `id_policy`

| policy | contract |
| --- | --- |
| `derived` | every object carries `derived_from`, and its id **equals** the digest of that record's identity inputs. Verifiable and reproducible. |
| `minted` | ids are opaque and producer-assigned. `derived_from`, if present, is provenance only and is not checked. |

AIM emits `derived`, so regenerating a package reproduces byte-identical ids.

### 3.5 The derivation algorithm

```text
US       = U+001F (unit separator)
payload  = "apmap/1.0" US kind US c1 US c2 US ... US cN
digest   = lowercase_hex( SHA-256( UTF-8(payload) ) )[0:16]
id       = prefix(kind) + "_" + digest
```

`kind` is `entity`, `brush`, or `face`, and is part of the payload, so an entity
and the brush at the same source path can never collide. `US` cannot occur in a
component. SHA-256 is mandatory — never a language's built-in `hash()`, which is
randomized per process.

**Components by `derived_from.kind`:**

| kind | components |
| --- | --- |
| `source_map` | `source_map`, `source_sha256`, `source_path` |
| `package` | `package_id`, `role`, `object_path` |
| `authored` | `document_id`, `operation_id`, `ordinal` (decimal, no padding) |
| `synthetic` | none mandated in 1.0; the producer assigns the id |

`source_path` addresses the object inside the **source** map; `object_path`
addresses it inside **this** document. Both use the same grammar:

```text
e30            entity 30
e30.b0         its first brush
e30.b0.f0      that brush's first face
```

Use `source_map` when the producer knows the exact source object and the source
file's hash. Use `package` when the stable semantic identity is the published
package rather than a source file — an extraction package whose layers are
regenerated as a unit, where the source object for a host context brush is not
individually tracked. `role` is part of the digest, so the same `object_path` in
`prefab.apmap` and `context.apmap` yields **different** ids: those two documents
describe different objects at that path, and a matching id would invite a false
correlation.

### 3.6 What identity must **not** depend on

The digest inputs are exactly the members listed above. Everything else in
`derived_from` — `source_entity_index`, `source_brush_position`,
`origin_at_extraction`, `bounds_at_extraction` — is **provenance**, recorded for
reconstruction and debugging, and never fed back into identity.

This is deliberate and load-bearing. Coordinates are recorded but excluded, so
that a live operation such as

> move `brs_1c77e0a942fb5d38` 32 units left

leaves the object's identity intact. An id derived from geometry would change on
every move and every journal reference would dangle.

Ids therefore remain stable when geometry, texture, metadata, or array position
changes, and are never derived from output array position, parser order of the
output document, geometry hashes, or texture values.

**A source-derived id does change when the source map changes**, because
`source_sha256` is an input. That is correct: re-extracting from a modified
`e1m4.map` genuinely yields different objects, and silently reusing the old ids
would assert an equivalence nobody verified.

### 3.7 Objects with no source

Geometry a user draws in the browser has no source object. Its identity comes
from the **operation journal**, which is itself deterministic:

```json
{
  "brush_id": "brs_7ae30f19c5d2b84a",
  "derived_from": {
    "kind": "authored",
    "document_id": "01jq...",
    "operation_id": "op-9f2a",
    "ordinal": 1
  }
}
```

Replaying the same journal against the same document reproduces every id
exactly, so a recovered WIP checkpoint and a replayed session agree.

`ordinal` counts objects created by **one** operation, starting at 0. One
operation that creates an entity, its brush, and six faces uses ordinals 0..7.

---

## 4. Coordinate frame

Every document declares its own space and the transform back to source world, so
**a consumer never reads a sidecar to place geometry**.

```json
"frame": {
  "space": "prefab_local",
  "units": "quake_unit",
  "coordinate_system": { "handedness": "right", "up_axis": "z" },
  "to_source": { "type": "translation", "translation": [1224, 999, 1384] }
}
```

`to_source` maps this document's coordinates **into** source-world coordinates.
Applying it to a `prefab_local` point yields the point's original position in
the source map.

| space | meaning |
| --- | --- |
| `source_world` | the source map's own coordinates; `to_source` must be `identity` |
| `prefab_local` | canonicalized prefab coordinates; `to_source` carries the translation |

This solves a real problem. In today's packages `prefab.map` is prefab-local
(`( -112 9 192 )`) while its sibling `context.map` is source-world
(`( 1056 752 1384 )`), reconciled only by `provenance.json`. AUP currently
searches five candidate metadata key paths for that transform and withholds the
whole context layer when none parse. With APMap each document answers for
itself.

**1.0 permits `identity` and `translation` only.** The name `affine` is reserved
and is rejected by the 1.0 schema. Every artifact that exists today is a pure
translation, and AUP's renderer already refuses rotated transforms, so allowing
a matrix nobody emits would only create documents that validate and cannot be
drawn.

`units` is `quake_unit`. `coordinate_system` is optional and, when present, must
be right-handed and Z-up.

---

## 5. Entities and ordered content

An entity is an **ordered** list of content items. Repeated keys are legal and
their position relative to brushes is significant, so a `.map` entity
round-trips exactly.

```json
{
  "entity_id": "ent_432a6b642793e26b",
  "derived_from": { "kind": "source_map", "source_path": "e30", "...": "..." },
  "content": [
    { "kind": "property", "key": "classname", "value": "func_door" },
    { "kind": "property", "key": "angle", "value": "180" },
    { "kind": "brush", "brush_id": "brs_...", "faces": [ ] },
    { "kind": "property", "key": "message", "value": "written after the brush" }
  ]
}
```

This mirrors AIM's internal model exactly, where an entity is a tuple of
`KeyValue | Brush`. A representation with a separate properties map and brushes
array could not round-trip either a repeated key or the ordering above.

An entity may legally carry **no brush at all** — that is a point entity. Keys
and values are MAP strings and cannot contain a double quote, carriage return,
or line feed, because the MAP writer cannot quote them.

---

## 6. Brushes and faces

A brush is the intersection of half-spaces, one per face — not a bounded mesh.
It needs at least four faces and must enclose a finite, non-degenerate volume.

```json
{
  "kind": "brush",
  "brush_id": "brs_1c77e0a942fb5d38",
  "derived_from": { },
  "faces": [ ]
}
```

### 6.1 Face plane

Exactly three points, in MAP order. The plane normal and the solid side follow
the source dialect's winding convention; APMap stores the points rather than a
normal-and-distance so nothing is lost to floating-point renormalization.

```json
"plane": { "points": [[-112, 9, 192], [-112, -7, 192], [-112, -7, 176]] }
```

### 6.2 Texture projection

Exactly one of two shapes. Mixing members from both is a schema error, because
one brush cannot mix face syntaxes in a `.map` file.

```json
"projection": { "mode": "classic",  "shift": [999, -1384], "rotation": 0, "scale": [1, 1] }
```

```json
"projection": {
  "mode": "valve220",
  "u_axis": [1, 0, 0, 0],
  "v_axis": [0, -1, 0, 0],
  "rotation": 0,
  "scale": [1, 1]
}
```

`u_axis` and `v_axis` are `[x, y, z, shift]`.

### 6.3 Face tail

Quake 2-style trailing numeric face values are preserved verbatim and
uninterpreted in 1.0:

```json
"tail": [1, 0, 0]
```

Absent when the source face had none. AIM's parser already reads and writes
these, so they survive a round trip without 1.0 assigning them meaning.

---

## 7. Synthetic faces

A face invented by a generator — a context-crop cap — declares itself:

```json
{
  "face_id": "fac_...",
  "derived_from": {
    "kind": "synthetic",
    "generator": "ai-mapcopilot.context_crop",
    "reason": "context_crop"
  },
  "plane": { "points": [ ] },
  "texture": "CONTEXT_CROP",
  "projection": { },
  "synthetic": true,
  "synthetic_reason": "context_crop"
}
```

`synthetic` and `synthetic_reason` appear together or not at all (SEM-3). This
replaces the need to cross-reference `context-cropped.meta.json` by
`entity_index`/`brush_index`/`face_index` to learn whether a face is authored;
the sidecar remains the record of the crop operation, but the geometry document
is now self-describing.

---

## 8. Relationships

One typed edge shape, referencing stable object ids:

```json
"relationships": [
  {
    "type": "activation_source",
    "from": "ent_a41f...",
    "to": "ent_9f2a...",
    "payload": { "via": "target", "key": "t1" }
  }
]
```

The registry is seeded only with relations AIM actually emits today:

| type | meaning | evidence |
| --- | --- | --- |
| `entity_target` | `target` → `targetname` edge | AIM `entity_graph` |
| `assembly_member` | members of one extracted assembly | `provenance.assembly_id`, e.g. `e1m4:e30+e31` |
| `activation_source` | what triggers an entity | `activation.json` raw_sources |

`type` is an open constrained string, so a consumer may introduce its own kind
without a schema bump. An unknown type validates structurally and must be
**preserved**, not dropped. Both endpoints must reference objects declared in
the same document (SEM-2).

---

## 9. Extensions

Namespaced vendor data, the only open bag in the format:

```json
"extensions": {
  "ai-mapcopilot.context_crop": { "display_only": true, "margin": [128, 128, 128] }
}
```

A namespace must contain at least one dot, so no producer can claim a bare word.
Extensions are allowed on the document, on an entity, on a brush, and on a face.
Values must be objects. A consumer must preserve extensions it does not
understand.

---

## 10. Rules enforced by JSON Schema

| id | rule |
| --- | --- |
| SCH-1 | `apmap_version` is `const "1.0"` |
| SCH-2 | `apmap_version`, `document_id`, `revision`, `role`, `game`, `map_dialect`, `id_policy`, `frame`, `entities` are required |
| SCH-3 | `revision` is an integer ≥ 0 |
| SCH-4 | `role` is one of the four enumerated roles |
| SCH-5 | every core object sets `additionalProperties: false`; undeclared members are rejected |
| SCH-6 | a brush has at least 4 faces |
| SCH-7 | a face plane has exactly 3 points, each a 3-number array |
| SCH-8 | a `valve220` projection requires `u_axis` and `v_axis` |
| SCH-9 | a `classic` projection is closed; Valve 220 members cannot be mixed in |
| SCH-10 | object ids match their typed prefix pattern |
| SCH-11 | an `extensions` namespace contains at least one dot |
| SCH-12 | entity `content` has at least 1 item |
| SCH-13 | `to_source` is `identity` or `translation`; `affine` is reserved and rejected |
| SCH-14 | a face requires `face_id`, `plane`, `texture`, `projection` |

## 11. Semantic validation rules

These cannot be expressed in JSON Schema. A conforming validator enforces them
after schema validation.

| id | rule |
| --- | --- |
| SEM-1 | every `entity_id`, `brush_id` and `face_id` is unique across the whole document |
| SEM-2 | every `relationship.from` / `.to` references an id declared in this document |
| SEM-3 | `synthetic` and `synthetic_reason` appear together; `synthetic` must be `true` |
| SEM-4 | `space: source_world` requires `to_source.type: identity` |
| SEM-5 | a face's three plane points are not collinear |
| SEM-6 | a brush's half-space intersection encloses a finite, non-degenerate volume |
| SEM-7 | every declared face contributes a bounded facet; a face that contributes none is redundant (**warning**, not an error) |
| SEM-8 | under `id_policy: derived`, every object carries `derived_from` |
| SEM-9 | a `full_map` document that declares any entity contains exactly one `worldspawn`, and it is first. An empty `entities` array is legal (**recommended** for other roles) |
| SEM-10 | under `id_policy: derived`, an object's id equals the digest of its `derived_from` identity inputs (§3.5) |
| SEM-11 | every number is finite; `NaN`, `Infinity` and `-Infinity` are forbidden |

SEM-11 needs its own check because JSON Schema's `number` type accepts anything
a JSON parser produced, and `1e400` decodes to `Infinity` in most parsers.

## 12. Canonical serialization rules

Two producers given the same document must emit the same bytes.

| id | rule |
| --- | --- |
| SER-1 | UTF-8, no byte-order mark |
| SER-2 | LF line endings only |
| SER-3 | two-space indentation |
| SER-4 | exactly one trailing newline at end of file |
| SER-5 | object members in the order this specification declares them |
| SER-6 | arrays in **semantic** order — entity, content, face and relationship order is meaningful and is never sorted |
| SER-7 | numbers are finite; a value that is mathematically an integer is emitted as a JSON integer; other values are rounded to 6 decimal places; `-0` is emitted as `0`; no exponent notation |
| SER-8 | a document that must be reproducible carries no wall-clock timestamp. `provenance.generated_at` is permitted but forfeits byte determinism |
| SER-9 | non-ASCII characters are emitted literally, not `\u`-escaped |

SER-7 matches AIM's MAP writer, which already emits `192` rather than `192.0`,
so nothing is lost crossing between the two formats.

Canonical encoding is a **fixed point**: decoding a canonical document and
re-encoding it must reproduce the original bytes. Every example and vector in
this directory is verified against that property.

## 13. Compatibility

Published schemas are **immutable**. Changing the meaning of an existing schema
is forbidden; a format change produces a new schema file and an explicit
migration.

```text
apmap/1.0/apmap.schema.json
apmap/1.1/apmap.schema.json
apmap/2.0/apmap.schema.json
```

- **Minor version (1.x)** adds optional members and reserved-name semantics
  only. It never removes a member, narrows a type, or changes a meaning.
- **Major version (x.0)** may break anything.
- Because every core object is closed (SCH-5), a 1.0 validator **rejects** a 1.1
  document rather than silently ignoring its new members. Consumers must
  validate against the version a document declares and must not accept a
  version they do not implement.
- Forward-compatible data belongs in `extensions`, which is the only member a
  1.0 consumer must preserve without understanding.

## 14. `.map` import and export loss boundaries

```text
.map import → new APMap document + stable ids
APMap edit  → canonical collaborative state
APMap export → .map representation
```

### Preserved exactly

entity order · repeated keys · key order relative to brushes · brush order ·
face order · 3-point planes · classic and Valve 220 projections · Quake 2
numeric face tails · texture names · brushless point entities · unknown entity
keys, verbatim

### Lost on import (`.map` → APMap)

| lost | why |
| --- | --- |
| `//` comments | AIM's tokenizer discards them at the line level |
| whitespace and indentation | the writer re-emits its own layout |
| number spelling (`0.50` vs `0.5`, `+3` vs `3`) | numbers are re-normalized by SER-7 |
| source line and column | only entity/brush/face indices survive, in `derived_from` |
| brush primitives, bezier patches, Quake 3 patch meshes | AIM's parser does not read them; a document containing them cannot be imported at all |

An unedited `.map` therefore re-exports **semantically identical, not
byte-identical**. That is the same guarantee AIM's existing
`round_trip_equivalence` check already proves for extraction, at 0.0 plane error
and 0.0 UV error.

### Lost on export (APMap → `.map`)

`.map` has nowhere to record APMap identity. Every `document_id`, `entity_id`,
`brush_id`, `face_id`, `derived_from`, `relationship` and `extensions` value is
dropped. **Reimporting an exported `.map` without its APMap sibling creates a
new document with new ids.** This is why `.map` is an import/export
representation and APMap is canonical.

The frame is also flattened: exporting a `prefab_local` document writes local
coordinates, and the `to_source` translation survives only if a sidecar records
it.

### Source data APMap 1.0 deliberately does not represent

Recorded here so nobody looks for it:

- **Package sidecar content** — classification, behaviour, validation results,
  recipes, preview cameras and review evidence stay in `prefab.json`,
  `classification.json`, `provenance.json`, `validation.json` and `recipe.json`.
  APMap is the geometry layer, not the package.
- **Derived render state** — AUP's `dropped_faces`, `geometry_status`,
  `alternate_renderable_faces`, face polygons, bounds and centres are recomputed
  from geometry and are never stored.
- **Texture image data** — only texture names. WAD resolution stays with the
  consumer.
- **Compiled artifacts** — `.bsp`, `.prt`, lightmaps, visibility.
- **Quake 2 surface flag semantics** — the numbers survive in `tail`; their
  meaning is not defined in 1.0.

---

## 15. Examples and test vectors

`examples/prefab-core.apmap` is a real conversion of the extracted package
`multi-brush-rigid-e1m4-e30-e31`: the opposed `func_door` pair at source
entities 30 and 31 of `e1m4.map`, in prefab-local coordinates with the
`canonicalize_rigid` translation `[1224, 999, 1384]` recorded in `frame`, plus
the `assembly_member` relationship for the pair. Its object ids are real
digests over that source map's SHA-256.

Every document in `examples/` and `test-vectors/valid/` passes schema validation
and every semantic rule. Every document in `test-vectors/invalid/` is rejected,
and `test-vectors/invalid/README.md` and `index.json` name the exact rule each
one violates.

Vector coverage spans: minimal document · real prefab core · Valve 220 ·
Quake 2 face tails · repeated entity keys · cropped-context synthetic faces ·
journal-derived authored ids · typed relationships · brushless point entities ·
namespaced extensions.
