// The envelope contract itself: the schema, the taxonomy, and the correlation-id convention.

import test from "node:test";
import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020.js";

import {
  SCHEMA_VERSION,
  BUG_REPORT_URL,
  envelopeSchema,
  codesDocument,
  INCIDENT_CODES,
  isIncidentCode,
  incidentCode,
  codesForComponent,
  createIncident,
  validateIncident,
  formatOccurredAt,
  newIncidentId,
  newTransportEventId,
  toSentryEvent,
  CORRELATION_HEADER,
  CORRELATION_TAG,
  isCorrelationId,
  newCorrelationId,
  correlationIdFromHeaders,
  correlationHeaders,
} from "../src/index.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const ajvValidate = ajv.compile(envelopeSchema);

function goodIncident(overrides = {}) {
  return createIncident({
    severity: "warning",
    component: "AUP",
    subsystem: "render.3d",
    code: "render.3d.slow",
    operation: "Paste",
    message: "3D redraw is still running after Paste.",
    duration_ms: 3100,
    correlation_id: "0123456789abcdef0123456789abcdef",
    release: "1.842",
    environment: "development",
    recoverable: true,
    user_action: "You can wait longer or reload the page.",
    evidence: { face_count: 31040, brush_count: 512 },
    ...overrides,
  });
}

test("the envelope schema is a compilable JSON Schema and the happy case passes it", () => {
  assert.ok(ajvValidate(goodIncident()), JSON.stringify(ajvValidate.errors));
});

test("the schema version is stated in the document and in every envelope", () => {
  assert.equal(SCHEMA_VERSION, "1.0");
  assert.equal(envelopeSchema.properties.schema_version.const, "1.0");
  assert.equal(goodIncident().schema_version, "1.0");
});

test("the envelope is CLOSED at every level", () => {
  assert.equal(envelopeSchema.additionalProperties, false);
  assert.equal(envelopeSchema.$defs.evidence.additionalProperties, false);
});

test("an arbitrary map dump cannot be attached, and the refusal says so", () => {
  const withDump = { ...goodIncident(), apmap_document: { brushes: [] } };
  assert.equal(ajvValidate(withDump), false);
  const verdict = validateIncident(withDump);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.errors.some((e) => e.path === "apmap_document"));
});

test("an unknown evidence field is refused rather than carried", () => {
  const withExtra = { ...goodIncident(), evidence: { face_count: 1, request_body: "…" } };
  assert.equal(ajvValidate(withExtra), false);
  assert.equal(validateIncident(withExtra).valid, false);
});

// The whole reason a small validator is allowed to exist beside a real schema engine: it is
// checked against one. A disagreement here means the interpreter has drifted from the authority.
test("the dependency-free validator agrees with ajv, case for case", () => {
  const cases = [
    ["happy path", goodIncident()],
    ["no optional fields", createIncident({ severity: "error", component: "AUG", code: "aug.error", message: "x", recoverable: true })],
    ["fatal, unrecoverable", goodIncident({ severity: "fatal", recoverable: false })],
    ["release unknown", goodIncident({ release: "unknown" })],
    ["bad severity", { ...goodIncident(), severity: "critical" }],
    ["bad component", { ...goodIncident(), component: "AUX" }],
    ["bad schema version", { ...goodIncident(), schema_version: "2.0" }],
    ["bad incident id", { ...goodIncident(), incident_id: "not-hex" }],
    ["bad correlation id", { ...goodIncident(), correlation_id: "ABCDEF" }],
    ["bad timestamp", { ...goodIncident(), occurred_at: "2026-08-26 12:00:00" }],
    ["bad release", { ...goodIncident(), release: "2.0.1" }],
    ["negative duration", { ...goodIncident(), duration_ms: -1 }],
    ["fractional duration", { ...goodIncident(), duration_ms: 1.5 }],
    ["http status out of range", goodIncident({ evidence: { http_status: 99 } })],
    ["http reason with a space", goodIncident({ evidence: { http_reason: "not found" } })],
    ["worker attempt zero", goodIncident({ evidence: { worker_attempt: 0 } })],
    ["subsystem with a capital", { ...goodIncident(), subsystem: "Render3D" }],
    ["code with one segment", { ...goodIncident(), code: "broken" }],
    ["recoverable missing", (() => { const i = goodIncident(); delete i.recoverable; return i; })()],
    ["message missing", (() => { const i = goodIncident(); delete i.message; return i; })()],
    ["empty message", { ...goodIncident(), message: "" }],
    ["message too long", { ...goodIncident(), message: "x".repeat(513) }],
    ["extra top-level field", { ...goodIncident(), stack: "…" }],
    ["extra evidence field", goodIncident({ evidence: { nope: 1 } })],
    ["bad environment", { ...goodIncident(), environment: "staging" }],
  ];
  for (const [name, incident] of cases) {
    const mine = validateIncident(incident).valid;
    const theirs = ajvValidate(incident);
    assert.equal(mine, theirs, `${name}: validateIncident=${mine} ajv=${theirs}`);
  }
});

test("validateIncident returns a verdict for a non-object instead of throwing", () => {
  for (const value of [null, undefined, 7, "incident", []]) {
    const verdict = validateIncident(value);
    assert.equal(verdict.valid, false);
    assert.ok(verdict.errors.length > 0);
  }
});

test("the taxonomy covers every component and every code is well formed", () => {
  assert.ok(INCIDENT_CODES.length >= 22);
  const seen = new Set();
  for (const entry of INCIDENT_CODES) {
    assert.match(entry.code, /^[a-z0-9]+(?:[._][a-z0-9]+)+$/, entry.code);
    assert.equal(typeof entry.recoverable, "boolean", entry.code);
    assert.ok(entry.summary.length > 10, entry.code);
    assert.ok(!seen.has(entry.code), `duplicate code ${entry.code}`);
    seen.add(entry.code);
  }
  for (const component of ["AUP", "AUB", "AUC", "AUE", "AUG", "AUT"]) {
    assert.ok(codesForComponent(component).length > 0, `${component} has no codes`);
  }
});

test("every code the watchdog programme named is present", () => {
  for (const code of [
    "render.3d.slow",
    "render.3d.context_lost",
    "render.3d.fatal",
    "render.2d.slow",
    "render.2d.fatal",
    "editor.main_thread_stall",
    "editor.transform.slow",
    "editor.transform.failed",
    "editor.operation.failed",
    "aub.unavailable",
    "aub.timeout",
    "aub.error",
    "auc.disconnected",
    "auc.reconnect_failed",
    "auc.backpressure",
    "auc.error",
    "aue.unavailable",
    "aue.timeout",
    "aue.job_failed",
    "aue.worker_failed",
    "aug.error",
    "reporting.telemetry_unavailable",
  ]) {
    assert.ok(isIncidentCode(code), `${code} is missing from the taxonomy`);
  }
});

test("an unknown code is answered, not thrown at", () => {
  assert.equal(isIncidentCode("render.4d.slow"), false);
  assert.equal(incidentCode("render.4d.slow"), undefined);
  assert.equal(incidentCode("render.3d.slow").component, "AUP");
});

test("the codes document declares its own version", () => {
  assert.equal(codesDocument.schema_version, "1.0");
});

test("a correlation id is 32 lowercase hex characters, minted from the CSPRNG", () => {
  const id = newCorrelationId();
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.ok(isCorrelationId(id));
  assert.equal(isCorrelationId("ABCDEF0123456789ABCDEF0123456789"), false, "uppercase is not the form");
  assert.equal(isCorrelationId("0123456789abcdef"), false, "16 hex characters is not the form");
  assert.equal(isCorrelationId(undefined), false);
  const many = new Set(Array.from({ length: 500 }, () => newCorrelationId()));
  assert.equal(many.size, 500, "ids collided, which a CSPRNG would not do");
});

test("an incident id has the same shape and is independent of the correlation id", () => {
  const incident = goodIncident();
  assert.match(newIncidentId(), /^[0-9a-f]{32}$/);
  assert.notEqual(incident.incident_id, incident.correlation_id);
});

test("the header name and the GlitchTip tag are the convention, in one place", () => {
  assert.equal(CORRELATION_HEADER, "X-Auto-Pigeon-Correlation-Id");
  assert.equal(CORRELATION_TAG, "correlation_id");
});

test("an incoming correlation id is read from any header shape, and a bad one is not propagated", () => {
  const id = "abcdef0123456789abcdef0123456789";
  assert.equal(correlationIdFromHeaders({ "x-auto-pigeon-correlation-id": id }), id);
  assert.equal(correlationIdFromHeaders({ "X-Auto-Pigeon-Correlation-Id": id }), id);
  assert.equal(correlationIdFromHeaders({ "x-auto-pigeon-correlation-id": [id, "second"] }), id);
  assert.equal(correlationIdFromHeaders(new Headers({ [CORRELATION_HEADER]: id })), id);
  assert.equal(correlationIdFromHeaders({ "x-auto-pigeon-correlation-id": `  ${id.toUpperCase()}  ` }), id);
  assert.equal(correlationIdFromHeaders({ "x-auto-pigeon-correlation-id": "nonsense" }), undefined);
  assert.equal(correlationIdFromHeaders({}), undefined);
  assert.equal(correlationIdFromHeaders(undefined), undefined);
});

test("an outgoing request carries the id it was given, or a fresh one", () => {
  const id = "aaaabbbbccccddddeeeeffff00001111";
  assert.deepEqual(correlationHeaders(id), { [CORRELATION_HEADER]: id });
  const fresh = correlationHeaders(undefined)[CORRELATION_HEADER];
  assert.ok(isCorrelationId(fresh));
  const replaced = correlationHeaders("garbage")[CORRELATION_HEADER];
  assert.ok(isCorrelationId(replaced));
  assert.notEqual(replaced, "garbage");
});

test("occurred_at is UTC with milliseconds and matches the schema pattern", () => {
  const pattern = new RegExp(envelopeSchema.properties.occurred_at.pattern);
  assert.match(formatOccurredAt(new Date("2026-08-26T12:34:56.789Z")), pattern);
  assert.match(formatOccurredAt(), pattern);
  assert.equal(formatOccurredAt(new Date("2026-08-26T12:34:56.789Z")), "2026-08-26T12:34:56.789Z");
});

test("createIncident invents an id and a timestamp and nothing else", () => {
  const incident = createIncident({
    severity: "error",
    component: "AUC",
    code: "auc.error",
    message: "Room refused the message.",
    recoverable: true,
  });
  assert.equal(validateIncident(incident).valid, true);
  assert.equal(incident.release, undefined, "no invented release");
  assert.equal(incident.environment, undefined, "no invented environment");
  assert.equal(incident.correlation_id, undefined, "no invented correlation id");
  assert.equal("evidence" in incident, false);
});

test("the public bug target is recorded once, here", () => {
  assert.equal(BUG_REPORT_URL, "https://github.com/auto-pigeon/bug-reports/issues");
});

// ---------------------------------------------------------------------------
// INC-01 — two identities: one stable incident, one id per transmission
// ---------------------------------------------------------------------------

/** The escalating stall the ladder produces: one incident, four transmissions. */
function stall() {
  return createIncident({
    severity: "warning",
    component: "AUP",
    subsystem: "watchdog",
    code: "editor.main_thread_stall",
    operation: "Paste",
    message: "Auto-Pigeon has been busy for 3 seconds while pasting.",
    duration_ms: 3_000,
    correlation_id: "aaaabbbbccccddddeeeeffff00001111",
    release: "1.407",
    environment: "test",
    recoverable: true,
    evidence: { face_count: 7_475 },
  });
}

test("a transport event id is 32 lowercase hex characters and a genuine version-4 UUID", () => {
  for (let index = 0; index < 64; index += 1) {
    const id = newTransportEventId();
    assert.match(id, /^[0-9a-f]{32}$/, "Sentry: exactly 32 hex characters, no dashes");
    assert.equal(id[12], "4", "version nibble");
    assert.ok("89ab".includes(id[16]), "variant nibble");
  }
});

test("a transport event id is never the same twice", () => {
  const seen = new Set();
  for (let index = 0; index < 1_000; index += 1) seen.add(newTransportEventId());
  assert.equal(seen.size, 1_000);
});

test("converting one incident three times gives three transport ids and one incident id", () => {
  // The whole of INC-01. GlitchTip answers 422 `Duplicate event id` to the second event carrying an
  // id it already holds, so the 10 s and 30 s rungs of every stall were being thrown away at the
  // door while the incident itself was — correctly — still one incident.
  const incident = stall();
  const events = [toSentryEvent(incident), toSentryEvent(incident), toSentryEvent(incident)];

  const transportIds = new Set(events.map((event) => event.event_id));
  assert.equal(transportIds.size, 3, "three transmissions, three transport ids");
  for (const event of events) assert.notEqual(event.event_id, incident.incident_id);

  const incidentIds = new Set(events.map((event) => event.contexts.incident.incident_id));
  assert.deepEqual([...incidentIds], [incident.incident_id], "one incident, whatever it costs");
});

test("every event is queryable back to the stable incident, by a searchable tag", () => {
  const incident = stall();
  const events = [toSentryEvent(incident), toSentryEvent(incident), toSentryEvent(incident)];
  for (const event of events) {
    // The tag is the searchable half — `contexts` is not indexed by GlitchTip — and it must agree
    // with the closed context block, which is the half a reader can trust to be bounded.
    assert.equal(event.tags.incident_id, incident.incident_id);
    assert.equal(event.contexts.incident.incident_id, incident.incident_id);
    assert.equal(event.tags[CORRELATION_TAG], incident.correlation_id);
  }
});

test("one fault is one issue however many times it was transmitted", () => {
  // Without this the three rungs are three MESSAGES ("after 3 seconds", "after 10 seconds") and the
  // default grouping files them as three unrelated issues — trading a rejected send for a scattered
  // one. Same four fields as AUB's and AUE's Go reporters.
  const incident = stall();
  const later = { ...incident, message: "Auto-Pigeon has been busy for 30 seconds while pasting.", duration_ms: 30_000 };
  assert.deepEqual(toSentryEvent(incident).fingerprint, ["AUP", "editor.main_thread_stall", "watchdog", "Paste"]);
  assert.deepEqual(toSentryEvent(later).fingerprint, toSentryEvent(incident).fingerprint);
});

test("the stable incident id survives the trip out, because nothing matches a bare hex string", () => {
  const incident = stall();
  const event = toSentryEvent(incident);
  assert.match(event.tags.incident_id, /^[0-9a-f]{32}$/);
  assert.equal(event.tags.incident_id, incident.incident_id);
});
