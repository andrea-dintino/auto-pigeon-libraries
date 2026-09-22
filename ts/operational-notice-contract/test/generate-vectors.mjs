// Regenerates ../fixtures/notice-vectors.json from the reference implementation. AUB's Go read
// route must reproduce every `server` case; every client runs every `client` case through this
// module (they vendor it byte for byte). `test/contract.test.mjs` fails when the committed vectors
// and the implementation disagree — run `npm run vectors`, read the diff, commit both.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  checkNoticeSchedule,
  checkNoticeText,
  nextPollDelayMs,
  parseNoticeResponse,
  restoreCachedResponse,
  cacheableResponse,
  selectServerNotices,
  selectVisibleNotices,
} from "../src/index.mjs";

const T = (iso) => Date.parse(iso);
// Winter maintenance in Copenhagen: 22:00-23:30 local on 2026-01-15 is 21:00-22:30Z.
const row = (over) => ({
  id: "maint0000000001",
  revision: 1,
  title: "Scheduled maintenance",
  body: "AUB will be unavailable for up to 90 minutes.\nEditing continues offline; saving resumes afterwards.",
  severity: "maintenance",
  show_from: "2026-01-14T21:00:00.000Z",
  starts_at: "2026-01-15T21:00:00.000Z",
  ends_at: "2026-01-15T22:30:00.000Z",
  visibility: "public",
  dismissible: true,
  enabled: true,
  surfaces: ["aup", "aug", "aucom"],
  ...over,
});

const rows = [
  row({}),
  row({ id: "crit00000000001", severity: "critical", title: "Security incident: sign in again", dismissible: true, show_from: "2026-01-15T10:00:00.000Z", starts_at: "2026-01-15T10:00:00.000Z", ends_at: "2026-01-15T12:00:00.000Z" }),
  row({ id: "auth00000000001", visibility: "authenticated", title: "Your saved maps move to new storage", severity: "info", show_from: "2026-01-15T09:00:00.000Z", starts_at: "2026-01-15T09:30:00.000Z", ends_at: "2026-01-16T09:00:00.000Z" }),
  row({ id: "augonly00000001", surfaces: ["aug"], title: "Gallery search is slow", severity: "warning", show_from: "2026-01-15T00:00:00.000Z", starts_at: "2026-01-15T00:00:00.000Z", ends_at: "2026-01-16T00:00:00.000Z" }),
  row({ id: "disabled0000001", enabled: false, title: "Disabled" }),
  row({ id: "future000000001", title: "Far future", show_from: "2026-06-01T00:00:00.000Z", starts_at: "2026-06-02T00:00:00.000Z", ends_at: "2026-06-02T01:00:00.000Z" }),
  row({ id: "soon00000000001", title: "Inside the look-ahead", show_from: "2026-01-15T11:10:00.000Z", starts_at: "2026-01-15T12:00:00.000Z", ends_at: "2026-01-15T13:00:00.000Z" }),
  row({ id: "ended0000000001", title: "Already ended", show_from: "2026-01-14T00:00:00.000Z", starts_at: "2026-01-14T01:00:00.000Z", ends_at: "2026-01-15T10:59:59.999Z" }),
];

const serverCases = [
  { name: "public caller on aup", surface: "aup", authenticated: false, now: "2026-01-15T11:00:00.000Z" },
  { name: "signed-in caller on aup sees authenticated notices too", surface: "aup", authenticated: true, now: "2026-01-15T11:00:00.000Z" },
  { name: "aug gets its own targeted notice", surface: "aug", authenticated: false, now: "2026-01-15T11:00:00.000Z" },
  { name: "after the critical window only the maintenance and look-ahead remain", surface: "aucom", authenticated: false, now: "2026-01-15T12:30:00.000Z" },
  { name: "after everything ended", surface: "aup", authenticated: true, now: "2026-01-17T00:00:00.000Z" },
  {
    name: "a flood of rows is cut to twenty, deterministically",
    surface: "aup",
    authenticated: false,
    now: "2026-01-15T11:00:00.000Z",
    rows: Array.from({ length: 60 }, (_, i) => row({ id: `flood${String(i).padStart(10, "0")}`, severity: ["info", "warning", "maintenance"][i % 3], starts_at: `2026-01-15T${String(12 + (i % 10)).padStart(2, "0")}:00:00.000Z`, ends_at: "2026-01-16T00:00:00.000Z" })),
  },
].map((c) => ({ ...c, rows: c.rows ?? rows, expected: selectServerNotices(c.rows ?? rows, { surface: c.surface, authenticated: c.authenticated, nowMs: T(c.now) }) }));

const response = (notices, extra = {}) => ({
  schema: "auto-pigeon-operational-notices/1.0",
  server_time: "2026-01-15T11:00:00.000Z",
  surface: "aup",
  visibility: "authenticated",
  poll_after_seconds: 90,
  notices,
  ...extra,
});
const wire = selectServerNotices(rows, { surface: "aup", authenticated: true, nowMs: T("2026-01-15T11:00:00.000Z") });

const clientCases = [
  { name: "future: upcoming a day ahead", server_now: "2026-01-14T21:00:00.000Z", authenticated: false },
  { name: "not yet shown before show_from", server_now: "2026-01-14T20:59:59.999Z", authenticated: false },
  { name: "active at starts_at", server_now: "2026-01-15T21:00:00.000Z", authenticated: false },
  { name: "expired at ends_at", server_now: "2026-01-15T22:30:00.000Z", authenticated: false },
  { name: "critical first, never dismissible, even when data says it is", server_now: "2026-01-15T11:00:00.000Z", authenticated: true, account: "user00000000001", dismissed: ["user00000000001:crit00000000001:1", "user00000000001:maint0000000001:1"] },
  { name: "dismissed revision 1 stays dismissed", server_now: "2026-01-15T11:00:00.000Z", authenticated: false, dismissed: ["anonymous:maint0000000001:1"] },
  { name: "an edit (revision 2) resurfaces a dismissed notice", server_now: "2026-01-15T11:00:00.000Z", authenticated: false, dismissed: ["anonymous:maint0000000001:1"], bump: { id: "maint0000000001", revision: 2 } },
  { name: "sign-out hides authenticated notices at once", server_now: "2026-01-15T11:00:00.000Z", authenticated: false },
  { name: "sign-in shows them", server_now: "2026-01-15T11:00:00.000Z", authenticated: true, account: "user00000000001" },
  { name: "a dismissal belongs to one account", server_now: "2026-01-15T11:00:00.000Z", authenticated: true, account: "user00000000002", dismissed: ["user00000000001:maint0000000001:1"] },
].map((c) => {
  const notices = wire.map((n) => (c.bump && n.id === c.bump.id ? { ...n, revision: c.bump.revision } : n));
  const parsed = parseNoticeResponse(response(notices));
  const visible = selectVisibleNotices({
    response: parsed.response,
    authenticated: c.authenticated,
    account: c.account,
    serverNowMs: T(c.server_now),
    dismissed: new Set(c.dismissed ?? []),
  });
  return { ...c, response: response(notices), expected: visible.map(({ notice, phase }) => ({ id: notice.id, revision: notice.revision, phase, dismissible: notice.dismissible })) };
});

// A wrong local clock: the client thinks it is 2020, the server says 11:00Z. With the offset the
// client derives the SERVER instant, so the phase is the server's.
const wrongClock = (() => {
  const localRequest = T("2020-03-01T00:00:00.000Z");
  const offset = T("2026-01-15T11:00:00.000Z") - (localRequest + (localRequest + 200)) / 2;
  const later = localRequest + 60 * 60 * 1000; // one local hour later
  return { local_request_ms: localRequest, local_response_ms: localRequest + 200, server_time: "2026-01-15T11:00:00.000Z", offset_ms: offset, local_later_ms: later, server_later: new Date(later + offset).toISOString() };
})();

const hostile = parseNoticeResponse(response([
  { ...wire[0], title: "<script>alert(1)</script>‮ evil", body: "line\u0000one\r\nline two ​" },
  { ...wire[0], id: "BAD", title: "bad id" },
  { ...wire[0], id: "badtime00000001", starts_at: "2026-01-16T00:00:00.000Z", ends_at: "2026-01-15T00:00:00.000Z" },
  { ...wire[0], id: "authonpublic001", visibility: "authenticated" },
], { visibility: "public" }));

const cacheCase = (() => {
  const parsed = parseNoticeResponse(response(wire));
  const entry = cacheableResponse(parsed.response, 0);
  return {
    stored: entry,
    restored_during: restoreCachedResponse(JSON.parse(JSON.stringify(entry)), T("2026-01-15T21:30:00.000Z")),
    restored_after: restoreCachedResponse(JSON.parse(JSON.stringify(entry)), T("2026-01-15T22:30:00.000Z")),
  };
})();

const textCases = [
  ["title", "Scheduled maintenance"],
  ["title", ""],
  ["title", "x".repeat(81)],
  ["title", "two\nlines"],
  ["title", "<b>bold</b>"],
  ["title", "see [docs](https://x.invalid)"],
  ["title", "javascript:alert(1)"],
  ["title", "right‮left"],
  ["title", "10:00 -> 11:00 < 2 hours"],
  ["body", "Line one.\nLine two."],
  ["body", "tab\tinside"],
  ["body", "crlf\r\nline"],
  ["body", "é".repeat(600)],
  ["body", "é".repeat(601)],
].map(([field, value]) => ({ field, value, expected: checkNoticeText(value, { field }) }));

const now = T("2026-01-15T11:00:00.000Z");
const scheduleCases = [
  { name: "ordinary", show_from: "2026-01-14T21:00:00.000Z", starts_at: "2026-01-15T21:00:00.000Z", ends_at: "2026-01-15T22:30:00.000Z" },
  { name: "show after start", show_from: "2026-01-16T00:00:00.000Z", starts_at: "2026-01-15T21:00:00.000Z", ends_at: "2026-01-15T22:30:00.000Z" },
  { name: "end equals start", show_from: "2026-01-15T00:00:00.000Z", starts_at: "2026-01-15T21:00:00.000Z", ends_at: "2026-01-15T21:00:00.000Z" },
  { name: "lead over thirty days", show_from: "2026-01-01T00:00:00.000Z", starts_at: "2026-02-15T00:00:00.000Z", ends_at: "2026-02-15T01:00:00.000Z" },
  { name: "longer than fourteen days", show_from: "2026-01-15T00:00:00.000Z", starts_at: "2026-01-16T00:00:00.000Z", ends_at: "2026-02-16T00:00:00.000Z" },
  { name: "more than four hundred days ahead", show_from: "2027-06-01T00:00:00.000Z", starts_at: "2027-06-02T00:00:00.000Z", ends_at: "2027-06-02T01:00:00.000Z" },
  { name: "not UTC", show_from: "2026-01-15T00:00:00+01:00", starts_at: "2026-01-16T00:00:00.000Z", ends_at: "2026-01-16T01:00:00.000Z" },
].map((c) => ({ ...c, now: "2026-01-15T11:00:00.000Z", expected: checkNoticeSchedule(c, now) }));

const pollCases = [
  { failures: 0, pollAfterSeconds: 90, random: 0 },
  { failures: 0, pollAfterSeconds: 10, random: 0 },
  { failures: 0, pollAfterSeconds: 999, random: 0.999 },
  { failures: 1, random: 0 },
  { failures: 3, random: 0.5 },
  { failures: 20, random: 0.999 },
].map((c) => ({ ...c, expected_ms: nextPollDelayMs(c) }));

const vectors = {
  schema_version: "1.0",
  description: "Cross-language vectors for auto-pigeon-operational-notices/1.0. Generated by test/generate-vectors.mjs; test/contract.test.mjs fails when they drift. AUB must reproduce every `server` case (ordered ids and fields) and every `text`/`schedule` verdict; clients run the `client`, `wrong_clock`, `hostile`, `cache` and `poll` cases through the vendored module.",
  server: serverCases,
  client: clientCases,
  wrong_clock: wrongClock,
  hostile,
  cache: cacheCase,
  text: textCases,
  schedule: scheduleCases,
  poll: pollCases,
};

const target = fileURLToPath(new URL("../fixtures/notice-vectors.json", import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(target, `${JSON.stringify(vectors, null, 2)}\n`);
  console.log(`wrote ${target}`);
}
export { vectors };
