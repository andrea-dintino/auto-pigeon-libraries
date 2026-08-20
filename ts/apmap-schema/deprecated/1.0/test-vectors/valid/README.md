# APMap 1.0 valid test vectors

Every document here must pass JSON Schema validation **and** every semantic
rule in `../../README.md`. `index.json` carries the same table for machines.

| vector | covers |
| --- | --- |
| `minimal-full-map.apmap` | Smallest legal full map: worldspawn, one convex cube, classic projection. |
| `prefab-core-classic.apmap` | The real e1m4 opposed_pair func_door package, prefab-local frame with a recorded translation back to source world. |
| `valve220-projection.apmap` | Valve 220 face syntax: explicit u_axis and v_axis alongside rotation and scale. |
| `quake2-face-tail.apmap` | Quake 2-style trailing numeric face values preserved verbatim in tail. |
| `repeated-entity-keys.apmap` | A repeated key and a property that follows a brush: ordered content round-trips both. |
| `cropped-context-synthetic-faces.apmap` | Cropped context: a synthetic cap face carrying synthetic true and synthetic_reason context_crop. |
| `authored-object-ids.apmap` | Objects created by a user operation: ids derived from document_id, operation_id and ordinal, so journal replay reproduces them. |
| `typed-relationships.apmap` | activation_source and entity_target edges referencing stable entity ids. |
| `point-entities-only.apmap` | Brushless point entities: an entity may legally carry no brush at all. |
| `package-derived-ids.apmap` | Package-scoped identity: ids derived from package_id, document role and the object path inside the document. This is the policy AIM's prefab export uses. |
| `namespaced-extensions.apmap` | Namespaced extensions at document and entity scope; unknown vendor data never weakens the core schema. |
