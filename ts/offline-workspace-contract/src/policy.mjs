// The numbers, read from schema/offline-workspace-policy.json.
//
// Each carries where it came from. `product` means the product specification fixed it and no
// implementation may choose otherwise; `contract_default` means this contract had to pick one so
// four repositories would agree, and the product may revise it without breaking a wire shape.
// The distinction is the point: an agent looking at a thirty-minute constant should be able to tell
// whether it is a decision or a convenience, and every duration in this workspace that could not
// answer that question has eventually been changed by somebody who assumed the wrong one.

import { policyDocument } from "./rules.mjs";

const DURATIONS = new Map(policyDocument.durations_ms.map((entry) => [entry.name, entry]));
const LIMITS = new Map(policyDocument.limits.map((entry) => [entry.name, entry]));

/** Thirty minutes. THE product rule: an Offline lease lapses this long after its last heartbeat. */
export const LEASE_INACTIVITY_TIMEOUT_MS = DURATIONS.get("lease_inactivity_timeout_ms").value;

/** The longest gap a live client may leave between heartbeats. Contract default. */
export const LEASE_HEARTBEAT_MAX_INTERVAL_MS = DURATIONS.get("lease_heartbeat_max_interval_ms").value;

/** How long an incumbent has to answer an escalation request. Shorter than the lease, deliberately. */
export const ESCALATION_REQUEST_TTL_MS = DURATIONS.get("escalation_request_ttl_ms").value;

/** The rate limit between one requester's escalation requests for one asset. */
export const ESCALATION_REQUEST_MIN_INTERVAL_MS = DURATIONS.get("escalation_request_min_interval_ms").value;

/** How long an unaccepted private invitation stays usable. */
export const INVITATION_TTL_MS = DURATIONS.get("invitation_ttl_ms").value;

/** How long an unanswered role request stays pending. */
export const ROLE_REQUEST_TTL_MS = DURATIONS.get("role_request_ttl_ms").value;

/** The longest an asset may sit in the server-owned realtime_starting state before it is recovered. */
export const REALTIME_STARTING_TIMEOUT_MS = DURATIONS.get("realtime_starting_timeout_ms").value;

/** A duration's full entry — value, source and summary — or undefined. */
export function duration(name) {
  return DURATIONS.get(name);
}

/** A limit's full entry, or undefined. */
export function limit(name) {
  return LIMITS.get(name);
}

/** Every duration the contract fixes. */
export function durations() {
  return policyDocument.durations_ms;
}

/** Every bound the contract fixes. */
export function limits() {
  return policyDocument.limits;
}

/** URL schemes permitted in a workspace description. */
export const PERMITTED_URL_SCHEMES = Object.freeze([...policyDocument.url_schemes.permitted]);

/**
 * Is this URL safe to render in a workspace description?
 *
 * Allow-list, not deny-list: `javascript:` and `data:` are named in the contract so a reviewer can
 * find them, and the check is still "is the scheme one of the two we render", because the set of
 * schemes somebody can invent is not enumerable and the set we render is.
 *
 * A relative URL has no scheme and is permitted. A string that does not parse is refused, because
 * something that cannot be parsed cannot be shown to be safe.
 */
export function isPermittedUrl(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(trimmed);
  if (!scheme) return true;
  return PERMITTED_URL_SCHEMES.includes(scheme[1].toLowerCase());
}

/**
 * When a lease acquired or beaten at `heartbeatAt` expires.
 *
 * Takes the instant rather than reading a clock, so it is a pure function of its input and a caller
 * can test the boundary without waiting thirty minutes. The server's clock decides what `now` is;
 * this decides what `expires_at` is.
 */
export function leaseExpiryFrom(heartbeatAtMs) {
  return heartbeatAtMs + LEASE_INACTIVITY_TIMEOUT_MS;
}
