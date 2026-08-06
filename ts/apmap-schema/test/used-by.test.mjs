/**
 * A package's own consumer manifest, checked against the repository's schema for it.
 *
 * `AGENTS.md` §2.2 makes `used-by.json` obligatory and §3 makes it load-bearing — an agent about to
 * change this package reads it to find out what it may break. A manifest that has quietly gone
 * malformed is worse than none, because it still looks like an answer.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT, compile, describeErrors, readJson } from './helpers.mjs';

const manifest = readJson(path.join(PACKAGE_ROOT, 'used-by.json'));

test('used-by.json is valid against meta/used-by.schema.json', () => {
  const validate = compile(readJson(path.resolve(PACKAGE_ROOT, '../../meta/used-by.schema.json')));
  assert.ok(validate(manifest), `used-by.json is invalid:\n  ${describeErrors(validate.errors)}`);
});

test('used-by.json names this package', () => {
  assert.equal(manifest.package, `ts/${path.basename(PACKAGE_ROOT)}`);
});
