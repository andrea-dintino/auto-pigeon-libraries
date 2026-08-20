/**
 * The shape of the contract itself — §3.2.
 *
 * These are the assertions every service's startup loader depends on being true of this package.
 * If any of them fails, four services fail to start, and they should: the alternative is a stack
 * that boots and then disagrees with itself about which format it speaks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CURRENT_SCHEMA_PATTERN, PACKAGE_ROOT, SCHEMA_DIR, compile, currentSchemaFiles, currentSchemaPath,
  currentVersion, deprecated10, deprecatedSchemaPath, loadCurrentSchema, readJson,
} from './helpers.mjs';

test('exactly one current schema sits directly under schema/', () => {
  const found = currentSchemaFiles();
  assert.deepEqual(found, ['apmap-1.1.schema.json'],
    `schema/ must hold exactly one apmap-*.schema.json; found: ${found.join(', ') || '(none)'}`);
});

test('the current schema is valid JSON and compiles', () => {
  const schema = loadCurrentSchema();
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.doesNotThrow(() => compile(schema));
});

test('the current version is derived from the filename, not declared anywhere', () => {
  assert.equal(currentVersion(), '1.1');
  // The derivation, spelled out: nothing reads a version constant to get this.
  const derived = CURRENT_SCHEMA_PATTERN.exec(path.basename(currentSchemaPath()))[1];
  assert.equal(derived, currentVersion());
});

test('the schema agrees with its own filename', () => {
  // §2.1's "verify the schema's apmap_version contract is compatible with that version". A file
  // named apmap-2.0.schema.json whose contract cannot express 2.0 is a packaging error, and every
  // service treats it as a fatal startup error.
  const contract = loadCurrentSchema().properties.apmap_version;
  const accepted = contract.const ? [contract.const] : contract.enum;
  assert.ok(accepted.includes(currentVersion()),
    `the schema's apmap_version contract ${JSON.stringify(accepted)} cannot express ${currentVersion()}`);
});

/**
 * The current schema's enum still contains "1.0", and that is deliberate and harmless.
 *
 * It means the schema would structurally accept a 1.0-shaped document — which creates NO runtime
 * support promise, because every service refuses a deprecated version at its version gate, before
 * validation is reached. Asserted rather than left implicit, so that nobody later "fixes" the enum
 * believing it is what enforces the doctrine. It is not. The gate is.
 */
test('structural acceptance of a 1.0 shape is not a support promise', () => {
  const contract = loadCurrentSchema().properties.apmap_version;
  assert.ok(contract.enum.includes('1.0'));
  assert.ok(contract.enum.includes(currentVersion()));
});

test('the deprecated schema is quarantined and cannot be discovered', () => {
  assert.ok(fs.existsSync(deprecatedSchemaPath()), 'the frozen 1.0 schema must be kept as history');
  // It lives one level down, so the discovery scan — which reads DIRECT children only — cannot see
  // it. This is the mechanism, not an optimisation.
  assert.equal(path.dirname(deprecatedSchemaPath()), path.join(SCHEMA_DIR, 'deprecated'));
  assert.ok(!currentSchemaFiles().includes('apmap-1.0.schema.json'));
});

test('the deprecated schema is outside normal package exports', () => {
  const manifest = readJson(path.join(PACKAGE_ROOT, 'package.json'));
  const targets = Object.values(manifest.exports);
  assert.ok(!targets.some((target) => target.includes('deprecated')),
    'an export points into a deprecated path');
  assert.ok(!Object.keys(manifest.exports).some((subpath) => /\d+\.\d+/.test(subpath)),
    'a per-version export subpath exists; a consumer that can choose a version can choose a wrong one');
  assert.equal(manifest.exports['.'], `./schema/${path.basename(currentSchemaPath())}`);
});

test('the package ships the current surface and not the deprecated one', () => {
  const manifest = readJson(path.join(PACKAGE_ROOT, 'package.json'));
  assert.ok(!manifest.files.includes('deprecated'));
  assert.deepEqual(manifest.files.filter((entry) => entry.startsWith('schema')), ['schema']);
});

test('the deprecated 1.0 corpus is present, frozen, and documented', () => {
  // Kept as evidence. `AGENTS.md` §4D's rule applies: this is checked-in fixture material, so a
  // missing file is a repository packaging error and fails rather than skips.
  assert.ok(fs.existsSync(deprecated10('README.md')), 'the quarantine must say what it is');
  for (const kind of ['valid', 'invalid']) {
    const index = readJson(deprecated10('test-vectors', kind, 'index.json'));
    assert.equal(index.apmap_version, '1.0');
    assert.ok(index.vectors.length > 0);
    const onDisk = fs.readdirSync(deprecated10('test-vectors', kind))
      .filter((name) => name.endsWith('.apmap')).sort();
    assert.deepEqual(index.vectors.map((entry) => entry.file).sort(), onDisk);
  }
  assert.equal(readJson(deprecated10('one-zero-document.apmap')).apmap_version, '1.0',
    'the canonical rejection fixture must still declare the deprecated version');
});
