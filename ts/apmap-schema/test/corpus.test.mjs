/**
 * APMap 1.1 against real documents.
 *
 * The compatibility promise is only worth what it survives, and what it has to survive is the
 * documents that already exist — not the ones written to demonstrate it. These read the corpus under
 * `$MAPPER_ROOT`, which is not part of this repository: from a bare public clone they skip, saying
 * so, and the hand-built vectors in `schema.test.mjs` still run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { apmapFiles, compile, describeErrors, loadSchema, mapperRoot, readJson, schemaPath } from './helpers.mjs';

const MAPPER_ROOT = mapperRoot();
const skip = MAPPER_ROOT ? false : 'no $MAPPER_ROOT corpus reachable; set MAPPER_ROOT to run the real-document tests';

const validate11 = compile(loadSchema('1.1'));

/** The corpora, widest first. Each is APMap 1.0 written by a producer that has never heard of 1.1. */
const CORPORA = [
  ['published examples', 'formats/apmap/1.0/examples'],
  ['published valid vectors', 'formats/apmap/1.0/test-vectors/valid'],
  ['clean full-map corpus', 'LLM/generated/apmap/clean-corpus'],
  ['AIM codec exports', 'LLM/generated/apmap/aim-codec'],
];

test('the frozen 1.0 copy is byte-identical to the published 1.0 schema', { skip }, () => {
  const published = fs.readFileSync(path.join(MAPPER_ROOT, 'formats/apmap/1.0/apmap.schema.json'));
  assert.deepEqual(fs.readFileSync(schemaPath('1.0')), published,
    'the frozen copy has drifted from $MAPPER_ROOT/formats/apmap/1.0/apmap.schema.json');
});

for (const [label, relative] of CORPORA) {
  test(`1.1 accepts every document in the ${label}`, { skip }, (t) => {
    const files = apmapFiles(path.join(MAPPER_ROOT, relative));
    assert.ok(files.length > 0, `${relative} holds no .apmap documents`);
    const rejected = [];
    for (const file of files) {
      const document = readJson(file);
      assert.equal(document.apmap_version, '1.0', `${file} is not a 1.0 document`);
      if (!validate11(document)) rejected.push(`${path.basename(file)}:\n  ${describeErrors(validate11.errors)}`);
    }
    assert.deepEqual(rejected, [], `1.1 rejected real 1.0 documents:\n${rejected.join('\n')}`);
    t.diagnostic(`${files.length} documents accepted from ${relative}`);
  });
}

/**
 * The published 1.0 rejection vectors, still rejected — with one deliberate exception.
 * `apmap-version-wrong.apmap` is a 1.0 vector whose whole fault is declaring "1.1", so 1.1 accepting
 * it is the intended consequence of the version being added, not a regression. Saying which one, and
 * why, is the point of the test: a silent exception list is how a real regression hides.
 */
test('1.1 still rejects the published 1.0 SCH-* vectors', { skip }, (t) => {
  const directory = path.join(MAPPER_ROOT, 'formats/apmap/1.0/test-vectors/invalid');
  const index = readJson(path.join(directory, 'index.json'));
  const VERSION_VECTOR = 'apmap-version-wrong.apmap';
  const unexpected = [];
  let checked = 0;
  for (const entry of index.vectors) {
    if (!entry.rule.startsWith('SCH-')) continue;   // SEM-* rules are not expressible in JSON Schema.
    const document = readJson(path.join(directory, entry.file));
    const accepted = validate11(document);
    if (entry.file === VERSION_VECTOR) {
      assert.equal(document.apmap_version, '1.1');
      assert.ok(accepted, `${VERSION_VECTOR} declares 1.1 and must now be accepted by the 1.1 schema`);
      continue;
    }
    checked += 1;
    if (accepted) unexpected.push(`${entry.file} (${entry.rule}: ${entry.violation})`);
  }
  assert.deepEqual(unexpected, [], `1.1 accepted documents 1.0 rejected:\n  ${unexpected.join('\n  ')}`);
  t.diagnostic(`${checked} SCH-* vectors still rejected; ${VERSION_VECTOR} accepted by design`);
});
