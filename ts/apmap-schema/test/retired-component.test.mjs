/**
 * The component AUE replaced is named nowhere in AULIBS except in frozen 1.0 history — `NEW_247D`.
 *
 * AUE owns extraction, normalization, texture descriptors and preview-camera computation; AULIBS
 * owns the APMap contract. A current README, specification, schema, test or manifest naming the
 * retired component would describe an architecture that no longer exists, so every file in this
 * repository is scanned, tracked or not yet committed, and there is no directory exclusion.
 *
 * The one exception is `deprecated/1.0/`, whose files are byte-identical to what was published
 * (`deprecated/1.0/README.md`: "Do not edit them to make a test pass"). Their provenance strings
 * are historical bytes, so each is allow-listed by exact path, exact hit count and SHA-256: a
 * changed byte fails here and has to be re-reviewed rather than silently re-pinned.
 *
 * The patterns are assembled from fragments so this file does not match itself.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT } from './helpers.mjs';

const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const COPILOT = 'co' + 'pilot';
/** Every spelling of the name, case-insensitive: product name, checkout, package, env stem. */
const NAME = new RegExp('ai[-_ ]?map[-_ ]?' + COPILOT + '|map' + COPILOT, 'gi');
/** Its acronym, case-sensitive, so the English verb is not a hit. */
const ACRONYM = new RegExp('\\b' + 'A' + 'IM' + '\\b', 'g');

const FROZEN = 'frozen APMap 1.0 corpus, byte-identical to the published contract';
/** `path -> { name, acronym, sha256 }`. Nothing else may match either pattern. */
const ALLOWED = {
  'ts/apmap-schema/deprecated/1.0/PUBLISHED-README.md': { name: 3, acronym: 11, sha256: '10a8c68fcca2f4031804d4e20704004e307171b60e5fbb385f5e6e60db552d81' },
  'ts/apmap-schema/deprecated/1.0/examples/prefab-core.apmap': { name: 2, acronym: 0, sha256: '243f954f2055e5ff7980d5276142eb81b7e89c288f9433fdad8091326b16ff96' },
  'ts/apmap-schema/deprecated/1.0/test-vectors/valid/README.md': { name: 0, acronym: 1, sha256: '81f6f7baa9ba54304f40dca0455b5754591054ae596abf42ec9ae7b16d70cb1a' },
  'ts/apmap-schema/deprecated/1.0/test-vectors/valid/cropped-context-synthetic-faces.apmap': { name: 2, acronym: 0, sha256: 'e019f65bb03454052182dd2a43665084ac5f51c975ca30db145e1da50fb4b14f' },
  'ts/apmap-schema/deprecated/1.0/test-vectors/valid/index.json': { name: 0, acronym: 1, sha256: '8a0824e9a4de307588c133078415d45d76de4024211d2593c99b9ec0abf4debc' },
  'ts/apmap-schema/deprecated/1.0/test-vectors/valid/namespaced-extensions.apmap': { name: 1, acronym: 0, sha256: '48526c17a4980e92f408b5e60b2c15a28ef9c821a88994d77a73ff88cdbef6b1' },
  'ts/apmap-schema/deprecated/1.0/test-vectors/valid/package-derived-ids.apmap': { name: 1, acronym: 0, sha256: 'c055e19a35e281273fc6eb482364900a218f8c7e5b253e4686bdbd3fb4db5501' },
  'ts/apmap-schema/deprecated/1.0/test-vectors/valid/prefab-core-classic.apmap': { name: 2, acronym: 0, sha256: '243f954f2055e5ff7980d5276142eb81b7e89c288f9433fdad8091326b16ff96' },
};

/** Genuinely binary assets. Everything else is read as text, NUL bytes or not. */
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.zip', '.gz', '.wad', '.lmp', '.pak']);

function repositoryFiles() {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return [...new Set(listed.split('\0').filter(Boolean))].sort()
    .filter((relative) => { const full = path.join(REPO_ROOT, relative); return fs.existsSync(full) && fs.lstatSync(full).isFile(); });
}

const count = (pattern, text) => (text.match(pattern) ?? []).length;

test('the patterns find every spelling and spare the English verb', () => {
  for (const line of ['ai-map' + COPILOT, 'AI Map Co' + 'pilot', 'AI_MAP_' + COPILOT.toUpperCase() + '_PATH', '_map' + COPILOT + '_prefab_core']) {
    assert.equal(count(NAME, line), 1, line);
  }
  assert.equal(count(ACRONYM, 'written by ' + 'A' + 'IM' + ' once'), 1);
  assert.equal(count(ACRONYM, 'aim the camera; AIMED; claim'), 0);
});

test('no file names the retired component outside the frozen 1.0 allow-list', (t) => {
  const unexpected = [];
  const seen = {};
  for (const relative of repositoryFiles()) {
    if (BINARY.has(path.extname(relative).toLowerCase())) continue;
    const text = fs.readFileSync(path.join(REPO_ROOT, relative)).toString('utf8');
    const hits = { name: count(NAME, text), acronym: count(ACRONYM, text) };
    if (!hits.name && !hits.acronym) continue;
    if (relative in ALLOWED) seen[relative] = hits;
    else unexpected.push(`${relative} (${hits.name} name, ${hits.acronym} acronym)`);
  }
  assert.deepEqual(unexpected, [], `the retired component is named again:\n  ${unexpected.join('\n  ')}`);
  for (const [relative, entry] of Object.entries(ALLOWED)) {
    assert.deepEqual(seen[relative], { name: entry.name, acronym: entry.acronym }, `${relative}: allow-listed hit counts changed`);
  }
  t.diagnostic(`${Object.keys(ALLOWED).length} allow-listed files, all ${FROZEN}`);
});

test('every allow-listed file is still the reviewed frozen bytes', () => {
  for (const [relative, entry] of Object.entries(ALLOWED)) {
    const bytes = fs.readFileSync(path.join(REPO_ROOT, relative));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256,
      `${relative} changed; it is allow-listed only as ${FROZEN} — re-review it rather than re-pinning`);
  }
});
