// The Offline role -> capability table, read from schema/offline-workspace-roles.json.
//
// Every authority question on an Offline path is `can(role, capability)`. Nothing anywhere may ask
// `role === "lord"`: a role comparison at a call site is a fifth copy of this table with no version
// on it, and the workspace has already paid for that mistake once — AUC carried its own
// `MAP_WRITE_ROLES` set until AUB moved `map.save` off Lord and the two disagreed about who could
// publish somebody's map.

import { rolesDocument } from "./rules.mjs";

/** The four roles, most privileged first. Rank order, not a capability test. */
export const ROLES = Object.freeze(rolesDocument.roles.map((entry) => entry.role));

export const ROLE_OVERLORD = "overlord";
export const ROLE_LORD = "lord";
export const ROLE_KNIGHT = "knight";
export const ROLE_PILGRIM = "pilgrim";

/** Every Offline capability, in the order the contract lists it. */
export const CAPABILITIES = Object.freeze(
  rolesDocument.capabilities.map((entry) => entry.capability),
);

const ROLE_SET = new Set(ROLES);
const CAPABILITY_SET = new Set(CAPABILITIES);

const MATRIX = new Map(
  ROLES.map((role) => [role, new Set(rolesDocument.matrix[role] ?? [])]),
);

const ROLE_SUMMARIES = new Map(rolesDocument.roles.map((entry) => [entry.role, entry]));
const CAPABILITY_SUMMARIES = new Map(
  rolesDocument.capabilities.map((entry) => [entry.capability, entry]),
);

export function isKnownRole(value) {
  return typeof value === "string" && ROLE_SET.has(value);
}

export function isKnownCapability(value) {
  return typeof value === "string" && CAPABILITY_SET.has(value);
}

/**
 * Does this role hold this capability?
 *
 * An unknown role holds nothing and an unknown capability is held by nobody. That is the only safe
 * reading of either: a name that reached here without matching the table is a historical value, a
 * typo or a claim minted by a build newer than this one, and `deny` is the answer that cannot leak
 * authority in any of the three cases.
 */
export function can(role, capability) {
  return MATRIX.get(role)?.has(capability) ?? false;
}

/** A role's capabilities, in the contract's capability order. Always an array, empty for an unknown role. */
export function capabilitiesFor(role) {
  const held = MATRIX.get(role);
  if (!held) return [];
  return CAPABILITIES.filter((capability) => held.has(capability));
}

/**
 * Every role holding a capability, in rank order.
 *
 * It exists so that a sentence shown to a refused user — "detaching an asset is the Overlord's" —
 * is read out of the table rather than written beside it. Prose that names a role is a role matrix
 * like any other, and it becomes a confident lie the moment the table moves.
 */
export function rolesWith(capability) {
  return ROLES.filter((role) => can(role, capability));
}

/** A role's position in the presentation order, most privileged first. An unknown role sorts last. */
export function rank(role) {
  const index = ROLES.indexOf(role);
  return index === -1 ? ROLES.length : index;
}

/** The contract's own description of a role, or undefined. */
export function roleSummary(role) {
  return ROLE_SUMMARIES.get(role);
}

/** The contract's own description of a capability, or undefined. */
export function capabilitySummary(capability) {
  return CAPABILITY_SUMMARIES.get(capability);
}

/**
 * The conditions that must ALSO hold, beyond the role, for a capability to permit an operation.
 *
 * Returned as data rather than enforced here, because every one of them is a question about durable
 * state that only AUB can answer inside a transaction. What this package guarantees is that the
 * list is the same list in all four repositories — `asset.save` is gated by the lease, the CAS and
 * the ASSET OWNER's storage in AUB's implementation, in AUP's pre-flight and in AUC's final
 * persistence, or one of the three is wrong.
 */
export function additionalGates(capability) {
  return rolesDocument.additional_gates[capability] ?? [];
}

/**
 * The capabilities the table deliberately does not nest, with the reason.
 *
 * `member.leave` and `role_request.create` are held by every role except Overlord. Capability sets
 * nesting neatly is a coincidence of most tables and never a rule; anything here that reasons
 * "higher rank implies the capability" is wrong about these two today, not hypothetically.
 */
export function nonNestingCapabilities() {
  return rolesDocument.non_nesting;
}
