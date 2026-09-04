// @auto-pigeon/offline-workspace-contract — the cross-stack contract for Offline Shared Workspaces.
//
// Offline collaboration is AUB-authoritative and is a different thing from an AUC Real-time
// session. This package is the one place the two halves of that sentence are written down as data:
// which roles may do what inside a durable workspace, which states its objects have and how they
// legally move, which refusal a rule returns, and what the product's fixed numbers are.
//
// Nothing here persists, serves, renders, connects or schedules anything. It is a contract and the
// reference implementation of the rules that contract needs; the persistence is AUB's, the UI is
// AUP's, the live session is AUC's, and the discovery surface is AUG's.

export {
  SCHEMA_VERSION,
  CAPABILITY_SCHEMA_VERSION,
  CAPABILITY_SCOPE,
  entitiesSchema,
  rolesDocument,
  reasonsDocument,
  machinesDocument,
  policyDocument,
  assetTypesDocument,
} from "./rules.mjs";

export {
  ROLES,
  ROLE_OVERLORD,
  ROLE_LORD,
  ROLE_KNIGHT,
  ROLE_PILGRIM,
  CAPABILITIES,
  isKnownRole,
  isKnownCapability,
  can,
  capabilitiesFor,
  rolesWith,
  rank,
  roleSummary,
  capabilitySummary,
  additionalGates,
  nonNestingCapabilities,
} from "./roles.mjs";

export {
  REASON_CODES,
  isReasonCode,
  reasonCode,
  reasonsForArea,
  httpStatusFor,
  createRefusal,
} from "./reasons.mjs";

export {
  MACHINES,
  MACHINE_IDS,
  machine,
  statesOf,
  eventsOf,
  initialState,
  isTerminal,
  transitionsFrom,
  transitionsFor,
  nextStates,
  canTransition,
  refusalsFor,
  fieldsSetBy,
  idempotencyFor,
} from "./machines.mjs";

export {
  LEASE_INACTIVITY_TIMEOUT_MS,
  LEASE_HEARTBEAT_MAX_INTERVAL_MS,
  ESCALATION_REQUEST_TTL_MS,
  ESCALATION_REQUEST_MIN_INTERVAL_MS,
  INVITATION_TTL_MS,
  ROLE_REQUEST_TTL_MS,
  REALTIME_STARTING_TIMEOUT_MS,
  PERMITTED_URL_SCHEMES,
  duration,
  limit,
  durations,
  limits,
  isPermittedUrl,
  leaseExpiryFrom,
} from "./policy.mjs";

export {
  ASSET_TYPES,
  isKnownAssetType,
  assetType,
  isMutable,
  isRealtimeEligible,
} from "./assets.mjs";

export { ENTITY_NAMES, validateEntity, isSupportedVersion } from "./validate.mjs";
