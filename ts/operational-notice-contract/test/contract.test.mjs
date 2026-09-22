// The operational-notice contract: committed vectors, the closed response schema, and the client
// promises — server time over the local clock, critical is never dismissible, a revision
// resurfaces, authenticated notices never reach disk, and a cached notice never outlives its end.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  NOTICE_POLL,
  cacheableResponse,
  clockOffsetMs,
  dismissalKey,
  nextPollDelayMs,
  noticePhase,
  noticeResponseSchema,
  noticeRules,
  parseNoticeResponse,
  restoreCachedResponse,
  selectServerNotices,
  selectVisibleNotices,
} from "../src/index.mjs";
import { vectors as regenerated } from "./generate-vectors.mjs";

const committed = JSON.parse(readFileSync(new URL("../fixtures/notice-vectors.json", import.meta.url), "utf8"));
const timeVectors = JSON.parse(readFileSync(new URL("../fixtures/operator-time-vectors.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validResponse = ajv.compile(noticeResponseSchema);

test("the committed vectors are exactly what the implementation produces (run `npm run vectors`)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(regenerated)), committed);
});

test("every server selection is a schema-valid response body", () => {
  for (const c of committed.server) {
    const body = { schema: "auto-pigeon-operational-notices/1.0", server_time: c.now, surface: c.surface, visibility: c.authenticated ? "authenticated" : "public", poll_after_seconds: 90, notices: c.expected };
    assert.ok(validResponse(body), `${c.name}: ${JSON.stringify(validResponse.errors)}`);
    assert.ok(c.expected.length <= noticeRules.limits.max_notices);
    for (const n of c.expected) {
      assert.ok(!("enabled" in n) && !("surfaces" in n) && !("created_by" in n) && !("updated_by" in n), "no store-only field leaves AUB");
    }
  }
});

test("a server never serves a disabled, ended, far-future or other-surface row", () => {
  const ids = (name) => committed.server.find((c) => c.name === name).expected.map((n) => n.id);
  const pub = ids("public caller on aup");
  for (const id of ["disabled0000001", "future000000001", "ended0000000001", "augonly00000001", "auth00000000001"]) assert.ok(!pub.includes(id), id);
  assert.ok(ids("signed-in caller on aup sees authenticated notices too").includes("auth00000000001"));
  assert.ok(ids("aug gets its own targeted notice").includes("augonly00000001"));
});

test("the client vectors reproduce", () => {
  for (const c of committed.client) {
    const parsed = parseNoticeResponse(c.response);
    assert.ok(parsed.ok, c.name);
    const got = selectVisibleNotices({ response: parsed.response, authenticated: c.authenticated, account: c.account, serverNowMs: Date.parse(c.server_now), dismissed: new Set(c.dismissed ?? []) })
      .map(({ notice, phase }) => ({ id: notice.id, revision: notice.revision, phase, dismissible: notice.dismissible }));
    assert.deepEqual(got, c.expected, c.name);
  }
});

test("a wrong local clock does not move a notice: phase follows the server", () => {
  const w = committed.wrong_clock;
  const offset = clockOffsetMs(w.server_time, w.local_request_ms, w.local_response_ms);
  assert.equal(offset, w.offset_ms);
  assert.equal(new Date(w.local_later_ms + offset).toISOString(), w.server_later);
  const notice = { show_from: "2026-01-15T11:30:00.000Z", starts_at: "2026-01-15T11:45:00.000Z", ends_at: "2026-01-15T11:50:00.000Z" };
  assert.equal(noticePhase(notice, w.local_later_ms + offset), "expired");
  assert.equal(noticePhase(notice, w.local_later_ms), "pending", "read naively, the 2020 clock would never show it");
});

test("critical notices are never dismissible, whatever the data says", () => {
  const parsed = parseNoticeResponse(committed.client[0].response).response;
  for (const n of parsed.notices) if (n.severity === "critical") assert.equal(n.dismissible, false);
});

test("hostile text is kept inert and bounded; malformed notices are dropped one by one", () => {
  const h = committed.hostile;
  assert.equal(h.ok, true);
  assert.equal(h.dropped, 3);
  const [n] = h.response.notices;
  assert.ok(!/[‮​\u0000\r]/.test(n.title + n.body));
});

test("authenticated notices never reach the cache, and a cached notice never outlives its end", () => {
  const { stored, restored_during, restored_after } = committed.cache;
  assert.ok(stored.response.notices.every((n) => n.visibility === "public"));
  assert.equal(stored.response.visibility, "public");
  assert.deepEqual(restored_during.response.notices.map((n) => n.id), ["maint0000000001"]);
  assert.deepEqual(restored_after.response.notices, []);
  assert.equal(restoreCachedResponse({ response: { schema: "nope" } }, 0), undefined);
  assert.equal(cacheableResponse(undefined, 0), undefined);
});

test("polling stays inside 60-120 s after success and backs off to at most 15 minutes after failure", () => {
  for (const c of committed.poll) assert.equal(nextPollDelayMs(c), c.expected_ms);
  for (let i = 0; i < 200; i += 1) {
    const ok = nextPollDelayMs({ failures: 0, pollAfterSeconds: 90, random: i / 200 });
    assert.ok(ok >= NOTICE_POLL.min_seconds * 1000 && ok <= NOTICE_POLL.max_seconds * 1000);
    const bad = nextPollDelayMs({ failures: 1 + (i % 12), random: i / 200 });
    assert.ok(bad >= NOTICE_POLL.min_seconds * 1000 && bad <= NOTICE_POLL.backoff_max_seconds * 1000);
  }
});

test("dismissal keys carry the account, the notice and its revision", () => {
  assert.equal(dismissalKey(undefined, { id: "a".repeat(15), revision: 3 }), `anonymous:${"a".repeat(15)}:3`);
  assert.equal(dismissalKey("u1", { id: "a".repeat(15), revision: 3 }), `u1:${"a".repeat(15)}:3`);
});

test("parsing never throws on junk", () => {
  for (const junk of [undefined, null, 1, "x", [], {}, { schema: "auto-pigeon-operational-notices/1.0" }]) {
    assert.equal(parseNoticeResponse(junk).ok, false);
  }
  assert.deepEqual(selectServerNotices(undefined, { surface: "aup", authenticated: false, nowMs: 0 }), []);
});

test("the operator time vectors name only refusals the rules declare", () => {
  const known = new Set(noticeRules.operator_time.refusals);
  const zone = new RegExp(noticeRules.operator_time.zone_pattern);
  for (const c of timeVectors.cases) {
    if (c.expected.refusal) assert.ok(known.has(c.expected.refusal), c.name);
    if (c.expected.refusal === "zone_not_iana_region") assert.ok(!zone.test(c.zone), c.name);
    else assert.ok(zone.test(c.zone), c.name);
  }
});
