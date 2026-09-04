// The Offline capability table, exhaustively.
//
// Every one of the four roles is asserted against every one of the capabilities — no sampling, no
// "the interesting ones". A capability matrix is exactly the kind of table where the row nobody
// tested is the row that is wrong, and this one is read by four repositories.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  ROLES,
  CAPABILITIES,
  can,
  capabilitiesFor,
  rolesWith,
  rank,
  isKnownRole,
  isKnownCapability,
  additionalGates,
  nonNestingCapabilities,
  roleSummary,
  capabilitySummary,
  rolesDocument,
} from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(here, "..", "fixtures", "index.json"), "utf8"));

test("the exhaustive matrix is the committed golden, verdict for verdict", () => {
  const expected = new Map(
    fixtures.capability_matrix.map((row) => [`${row.role} ${row.capability}`, row.allowed]),
  );
  assert.equal(
    expected.size,
    ROLES.length * CAPABILITIES.length,
    "the golden matrix is not one row per role per capability",
  );
  for (const role of ROLES) {
    for (const capability of CAPABILITIES) {
      const key = `${role} ${capability}`;
      assert.ok(expected.has(key), `the golden matrix has no row for ${role} / ${capability}`);
      assert.equal(
        can(role, capability),
        expected.get(key),
        `${role} / ${capability} disagrees with fixtures/index.json — if the table changed on purpose, regenerate the golden in the same commit`,
      );
    }
  }
});

test("the four frozen roles, in rank order", () => {
  assert.deepEqual([...ROLES], ["overlord", "lord", "knight", "pilgrim"]);
  assert.deepEqual(ROLES.map(rank), [0, 1, 2, 3]);
  assert.equal(rank("peasant"), ROLES.length, "an unknown role sorts last rather than first");
});

test("an unknown role holds nothing and an unknown capability is held by nobody", () => {
  for (const capability of CAPABILITIES) {
    assert.equal(can("peasant", capability), false);
    assert.equal(can("", capability), false);
    assert.equal(can(undefined, capability), false);
  }
  for (const role of ROLES) {
    assert.equal(can(role, "workspace.take_ownership"), false);
    assert.equal(can(role, ""), false);
  }
  assert.deepEqual(capabilitiesFor("peasant"), []);
  assert.deepEqual(rolesWith("workspace.take_ownership"), []);
  assert.equal(isKnownRole("peasant"), false);
  assert.equal(isKnownCapability("map.write"), false, "a Real-time capability is not an Offline one");
});

test("Overlord and Lord edit and save existing assets; Knight and Pilgrim do not", () => {
  for (const capability of ["asset.edit", "asset.save"]) {
    assert.deepEqual(rolesWith(capability), ["overlord", "lord"], capability);
  }
});

test("Knight contributes new assets and annotates, and cannot touch an existing one", () => {
  assert.equal(can("knight", "asset.upload"), true);
  assert.equal(can("knight", "asset.import"), true);
  assert.equal(can("knight", "annotation.write"), true);
  assert.equal(can("knight", "asset.edit"), false);
  assert.equal(can("knight", "asset.save"), false);
  assert.equal(
    can("knight", "annotation.resolve"),
    false,
    "V1 decides what the older backlog left open: a contributor may raise a point and may not declare it settled",
  );
  assert.equal(
    can("knight", "escalation.request"),
    false,
    "a member who may not edit is sent to the role-upgrade path, not to Real-time",
  );
});

test("Pilgrim writes nothing at all", () => {
  const writes = CAPABILITIES.filter(
    (capability) =>
      capability.endsWith(".write") ||
      capability.startsWith("asset.upload") ||
      capability.startsWith("asset.import") ||
      capability.startsWith("asset.edit") ||
      capability.startsWith("asset.save") ||
      capability.startsWith("asset.detach") ||
      capability.startsWith("member.invite") ||
      capability.startsWith("member.remove") ||
      capability.startsWith("member.role") ||
      capability.startsWith("annotation.resolve") ||
      capability.startsWith("escalation.") ||
      capability.startsWith("workspace.visibility") ||
      capability.startsWith("workspace.delete"),
  );
  assert.ok(writes.length > 0);
  for (const capability of writes) {
    assert.equal(can("pilgrim", capability), false, `pilgrim holds ${capability}`);
  }
  assert.deepEqual(capabilitiesFor("pilgrim"), [
    "workspace.read",
    "workspace.activity.read",
    "member.leave",
    "role_request.create",
    "asset.read",
    "asset.download",
    "annotation.read",
  ]);
});

test("only the Overlord administers membership, roles, visibility and deletion", () => {
  for (const capability of [
    "workspace.metadata.write",
    "workspace.visibility.change",
    "workspace.delete",
    "member.invite",
    "member.role.change",
    "member.remove",
    "role_request.resolve",
    "asset.detach",
  ]) {
    assert.deepEqual(rolesWith(capability), ["overlord"], capability);
  }
});

test("the two capabilities that deliberately do not nest", () => {
  const declared = nonNestingCapabilities();
  assert.equal(declared.length, 2);
  for (const entry of declared) {
    assert.deepEqual(
      rolesWith(entry.capability),
      entry.held_by,
      `${entry.capability} does not match the non-nesting note that explains it`,
    );
    assert.equal(can("overlord", entry.capability), false);
    assert.ok(entry.why.length > 0);
  }
  assert.deepEqual(declared.map((entry) => entry.capability).sort(), [
    "member.leave",
    "role_request.create",
  ]);
});

test("capability sets are not derivable from rank, which is why nothing may try", () => {
  // If the sets nested, every capability a lower rank held would be held by every higher rank. Two
  // do not, and this assertion is here so a future "higher rank implies it" shortcut fails loudly
  // rather than working for twenty-one capabilities and quietly letting an Overlord leave.
  // Nesting would mean each capability's holders are a PREFIX of the rank order: held by the
  // Overlord, then by the Lord, and so on down. Anything held further down but not at the top
  // breaks it.
  const notNested = CAPABILITIES.filter((capability) => {
    const holders = rolesWith(capability).map(rank);
    return holders.length > 0 && !holders.every((position, index) => position === index);
  });
  assert.deepEqual(
    notNested.sort(),
    ["member.leave", "role_request.create"],
    "the set of capabilities that break rank nesting changed; a shortcut that reasons from rank is now wrong about a different capability",
  );
});

test("every role and capability in the table carries its own explanation", () => {
  for (const role of ROLES) {
    assert.ok(roleSummary(role)?.summary?.length > 0, role);
  }
  for (const capability of CAPABILITIES) {
    assert.ok(capabilitySummary(capability)?.summary?.length > 0, capability);
  }
});

test("capabilitiesFor projects onto the contract's capability order", () => {
  for (const role of ROLES) {
    const held = capabilitiesFor(role);
    const positions = held.map((capability) => CAPABILITIES.indexOf(capability));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), role);
    assert.equal(new Set(held).size, held.length, `${role} lists a capability twice`);
  }
  assert.equal(
    capabilitiesFor("overlord").length,
    CAPABILITIES.length - 2,
    "the Overlord holds everything except the two the table deliberately withholds",
  );
});

test("the matrix names only capabilities the vocabulary declares", () => {
  for (const [role, held] of Object.entries(rolesDocument.matrix)) {
    assert.ok(ROLES.includes(role), `the matrix has a row for the unknown role ${role}`);
    for (const capability of held) {
      assert.ok(
        CAPABILITIES.includes(capability),
        `${role} is given the undeclared capability ${capability}`,
      );
    }
  }
  assert.deepEqual(Object.keys(rolesDocument.matrix).sort(), [...ROLES].sort(), "a role has no row");
});

test("the gates beyond the role are declared for every capability that has one", () => {
  for (const capability of ["asset.edit", "asset.save", "asset.detach", "escalation.accept"]) {
    assert.ok(additionalGates(capability).length > 0, `${capability} has no additional gates recorded`);
  }
  assert.ok(
    additionalGates("asset.save").some((gate) => /owner/i.test(gate)),
    "asset.save must record that it is the ASSET OWNER's storage that is checked, not the saver's",
  );
  assert.deepEqual(additionalGates("workspace.read"), [], "a plain read needs no extra gate");
});
