/**
 * Shared plumbing for the schema tests. No test cases live here.
 *
 * `ajv/dist/2020` is deliberately the validator: it is what Auto-Pigeon's own APMap pipeline
 * compiles this schema with, so a construct that passes here passes in the consumer that matters.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * THE CURRENT CONTRACT — discovered, never named.
 *
 * `schema/` holds exactly one `apmap-*.schema.json`, and its FILENAME carries the current version.
 * Nothing in this repository or any consumer hard-codes "1.1": every service derives it by the same
 * three lines below, so promoting 1.2 is one file rename and no code change anywhere.
 *
 * `schema/deprecated/` is not traversed and cannot participate in discovery. That is not an
 * optimisation — it is the mechanism. A deprecated schema that could be discovered is a deprecated
 * schema that will eventually be loaded by something.
 */
export const SCHEMA_DIR = path.join(PACKAGE_ROOT, 'schema');
export const CURRENT_SCHEMA_PATTERN = /^apmap-(\d+\.\d+)\.schema\.json$/;

/** Every direct child of `schema/` that looks like a current schema. Exactly one is legal. */
export function currentSchemaFiles(directory = SCHEMA_DIR) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && CURRENT_SCHEMA_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function currentSchemaPath(directory = SCHEMA_DIR) {
  const found = currentSchemaFiles(directory);
  if (found.length !== 1)
    throw new Error(`expected exactly one current schema in ${directory}, found ${found.length}: ${found.join(', ')}`);
  return path.join(directory, found[0]);
}

/** The current version, derived from the filename rather than declared anywhere. */
export function currentVersion(directory = SCHEMA_DIR) {
  return CURRENT_SCHEMA_PATTERN.exec(path.basename(currentSchemaPath(directory)))[1];
}

export const loadCurrentSchema = (directory = SCHEMA_DIR) => readJson(currentSchemaPath(directory));

/** One Ajv instance per call: a compiled validator caches, and these tests compile several schemas. */
export const compile = (schema) =>
  new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true }).compile(schema);

/**
 * A validator for one `$defs` entry of a schema, so a negative vector can be checked against the
 * definition it actually violates. Validating a whole document against a nested `oneOf` reports
 * every branch's failure at once, which says the document is wrong without saying why.
 */
export const compileDef = (schema, def) =>
  new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true })
    .addSchema(schema, 'apmap')
    .compile({ $ref: `apmap#/$defs/${def}` });

/** Resolve a JSON Pointer. Empty string is the document itself. */
export const resolvePointer = (document, pointer) =>
  pointer === '' ? document
    : pointer.split('/').slice(1).reduce((node, token) => node[token.replace(/~1/g, '/').replace(/~0/g, '~')], document);

/** The CURRENT conformance vectors. There is one set, for the one contract. */
export const vectorIndex = () => readJson(path.join(PACKAGE_ROOT, 'test-vectors', 'index.json'));
export const vector = (kind, file) => readJson(path.join(PACKAGE_ROOT, 'test-vectors', kind, file));

/**
 * The DEPRECATED tree. Reachable from these tests by an explicit repository-local path and from
 * nowhere else — not through `exports`, not through discovery.
 */
export const DEPRECATED_ROOT = path.join(PACKAGE_ROOT, 'deprecated');
export const deprecatedSchemaPath = () => path.join(SCHEMA_DIR, 'deprecated', 'apmap-1.0.schema.json');
export const deprecated10 = (...segments) => path.join(DEPRECATED_ROOT, '1.0', ...segments);

export const describeErrors = (errors) =>
  (errors ?? []).map((error) => `${error.keyword} @ ${error.instancePath || '/'}: ${error.message}`).join('\n  ');

/**
 * `$MAPPER_ROOT`, or null. Only the generated corpora need it; the whole published contract is in
 * this repository and is tested from a bare clone.
 */
export const mapperRoot = () => {
  const candidates = [process.env.MAPPER_ROOT,
                      path.resolve(PACKAGE_ROOT, '../../../mapper'),
                      path.resolve(PACKAGE_ROOT, '../../../../mapper')];
  for (const candidate of candidates)
    if (candidate && fs.existsSync(path.join(candidate, 'LLM'))) return candidate;
  return null;
};

/** Every `.apmap` under `directory`, recursively. Empty when the directory does not exist. */
export const apmapFiles = (directory) =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? apmapFiles(path.join(directory, entry.name))
          : entry.name.endsWith('.apmap') ? [path.join(directory, entry.name)] : [])
    : [];
