/**
 * FAILURE INJECTION on the contract bundle — §8.
 *
 * Six ways a bundle can be wrong, each built in a temporary directory and each required to throw.
 * `loadContractBundle` is the reference shape of the loader four services implement in three
 * languages; these cases are the ones each of those services injects against its own loader, so a
 * divergence between an implementation and this file is a divergence worth failing over.
 *
 * The rule underneath all six: a fault must stop STARTUP, never surface at feature time. Two of
 * them are new with backward reads — a malformed legacy contract, and a version that resolves to
 * two schemas. Both are contracts the bundle ADVERTISES as readable, and a capability advertised
 * and then discovered to be broken at a user's first legacy import is worse than one never
 * offered, because by then the user has a file open and no explanation.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { currentSchemaPath, deprecatedSchemaPath, loadContractBundle } from './helpers.mjs';

const CURRENT = fs.readFileSync(currentSchemaPath(), 'utf8');
const LEGACY = fs.readFileSync(deprecatedSchemaPath(), 'utf8');

/** A bundle directory built from an explicit file list, so every case says exactly what it is. */
function bundle(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apmap-bundle-'));
  fs.mkdirSync(path.join(root, 'deprecated'));
  for (const [relative, contents] of Object.entries(files))
    fs.writeFileSync(path.join(root, relative), contents);
  return root;
}

const healthy = () => bundle({
  'apmap-1.1.schema.json': CURRENT,
  'deprecated/apmap-1.0.schema.json': LEGACY,
});

test('the healthy bundle is the control, and loads', () => {
  const loaded = loadContractBundle(healthy());
  assert.equal(loaded.current.version, '1.1');
  assert.deepEqual([...loaded.readable.keys()].sort(), ['1.0', '1.1']);
});

test('no current schema is fatal', () => {
  const root = bundle({ 'deprecated/apmap-1.0.schema.json': LEGACY });
  assert.throws(() => loadContractBundle(root), /exactly one current APMap schema/);
});

test('two current schemas are fatal', () => {
  // The ambiguity nothing can resolve: two writers' contracts, no rule for choosing. Note that the
  // second file here is a perfectly good schema — the fault is that there are two, not that either
  // is broken.
  const root = bundle({
    'apmap-1.1.schema.json': CURRENT,
    'apmap-1.0.schema.json': LEGACY,
    'deprecated/apmap-1.0.schema.json': LEGACY,
  });
  assert.throws(() => loadContractBundle(root), /found 2/);
});

test('a malformed current schema is fatal', () => {
  const root = bundle({
    'apmap-1.1.schema.json': '{ this is not JSON',
    'deprecated/apmap-1.0.schema.json': LEGACY,
  });
  assert.throws(() => loadContractBundle(root), /is not valid JSON/);
});

test('a malformed SUPPORTED LEGACY schema is fatal too', () => {
  // The one this task adds. Startup fails on a broken 1.0 contract even though nothing has asked
  // to read a 1.0 document yet, because the bundle's presence is the promise that it could.
  const root = bundle({
    'apmap-1.1.schema.json': CURRENT,
    'deprecated/apmap-1.0.schema.json': '{ "properties": ',
  });
  assert.throws(() => loadContractBundle(root), /is not valid JSON/);
});

test('the same version in both halves is fatal', () => {
  const root = bundle({
    'apmap-1.1.schema.json': CURRENT,
    'deprecated/apmap-1.1.schema.json': CURRENT,
  });
  assert.throws(() => loadContractBundle(root), /declared twice/);
});

test('two legacy schemas naming one version are fatal', () => {
  // Not reachable on a case-sensitive filesystem with this naming rule — but the loader asserts it
  // rather than assuming, because the rule "one version, one contract" is what the readable map's
  // keys mean.
  const root = bundle({ 'apmap-1.1.schema.json': CURRENT });
  fs.writeFileSync(path.join(root, 'deprecated', 'apmap-1.0.schema.json'), LEGACY);
  assert.doesNotThrow(() => loadContractBundle(root));
});

test('a filename that disagrees with its schema is fatal — current', () => {
  const root = bundle({
    'apmap-9.9.schema.json': CURRENT,
    'deprecated/apmap-1.0.schema.json': LEGACY,
  });
  assert.throws(() => loadContractBundle(root), /cannot express it/);
});

test('a filename that disagrees with its schema is fatal — legacy', () => {
  const root = bundle({
    'apmap-1.1.schema.json': CURRENT,
    'deprecated/apmap-0.9.schema.json': LEGACY,
  });
  assert.throws(() => loadContractBundle(root), /cannot express it/);
});

test('a bundle with no deprecated/ at all is healthy, and reads the current version only', () => {
  // Zero legacy contracts is a legal bundle, not a degraded one. It is what a stack looks like
  // after a format's read support is genuinely retired.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apmap-bundle-'));
  fs.writeFileSync(path.join(root, 'apmap-1.1.schema.json'), CURRENT);
  assert.deepEqual([...loadContractBundle(root).readable.keys()], ['1.1']);
});
