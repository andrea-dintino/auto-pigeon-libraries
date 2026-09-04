/**
 * This package's consumer manifest, checked against the repository's schema for it.
 *
 * `AGENTS.md` §2.2 makes `used-by.json` obligatory and §3 makes it load-bearing — an agent about to
 * change this package reads it to find out what it may break, and for this package that is three
 * repositories, each of which holds a byte-for-byte copy of the contract behind a drift test. A
 * manifest that has quietly gone malformed is worse than none, because it still looks like an answer.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const manifest = readJson(join(packageRoot, "used-by.json"));

test("used-by.json is valid against meta/used-by.schema.json", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(readJson(resolve(packageRoot, "../../meta/used-by.schema.json")));
  assert.ok(
    validate(manifest),
    `used-by.json is invalid:\n  ${JSON.stringify(validate.errors, null, 2)}`,
  );
});

test("used-by.json names this package", () => {
  assert.equal(manifest.package, `ts/${basename(packageRoot)}`);
});

test("every consumer says what it uses the contract for, not that it uses it", () => {
  // "Checked the consumers" is not a handoff entry and "uses this package" is not a usage line. The
  // manifest is the starting point for the next agent's consumer check, so each row has to name the
  // files and the mechanism, which a one-clause entry cannot.
  for (const consumer of manifest.consumers) {
    assert.ok(consumer.usage.length > 120, `${consumer.repo}: the usage line says too little`);
  }
});
