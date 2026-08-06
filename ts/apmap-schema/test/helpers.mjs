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

export const schemaPath = (version) => path.join(PACKAGE_ROOT, 'schema', `apmap-${version}.schema.json`);
export const loadSchema = (version) => readJson(schemaPath(version));

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

export const vectorIndex = () => readJson(path.join(PACKAGE_ROOT, 'test-vectors', 'index.json'));

export const vector = (kind, file) => readJson(path.join(PACKAGE_ROOT, 'test-vectors', kind, file));

export const describeErrors = (errors) =>
  (errors ?? []).map((error) => `${error.keyword} @ ${error.instancePath || '/'}: ${error.message}`).join('\n  ');

/**
 * `$MAPPER_ROOT`, or null when it is not reachable. The real-corpus tests need it and are skipped
 * without it: this repository is public and its packages must be testable from a bare clone, so the
 * corpus is evidence when present rather than a dependency.
 */
export const mapperRoot = () => {
  const candidates = [process.env.MAPPER_ROOT, path.resolve(PACKAGE_ROOT, '../../../../mapper')];
  for (const candidate of candidates)
    if (candidate && fs.existsSync(path.join(candidate, 'formats/apmap/1.0/apmap.schema.json'))) return candidate;
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
