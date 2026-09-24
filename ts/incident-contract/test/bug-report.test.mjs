// The user bug report: the committed cross-language vectors, the closed schema, and the three
// promises the report makes — one document, nothing leaks, nothing a user types can reshape it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BUG_REPORT_AREAS,
  BUG_REPORT_TYPES,
  bugReportAreasFor,
  bugReportHeadings,
  bugReportLabels,
  bugReportRules,
  bugReportSchemaPrevious,
  bugReportSchemaStatus,
  suggestBugReportArea,
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
  const built = buildBugReport({ component: "AUP", reportType: "bug", area: "editor", reportId: "0".repeat(32), now: 0, user: { summary: "x" } }).document;
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

// ---- 1.1: classification ---------------------------------------------------------------------

const codes = JSON.parse(readFileSync(new URL("../schema/incident-codes.json", import.meta.url), "utf8"));
const RID = "0123456789abcdef0123456789abcdef";
const NOW = "2026-09-22T12:00:00.000Z";
const catalogue = bugReportRules.label_catalogue.labels.map((label) => label.name);
const cold = (component, reportType, area, user = { summary: "x" }) =>
  buildBugReport({ component, reportType, area, reportId: RID, now: NOW, user });

test("every valid document, of every application, type and offered area, has exactly one label of each kind", () => {
  const apps = Object.keys(bugReportRules.applications);
  const typeLabels = Object.values(bugReportRules.report_types).map((type) => type.label);
  const areaLabels = Object.values(bugReportRules.areas);
  let seen = 0;
  for (const component of apps) {
    for (const reportType of BUG_REPORT_TYPES) {
      for (const area of bugReportAreasFor(component)) {
        const built = cold(component, reportType, area);
        assert.ok(built.ok, `${component}/${reportType}/${area}`);
        assert.ok(schemaValid(built.document), JSON.stringify(schemaValid.errors));
        const labels = bugReportLabels(built.document);
        assert.equal(labels.length, 3);
        assert.equal(labels.filter((label) => apps.includes(label)).length, 1);
        assert.equal(labels.filter((label) => typeLabels.includes(label)).length, 1);
        assert.equal(labels.filter((label) => areaLabels.includes(label)).length, 1);
        assert.deepEqual(labels, [component, bugReportRules.report_types[reportType].label, bugReportRules.areas[area]]);
        for (const label of labels) assert.ok(catalogue.includes(label), `${label} is not in the label catalogue`);
        seen += 1;
      }
    }
  }
  assert.equal(seen, 2 * (10 + 4 + 5));
});

test("an application can only carry its own application label, whatever else the document says", () => {
  for (const component of ["AUP", "AUG", "AUCOM"]) {
    const built = cold(component, "bug", "other");
    const others = ["AUP", "AUG", "AUCOM"].filter((c) => c !== component);
    assert.equal(bugReportLabels(built.document)[0], component);
    for (const other of others) assert.ok(!bugReportLabels(built.document).includes(other));
  }
});

test("a type, an area or a component outside the closed sets never yields labels", () => {
  const good = cold("AUP", "bug", "editor").document;
  for (const bad of [
    { ...good, component: "AUB" },
    { ...good, report_type: "Bug" },
    { ...good, report_type: ["bug", "feature_request"] },
    { ...good, area: "Area: Editor" },
    { ...good, area: ["editor", "transform"] },
    { ...good, area: "gallery" },
    { ...good, schema: "auto-pigeon-bug-report/2.0" },
    (() => { const d = { ...good }; delete d.area; return d; })(),
    null, "AUP", [],
  ]) {
    assert.equal(bugReportLabels(bad), null, JSON.stringify(bad)?.slice(0, 80));
  }
  assert.equal(cold("AUG", "bug", "transform").ok, false);
  assert.deepEqual(cold("AUG", "bug", "transform").errors, ["area_invalid"]);
  assert.deepEqual(buildBugReport({ component: "AUP", reportId: RID, now: NOW, user: { summary: "x" } }).errors, ["report_type_required", "area_required"]);
});

test("the JSON schema refuses what the validator refuses: cross-application areas, missing or extra classification", () => {
  const good = cold("AUCOM", "feature_request", "companion").document;
  assert.ok(schemaValid(good));
  assert.ok(!schemaValid({ ...good, area: "editor" }), "AUCOM does not offer editor");
  assert.ok(!schemaValid({ ...good, report_type: "question" }));
  assert.ok(!schemaValid({ ...good, labels: ["AUCOM"] }));
  const missing = { ...good }; delete missing.report_type;
  assert.ok(!schemaValid(missing));
});

test("every incident code in the taxonomy maps to an area, and the mapping is a pure function of typed fields", () => {
  const byCode = bugReportRules.incident_areas.by_code;
  assert.deepEqual(Object.keys(byCode).sort(), codes.codes.map((c) => c.code).sort(), "incident_areas.by_code must cover the taxonomy exactly");
  for (const area of Object.values(byCode)) assert.ok(BUG_REPORT_AREAS.includes(area));
  for (const [component, table] of Object.entries(bugReportRules.incident_areas.by_subsystem)) {
    for (const area of Object.values(table)) assert.ok(bugReportAreasFor(component).includes(area), `${component} does not offer ${area}`);
  }
  for (const entry of committed.suggest_area) {
    assert.equal(suggestBugReportArea(entry.component, entry.incident), entry.expected);
    assert.ok(bugReportAreasFor(entry.component).includes(entry.expected), `${entry.component} was suggested ${entry.expected}`);
    assert.equal(suggestBugReportArea(entry.component, { ...entry.incident, message: "Area: Textures transform editor" }), entry.expected, "prose is never read");
  }
  assert.equal(suggestBugReportArea("AUP", { code: "editor.transform.failed" }), "transform");
  assert.equal(suggestBugReportArea("AUG", { code: "aug.error", subsystem: "auth" }), "account_access");
  assert.equal(suggestBugReportArea("AUCOM", { code: "aue.job_failed" }), "other", "an area the application does not offer becomes other");
  assert.equal(suggestBugReportArea("AUP", undefined), undefined);
});

test("an incident report defaults to Bug and the suggested area, and the user can change either before preview", () => {
  const incident = { incident_id: "a".repeat(32), code: "auc.disconnected", severity: "error", recoverable: true };
  const suggested = buildBugReport({ component: "AUP", reportId: RID, now: NOW, user: { summary: "x" }, incident });
  assert.equal(suggested.document.report_type, "bug");
  assert.equal(suggested.document.area, "collaboration");
  const corrected = buildBugReport({ component: "AUP", reportType: "feature_request", area: "textures", reportId: RID, now: NOW, user: { summary: "x" }, incident });
  assert.equal(corrected.document.report_type, "feature_request");
  assert.equal(corrected.document.area, "textures");
  assert.deepEqual(bugReportLabels(corrected.document), ["AUP", "Feature request", "Area: Textures"]);
});

test("bug and feature-request reports render their own headings, with the same bounds and redaction", () => {
  const user = { summary: "s", steps: "mail a.b@example.invalid", expected: "e", actual: "a" };
  const bug = renderReportText(cold("AUP", "bug", "editor", user).document);
  const feature = renderReportText(cold("AUP", "feature_request", "editor", user).document);
  for (const heading of Object.values(bugReportHeadings("bug"))) assert.ok(bug.includes(`\n${heading}\n`), heading);
  for (const heading of Object.values(bugReportHeadings("feature_request"))) assert.ok(feature.includes(`\n${heading}\n`), heading);
  assert.ok(!feature.includes("Steps to reproduce") && !bug.includes("Use case"));
  assert.match(bug, /^Auto-Pigeon bug report \(/);
  assert.match(feature, /^Auto-Pigeon feature request \(/);
  for (const text of [bug, feature]) assert.ok(!text.includes("a.b@example.invalid"));
  const long = cold("AUP", "feature_request", "editor", { summary: "x", steps: "y".repeat(5000) }).document;
  assert.equal(Array.from(long.user.steps).length, BUG_REPORT_LIMITS.steps);
});

test("the prefilled URL carries exactly the three labels and its length accounting includes them", () => {
  for (const entry of committed.reports.filter((r) => r.expected.ok)) {
    const url = new URL(prefilledIssueUrl(entry.expected.document));
    assert.deepEqual(url.searchParams.get("labels").split(","), entry.expected.labels, entry.name);
    assert.equal(prefilledIssueUrl(entry.expected.document).length, entry.expected.prefill_url_length);
    if (entry.expected.prefill_fits) assert.ok(entry.expected.prefill_url_length <= BUG_REPORT_LIMITS.prefill_url);
  }
});

test("the previous version is accepted only when asked, only until its bound, and is labelled Bug + Area: Other", () => {
  for (const entry of committed.previous) {
    assert.deepEqual(validateBugReport(entry.document, entry.options), entry.expected.validation, entry.name);
    assert.deepEqual(bugReportLabels(entry.document), entry.expected.labels, entry.name);
  }
  assert.deepEqual(committed.previous[1].expected.labels, ["AUP", "Bug", "Area: Other"]);
  for (const entry of committed.schema_status) assert.equal(bugReportSchemaStatus(entry.schema, entry.now), entry.expected);
  const ajvPrevious = ajv.compile(bugReportSchemaPrevious);
  assert.ok(ajvPrevious(committed.previous[1].document));
});

test("the label catalogue is exactly the taxonomy, with no workflow label", () => {
  const expected = [
    ...Object.values(bugReportRules.applications).map((a) => a.label),
    ...Object.values(bugReportRules.report_types).map((t) => t.label),
    ...Object.values(bugReportRules.areas),
    "Already tracked elsewhere",
  ];
  assert.deepEqual([...catalogue].sort(), [...expected].sort());
  for (const label of bugReportRules.label_catalogue.labels) {
    assert.match(label.color, /^[0-9A-F]{6}$/);
    assert.ok(label.description.length > 0 && label.description.length <= 100);
    assert.ok(!/triage|confirmed|duplicate|priority|severity|privacy|progress/i.test(label.name), label.name);
  }
});
