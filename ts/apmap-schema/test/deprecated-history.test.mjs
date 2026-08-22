/**
 * The deprecated 1.0 contract, kept as evidence and checked as evidence.
 *
 * WHAT THIS FILE IS NOT: a compatibility suite. Nothing here says a 1.0 document works. Every
 * service refuses one at its version gate, before validation. These tests assert that the frozen
 * record of what 1.0 *said* is intact, complete, and still reachable only by an explicit
 * repository-local path.
 *
 * Every file it reads is checked in, so a missing one is a repository packaging error and fails —
 * `AGENTS.md` §4D. None of it is discoverable, exported, or loadable by any product code.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  compile, currentVersion, deprecated10, deprecatedSchemaPath, describeErrors, loadCurrentSchema, promoteToCurrent, readJson,
} from './helpers.mjs';

const schema10 = readJson(deprecatedSchemaPath());
const validate10 = compile(schema10);
const validateCurrent = compile(loadCurrentSchema());

const validIndex = readJson(deprecated10('test-vectors', 'valid', 'index.json'));
const invalidIndex = readJson(deprecated10('test-vectors', 'invalid', 'index.json'));

test('the frozen 1.0 schema still accepts every published 1.0 vector', (t) => {
  for (const entry of validIndex.vectors) {
    const document = readJson(deprecated10('test-vectors', 'valid', entry.file));
    assert.equal(document.apmap_version, '1.0', `${entry.file} is not a 1.0 document`);
    assert.ok(validate10(document), `${entry.file} was rejected:\n  ${describeErrors(validate10.errors)}`);
  }
  t.diagnostic(`${validIndex.vectors.length} published 1.0 vectors still accepted by the frozen schema`);
});

/**
 * Only `SCH-*` rules are expressible in JSON Schema. `SEM-*` rules are the semantic layer —
 * convexity, dangling relationships, id derivation — which consumers enforce in code and which
 * `SEMANTICS.md` is the normative catalogue for. Those rules carry forward to the current contract
 * unchanged; the vectors below are 1.0's record of them.
 */
const schVectors = invalidIndex.vectors.filter((entry) => entry.rule.startsWith('SCH-'));
const semVectors = invalidIndex.vectors.filter((entry) => !entry.rule.startsWith('SCH-'));

test('the frozen 1.0 schema still rejects every published SCH-* vector', (t) => {
  assert.ok(schVectors.length > 0);
  const accepted = [];
  for (const entry of schVectors) {
    const document = readJson(deprecated10('test-vectors', 'invalid', entry.file));
    if (validate10(document)) accepted.push(`${entry.file} (${entry.rule}: ${entry.violation})`);
  }
  assert.deepEqual(accepted, [], `the frozen schema accepted documents 1.0 defines as invalid:\n  ${accepted.join('\n  ')}`);
  t.diagnostic(`${schVectors.length} SCH-* vectors still rejected`);
});

test('the SEM-* vectors are schema-valid, which is what makes them useful', (t) => {
  // They fail only semantically, so a consumer's semantic checker is the only thing standing
  // between them and acceptance. A test claiming the schema rejects them would be claiming the
  // schema enforces the semantic layer.
  assert.ok(semVectors.length > 0);
  for (const entry of semVectors) {
    const document = readJson(deprecated10('test-vectors', 'invalid', entry.file));
    assert.ok(validate10(document),
      `${entry.file} (${entry.rule}) is rejected by the schema, so it is not a purely semantic vector`);
  }
  t.diagnostic(`${semVectors.length} SEM-* vectors are schema-valid, as documented`);
});

/**
 * Migration evidence: the current schema can express the old documents' SHAPE.
 *
 * Read this precisely. It does not mean a 1.0 document is accepted — the version gate refuses it
 * before any of this runs. It means a migration tool only has to rewrite the declared version and
 * supply the current contract's structural defaults, not restructure geometry. That is worth
 * knowing before somebody writes one, and worth failing loudly if it stops being true.
 *
 * `promoteToCurrent` is that whole promotion, and 1.2 is the first version to need more than the
 * header: it requires `groups`, which no 1.0 document could declare. Everything else is copied by
 * reference, so what this proves is that no geometry, id or provenance is rebuilt on the way.
 */
test('the current schema can express every published 1.0 document', (t) => {
  const files = [
    ...validIndex.vectors.map((entry) => deprecated10('test-vectors', 'valid', entry.file)),
    ...fs.readdirSync(deprecated10('examples')).filter((n) => n.endsWith('.apmap')).map((n) => deprecated10('examples', n)),
  ];
  assert.ok(files.length >= 13);
  const unexpressible = [];
  for (const file of files) {
    // Only the header and the current contract's structural defaults — exactly what a migration
    // does. Nothing here touches entities, relationships or provenance.
    const migrated = promoteToCurrent(readJson(file));
    if (!validateCurrent(migrated)) unexpressible.push(`${file}:\n  ${describeErrors(validateCurrent.errors)}`);
  }
  assert.deepEqual(unexpressible, [],
    `migration to ${currentVersion()} would not be a header-and-defaults rewrite for:\n${unexpressible.join('\n')}`);
  t.diagnostic(`${files.length} published 1.0 documents are expressible in ${currentVersion()} after the documented promotion`);
});

test('the canonical rejection fixture is intact', () => {
  // What consumers use to prove their version gate refuses a deprecated document. It must keep
  // declaring 1.0, and it must be a document that is otherwise well-formed — a fixture that failed
  // for a second reason would let a gate pass this test without gating anything.
  const document = readJson(deprecated10('one-zero-document.apmap'));
  assert.equal(document.apmap_version, '1.0');
  assert.ok(validate10(document), 'the rejection fixture must be a VALID 1.0 document');
  assert.ok(validateCurrent(promoteToCurrent(document)),
    'and must differ from a current document only by its declared version and 1.2\'s empty groups');
});
