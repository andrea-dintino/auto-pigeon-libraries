/**
 * The schema documents themselves, and the hand-built vectors for what 1.1 adds.
 *
 * Nothing here runs on load, on import, or against a document nobody asked about — the package
 * carries no runtime code at all, and these are tests, which is the one place validation is
 * unconditional by definition.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compile, compileDef, describeErrors, loadSchema, resolvePointer, vector, vectorIndex,
} from './helpers.mjs';

const schema10 = loadSchema('1.0');
const schema11 = loadSchema('1.1');
const index = vectorIndex();

test('both schema documents compile as JSON Schema 2020-12', () => {
  assert.equal(schema10.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema11.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.doesNotThrow(() => compile(schema10));
  assert.doesNotThrow(() => compile(schema11));
});

test('1.1 declares its own $id and accepts both versions', () => {
  assert.equal(schema11.$id, 'https://auto-pigeon.org/schemas/apmap/1.1/apmap.schema.json');
  assert.deepEqual(schema11.properties.apmap_version.enum, ['1.0', '1.1']);
  assert.equal(schema10.properties.apmap_version.const, '1.0', 'the frozen 1.0 copy must stay pinned to 1.0');
});

/**
 * The compatibility promise as a structural fact rather than an assertion in a README: 1.1 is 1.0
 * with things added. Every difference between the two documents is either an addition, or one of
 * the four places where a version of a schema necessarily differs from another version of it.
 */
test('1.1 differs from 1.0 only by additions and its own identity', () => {
  const ALLOWED = new Set(['/$id', '/title', '/description', '/properties/apmap_version']);
  const changes = [];
  const walk = (before, after, path) => {
    if (ALLOWED.has(path)) return;
    const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
    if (isObject(before) && isObject(after)) {
      for (const key of Object.keys(before)) {
        if (!(key in after)) { changes.push(`removed ${path}/${key}`); continue; }
        walk(before[key], after[key], `${path}/${key}`);
      }
      return;
    }
    if (Array.isArray(before) && Array.isArray(after)) {
      // An added `oneOf` branch is an addition; a changed or dropped one is not.
      if (after.length < before.length) { changes.push(`shortened ${path}`); return; }
      before.forEach((item, position) => walk(item, after[position], `${path}/${position}`));
      return;
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push(`changed ${path}`);
  };
  walk(schema10, schema11, '');
  assert.deepEqual(changes, [], `1.1 changed something 1.0 already defined:\n  ${changes.join('\n  ')}`);
});

test('derived_from defines exactly the five known kinds', () => {
  const kinds = schema11.$defs.derived_from.oneOf.map((branch) => {
    const def = branch.$ref.replace('#/$defs/', '');
    return schema11.$defs[def].properties.kind.const;
  });
  assert.deepEqual(kinds.sort(), ['authored', 'operation', 'package', 'source_map', 'synthetic']);
});

test('the operation kind requires only kind and operation_id', () => {
  assert.deepEqual(schema11.$defs.derived_from_operation.required, ['kind', 'operation_id']);
  assert.equal(schema11.$defs.derived_from_operation.additionalProperties, false);
});

test('intent and broken carry their intent in their descriptions', () => {
  // Both are load-bearing prose: an implementer reading only the schema must inherit them.
  assert.match(schema11.$defs.derived_from_operation.properties.intent.description, /never authorization/i);
  assert.match(schema11.$defs.brush_item.properties.broken.description, /warns and exports anyway/i);
  assert.equal(schema11.$defs.brush_item.properties.broken.type, 'boolean');
  assert.ok(!(schema11.$defs.brush_item.required ?? []).includes('broken'), 'broken must stay optional');
});

const validate11 = compile(schema11);

test('every valid vector is accepted by 1.1', (t) => {
  assert.ok(index.valid.length > 0);
  for (const entry of index.valid) {
    const document = vector('valid', entry.file);
    assert.ok(validate11(document), `${entry.file} was rejected:\n  ${describeErrors(validate11.errors)}`);
    t.diagnostic(`accepted ${entry.file}`);
  }
});

test('a 1.0 vector is valid under both the frozen 1.0 schema and 1.1', () => {
  const document = vector('valid', 'one-zero-document.apmap');
  assert.equal(document.apmap_version, '1.0');
  const validate10 = compile(schema10);
  assert.ok(validate10(document), `the frozen 1.0 schema rejected it:\n  ${describeErrors(validate10.errors)}`);
  assert.ok(validate11(document), `1.1 rejected it:\n  ${describeErrors(validate11.errors)}`);
});

test('the frozen 1.0 schema still refuses a 1.1 document', () => {
  // If this ever passes, the frozen copy has been edited and old documents lost their fixed reference.
  const validate10 = compile(schema10);
  assert.equal(validate10(vector('valid', 'broken-brush.apmap')), false);
});

test('every invalid vector is rejected by 1.1', () => {
  assert.ok(index.invalid.length > 0);
  for (const entry of index.invalid) {
    const document = vector('invalid', entry.file);
    assert.equal(validate11(document), false, `${entry.file} (${entry.rule}) was accepted`);
  }
});

test('every invalid vector is rejected for the recorded reason', () => {
  for (const entry of index.invalid) {
    const document = vector('invalid', entry.file);
    const expectation = entry.expect_fragment ?? entry.expect_document;
    const [validate, subject] = entry.expect_fragment
      ? [compileDef(schema11, entry.expect_fragment.def), resolvePointer(document, entry.expect_fragment.pointer)]
      : [validate11, document];
    assert.equal(validate(subject), false, `${entry.file}: the fragment named in index.json is valid`);
    const matched = (validate.errors ?? []).filter((error) =>
      error.keyword === expectation.keyword
      && error.instancePath === expectation.instancePath
      && (expectation.missingProperty === undefined || error.params.missingProperty === expectation.missingProperty)
      && (expectation.additionalProperty === undefined || error.params.additionalProperty === expectation.additionalProperty));
    assert.ok(matched.length > 0,
      `${entry.file} (${entry.rule}) failed, but not for ${JSON.stringify(expectation)}. Reported:\n  ${describeErrors(validate.errors)}`);
  }
});
