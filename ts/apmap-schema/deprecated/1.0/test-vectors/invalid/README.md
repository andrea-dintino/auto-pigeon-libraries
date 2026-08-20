# APMap 1.0 invalid test vectors

Every document here must be **rejected**, and the table states the exact rule
it violates. `SCH-*` rules are enforced by `apmap.schema.json`; `SEM-*` rules
cannot be expressed in JSON Schema and require a semantic validator.
`index.json` carries the same table for machines.

| vector | rule | violation |
| --- | --- | --- |
| `apmap-version-wrong.apmap` | SCH-1 | apmap_version must be const "1.0"; this document declares "1.1". |
| `missing-document-id.apmap` | SCH-2 | document_id is required and is absent. |
| `negative-revision.apmap` | SCH-3 | revision has minimum 0; this document declares -1. |
| `unknown-role.apmap` | SCH-4 | role must be one of full_map, prefab_core, reference_context, cropped_context; "context" is not in the enum. |
| `unknown-top-level-member.apmap` | SCH-5 | the document object sets additionalProperties false; "comment" is undeclared. Vendor data belongs in extensions. |
| `brush-too-few-faces.apmap` | SCH-6 | faces has minItems 4; a bounded convex solid cannot be built from three half-spaces. |
| `face-plane-two-points.apmap` | SCH-7 | plane.points requires exactly three points; this face supplies two. |
| `valve220-missing-axes.apmap` | SCH-8 | a valve220 projection requires u_axis and v_axis; neither is present, so the projection matches neither branch of the oneOf. |
| `classic-with-valve-axes.apmap` | SCH-9 | the classic projection sets additionalProperties false; u_axis and v_axis are Valve 220 members and cannot be mixed into one face. |
| `bad-id-prefix.apmap` | SCH-10 | entity_id must match ^ent_[0-9A-Za-z]{8,64}$; a brush id was used where an entity id belongs. |
| `extension-key-not-namespaced.apmap` | SCH-11 | an extensions namespace must contain at least one dot; the bare word "review" claims a global name. |
| `entity-empty-content.apmap` | SCH-12 | entity content has minItems 1; an entity with neither a property nor a brush carries no information. |
| `affine-transform-reserved.apmap` | SCH-13 | APMap 1.0 permits only identity and translation transforms; "affine" is reserved for a later version and matches neither branch of the oneOf. |
| `duplicate-object-id.apmap` | SEM-1 | two brushes share one brush_id. Object ids must be unique across every entity, brush and face in the document. JSON Schema cannot express cross-document uniqueness, so a semantic validator must reject this. |
| `dangling-relationship.apmap` | SEM-2 | relationship.to references an id that no object in the document declares. Reference integrity is semantic, not schema-checkable. |
| `synthetic-reason-without-synthetic.apmap` | SEM-3 | synthetic_reason is present while synthetic is absent. The two members must appear together and synthetic must be true. |
| `world-frame-with-translation.apmap` | SEM-4 | space is source_world, so to_source must be the identity transform. A document already in source coordinates cannot also declare a translation back to them. |
| `unbounded-brush.apmap` | SEM-6 | four planes that do not enclose a finite volume. The face count satisfies the schema; boundedness must be proved by half-space intersection. |
| `collinear-plane-points.apmap` | SEM-5 | three collinear points define no plane. The schema counts the points; only a semantic check can reject a degenerate triple. |
| `face-missing-id.apmap` | SCH-14 | face_id is required on every face. |
| `non-finite-number.apmap` | SEM-11 | a coordinate is written as 1e400, which decodes to Infinity. Every APMap number must be finite; JSON Schema's "number" type cannot express that. |
