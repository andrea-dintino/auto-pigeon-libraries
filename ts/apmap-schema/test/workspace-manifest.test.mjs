/**
 * The canonical workspace manifest, checked against its own schema and its own invariants.
 *
 * It lives in this package's test run for one boring reason: this is the only package in the
 * repository, so it owns the only `npm test` script `run.sh` can reach.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT, compile, currentSchemaFiles, describeErrors, readJson } from './helpers.mjs';

const WORKSPACE_DIR = path.resolve(PACKAGE_ROOT, '../../workspace');
const manifest = readJson(path.join(WORKSPACE_DIR, 'auto-pigeon-workspace.json'));
const schema = readJson(path.join(WORKSPACE_DIR, 'auto-pigeon-workspace.schema.json'));

/** Every repository the workspace is defined to contain. Changing this is a product decision. */
const CANONICAL = {
  AUP: 'auto-pigeon', AUB: 'auto-pigeon-backend', AUC: 'auto-pigeon-collaboration',
  AUE: 'auto-pigeon-extractor', AUG: 'auto-pigeon-gallery', AUT: 'auto-pigeon-tools',
  AULIBS: 'auto-pigeon-libraries',
};

test('the manifest validates against its schema', () => {
  const validate = compile(schema);
  assert.ok(validate(manifest), `the workspace manifest is invalid:\n  ${describeErrors(validate.errors)}`);
});

test('aliases, directories and clone URLs are each unique', () => {
  for (const key of ['alias', 'directory', 'clone_url']) {
    const values = manifest.repositories.map((entry) => entry[key]);
    assert.deepEqual([...new Set(values)].sort(), [...values].sort(), `two repositories share a ${key}`);
  }
});

test('the manifest names exactly the seven canonical repositories', () => {
  assert.deepEqual(Object.fromEntries(manifest.repositories.map((e) => [e.alias, e.directory])), CANONICAL);
});

test('every clone URL ends in the repository directory name', () => {
  // A mismatch would clone a repository into a directory named after a different one, which the
  // clone script cannot detect: it derives the destination from `directory`, not from the URL.
  for (const entry of manifest.repositories)
    assert.equal(entry.clone_url.split('/').pop(), `${entry.directory}.git`,
      `${entry.alias}: clone_url and directory disagree`);
});

/**
 * The exclusions are the manifest's whole design, so they are asserted rather than left to the
 * schema's `additionalProperties: false` — that stops a new KEY, and this stops a bad VALUE.
 *
 * Only the structural fields are scanned: `description` and `role` are prose, and prose about the
 * rule trips the rule. A leak would be in a URL or a directory, not in a sentence saying there are
 * none.
 */
test('no structural field carries a machine path, data root, port or credential', () => {
  const structural = manifest.repositories
    .flatMap((entry) => [entry.alias, entry.directory, entry.clone_url])
    .concat(manifest.schema_version).join(' ');
  const FORBIDDEN = [
    [/\/home\//, 'an absolute machine path'],
    [/MAPPER_ROOT/, 'the $MAPPER_ROOT data root'],
    [/localhost|127\.0\.0\.1|192\.168\./, 'a host address'],
    [/:\d{4,5}\b/, 'a port number'],
    [/password|secret|token|api[_-]?key/i, 'a credential'],
    [/@/, 'userinfo in a URL'],
  ];
  for (const [pattern, what] of FORBIDDEN)
    assert.equal(pattern.test(structural), false, `a structural field contains ${what}; this manifest is topology only`);
});

test('directories are bare names, never paths', () => {
  for (const entry of manifest.repositories) {
    assert.equal(path.basename(entry.directory), entry.directory, `${entry.alias}: directory is a path`);
    assert.ok(!entry.directory.startsWith('.'), `${entry.alias}: directory is relative`);
  }
});

/**
 * The manifest carries no schema path, and must not grow one: AUT DERIVES the APMap schema
 * directory from the AULIBS entry, and services are handed it explicitly. A path in the manifest
 * would be a second answer to where the contract lives.
 */
test('the manifest names no APMap schema path', () => {
  assert.ok(!JSON.stringify(manifest).includes('apmap-schema'),
    'the manifest names a schema path; AUT derives it from the AULIBS repository entry instead');
  const aulibs = manifest.repositories.find((entry) => entry.alias === 'AULIBS');
  assert.ok(fs.existsSync(path.resolve(PACKAGE_ROOT, '..', '..')), 'AULIBS entry must describe this repository');
  assert.equal(aulibs.directory, 'auto-pigeon-libraries');
  // And the directory AUT derives from it is the one that actually holds the current schema.
  assert.equal(currentSchemaFiles().length, 1);
});
