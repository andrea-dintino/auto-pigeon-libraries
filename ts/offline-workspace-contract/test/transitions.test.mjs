// The state machines, exhaustively.
//
// Every machine, every state, every event: 199 questions, each answered against the committed
// golden. Legality is a closed question here — a move that is not listed does not exist — so the
// rows that assert an EMPTY set of next states are the ones doing most of the work. "Cannot detach
// a map somebody is editing" is a row of this table, not a paragraph somewhere.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
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
  isReasonCode,
} from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(here, "..", "fixtures", "index.json"), "utf8"));

test("the exhaustive transition matrix is the committed golden, cell for cell", () => {
  const expected = new Map(
    fixtures.transition_matrix.map((row) => [`${row.machine} ${row.from} ${row.event}`, row]),
  );
  let cells = 0;
  for (const id of MACHINE_IDS) {
    for (const from of statesOf(id)) {
      for (const event of eventsOf(id)) {
        cells += 1;
        const key = `${id} ${from} ${event}`;
        const row = expected.get(key);
        assert.ok(row, `the golden matrix has no cell for ${key}`);
        assert.deepEqual(
          nextStates(id, from, event),
          row.to,
          `${key} disagrees with fixtures/index.json — regenerate the golden in the same commit as a deliberate change`,
        );
        assert.deepEqual(refusalsFor(id, from, event), row.refusals, `${key} refusals`);
      }
    }
  }
  assert.equal(cells, expected.size, "the golden matrix has cells for moves that no longer exist");
  assert.equal(cells, 199);
});

test("every machine declares an initial state that is one of its states", () => {
  for (const id of MACHINE_IDS) {
    assert.ok(statesOf(id).includes(initialState(id)), id);
  }
});

test("no transition leaves a terminal state, and every non-terminal state has a way out", () => {
  for (const id of MACHINE_IDS) {
    for (const state of statesOf(id)) {
      const out = transitionsFrom(id, state);
      if (isTerminal(id, state)) {
        assert.equal(out.length, 0, `${id}.${state} is terminal and has ${out.length} way(s) out`);
      } else {
        assert.ok(out.length > 0, `${id}.${state} is not terminal and has no way out`);
      }
    }
  }
});

test("every state is reachable from the initial one", () => {
  for (const id of MACHINE_IDS) {
    const seen = new Set([initialState(id)]);
    const queue = [initialState(id)];
    while (queue.length > 0) {
      const state = queue.shift();
      for (const transition of transitionsFrom(id, state)) {
        if (!seen.has(transition.to)) {
          seen.add(transition.to);
          queue.push(transition.to);
        }
      }
    }
    for (const state of statesOf(id)) {
      assert.ok(seen.has(state), `${id}.${state} cannot be reached from ${initialState(id)}`);
    }
  }
});

test("every transition names guards, refusals, timestamps and an idempotency identity", () => {
  for (const id of MACHINE_IDS) {
    for (const transition of machine(id).transitions) {
      const where = `${id}: ${transition.from} --${transition.event}--> ${transition.to}`;
      assert.ok(Array.isArray(transition.identity), `${where} has no idempotency identity`);
      assert.ok(transition.identity.length > 0, `${where} has an empty idempotency identity`);
      assert.ok(
        ["return_current", "conflict"].includes(transition.on_replay ?? "return_current"),
        `${where} has an unrecognised replay rule`,
      );
      for (const reason of transition.refusals ?? []) {
        assert.ok(isReasonCode(reason), `${where} refuses with ${reason}, which is not in the taxonomy`);
      }
    }
  }
});

test("only the invitation's single-use acceptance conflicts on replay", () => {
  const conflicting = [];
  for (const id of MACHINE_IDS) {
    for (const transition of machine(id).transitions) {
      if (transition.on_replay === "conflict") {
        conflicting.push(`${id}.${transition.event}`);
      }
    }
  }
  assert.deepEqual(conflicting, ["workspace_invitation.accept"]);
  assert.deepEqual(idempotencyFor("workspace_invitation", "pending", "accept"), {
    identity: ["invitation_id"],
    on_replay: "conflict",
  });
});

test("an unknown machine, state or event is answered with nothing rather than an exception", () => {
  assert.equal(canTransition("no_such_machine", "a", "b"), false);
  assert.deepEqual(nextStates("asset_collaboration", "no_such_state", "attach"), []);
  assert.deepEqual(nextStates("asset_collaboration", "workspace_idle", "no_such_event"), []);
  assert.deepEqual(statesOf("no_such_machine"), []);
  assert.equal(initialState("no_such_machine"), undefined);
  assert.equal(isTerminal("no_such_machine", "anything"), false);
  assert.equal(idempotencyFor("asset_collaboration", "workspace_idle", "no_such_event"), undefined);
});

// -- The product invariants, read out of the machine rather than restated beside it ---------------

test("an asset being edited or in a session cannot be detached by an ordinary detach", () => {
  for (const state of ["offline_editing", "realtime_starting", "realtime_active"]) {
    assert.deepEqual(
      nextStates("asset_collaboration", state, "detach"),
      [],
      `an asset in ${state} can be detached, which is the destructive administrative race V1 blocks`,
    );
  }
  assert.deepEqual(nextStates("asset_collaboration", "workspace_idle", "detach"), ["unattached"]);
});

test("only a lawful forced lifecycle event takes an asset out of an active state", () => {
  for (const state of ["workspace_idle", "offline_editing", "realtime_starting", "realtime_active"]) {
    assert.deepEqual(nextStates("asset_collaboration", state, "forced_detach"), ["unattached"], state);
  }
  const forced = machine("asset_collaboration").transitions.filter(
    (transition) => transition.event === "forced_detach",
  );
  for (const transition of forced) {
    assert.ok(
      transition.guards.some((guard) => /forced lifecycle/i.test(guard)),
      "forced_detach must be guarded by the lifecycle event that justifies it",
    );
    assert.deepEqual(transition.refusals, [], "a lawful erasure is not refusable by a collaboration lock");
  }
});

test("one asset, one writer: a lease is acquirable only from idle", () => {
  assert.deepEqual(nextStates("asset_collaboration", "workspace_idle", "acquire_lease"), [
    "offline_editing",
  ]);
  for (const state of ["unattached", "offline_editing", "realtime_starting", "realtime_active"]) {
    assert.deepEqual(nextStates("asset_collaboration", state, "acquire_lease"), [], state);
  }
  assert.deepEqual(refusalsFor("asset_collaboration", "workspace_idle", "acquire_lease"), [
    "edit_lease_not_available_for_role",
    "asset_not_mutable",
    "edit_lease_held_by_other_user",
    "edit_lease_held_by_other_client",
  ]);
});

test("saving keeps the lease and bumps exactly one revision", () => {
  assert.deepEqual(nextStates("asset_collaboration", "offline_editing", "save"), ["offline_editing"]);
  const fields = fieldsSetBy("asset_collaboration", "offline_editing", "save");
  assert.ok(fields.includes("revision"));
  assert.ok(fields.includes("last_modified_by_user_id"));
  const refusals = refusalsFor("asset_collaboration", "offline_editing", "save");
  assert.ok(refusals.includes("stale_asset_revision"), "CAS is mandatory even under a lease");
  assert.ok(
    refusals.includes("asset_owner_storage_unavailable") &&
      refusals.includes("asset_owner_quota_exceeded"),
    "the ASSET OWNER's storage is what gates the save",
  );
});

test("a save is impossible without a lease, and a lease is not a save permit", () => {
  assert.deepEqual(nextStates("asset_collaboration", "workspace_idle", "save"), []);
  assert.ok(
    refusalsFor("asset_collaboration", "offline_editing", "save").includes(
      "insufficient_workspace_role",
    ),
    "holding the lease is not the same as holding asset.save",
  );
});

test("escalation is accepted only from an active Offline edit, and produces one session", () => {
  assert.deepEqual(nextStates("asset_collaboration", "offline_editing", "accept_escalation"), [
    "realtime_starting",
  ]);
  for (const state of ["unattached", "workspace_idle", "realtime_starting", "realtime_active"]) {
    assert.deepEqual(nextStates("asset_collaboration", state, "accept_escalation"), [], state);
  }
  assert.ok(
    refusalsFor("asset_collaboration", "offline_editing", "accept_escalation").includes(
      "asset_already_in_realtime_session",
    ),
    "two requesters must not be able to produce two sessions for one map",
  );
});

test("a failed session start recovers to a truthful state, never to a phantom lock", () => {
  assert.deepEqual(
    nextStates("asset_collaboration", "realtime_starting", "session_failed").sort(),
    ["offline_editing", "workspace_idle"],
    "the two targets are the two truthful answers: the lease survived, or it did not",
  );
  const transitions = transitionsFor("asset_collaboration", "realtime_starting", "session_failed");
  assert.equal(transitions.length, 2);
  const guards = transitions.map((transition) => transition.guards.join(" "));
  assert.ok(guards.some((guard) => /still valid/i.test(guard)));
  assert.ok(guards.some((guard) => /lapsed/i.test(guard)));
});

test("Offline writing resumes only after the linked session's persistence is real", () => {
  assert.deepEqual(nextStates("asset_collaboration", "realtime_active", "session_ended"), [
    "workspace_idle",
  ]);
  assert.deepEqual(nextStates("asset_collaboration", "realtime_active", "acquire_lease"), []);
  assert.deepEqual(nextStates("asset_collaboration", "realtime_active", "save"), []);
  assert.equal(
    isTerminal("linked_session", "failed"),
    false,
    "a failed final persistence must be recovered explicitly, not silently unlocked",
  );
  assert.deepEqual(nextStates("linked_session", "failed", "recovered"), ["ended"]);
  assert.deepEqual(nextStates("linked_session", "finalizing", "persist_failed"), ["failed"]);
});

test("the workspace has no Offline/Live mode of its own", () => {
  assert.deepEqual(statesOf("workspace"), ["active", "deleted"]);
  for (const state of statesOf("workspace")) {
    assert.doesNotMatch(state, /offline|live|realtime/i);
  }
});

test("deleting a workspace is blocked while any asset in it is active", () => {
  const refusals = refusalsFor("workspace", "active", "delete");
  assert.ok(refusals.includes("workspace_delete_blocked_by_active_work"));
  const guards = transitionsFor("workspace", "active", "delete")[0].guards.join(" ");
  assert.match(guards, /offline_editing/);
  assert.match(guards, /realtime_active/);
});

test("the owner cannot leave, and cannot be demoted or removed", () => {
  assert.ok(refusalsFor("workspace_membership", "active", "leave").includes("workspace_owner_cannot_leave"));
  for (const event of ["remove", "change_role"]) {
    assert.ok(
      refusalsFor("workspace_membership", "active", event).includes("workspace_owner_immutable"),
      event,
    );
  }
});

test("a demotion or removal is blocked rather than revoking somebody's live edit", () => {
  assert.ok(
    refusalsFor("workspace_membership", "active", "change_role").includes(
      "role_change_blocked_by_active_lease",
    ),
  );
  assert.ok(
    refusalsFor("workspace_membership", "active", "remove").includes(
      "member_removal_blocked_by_active_work",
    ),
  );
});

test("an invitation is single-use in every direction", () => {
  assert.deepEqual(statesOf("workspace_invitation"), [
    "pending",
    "accepted",
    "declined",
    "revoked",
    "expired",
  ]);
  for (const state of ["accepted", "declined", "revoked", "expired"]) {
    assert.equal(isTerminal("workspace_invitation", state), true, state);
    for (const event of eventsOf("workspace_invitation")) {
      assert.deepEqual(nextStates("workspace_invitation", state, event), [], `${state}/${event}`);
    }
  }
});

test("private -> public is guarded by the asset-visibility invariant", () => {
  const transition = transitionsFor("workspace", "active", "change_visibility")[0];
  assert.ok(transition.guards.some((guard) => /every attached asset to be public/i.test(guard)));
  assert.ok(
    transition.refusals.includes("workspace_visibility_blocked_by_private_assets"),
  );
});

test("an escalation request has exactly one accepted outcome and five closed ones", () => {
  assert.deepEqual(statesOf("escalation_request"), [
    "pending",
    "accepted",
    "declined",
    "cancelled",
    "expired",
    "superseded",
  ]);
  assert.deepEqual(nextStates("escalation_request", "pending", "supersede"), ["superseded"]);
  for (const state of statesOf("escalation_request").slice(1)) {
    assert.equal(isTerminal("escalation_request", state), true, state);
  }
});

test("annotation threads resolve and reopen, and are never deleted by a machine", () => {
  assert.deepEqual(statesOf("annotation_thread"), ["open", "resolved"]);
  assert.deepEqual(nextStates("annotation_thread", "open", "resolve"), ["resolved"]);
  assert.deepEqual(nextStates("annotation_thread", "resolved", "reopen"), ["open"]);
  assert.equal(eventsOf("annotation_thread").includes("delete"), false);
});
