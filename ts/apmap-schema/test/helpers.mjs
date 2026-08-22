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
 * THE CONTRACT BUNDLE — discovered, never named.
 *
 * `schema/` holds exactly one `apmap-*.schema.json`, and its FILENAME carries the CURRENT version.
 * `schema/deprecated/` holds zero or more `apmap-*.schema.json`, and each of those is a supported
 * LEGACY READ contract. Nothing in this repository or any consumer hard-codes "1.0" or "1.1":
 * every service derives both by the same directory reads below, so promoting 1.2 is one file
 * rename plus one file move, and no code change anywhere.
 *
 * The layout IS the policy:
 *
 *     schema/apmap-<v>.schema.json              CURRENT — the only WRITE format
 *     schema/deprecated/apmap-<v>.schema.json   LEGACY  — readable, never written
 *
 * Depth is what separates the two, and it is the mechanism rather than an optimisation: the
 * current-schema scan reads DIRECT children only, so a deprecated schema can never be mistaken for
 * the writer's contract. It is loadable, deliberately — "deprecated" means "not current / never
 * written", not "unreadable". A format that becomes genuinely unreadable moves OUT of this tree.
 */
export const SCHEMA_DIR = path.join(PACKAGE_ROOT, 'schema');
export const DEPRECATED_SCHEMA_DIR = path.join(SCHEMA_DIR, 'deprecated');
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

/** Every `apmap-*.schema.json` directly under `<directory>/deprecated/`. Zero or more are legal. */
export function legacySchemaFiles(directory = SCHEMA_DIR) {
  const deprecated = path.join(directory, 'deprecated');
  if (!fs.existsSync(deprecated)) return [];
  return fs.readdirSync(deprecated, { withFileTypes: true })
    .filter((entry) => entry.isFile() && CURRENT_SCHEMA_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * THE REFERENCE BUNDLE LOADER — the shape every service's startup loader implements.
 *
 * It lives here, in the contract authority's tests, because four services reimplement it in three
 * languages and the one place they can be checked against each other is the package that defines
 * what they are reading. It is test-only: this package ships schemas and no runtime code.
 *
 *     require exactly one current schema -> version from its filename -> parse -> the schema must
 *     be able to express that version -> enumerate deprecated/ -> same four steps each -> refuse a
 *     duplicate version -> cache { current, readable }
 *
 * Every fault throws. A legacy contract this bundle ADVERTISES as readable but cannot parse is a
 * startup failure, not a feature-time surprise: a service that claims to read 1.0 and discovers at
 * the user's first import that its 1.0 contract is corrupt has lied about its capability.
 */
export function loadContractBundle(directory = SCHEMA_DIR) {
  const currentFile = currentSchemaFiles(directory);
  if (currentFile.length !== 1)
    throw new Error(`expected exactly one current APMap schema in ${directory}, found ${currentFile.length}`
      + (currentFile.length ? `: ${currentFile.join(', ')}` : '')
      + '; exactly one file is the contract, and a second is an ambiguity nothing can resolve');

  const readable = new Map();
  const current = readSchemaFile(path.join(directory, currentFile[0]));
  readable.set(current.version, current);

  for (const name of legacySchemaFiles(directory)) {
    const legacy = readSchemaFile(path.join(directory, 'deprecated', name));
    if (readable.has(legacy.version))
      throw new Error(`APMap ${legacy.version} is declared twice in ${directory}; a version that `
        + 'resolves to two contracts resolves to neither');
    readable.set(legacy.version, legacy);
  }
  return { current, readable };
}

/** One schema file: parsed, version-from-filename, and checked that it can say its own name. */
function readSchemaFile(file) {
  const name = path.basename(file);
  const version = CURRENT_SCHEMA_PATTERN.exec(name)[1];
  let schema;
  try {
    schema = readJson(file);
  } catch (cause) {
    throw new Error(`the APMap schema ${file} is not valid JSON: ${cause.message}`);
  }
  const contract = schema?.properties?.apmap_version ?? {};
  const accepted = contract.const ? [contract.const] : (contract.enum ?? []);
  if (!accepted.includes(version))
    throw new Error(`${name} is named for APMap ${version}, but its apmap_version contract `
      + `${JSON.stringify(accepted)} cannot express it`);
  return { version, path: file, schema };
}

/** The versions this bundle can READ, sorted. The current one is always among them. */
export const readableVersions = (directory = SCHEMA_DIR) =>
  [...loadContractBundle(directory).readable.keys()].sort();

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
 * The DEPRECATED corpus — `deprecated/1.0/`, the published 1.0 vectors and examples. Reachable by
 * an explicit repository-local path only; it is history, not a runtime input.
 *
 * `deprecatedSchemaPath()` is different in kind: it names the frozen 1.0 CONTRACT, which IS a
 * runtime input — a reader loads it to validate a 1.0 document it has been asked to open. It is
 * outside `exports` because no writer may ever choose it, not because nothing may read it.
 */
export const DEPRECATED_ROOT = path.join(PACKAGE_ROOT, 'deprecated');
export const deprecatedSchemaPath = () => path.join(SCHEMA_DIR, 'deprecated', 'apmap-1.0.schema.json');
export const deprecated10 = (...segments) => path.join(DEPRECATED_ROOT, '1.0', ...segments);

/**
 * THE DOCUMENTED PROMOTION, as the contract defines it — the one place these tests express it.
 *
 * A legacy document becomes a current one by rewriting the declared version and supplying the
 * structural defaults the current contract requires and the old one had no place for. Today that
 * is exactly one member: `groups`, which 1.2 requires of every writer and 1.0/1.1 could not say.
 *
 * What makes this evidence rather than a formality is what it does NOT do. It copies every other
 * member by reference — no geometry is rebuilt, no id is reminted, no provenance is rewritten — so
 * a promotion that passes here is provably a header-and-default change and nothing more. When a
 * future version needs a second default, it is added here and every migration test moves with it.
 */
export const promoteToCurrent = (document, version = currentVersion()) => ({
  ...document,
  apmap_version: version,
  groups: document.groups ?? [],
});

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
