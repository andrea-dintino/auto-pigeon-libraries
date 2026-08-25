// The two schemas are the cross-stack contract five repositories implement independently. What is
// worth testing about a schema nobody generates code from is that it ACCEPTS what a correct service
// sends and REFUSES what a mistaken one sends — a schema that accepts everything is documentation
// with a .json extension.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const here = dirname(fileURLToPath(import.meta.url));
const schema = (name) => JSON.parse(readFileSync(join(here, "..", "schema", name), "utf8"));

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateVersion = ajv.compile(schema("version-response.schema.json"));
const validateHealthz = ajv.compile(schema("healthz-response.schema.json"));

test("a complete /version document is accepted", () => {
  assert.ok(
    validateVersion({
      component: "auto-pigeon-backend",
      version: "1.517",
      commit_count: 517,
      commit_hash: "a1b2c3d4e5f6",
      dirty: false,
    }),
    JSON.stringify(validateVersion.errors),
  );
});

test("a minimal /version document is accepted", () => {
  assert.ok(
    validateVersion({ component: "auto-pigeon-gallery", version: "1.167", commit_count: 167 }),
    JSON.stringify(validateVersion.errors),
  );
});

test("an uninjected build reports unknown rather than a plausible placeholder", () => {
  assert.ok(validateVersion({ component: "auto-pigeon", version: "unknown", commit_count: null }));
  // The exact string a package manager would have left behind. Accepting it is how a build with no
  // version becomes a build that reports a wrong one.
  assert.ok(!validateVersion({ component: "auto-pigeon", version: "0.1.0-dev", commit_count: null }));
});

test("a commit hash is not a version", () => {
  assert.ok(!validateVersion({ component: "auto-pigeon", version: "a1b2c3d", commit_count: 382 }));
});

test("/version is closed: it may not grow paths, environment or dependency dumps", () => {
  assert.ok(
    !validateVersion({
      component: "auto-pigeon-backend",
      version: "1.517",
      commit_count: 517,
      data_dir: "/home/someone/mapper/runtime/auto-pigeon-backend/prod",
    }),
  );
});

test("an instance identity distinguishes two processes of one build", () => {
  assert.ok(
    validateVersion({
      component: "auto-pigeon-collaboration",
      version: "1.304",
      commit_count: 304,
      instance: "colyseus-2",
    }),
  );
});

test("a /healthz document carries the component AND its version", () => {
  assert.ok(
    validateHealthz({ status: "ok", component: "auto-pigeon-backend", version: "1.517" }),
    JSON.stringify(validateHealthz.errors),
  );
  for (const missing of ["status", "component", "version"]) {
    const document = { status: "ok", component: "auto-pigeon-backend", version: "1.517" };
    delete document[missing];
    assert.ok(!validateHealthz(document), `${missing} must be required`);
  }
});

test("/healthz admits the one or two facts only that component can know", () => {
  assert.ok(
    validateHealthz({
      status: "ok",
      component: "auto-pigeon-backend",
      version: "1.517",
      database: "ready",
      aue: { status: "configured", image_version: "1.221" },
    }),
    JSON.stringify(validateHealthz.errors),
  );
});

test("/healthz status is a closed vocabulary", () => {
  assert.ok(!validateHealthz({ status: "UP", component: "auto-pigeon", version: "1.382" }));
  assert.ok(validateHealthz({ status: "degraded", component: "auto-pigeon", version: "1.382" }));
});
