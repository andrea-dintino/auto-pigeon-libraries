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
import { apmapFiles, compile, currentVersion, describeErrors, loadCurrentSchema, mapperRoot, readJson } from './helpers.mjs';

const MAPPER_ROOT = mapperRoot();
const skip = MAPPER_ROOT ? false : 'no $MAPPER_ROOT corpus reachable; set MAPPER_ROOT to run the real-document tests';

const validate11 = compile(loadCurrentSchema());

/** The corpora, widest first. Each is APMap 1.0 written by a producer that has never heard of 1.1. */
const CORPORA = [
  ['clean full-map corpus', 'LLM/generated/apmap/clean-corpus'],
  ['AIM codec exports', 'LLM/generated/apmap/aim-codec'],
];

/**
 * THE `$MAPPER_ROOT` MIRROR IS GONE, AND THIS ASSERTS THAT IT STAYS GONE.
 *
 * `$MAPPER_ROOT/formats/apmap/` held a copy of the 1.0 schema, its vectors and its examples. A
 * test here byte-compared the two and told whoever broke the tie to "update the mirror" — which
 * was the right check while a second copy existed and the wrong thing to keep once it did not.
 * PREPROD-01C removed it: the contract is packaged into each Docker image from this repository,
 * so the data root is not an APMap authority in any deployment any more.
 *
 * The inverted assertion is the useful one now. A mirror reappearing is a second source of truth
 * growing back, and the failure it causes — two contracts that agree until the day they do not —
 * is the one this whole line of work exists to prevent. Everything the mirror carried is here:
 * the schema at `schema/deprecated/`, the vectors and examples under `deprecated/1.0/`, and the
 * published specification as `deprecated/1.0/PUBLISHED-README.md`.
 */
test('the retired $MAPPER_ROOT mirror has not grown back', { skip }, () => {
  const mirror = path.join(MAPPER_ROOT, 'formats/apmap');
  assert.ok(!fs.existsSync(mirror),
    `${mirror} exists again. It was removed by PREPROD-01C because a second copy of the contract `
    + 'is a second source of truth; this repository is the authority and Docker images package it '
    + 'from here. Delete the mirror rather than re-syncing it.');
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
