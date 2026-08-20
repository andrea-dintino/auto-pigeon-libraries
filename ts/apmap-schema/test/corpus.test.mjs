/**
 * The current schema against the real corpora — as MIGRATION EVIDENCE, not as a support promise.
 *
 * Every document in these corpora declares `1.0`, and every service now REFUSES a 1.0 document at
 * its version gate. So what these tests establish is not that the corpora still work — they do not,
 * and are not meant to. It is that the current schema is structurally capable of expressing every
 * real document that exists, which is what makes a future mechanical migration (PREPROD-01C+) a
 * rewrite of one header field rather than a lossy conversion. If one of these ever fails, migration
 * has a real problem and somebody should know before writing the tool.
 *
 * The corpora live under `$MAPPER_ROOT` and are not part of this repository. Each skips by name when
 * it is not mounted — `AGENTS.md` §4D: derived output may never gate repository correctness.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { apmapFiles, compile, currentVersion, describeErrors, deprecatedSchemaPath, loadCurrentSchema, mapperRoot, readJson } from './helpers.mjs';

const MAPPER_ROOT = mapperRoot();
const skip = MAPPER_ROOT ? false : 'no $MAPPER_ROOT corpus reachable; set MAPPER_ROOT to run the real-document tests';

const validate11 = compile(loadCurrentSchema());

/** The corpora, widest first. Each is APMap 1.0 written by a producer that has never heard of 1.1. */
const CORPORA = [
  ['clean full-map corpus', 'LLM/generated/apmap/clean-corpus'],
  ['AIM codec exports', 'LLM/generated/apmap/aim-codec'],
];

/**
 * The temporary `$MAPPER_ROOT` mirror, byte-compared against the quarantined copy.
 *
 * This repository is the authority; the mirror is what PREPROD-01C deletes. Until then a drift
 * would mean somebody edited a frozen contract. Bytes only — nothing compiles or validates against
 * the deprecated schema, here or anywhere.
 */
const MIRROR = MAPPER_ROOT ? path.join(MAPPER_ROOT, 'formats/apmap/1.0/apmap.schema.json') : null;
const skipMirror = MIRROR && fs.existsSync(MIRROR)
  ? false : 'the temporary $MAPPER_ROOT/formats/apmap/1.0 mirror is gone — expected after PREPROD-01C';

test('the temporary legacy mirror still matches the quarantined 1.0 schema', { skip: skipMirror }, () => {
  assert.deepEqual(fs.readFileSync(MIRROR), fs.readFileSync(deprecatedSchemaPath()),
    'the mirror has drifted from this repository, which is the authority. Update the mirror.');
});

for (const [label, relative] of CORPORA) {
  const present = MAPPER_ROOT ? fs.existsSync(path.join(MAPPER_ROOT, relative)) : false;
  const skipCorpus = skip || (present ? false : `${relative} is not mounted in this data root`);
  test(`the current schema can express every document in the ${label}`, { skip: skipCorpus }, (t) => {
    const files = apmapFiles(path.join(MAPPER_ROOT, relative));
    assert.ok(files.length > 0, `${relative} is mounted but holds no .apmap documents`);
    const rejected = [];
    for (const file of files) {
      const document = readJson(file);
      assert.equal(document.apmap_version, '1.0', `${file} is not a 1.0 document`);
      if (!validate11(document)) rejected.push(`${path.basename(file)}:\n  ${describeErrors(validate11.errors)}`);
    }
    assert.deepEqual(rejected, [],
      `the current schema cannot express real documents, so migration to ${currentVersion()} is not mechanical:\n${rejected.join('\n')}`);
    t.diagnostic(`${files.length} documents accepted from ${relative}`);
  });
}

/**
 * The published 1.0 rejection vectors are checked in `deprecated-history.test.mjs`, against the
 * corpus now inside this repository rather than against `$MAPPER_ROOT`.
 */
