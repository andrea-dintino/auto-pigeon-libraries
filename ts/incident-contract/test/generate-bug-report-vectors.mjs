// Regenerates ../fixtures/bug-report-vectors.json from the reference implementation.
//
// The vectors are the cross-language contract: AUB re-validates a server-route submission in Go
// and must produce exactly the same sanitised text, the same validation verdict and the same
// rendered issue as this implementation. `test/bug-report.test.mjs` fails when the committed
// vectors and this implementation disagree, so a behaviour change is always a reviewed diff of
// this file's output — run `npm run vectors`, read the diff, commit both.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  bugReportLabels,
  bugReportRules,
  bugReportSchemaStatus,
  buildBugReport,
  canonicalReportJson,
  suggestBugReportArea,
  prefilledIssueUrl,
  renderIssue,
  renderReportText,
  sanitizeReportText,
  validateBugReport,
} from "../src/index.mjs";

// Every canary is a string that must NEVER appear in any output of any case. Each is planted in a
// place a collector could conceivably read from — user text (where redaction is the defence) and
// structural places (where the closed document is the defence).
export const CANARIES = {
  token_github: "ghp_CANARYtokenCANARYtoken0123456789",
  token_bearer: "CANARYbearerVALUE0123456789",
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlkifQ.CANARYsignatureXYZ",
  cookie: "CANARYcookieVALUE0123",
  email: "canary.reporter@example.invalid",
  url_host: "canary-host.example.invalid",
  url_query: "canaryQueryToken0123",
  ip: "203.0.113.77",
  path_posix: "/home/canaryuser/maps",
  path_windows: "C:\\Users\\CanaryUser",
  path_home: "~/canary-private-dir",
  map_name: "CANARY_PRIVATE_MAP_NAME",
  session_name: "CANARY_SESSION_NAME",
  workspace_id: "canaryworkspaceid77",
  annotation: "CANARY annotation text about a secret room",
  chat: "CANARY chat message",
  asset_meta: "CANARY_ASSET_METADATA_texture_wall7",
  invitation: "CANARY-INVITE-CODE-9911",
  incident_message: "CANARY incident message naming a map",
};

const NOW = "2026-09-22T12:00:00.000Z";
const RID = "0123456789abcdef0123456789abcdef";
const INCIDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CORR = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SESSION = "cccccccccccccccccccccccccccccccc";
const UA_CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const baseClient = {
  userAgent: UA_CHROME,
  viewportWidth: 1920,
  viewportHeight: 1080,
  pixelRatio: 1.25,
  cores: 8,
  memoryGb: 8,
  language: "en-GB",
  webgl2: true,
};

const reportCases = [
  {
    name: "cold report, minimal",
    input: { component: "AUP", reportType: "bug", area: "editor", release: "1.842", environment: "production", reportId: RID, now: NOW, user: { summary: "The 2D view does not redraw after undo" } },
  },
  {
    name: "incident-linked report with activity",
    input: {
      component: "AUP",
      release: "1.842",
      environment: "production",
      reportId: RID,
      now: NOW,
      user: { summary: "Paste froze", steps: "1. Select 300 brushes\n2. Ctrl+V", expected: "Paste completes", actual: "Spinner for 30 s" },
      incident: {
        incident_id: INCIDENT_ID,
        code: "render.3d.slow",
        severity: "warning",
        subsystem: "render.3d",
        operation: "Paste",
        occurred_at: "2026-09-22T11:59:58.000Z",
        recoverable: true,
        correlation_id: CORR,
        message: CANARIES.incident_message,
        evidence: { face_count: 31040 },
      },
      sessionCorrelationId: SESSION,
      client: baseClient,
      recent: [
        { at: "2026-09-22T11:59:50.000Z", kind: "operation", name: "Paste", duration_ms: 30000, outcome: "timed_out", correlation_id: CORR },
        { at: "2026-09-22T11:59:58.000Z", kind: "incident", name: "render.3d.slow" },
      ],
    },
  },
  {
    name: "AUG cold report",
    input: { component: "AUG", reportType: "bug", area: "gallery", release: "1.301", environment: "development", reportId: RID, now: NOW, user: { summary: "Gallery card shows the wrong author" }, client: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0", language: "da-DK" } },
  },
  {
    name: "AUCOM cold report",
    input: { component: "AUCOM", reportType: "bug", area: "compile_run", release: "1.214", environment: "development", reportId: RID, now: NOW, user: { summary: "Build & Run does not highlight the current step" }, client: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", language: "it-IT" } },
  },
  {
    name: "canaries in every prohibited source",
    input: {
      component: "AUG",
      release: "1.301",
      environment: "production",
      reportId: RID,
      now: NOW,
      user: {
        summary: `Token ${CANARIES.token_github} and mail ${CANARIES.email}`,
        steps: [
          `Open https://${CANARIES.url_host}/maps/${CANARIES.workspace_id}?token=${CANARIES.url_query}`,
          `Authorization: Bearer ${CANARIES.token_bearer}`,
          `jwt ${CANARIES.jwt}`,
          `cookie pb_auth=${CANARIES.cookie}`,
          `server ${CANARIES.ip}:9190`,
          `saved in ${CANARIES.path_posix}/x.map and ${CANARIES.path_windows}\\x.map and ${CANARIES.path_home}/x`,
        ].join("\n"),
        expected: "nothing leaks",
        actual: "",
      },
      incident: {
        incident_id: INCIDENT_ID,
        code: "aug.error",
        severity: "error",
        subsystem: "aub.payload",
        operation: "load card",
        recoverable: true,
        message: CANARIES.incident_message,
        user_action: CANARIES.annotation,
        evidence: { map_name: CANARIES.map_name },
      },
      client: { ...baseClient, extra: CANARIES.asset_meta },
      recent: [
        { at: "2026-09-22T11:59:50.000Z", kind: "breadcrumb", name: "map.open", data: { map: CANARIES.map_name, session: CANARIES.session_name } },
        { at: "2026-09-22T11:59:51.000Z", kind: "breadcrumb", name: CANARIES.path_posix },
        { at: "2026-09-22T11:59:52.000Z", kind: "breadcrumb", name: "chat.sent", message: CANARIES.chat, outcome: CANARIES.invitation },
      ],
      map: { name: CANARIES.map_name },
      annotations: [CANARIES.annotation],
      invitation: CANARIES.invitation,
    },
  },
  {
    name: "hostile markdown, html, bidi and control characters",
    input: {
      component: "AUP",
      reportType: "bug",
      area: "other",
      release: "1.842",
      environment: "production",
      reportId: RID,
      now: NOW,
      user: {
        summary: "Title with <img src=x onerror=alert(1)> @maintainer #1\u202Egnp.exe\u0007",
        steps: "````\nclosing fence attempt\n```\n</details><script>alert(1)</script>\n[link](javascript:alert(1))\nzero\u200Bwidth\u200Djoin\r\nwindows line\rold mac\u2028sep\u0000nul\u009Fc1",
        expected: "\n\n\n\n  lots of blank lines  \n\n\n\n",
        actual: "tab\there",
      },
    },
  },
  {
    name: "oversized fields are cut in code points and say so",
    input: {
      component: "AUP",
      release: "1.842",
      environment: "production",
      reportId: RID,
      now: NOW,
      reportType: "feature_request",
      area: "textures",
      user: { summary: "漢".repeat(300), steps: "🐦".repeat(2500), expected: "e".repeat(1500), actual: "a ".repeat(900) },
    },
  },
  {
    name: "activity is bounded to the newest thirty and unusable entries are counted",
    input: {
      component: "AUP",
      release: "1.842",
      environment: "production",
      reportId: RID,
      now: NOW,
      reportType: "bug",
      area: "collaboration",
      user: { summary: "Long session" },
      recent: [
        ...Array.from({ length: 40 }, (_, i) => ({ at: Date.parse(NOW) - (40 - i) * 1000, kind: "breadcrumb", name: `step.${i}` })),
        { at: "not a date", kind: "breadcrumb", name: "x" },
        { at: NOW, kind: "unknown", name: "x" },
      ],
    },
  },
  {
    name: "a report too long for a prefilled URL omits its oldest activity, then says it does not fit",
    input: {
      component: "AUP",
      release: "1.842",
      environment: "production",
      reportId: RID,
      now: NOW,
      reportType: "bug",
      area: "import_export",
      user: { summary: "Big", steps: "字".repeat(2000), expected: "字".repeat(1000), actual: "字".repeat(1000) },
      recent: Array.from({ length: 10 }, (_, i) => ({ at: Date.parse(NOW) - (10 - i) * 1000, kind: "operation", name: `op.${i}`, duration_ms: i })),
    },
  },
  {
    name: "feature request from AUCOM",
    input: {
      component: "AUCOM", reportType: "feature_request", area: "import_export", release: "1.214", environment: "production", reportId: RID, now: NOW,
      user: { summary: "Import a .rmf file", steps: "I keep Worldcraft projects as .rmf", expected: "Open them in the Companion", actual: "Only .map is accepted" },
    },
  },
  {
    name: "incident report whose suggested area the user corrected",
    input: {
      component: "AUP", area: "textures", release: "1.842", environment: "production", reportId: RID, now: NOW,
      user: { summary: "Texture browser froze" },
      incident: { incident_id: INCIDENT_ID, code: "editor.main_thread_stall", severity: "warning", recoverable: true },
    },
  },
  {
    name: "incident feature request (the user changed the type)",
    input: {
      component: "AUG", reportType: "feature_request", release: "1.301", environment: "production", reportId: RID, now: NOW,
      user: { summary: "Let me retry a failed sign-in link" },
      incident: { incident_id: INCIDENT_ID, code: "aug.error", severity: "error", subsystem: "auth.invitation", recoverable: true },
    },
  },
  { name: "refused: no summary", input: { component: "AUP", reportType: "bug", area: "editor", reportId: RID, now: NOW, user: { summary: " \u200B\n " } } },
  { name: "refused: unknown component", input: { component: "AUB", reportType: "bug", area: "other", reportId: RID, now: NOW, user: { summary: "x" } } },
  { name: "refused: bad report id", input: { component: "AUP", reportType: "bug", area: "editor", reportId: "not-hex", now: NOW, user: { summary: "x" } } },
  { name: "refused: a cold report with no type or area", input: { component: "AUP", reportId: RID, now: NOW, user: { summary: "x" } } },
  { name: "refused: an area the application does not offer", input: { component: "AUG", reportType: "bug", area: "transform", reportId: RID, now: NOW, user: { summary: "x" } } },
  { name: "refused: an unknown report type", input: { component: "AUCOM", reportType: "question", area: "companion", reportId: RID, now: NOW, user: { summary: "x" } } },
];

const sanitizeCases = [
  ["plain", "hello", 100, true],
  ["crlf", "a\r\nb\rc", 100, true],
  ["bidi", "abc\u202Edef\u2066g\u2069", 100, true],
  ["zero width splits a token", `ghp_CANARY\u200BtokenCANARYtoken0123456789`, 100, true],
  ["single line", "a\n\tb   c", 100, false],
  ["trailing spaces", "a  \nb\t\n", 100, true],
  ["cut in code points", "🐦🐦🐦🐦🐦", 3, true],
  ["cut drops trailing space before ellipsis", "ab   cdef", 4, true],
  ["lone surrogate", "a\uD800b", 100, true],
  ["url", "see https://example.invalid/a?b=c for more", 100, true],
  ["ip", "dial tcp 172.18.0.3:8666: refused", 100, true],
  ["four part version is not spared", "Chrome/120.0.0.0", 100, true],
  ["email", "mail me at a.b@example.invalid", 100, true],
  ["not a string", 42, 100, true],
].map(([name, input, max, multiline]) => ({ name, input, max, multiline, expected: sanitizeReportText(input, max, { multiline }) }));

function caseOutput(input) {
  const built = buildBugReport(input);
  if (!built.ok) return { ok: false, errors: built.errors };
  const { document } = built;
  return {
    ok: true,
    document,
    canonical_json: canonicalReportJson(document),
    text: renderReportText(document),
    issue_prefilled: renderIssue(document, { route: "prefilled" }),
    issue_server: renderIssue(document, { route: "server" }),
    prefill_url_length: prefilledIssueUrl(document).length,
    prefill_fits: built.prefill.fits,
    labels: bugReportLabels(document),
    validation: validateBugReport(document),
  };
}

const good = buildBugReport(reportCases[1].input).document;
const clone = () => JSON.parse(JSON.stringify(good));
const validateCases = [
  { name: "a built document is valid", document: clone() },
  { name: "an extra top-level field", document: { ...clone(), map_name: "x" } },
  { name: "an extra incident field", document: { ...clone(), incident: { ...clone().incident, message: "x" } } },
  { name: "summary that was not sanitised", document: { ...clone(), user: { ...clone().user, summary: "two\nlines" } } },
  { name: "steps with a secret the client did not redact", document: { ...clone(), user: { ...clone().user, steps: "mail a.b@example.invalid" } } },
  { name: "steps with a bidi override", document: { ...clone(), user: { ...clone().user, steps: "a\u202Eb" } } },
  { name: "unknown incident code", document: { ...clone(), incident: { ...clone().incident, code: "made.up" } } },
  { name: "kind says incident but none is attached", document: (() => { const d = clone(); delete d.incident; return d; })() },
  { name: "too many recent entries", document: { ...clone(), recent: Array.from({ length: 31 }, () => clone().recent[0]) } },
  { name: "a float where an integer belongs", document: { ...clone(), client: { ...clone().client, cores: 2.5 } } },
  { name: "wrong schema", document: { ...clone(), schema: "auto-pigeon-bug-report/2.0" } },
  { name: "no report type", document: (() => { const d = clone(); delete d.report_type; return d; })() },
  { name: "an unknown report type", document: { ...clone(), report_type: "question" } },
  { name: "no area", document: (() => { const d = clone(); delete d.area; return d; })() },
  { name: "an area this application does not offer", document: { ...clone(), area: "gallery" } },
  { name: "an unknown area", document: { ...clone(), area: "Area: Editor" } },
  { name: "a client-supplied label field", document: { ...clone(), labels: ["AUP", "Bug", "Area: Editor"] } },
  { name: "a component the tracker does not know", document: { ...clone(), component: "AUB" } },
].map((entry) => ({ ...entry, expected: validateBugReport(entry.document) }));

// A document a pre-1.1 client previewed. A server may accept it, with `acceptPrevious`, until the
// instant bug-report-rules.json `previous_schemas` names, and labels it Bug + Area: Other.
const legacy = (() => {
  const d = clone();
  d.schema = "auto-pigeon-bug-report/1.0";
  delete d.report_type;
  delete d.area;
  return d;
})();
const previousCases = [
  { name: "a 1.0 document is refused without acceptPrevious", document: legacy, options: {} },
  { name: "a 1.0 document is accepted with acceptPrevious", document: legacy, options: { acceptPrevious: true } },
  { name: "a 1.0 document may not carry 1.1 fields", document: { ...legacy, report_type: "feature_request", area: "textures" }, options: { acceptPrevious: true } },
].map((entry) => ({
  ...entry,
  expected: {
    validation: validateBugReport(entry.document, entry.options),
    labels: bugReportLabels(entry.document),
    issue_server: validateBugReport(entry.document, entry.options).valid ? renderIssue(entry.document, { route: "server" }) : null,
  },
}));
const accepted_until = bugReportRules.previous_schemas[0].accepted_until;
const schemaStatusCases = [
  ["auto-pigeon-bug-report/1.1", NOW],
  ["auto-pigeon-bug-report/1.0", NOW],
  ["auto-pigeon-bug-report/1.0", accepted_until],
  ["auto-pigeon-bug-report/1.0", new Date(Date.parse(accepted_until) + 1).toISOString()],
  ["auto-pigeon-bug-report/2.0", NOW],
].map(([schema, now]) => ({ schema, now, expected: bugReportSchemaStatus(schema, now) }));

// Every code in the taxonomy, for every application, plus the subsystem overrides.
const suggestCases = [];
for (const component of bugReportRules.components) {
  for (const code of Object.keys(bugReportRules.incident_areas.by_code)) {
    suggestCases.push({ component, incident: { code }, expected: suggestBugReportArea(component, { code }) });
  }
  for (const [owner, table] of Object.entries(bugReportRules.incident_areas.by_subsystem)) {
    for (const subsystem of Object.keys(table)) {
      const incident = { code: "aug.error", subsystem };
      suggestCases.push({ component, incident, expected: suggestBugReportArea(component, incident), subsystem_owner: owner });
    }
  }
}

const vectors = {
  schema_version: "1.1",
  description: "Cross-language vectors for auto-pigeon-bug-report/1.1 (and the bounded acceptance of 1.0). Generated by test/generate-bug-report-vectors.mjs from the reference implementation; test/bug-report.test.mjs fails when they drift. AUB's Go re-validation must reproduce `sanitize[].expected`, `validate[].expected.valid`, every `reports[].expected.issue_server` and `reports[].expected.labels`, every `previous[].expected` and every `schema_status[].expected` exactly.",
  canaries: Object.values(CANARIES),
  sanitize: sanitizeCases,
  reports: reportCases.map((entry) => ({ name: entry.name, input: entry.input, expected: caseOutput(entry.input) })),
  validate: validateCases,
  previous: previousCases,
  schema_status: schemaStatusCases,
  suggest_area: suggestCases,
};

const target = fileURLToPath(new URL("../fixtures/bug-report-vectors.json", import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(target, `${JSON.stringify(vectors, null, 2)}\n`);
  console.log(`wrote ${target}`);
}

export { vectors };
