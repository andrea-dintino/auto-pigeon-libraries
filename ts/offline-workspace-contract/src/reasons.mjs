// The refusal vocabulary, read from schema/offline-workspace-reason-codes.json.
//
// A refusal is an expected, correct outcome of a rule — an asset already shared elsewhere, a lease
// somebody else holds, a revision that moved. It is NOT an incident: routing these into the
// incident backend would bury the signal that something is actually broken under the noise of the
// product working exactly as designed. The one exception the taxonomy marks explicitly is
// `linked_session_creation_failed`, which is a component failing rather than a rule refusing.

import { reasonsDocument } from "./rules.mjs";
import { SCHEMA_VERSION } from "./rules.mjs";

/** Every reason, in the order the contract lists them. */
export const REASON_CODES = Object.freeze(
  reasonsDocument.reasons.map((entry) => Object.freeze({ ...entry })),
);

const BY_CODE = new Map(REASON_CODES.map((entry) => [entry.code, entry]));

export function isReasonCode(code) {
  return typeof code === "string" && BY_CODE.has(code);
}

/**
 * The contract entry for a reason, or `undefined`.
 *
 * Returns rather than throws, for the reason the whole package returns rather than throws: a
 * refusal is looked up on a path that is already saying no to somebody, and a lookup that threw
 * would turn a correct refusal into a server error.
 */
export function reasonCode(code) {
  return BY_CODE.get(code);
}

/** Every reason in one area of the contract. */
export function reasonsForArea(area) {
  return REASON_CODES.filter((entry) => entry.area === area);
}

/** The HTTP status the contract assigns a reason, or `undefined` for an unknown one. */
export function httpStatusFor(code) {
  return BY_CODE.get(code)?.http_status;
}

/**
 * Build a refusal envelope.
 *
 * The status comes from the taxonomy rather than from the caller, so that one reason cannot be a
 * 409 in AUB and a 403 in AUC. An unknown code produces a refusal with no status rather than a
 * thrown error or a guessed 400 — the caller asked for a verdict and gets one it can inspect.
 *
 * Nothing is sent, logged or reported here.
 */
export function createRefusal(code, fields = {}) {
  const entry = BY_CODE.get(code);
  const refusal = {
    schema_version: SCHEMA_VERSION,
    reason: code,
  };
  if (entry) refusal.http_status = entry.http_status;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) refusal[key] = value;
  }
  return refusal;
}
