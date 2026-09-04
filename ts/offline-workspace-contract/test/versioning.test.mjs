// Version and compatibility.
//
// Contract 1.0 is ADDITIVE-ONLY. A new capability, reason, state or field may appear inside it; a
// rename or a removal is a 2.0, because four repositories read these names off the wire and a
// deleted string is a component that stops understanding an object it has been storing for months.
//
// The frozen surfaces below are that promise written as a test. They are deliberately spelled out
// in full rather than derived: a golden generated from the thing it checks proves nothing, and the
// point of this file is that a reviewer can see the whole 1.0 vocabulary in one place and a
// deletion cannot pass review by accident.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION,
  CAPABILITY_SCHEMA_VERSION,
  CAPABILITY_SCOPE,
  ROLES,
  CAPABILITIES,
  REASON_CODES,
  MACHINE_IDS,
  ASSET_TYPES,
  ENTITY_NAMES,
  statesOf,
  isSupportedVersion,
  entitiesSchema,
  rolesDocument,
  reasonsDocument,
  machinesDocument,
  policyDocument,
  assetTypesDocument,
} from "../src/index.mjs";

const FROZEN_ROLES = ["overlord", "lord", "knight", "pilgrim"];

const FROZEN_CAPABILITIES = [
  "workspace.read",
  "workspace.activity.read",
  "workspace.metadata.write",
  "workspace.visibility.change",
  "workspace.delete",
  "member.invite",
  "member.role.change",
  "member.remove",
  "member.leave",
  "role_request.create",
  "role_request.resolve",
  "asset.read",
  "asset.download",
  "asset.upload",
  "asset.import",
  "asset.edit",
  "asset.save",
  "asset.detach",
  "annotation.read",
  "annotation.write",
  "annotation.resolve",
  "escalation.request",
  "escalation.accept",
];

const FROZEN_MACHINES = [
  "asset_collaboration",
  "asset_edit_lease",
  "workspace",
  "workspace_membership",
  "workspace_invitation",
  "role_request",
  "escalation_request",
  "linked_session",
  "annotation_thread",
];

const FROZEN_STATES = {
  asset_collaboration: [
    "unattached",
    "workspace_idle",
    "offline_editing",
    "realtime_starting",
    "realtime_active",
  ],
  asset_edit_lease: ["active", "released", "expired", "revoked"],
  workspace: ["active", "deleted"],
  workspace_membership: ["active", "removed", "left"],
  workspace_invitation: ["pending", "accepted", "declined", "revoked", "expired"],
  role_request: ["pending", "approved", "denied", "withdrawn", "expired"],
  escalation_request: [
    "pending",
    "accepted",
    "declined",
    "cancelled",
    "expired",
    "superseded",
  ],
  linked_session: ["starting", "active", "finalizing", "ended", "failed"],
  annotation_thread: ["open", "resolved"],
};

const FROZEN_ENTITIES = [
  "workspace",
  "workspace_public_card",
  "workspace_member",
  "workspace_asset",
  "asset_record",
  "dependency_entry",
  "dependency_manifest",
  "workspace_invitation",
  "role_request",
  "asset_edit_lease",
  "escalation_request",
  "linked_session",
  "annotation_anchor",
  "annotation_thread",
  "annotation_message",
  "annotation_read_state",
  "activity_event",
  "blocking_reference",
  "refusal",
];

const FROZEN_ASSET_TYPES = [
  "map",
  "texture_source",
  "entity_catalogue",
  "game_profile",
  "prefab_package",
];

// The reasons named by the first release. Additions are expected; a name leaving this list is a
// component somewhere that will one day receive a refusal it cannot classify.
const FROZEN_REASONS = [
  "workspace_not_found",
  "workspace_metadata_stale_revision",
  "workspace_visibility_blocked_by_private_assets",
  "workspace_max_members_below_current",
  "workspace_max_members_above_platform_limit",
  "workspace_delete_blocked_by_active_work",
  "workspace_owner_cannot_leave",
  "workspace_description_unsafe_link",
  "not_a_workspace_member",
  "insufficient_workspace_role",
  "workspace_full",
  "already_a_workspace_member",
  "member_removal_blocked_by_active_work",
  "role_change_blocked_by_active_lease",
  "workspace_owner_immutable",
  "invitation_not_found",
  "invitation_expired",
  "invitation_already_used",
  "invitation_revoked",
  "invitation_wrong_account",
  "invitation_role_not_assignable",
  "role_request_already_pending",
  "role_request_not_pending",
  "role_request_cannot_target_overlord",
  "role_request_message_too_long",
  "asset_not_found",
  "asset_already_in_another_workspace",
  "asset_not_in_workspace",
  "private_asset_in_public_workspace",
  "asset_visibility_change_blocked_by_public_workspace",
  "asset_delete_blocked_by_workspace_attachment",
  "asset_detach_blocked_by_active_work",
  "asset_not_mutable",
  "asset_not_realtime_eligible",
  "asset_dependency_pinned",
  "dependency_not_accessible",
  "dependency_missing",
  "asset_owner_storage_unavailable",
  "asset_owner_quota_exceeded",
  "stale_asset_revision",
  "edit_lease_held_by_other_user",
  "edit_lease_held_by_other_client",
  "edit_lease_not_held",
  "edit_lease_expired",
  "edit_lease_not_available_for_role",
  "escalation_request_rate_limited",
  "escalation_request_already_pending",
  "escalation_request_not_pending",
  "escalation_request_expired",
  "escalation_requires_incumbent_editor",
  "escalation_self_request_forbidden",
  "asset_already_in_realtime_session",
  "linked_session_creation_failed",
  "annotation_thread_not_found",
  "annotation_not_editable_by_caller",
  "annotation_body_too_long",
  "idempotency_key_conflict",
  "unsupported_contract_version",
];

const missing = (frozen, current) => frozen.filter((name) => !current.includes(name));

test("no role, capability, machine, state, entity, asset type or reason has been removed or renamed", () => {
  assert.deepEqual(missing(FROZEN_ROLES, [...ROLES]), [], "a role left 1.0");
  assert.deepEqual(missing(FROZEN_CAPABILITIES, [...CAPABILITIES]), [], "a capability left 1.0");
  assert.deepEqual(missing(FROZEN_MACHINES, [...MACHINE_IDS]), [], "a machine left 1.0");
  assert.deepEqual(missing(FROZEN_ENTITIES, [...ENTITY_NAMES]), [], "an entity left 1.0");
  assert.deepEqual(missing(FROZEN_ASSET_TYPES, [...ASSET_TYPES]), [], "an asset type left 1.0");
  assert.deepEqual(
    missing(
      FROZEN_REASONS,
      REASON_CODES.map((entry) => entry.code),
    ),
    [],
    "a reason left 1.0",
  );
  for (const [id, states] of Object.entries(FROZEN_STATES)) {
    assert.deepEqual(missing(states, statesOf(id)), [], `a state left ${id}`);
  }
});

test("the frozen roles are exactly four, and the frozen surfaces are not empty by accident", () => {
  assert.deepEqual([...ROLES], FROZEN_ROLES, "the four role names are frozen in both directions");
  assert.ok(FROZEN_CAPABILITIES.length >= 23);
  assert.ok(FROZEN_REASONS.length >= 58);
});

test("the Offline capability model is a different version from the Real-time one", () => {
  assert.equal(CAPABILITY_SCHEMA_VERSION, "aub-offline-workspace-roles/1.0");
  assert.equal(CAPABILITY_SCOPE, "offline_workspace");
  assert.notEqual(
    CAPABILITY_SCHEMA_VERSION,
    "aub-collaboration-roles/1.0",
    "AUB's Real-time table and this one share four role NAMES and nothing else; one version string for both would let a component answer the wrong question confidently",
  );
});

test("no Offline capability collides with a Real-time capability name", () => {
  // AUB's `internal/membership` vocabulary, as published in GET /api/collaboration/roles. It is
  // written out here rather than imported, because importing it would be a source dependency on a
  // sibling repository; what matters is that the two vocabularies stay disjoint, so a component
  // holding a mixed set can always say which table a name came from.
  const realtime = [
    "map.read",
    "map.write",
    "map.save",
    "annotation.read",
    "annotation.write",
    "preview.receive",
    "preview.send",
    "leases.receive",
    "leases.acquire",
    "editor_presence.read",
    "editor_presence.send",
    "session.start",
    "session.join",
    "session.manage_roles",
    "session.end",
    "roster.read",
    "assets.manage_owned_map",
  ];
  const shared = CAPABILITIES.filter((capability) => realtime.includes(capability));
  assert.deepEqual(
    shared,
    ["annotation.read", "annotation.write"],
    "only the two annotation capabilities are spelled the same in both scopes, and they mean the same thing in both: read the durable AUB annotations, and write one",
  );
});

test("every contract document declares the version it belongs to", () => {
  assert.equal(entitiesSchema.$defs.schema_version.const, SCHEMA_VERSION);
  assert.equal(reasonsDocument.schema_version, SCHEMA_VERSION);
  assert.equal(machinesDocument.schema_version, SCHEMA_VERSION);
  assert.equal(policyDocument.schema_version, SCHEMA_VERSION);
  assert.equal(assetTypesDocument.schema_version, SCHEMA_VERSION);
  assert.equal(rolesDocument.capability_schema_version, CAPABILITY_SCHEMA_VERSION);
});

test("every entity carries the contract version, so a mixed store is readable", () => {
  const exempt = new Set([
    // Sub-objects, always embedded in a parent that carries the version.
    "dependency_entry",
    "annotation_anchor",
    "blocking_reference",
  ]);
  for (const name of ENTITY_NAMES) {
    if (exempt.has(name)) continue;
    const def = entitiesSchema.$defs[name];
    assert.ok(def.required.includes("schema_version"), `${name} does not require schema_version`);
  }
});

test("a record from another contract version is refused rather than reinterpreted", () => {
  assert.equal(isSupportedVersion("1.0"), true);
  for (const version of ["1.1", "2.0", "0.9", "", null, undefined, 1.0]) {
    assert.equal(isSupportedVersion(version), false, String(version));
  }
  assert.ok(
    REASON_CODES.some((entry) => entry.code === "unsupported_contract_version"),
    "there has to be a refusal to give somebody whose version we do not implement",
  );
});

test("every entity carries stable ids and no display name is used as a key", () => {
  // Names, nicknames and filenames are display data. The invariant is checked structurally: any
  // property whose name ends in `_id` refers to the id definition, so a `workspace_name` can never
  // quietly become the thing a membership is bound to.
  // The two exceptions are inside an annotation's anchor and are not workspace ids at all: they
  // are identities WITHIN an APMap document, whose shape `@auto-pigeon/apmap-schema` owns. Borrowing
  // this contract's id definition for them would be this package asserting a rule over a document
  // format it does not define.
  const foreignIds = new Set(["annotation_anchor.object_id", "annotation_anchor.face_id"]);
  for (const name of ENTITY_NAMES) {
    for (const [field, schema] of Object.entries(entitiesSchema.$defs[name].properties)) {
      if (!field.endsWith("_id")) continue;
      if (foreignIds.has(`${name}.${field}`)) continue;
      assert.ok(
        ["#/$defs/id", "#/$defs/id_or_null", "#/$defs/client_instance_id", "#/$defs/correlation_id"].includes(
          schema.$ref,
        ),
        `${name}.${field} is an id field that does not use an id definition`,
      );
    }
  }
});

test("every timestamp field uses the one timestamp definition", () => {
  const timeish = /(_at|_time)$/;
  for (const name of ENTITY_NAMES) {
    for (const [field, schema] of Object.entries(entitiesSchema.$defs[name].properties)) {
      if (!timeish.test(field)) continue;
      assert.ok(
        ["#/$defs/timestamp", "#/$defs/timestamp_or_null"].includes(schema.$ref),
        `${name}.${field} looks like a timestamp and is not one`,
      );
    }
  }
});
