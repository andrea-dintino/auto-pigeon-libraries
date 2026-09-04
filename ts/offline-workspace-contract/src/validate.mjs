// On-demand validation of an Offline workspace entity.
//
// ## AULIBS rule 2.1: validation is on demand, and it RETURNS
//
// Nothing here runs on import, on construction, on a save path or on a timer, and nothing throws
// for invalid input. A caller asks for a verdict and gets `{ valid, errors }`. That is the same
// discipline the incident contract follows and it matters more here, not less: these entities are
// read on paths that are already refusing somebody, and a validator that threw would turn a correct
// refusal into a server error.
//
// ## Why this is not ajv
//
// The package is consumed by a browser bundle, a node service and Go through the same JSON files.
// Pulling a general JSON Schema engine into the editor's bundle to check a fifteen-field object
// would be a large dependency for a small question, and the entity schema deliberately uses only a
// handful of keywords: $ref to local $defs, const, enum, type (including a two-member type array
// for the nullable fields), pattern, string lengths, numeric bounds, required, properties,
// additionalProperties: false, items and maxItems.
//
// So this is a reader for THAT subset, driven by the schema file itself rather than by a
// transcription of it — adding a field to the schema needs no edit here. The schema remains the
// authority, and `test/contract.test.mjs` runs ajv over the same cases and fails if the two
// disagree. That comparison is the only thing that makes a small interpreter safe rather than a
// second opinion.

import { entitiesSchema } from "./rules.mjs";

/** The entity names this contract defines, i.e. what `validateEntity` will validate against. */
export const ENTITY_NAMES = Object.freeze(
  Object.keys(entitiesSchema.$defs).filter(
    (name) => entitiesSchema.$defs[name].type === "object" && entitiesSchema.$defs[name].properties,
  ),
);

function resolveRef(ref) {
  return entitiesSchema.$defs?.[ref.replace("#/$defs/", "")];
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesOneType(value, expected) {
  if (expected === "integer") return typeof value === "number" && Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expected === "null") return value === null;
  return typeof value === expected;
}

function matchesType(value, expected) {
  if (Array.isArray(expected)) return expected.some((one) => matchesOneType(value, one));
  return matchesOneType(value, expected);
}

function describeType(expected) {
  return Array.isArray(expected) ? expected.join(" or ") : expected;
}

function check(schema, value, path, errors) {
  if (schema.$ref) {
    const target = resolveRef(schema.$ref);
    if (!target) {
      errors.push({ path, message: `unresolvable $ref ${schema.$ref}` });
      return;
    }
    check(target, value, path, errors);
    return;
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push({ path, message: `must be ${JSON.stringify(schema.const)}` });
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({
      path,
      message: `must be one of ${schema.enum.map((one) => JSON.stringify(one)).join(", ")}`,
    });
    return;
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push({ path, message: `must be ${describeType(schema.type)}, got ${typeOf(value)}` });
    return;
  }

  // String keywords apply only to strings. A nullable field declares `["string", "null"]`, and a
  // null there must not be measured against a pattern it cannot satisfy — that is what JSON Schema
  // itself does, and the two have to agree for the ajv cross-check to mean anything.
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      errors.push({ path, message: `must match ${schema.pattern}` });
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `must be <= ${schema.maximum}` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `must have at most ${schema.maxItems} items` });
    }
    if (schema.items) {
      value.forEach((item, index) => check(schema.items, item, `${path}[${index}]`, errors));
    }
  }

  if (matchesOneType(value, "object")) {
    for (const required of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) {
        errors.push({ path: path ? `${path}.${required}` : required, message: "is required" });
      }
    }
    for (const [key, item] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const childSchema = schema.properties?.[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) {
          errors.push({ path: childPath, message: "is not a field of this contract" });
        }
        continue;
      }
      check(childSchema, item, childPath, errors);
    }
  }
}

/**
 * Validate one entity against its definition in the entity schema.
 *
 * @param {string} entityName one of ENTITY_NAMES — "workspace", "asset_edit_lease", "refusal", ...
 * @param {unknown} value
 * @returns {{ valid: boolean, errors: Array<{path: string, message: string}> }}
 */
export function validateEntity(entityName, value) {
  const schema = entitiesSchema.$defs?.[entityName];
  if (!schema) {
    return {
      valid: false,
      errors: [{ path: "", message: `${entityName} is not an entity in this contract` }],
    };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: [{ path: "", message: "an entity must be an object" }] };
  }
  const errors = [];
  check(schema, value, "", errors);
  return { valid: errors.length === 0, errors };
}

/**
 * Is a record's declared contract version one this build implements?
 *
 * Separate from `validateEntity` on purpose. A record from a future contract will usually fail
 * validation too, but for a misleading reason — "is not a field of this contract" reads like a bug
 * in the writer rather than like a version gap. A component that asks this first can refuse with
 * `unsupported_contract_version` and say something true.
 */
export function isSupportedVersion(schemaVersion) {
  return schemaVersion === entitiesSchema.$defs.schema_version.const;
}
