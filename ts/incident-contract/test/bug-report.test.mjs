// The user bug report: the committed cross-language vectors, the closed schema, and the three
// promises the report makes — one document, nothing leaks, nothing a user types can reshape it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BUG_REPORT_LIMITS,
  BUG_REPORT_URL,
  buildBugReport,
  bugReportSchema,
  canonicalReportJson,
  prefilledIssueUrl,
  renderIssue,
  renderReportText,
  reportDownloadNames,
  reportJsonDownload,
  sanitizeReportText,
  validateBugReport,
} from "../src/index.mjs";
import { vectors as regenerated } from "./generate-bug-report-vectors.mjs";

const committed = JSON.parse(readFileSync(new URL("../fixtures/bug-report-vectors.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const schemaValid = ajv.compile(bugReportSchema);

test("the committed vectors are exactly what the implementation produces (run `npm run vectors`)", () => {
  // Timestamps and ids are pinned in every input, so regeneration is deterministic.
  assert.deepEqual(JSON.parse(JSON.stringify(regenerated)), committed);
});

test("every built document satisfies the closed JSON schema and its own validator", () => {
  for (const entry of committed.reports.filter((r) => r.expected.ok)) {
    assert.ok(schemaValid(entry.expected.document), `${entry.name}: ${JSON.stringify(schemaValid.errors)}`);
    assert.deepEqual(validateBugReport(entry.expected.document), { valid: true, errors: [] }, entry.name);
  }
});

test("no canary survives into any output, in any letter case", () => {
  const outputs = JSON.stringify(committed.reports.map((r) => r.expected)).toLowerCase();
  for (const canary of committed.canaries) {
    assert.ok(!outputs.includes(canary.toLowerCase()), `canary leaked: ${canary}`);
  }
  for (const entry of committed.reports.filter((r) => r.expected.ok)) {
    const url = decodeURIComponent(prefilledIssueUrl(entry.expected.document)).toLowerCase();
    for (const canary of committed.canaries) assert.ok(!url.includes(canary.toLowerCase()), `canary in URL: ${canary}`);
  }
});

test("preview, downloads and both issue forms are renderings of one document", () => {
  const built = buildBugReport(committed.reports[1].input);
  const text = renderReportText(built.document);
  assert.equal(JSON.parse(reportJsonDownload(built.document)).report_id, built.document.report_id);
  assert.equal(reportJsonDownload(built.document).replace(/\s/g, ""), canonicalReportJson(built.document).replace(/\s/g, ""));
  for (const route of ["prefilled", "server"]) assert.ok(renderIssue(built.document, { route }).body.includes(text.trimEnd()));
  assert.ok(prefilledIssueUrl(built.document).startsWith(`${BUG_REPORT_URL}/new?`));
  const names = reportDownloadNames(built.document);
  assert.match(names.text, /^auto-pigeon-bug-report-aup-[0-9a-f]{12}\.txt$/);
  assert.match(names.json, /^auto-pigeon-bug-report-aup-[0-9a-f]{12}\.json$/);
});

test("the report text says, in its second line, that it is published publicly and where", () => {
  const text = committed.reports[0].expected.text.split("\n");
  assert.match(text[1], /published PUBLICLY at https:\/\/github\.com\/auto-pigeon\/bug-reports/);
});

test("nothing a user types can close the fence around the report", () => {
  const body = committed.reports.find((r) => r.name.startsWith("hostile")).expected.issue_server.body;
  const fences = body.split("\n").filter((line) => /^`{3,}/.test(line));
  const outer = fences[0].replace(/text$/, "");
  assert.equal(fences.at(-1), outer, "the last fence line closes the first");
  const inner = body.slice(body.indexOf(fences[0]) + fences[0].length, body.lastIndexOf(outer));
  for (const line of inner.split("\n")) assert.ok(!line.startsWith(outer), `a line inside could close the fence: ${line}`);
});

test("sanitising is idempotent on every vector and on every user field", () => {
  for (const entry of committed.sanitize) {
    assert.equal(sanitizeReportText(entry.expected, entry.max, { multiline: entry.multiline }), entry.expected, entry.name);
  }
  for (const entry of committed.reports.filter((r) => r.expected.ok)) {
    const user = entry.expected.document.user;
    assert.equal(sanitizeReportText(user.summary, BUG_REPORT_LIMITS.summary, { multiline: false }), user.summary);
    for (const field of ["steps", "expected", "actual"]) assert.equal(sanitizeReportText(user[field], BUG_REPORT_LIMITS[field]), user[field]);
  }
});

test("bidi overrides, zero-width characters and C0/C1 controls are removed before redaction", () => {
  const out = sanitizeReportText("a‮b​c\u0007d\u009Fe﻿f", 100);
  assert.equal(out, "abcdef");
  assert.equal(sanitizeReportText("ghp_CANARY‍token0123456789abcdef0", 100), "[redacted-token]");
});

test("a field is cut in code points, never inside a character, and the cut is marked", () => {
  const cut = sanitizeReportText("🐦".repeat(10), 4);
  assert.equal(Array.from(cut).length, 4);
  assert.ok(cut.endsWith("…"));
  assert.ok(!/[\uD800-\uDFFF](?![\uDC00-\uDFFF])/.test(cut.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")));
});

test("the validation vectors reproduce", () => {
  for (const entry of committed.validate) assert.deepEqual(validateBugReport(entry.document), entry.expected, entry.name);
});

test("a document that is too large is refused", () => {
  const built = buildBugReport({ component: "AUP", reportId: "0".repeat(32), now: 0, user: { summary: "x" } }).document;
  const huge = { ...built, user: { ...built.user, steps: "x".repeat(40000) } };
  assert.ok(validateBugReport(huge).errors.includes("document:too_large"));
});

test("the prefilled URL fits the limit, or the build says it does not", () => {
  for (const entry of committed.reports.filter((r) => r.expected.ok)) {
    assert.equal(entry.expected.prefill_fits, entry.expected.prefill_url_length <= BUG_REPORT_LIMITS.prefill_url, entry.name);
  }
});

test("building never throws, whatever it is handed", () => {
  for (const input of [undefined, null, {}, { component: "AUP" }, { component: "AUP", user: null }, { component: "AUP", user: { summary: 7 } }]) {
    const out = buildBugReport(input ?? undefined);
    assert.equal(out.ok, false);
  }
});
