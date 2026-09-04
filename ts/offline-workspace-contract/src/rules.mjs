// The contract data, loaded once.
//
// The JSON files under ../schema are the AUTHORITY and this module is a reader for them, not a
// second copy of them. AUB is Go, AUC and AUP are TypeScript, and the tooling that will exercise
// any of this is Python; a capability matrix or a transition table written down in JavaScript would
// have to be written down twice more, and three sincere transcriptions of one table is exactly what
// this package exists to prevent. It is the same arrangement `@auto-pigeon/incident-contract` uses,
// for the same reason and with the same consequence: adding a capability, a reason or a transition
// is an edit to one JSON file plus its tests, and no edit at all here.
//
// Import attributes rather than `fs.readFileSync`, so the package works inside a browser bundle as
// well as in node: a bundler resolves the JSON at build time and node parses it at load time, and
// neither needs a filesystem.

import entitiesSchema from "../schema/offline-workspace-entities-1.0.schema.json" with { type: "json" };
import rolesDocument from "../schema/offline-workspace-roles.json" with { type: "json" };
import reasonsDocument from "../schema/offline-workspace-reason-codes.json" with { type: "json" };
import machinesDocument from "../schema/offline-workspace-state-machines.json" with { type: "json" };
import policyDocument from "../schema/offline-workspace-policy.json" with { type: "json" };
import assetTypesDocument from "../schema/offline-workspace-asset-types.json" with { type: "json" };

export {
  entitiesSchema,
  rolesDocument,
  reasonsDocument,
  machinesDocument,
  policyDocument,
  assetTypesDocument,
};

/**
 * The version of the Offline workspace entity contract this package implements.
 *
 * It is carried on every entity and on every refusal. A record or request declaring a version this
 * build does not implement is refused with `unsupported_contract_version` rather than read under
 * whichever rules happen to be compiled in — a component that reinterprets an unknown version is a
 * component that will one day silently apply the wrong rule to somebody's map.
 */
export const SCHEMA_VERSION = "1.0";

/**
 * The version of the OFFLINE capability model.
 *
 * Deliberately a different string from AUB's Real-time `aub-collaboration-roles/1.0`. The four role
 * names are shared and nothing else is: a Real-time capability governs one AUC session, an Offline
 * capability governs one durable AUB workspace, and a component holding a table needs to be able to
 * say which question it can answer. Two versions is how it says so.
 */
export const CAPABILITY_SCHEMA_VERSION = rolesDocument.capability_schema_version;

/** The scope name this table governs, as it appears in the roles document. */
export const CAPABILITY_SCOPE = rolesDocument.scope;
