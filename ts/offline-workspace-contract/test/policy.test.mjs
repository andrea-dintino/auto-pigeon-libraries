// The numbers, and the asset-type vocabulary.
//
// Two things get asserted here that no schema can: that the durations are CONSISTENT with each
// other — a request that can outlive the lease it is addressed to is a race waiting to be
// discovered by a user — and that each one still says whether the product fixed it or this contract
// picked it.

import test from "node:test";
import assert from "node:assert/strict";

import {
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
  ASSET_TYPES,
  assetType,
  isMutable,
  isRealtimeEligible,
  isKnownAssetType,
  policyDocument,
} from "../src/index.mjs";

test("thirty minutes is the product rule and says so", () => {
  assert.equal(LEASE_INACTIVITY_TIMEOUT_MS, 30 * 60 * 1000);
  assert.equal(duration("lease_inactivity_timeout_ms").source, "product");
});

test("the heartbeat ceiling is well inside the lease, so `inactive` means one thing", () => {
  assert.ok(
    LEASE_HEARTBEAT_MAX_INTERVAL_MS < LEASE_INACTIVITY_TIMEOUT_MS / 2,
    "a client beating this slowly would be indistinguishable from a departed one",
  );
});

test("an escalation request cannot outlive the lease it is addressed to", () => {
  assert.ok(
    ESCALATION_REQUEST_TTL_MS < LEASE_INACTIVITY_TIMEOUT_MS,
    "an acceptance arriving after the incumbent's authority lapsed is a session started from nothing",
  );
  assert.ok(ESCALATION_REQUEST_MIN_INTERVAL_MS < ESCALATION_REQUEST_TTL_MS);
});

test("the server-owned transition state has a timeout, so a phantom lock cannot outlive a crash", () => {
  assert.ok(REALTIME_STARTING_TIMEOUT_MS > 0);
  assert.ok(REALTIME_STARTING_TIMEOUT_MS < ESCALATION_REQUEST_TTL_MS);
});

test("the invitation and role-request windows are the long ones, and are bounded", () => {
  assert.ok(INVITATION_TTL_MS > LEASE_INACTIVITY_TIMEOUT_MS);
  assert.ok(ROLE_REQUEST_TTL_MS > INVITATION_TTL_MS);
  for (const entry of durations()) {
    assert.ok(entry.value > 0, `${entry.name} is not a positive duration`);
    assert.ok(Number.isInteger(entry.value), `${entry.name} is not whole milliseconds`);
  }
});

test("every number says where it came from and what it is for", () => {
  for (const entry of [...durations(), ...limits()]) {
    assert.ok(["product", "contract_default"].includes(entry.source), `${entry.name}: ${entry.source}`);
    assert.ok(entry.summary.length > 0, `${entry.name} has no summary`);
  }
  const productFixed = durations().filter((entry) => entry.source === "product");
  assert.deepEqual(
    productFixed.map((entry) => entry.name),
    ["lease_inactivity_timeout_ms"],
    "exactly one duration is fixed by the product specification; the rest are this contract's choices and are revisable",
  );
});

test("the bounds the schema enforces are the bounds the policy declares", () => {
  assert.equal(limit("role_request_message_max_chars").value, 500);
  assert.equal(limit("annotation_message_max_chars").value, 4000);
  assert.equal(limit("workspace_name_max_chars").value, 120);
  assert.equal(limit("workspace_description_max_chars").value, 4000);
  assert.equal(limit("workspace_max_members_platform_ceiling").value, 500);
  assert.equal(limit("dependency_manifest_max_entries").value, 512);
  assert.equal(limit("no_such_limit"), undefined);
});

test("leaseExpiryFrom is a pure function of the instant it is given", () => {
  const acquired = Date.parse("2026-08-31T09:15:00.000Z");
  assert.equal(
    new Date(leaseExpiryFrom(acquired)).toISOString(),
    "2026-08-31T09:45:00.000Z",
  );
  assert.equal(leaseExpiryFrom(0), LEASE_INACTIVITY_TIMEOUT_MS);
});

test("a description link is checked against an allow-list, not a deny-list", () => {
  assert.deepEqual([...PERMITTED_URL_SCHEMES], ["http", "https"]);
  for (const url of [
    "https://example.invalid/design",
    "http://example.invalid",
    "HTTPS://EXAMPLE.INVALID",
    "/relative/path",
    "#anchor",
  ]) {
    assert.equal(isPermittedUrl(url), true, url);
  }
  for (const url of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "ftp://example.invalid",
    "",
    "   ",
  ]) {
    assert.equal(isPermittedUrl(url), false, JSON.stringify(url));
  }
  for (const value of [null, undefined, 42, {}, []]) {
    assert.equal(isPermittedUrl(value), false, String(value));
  }
  for (const scheme of policyDocument.url_schemes.refused) {
    assert.equal(PERMITTED_URL_SCHEMES.includes(scheme), false, scheme);
  }
});

test("only the map is mutable and only the map escalates, in V1", () => {
  assert.deepEqual([...ASSET_TYPES], [
    "map",
    "texture_source",
    "entity_catalogue",
    "game_profile",
    "prefab_package",
  ]);
  assert.equal(isMutable("map"), true);
  assert.equal(isRealtimeEligible("map"), true);
  for (const type of ASSET_TYPES.filter((one) => one !== "map")) {
    assert.equal(isMutable(type), false, `${type} claims an in-place edit path`);
    assert.equal(isRealtimeEligible(type), false, `${type} claims a Real-time escalation path`);
  }
});

test("an unknown asset type is neither mutable nor eligible, rather than being guessed at", () => {
  assert.equal(isKnownAssetType("sound_pack"), false);
  assert.equal(isMutable("sound_pack"), false);
  assert.equal(isRealtimeEligible("sound_pack"), false);
  assert.equal(assetType("sound_pack"), undefined);
});

test("every asset type names the AUB collection it is derived from", () => {
  for (const type of ASSET_TYPES) {
    const entry = assetType(type);
    assert.ok(entry.aub_collection.length > 0, `${type} names no collection`);
    assert.ok(entry.summary.length > 0, `${type} has no summary`);
  }
});
