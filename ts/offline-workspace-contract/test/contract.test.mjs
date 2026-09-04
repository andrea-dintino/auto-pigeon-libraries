// The entity schema, the fixtures, and the agreement between this package's small validator and a
// real JSON Schema engine.
//
// That last one is the load-bearing test. `src/validate.mjs` exists so that a browser bundle does
// not have to carry ajv to check a fifteen-field object, and a hand-written interpreter of a schema
// subset is only safe while something proves it reads the schema the way the schema says. Here that
// something is ajv, run over the identical cases.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

import {
  SCHEMA_VERSION,
  entitiesSchema,
  reasonsDocument,
  ENTITY_NAMES,
  validateEntity,
  isSupportedVersion,
  isReasonCode,
  createRefusal,
  httpStatusFor,
} from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "..", "fixtures");
const fixtures = JSON.parse(readFileSync(join(fixtureDir, "index.json"), "utf8"));

const readFixture = (file) => JSON.parse(readFileSync(join(fixtureDir, file), "utf8"));

// The whole document is registered once and each entity is compiled as a reference into it, so ajv
// reads exactly the file this package ships rather than a per-entity rearrangement of it.
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(entitiesSchema);
const compiled = new Map(
  ENTITY_NAMES.map((name) => [name, ajv.compile({ $ref: `${entitiesSchema.$id}#/$defs/${name}` })]),
);

test("the entity schema compiles under a real JSON Schema engine, in strict mode", () => {
  assert.ok(compiled.size > 0);
  assert.equal(compiled.size, ENTITY_NAMES.length);
});

test("every entity definition is closed", () => {
  for (const name of ENTITY_NAMES) {
    const def = entitiesSchema.$defs[name];
    assert.equal(
      def.additionalProperties,
      false,
      `${name} accepts additional properties; a field one component invents is a field the other three cannot read`,
    );
  }
});

test("every $ref in the schema resolves to a local $def", () => {
  const refs = [];
  const walk = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node.$ref === "string") refs.push(node.$ref);
    for (const value of Object.values(node)) walk(value);
  };
  walk(entitiesSchema);
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    assert.ok(ref.startsWith("#/$defs/"), `${ref} is not a local reference`);
    const name = ref.slice("#/$defs/".length);
    assert.ok(entitiesSchema.$defs[name], `${ref} resolves to nothing`);
  }
});

test("every valid fixture validates", () => {
  assert.ok(fixtures.entities.length >= 25, "the fixture set is meant to cover every entity");
  for (const { file, entity } of fixtures.entities) {
    const result = validateEntity(entity, readFixture(file));
    assert.ok(result.valid, `${file}: ${JSON.stringify(result.errors)}`);
  }
});

test("every entity in the contract has at least one valid fixture", () => {
  const covered = new Set(fixtures.entities.map((entry) => entry.entity));
  for (const name of ENTITY_NAMES) {
    assert.ok(covered.has(name), `${name} has no fixture; an entity nobody wrote down once is an entity nobody has read`);
  }
});

test("every invalid fixture is refused, at the field the fixture names", () => {
  for (const { file, entity, error_path } of fixtures.invalid) {
    const result = validateEntity(entity, readFixture(file));
    assert.equal(result.valid, false, `${file} was accepted`);
    const paths = result.errors.map((error) => error.path);
    assert.ok(
      paths.includes(error_path),
      `${file}: expected an error on ${error_path}, got ${JSON.stringify(paths)}`,
    );
  }
});

test("the dependency-free validator agrees with ajv, case for case", () => {
  const cases = [
    ...fixtures.entities.map((entry) => ({ ...entry, expected: true })),
    ...fixtures.invalid.map((entry) => ({ ...entry, expected: false })),
  ];
  for (const { file, entity, expected } of cases) {
    const document = readFixture(file);
    const mine = validateEntity(entity, document).valid;
    const theirs = compiled.get(entity)(document);
    assert.equal(mine, theirs, `${file}: validateEntity=${mine} ajv=${theirs}`);
    assert.equal(mine, expected, `${file}: expected valid=${expected}`);
  }
});

test("validateEntity returns rather than throwing, for every shape of nonsense", () => {
  for (const value of [null, undefined, 42, "workspace", [], () => {}, NaN]) {
    const result = validateEntity("workspace", value);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  }
  const unknown = validateEntity("not_an_entity", {});
  assert.equal(unknown.valid, false);
  assert.match(unknown.errors[0].message, /not an entity/);
});

test("an unknown entity name and an unknown reason are answered, not thrown", () => {
  assert.equal(isReasonCode("no_such_reason"), false);
  assert.equal(httpStatusFor("no_such_reason"), undefined);
  const refusal = createRefusal("no_such_reason");
  assert.equal(refusal.reason, "no_such_reason");
  assert.equal(refusal.http_status, undefined, "an unknown reason gets no invented status");
});

test("createRefusal takes its status from the taxonomy and validates as a refusal", () => {
  const refusal = createRefusal("stale_asset_revision", {
    subject_type: "asset",
    subject_id: "map000000000001",
    current_revision: 18,
    message: undefined,
  });
  assert.equal(refusal.http_status, 409);
  assert.equal("message" in refusal, false, "an undefined field is omitted, not written as null");
  const result = validateEntity("refusal", refusal);
  assert.ok(result.valid, JSON.stringify(result.errors));
});

test("every reason in the taxonomy is unique, typed, and carries a remedy", () => {
  const seen = new Set();
  for (const entry of reasonsDocument.reasons) {
    assert.equal(seen.has(entry.code), false, `${entry.code} appears twice`);
    seen.add(entry.code);
    assert.match(entry.code, /^[a-z][a-z0-9_]{2,63}$/, `${entry.code} is not lower_snake_case`);
    assert.ok(reasonsDocument.areas.includes(entry.area), `${entry.code} has an undeclared area`);
    assert.ok(entry.http_status >= 400 && entry.http_status <= 599, `${entry.code} has no HTTP status`);
    assert.equal(typeof entry.retryable, "boolean");
    assert.ok(entry.summary.length > 0, `${entry.code} has no summary`);
    assert.ok(entry.remedy.length > 0, `${entry.code} tells the user nothing to do`);
  }
});

test("a reason names a remedy rather than telling the user something generic went wrong", () => {
  for (const entry of reasonsDocument.reasons) {
    assert.doesNotMatch(
      `${entry.summary} ${entry.remedy}`,
      /something went wrong|unknown error|please try again later/i,
      `${entry.code} falls back on a generic apology`,
    );
  }
});

test("the contract version is the same string everywhere it appears", () => {
  assert.equal(SCHEMA_VERSION, "1.0");
  assert.equal(entitiesSchema.$defs.schema_version.const, SCHEMA_VERSION);
  assert.equal(fixtures.schema_version, SCHEMA_VERSION);
  assert.equal(isSupportedVersion(SCHEMA_VERSION), true);
  assert.equal(isSupportedVersion("2.0"), false);
  assert.equal(isSupportedVersion(undefined), false);
});
