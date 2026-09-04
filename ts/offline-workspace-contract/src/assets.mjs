// The asset-type vocabulary, read from schema/offline-workspace-asset-types.json.

import { assetTypesDocument } from "./rules.mjs";

/** Every attachable asset type, in contract order. */
export const ASSET_TYPES = Object.freeze(
  assetTypesDocument.asset_types.map((entry) => entry.asset_type),
);

const BY_TYPE = new Map(assetTypesDocument.asset_types.map((entry) => [entry.asset_type, entry]));

export function isKnownAssetType(value) {
  return typeof value === "string" && BY_TYPE.has(value);
}

/** The contract's entry for a type — its AUB collection and its two V1 flags — or undefined. */
export function assetType(value) {
  return BY_TYPE.get(value);
}

/**
 * Does this type have an in-place edit path, and therefore an Offline edit lease?
 *
 * Only the map, in V1. An unknown type is not mutable: a lease granted on a type this build does
 * not recognise would be an exclusive writer over something nobody can say how to write.
 */
export function isMutable(value) {
  return BY_TYPE.get(value)?.mutable ?? false;
}

/** Can this type escalate into an AUC session? Only the map, and there is no whole-workspace session. */
export function isRealtimeEligible(value) {
  return BY_TYPE.get(value)?.realtime_eligible ?? false;
}
