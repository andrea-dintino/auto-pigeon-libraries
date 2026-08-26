// Building an incident envelope, and turning one into a GlitchTip event.

import { SCHEMA_VERSION } from "./rules.mjs";
import { newCorrelationId, isCorrelationId, CORRELATION_TAG } from "./correlation.mjs";
import { redactIncident, redactText } from "./redact.mjs";

/** A fresh incident id: 128 random bits as 32 lowercase hex characters, like a correlation id. */
export function newIncidentId() {
  return newCorrelationId();
}

/**
 * The `occurred_at` format the schema demands: UTC, RFC 3339, milliseconds, `Z`.
 *
 * A fixed shape rather than "whatever toISOString gives" so that the pattern in the schema can be
 * strict. `Date.prototype.toISOString` already produces exactly this for a valid date.
 */
export function formatOccurredAt(when = new Date()) {
  return new Date(when).toISOString().replace(/\.(\d{3})\d*Z$/, ".$1Z");
}

/**
 * Build an incident envelope.
 *
 * Fills in only what a caller cannot reasonably be asked to repeat at every call site — the schema
 * version, an id, a timestamp — and REFUSES to invent anything else. In particular there is no
 * default component, no default severity and no default release: a wrong component sends a reader
 * to the wrong repository, and a made-up release is the placeholder-version failure PREPROD-05
 * settled (an uninjected build reports `unknown`, and `unknown` is a legal value here).
 *
 * Undefined optional fields are omitted rather than written as `null`, because the schema is closed
 * and `null` is not one of the types any field accepts.
 *
 * The result is NOT redacted and NOT validated. Both are on-demand (AULIBS §2.1) and both are
 * separate calls: `redactIncident` then `validateIncident`.
 */
export function createIncident(fields) {
  const incident = {
    schema_version: SCHEMA_VERSION,
    incident_id: fields.incident_id ?? newIncidentId(),
    occurred_at: fields.occurred_at ?? formatOccurredAt(),
    severity: fields.severity,
    component: fields.component,
    code: fields.code,
    message: fields.message,
    recoverable: fields.recoverable,
  };
  const optional = [
    "subsystem",
    "operation",
    "duration_ms",
    "correlation_id",
    "release",
    "environment",
    "user_action",
  ];
  for (const key of optional) {
    if (fields[key] !== undefined) incident[key] = fields[key];
  }
  if (fields.evidence !== undefined) {
    const evidence = {};
    for (const [key, value] of Object.entries(fields.evidence)) {
      if (value !== undefined) evidence[key] = value;
    }
    incident.evidence = evidence;
  }
  return incident;
}

/**
 * The Sentry/GlitchTip event an incident becomes.
 *
 * This is a plain object in the shape the Sentry SDKs and the store endpoint both accept, so a
 * component may hand it to `captureEvent` or POST it. It is deliberately not an SDK call: which SDK
 * a component uses is that component's decision, and this package has no runtime dependency.
 *
 * Three things are guaranteed to be on every event because the acceptance for the whole
 * observability foundation rests on them: the RELEASE (`1.N`), the ENVIRONMENT, and the
 * CORRELATION ID as a tag.
 *
 * The event is redacted on the way out. That is not belt-and-braces — this is the boundary where
 * the closed schema stops governing, because from here the payload is somebody else's format.
 */
export function toSentryEvent(incident, options = {}) {
  const safe = redactIncident(incident);
  const tags = {
    incident_code: safe.code,
    component: safe.component,
    recoverable: String(safe.recoverable),
  };
  if (safe.subsystem) tags.subsystem = safe.subsystem;
  if (safe.operation) tags.operation = safe.operation;
  if (isCorrelationId(safe.correlation_id)) tags[CORRELATION_TAG] = safe.correlation_id;

  const event = {
    event_id: safe.incident_id,
    timestamp: safe.occurred_at,
    level: safe.severity,
    logger: `auto-pigeon.${safe.component.toLowerCase()}`,
    platform: options.platform ?? "other",
    release: safe.release ?? options.release ?? "unknown",
    environment: safe.environment ?? options.environment ?? "development",
    transaction: safe.operation,
    message: safe.message,
    tags,
    // `contexts` is Sentry's own place for structured, non-searchable detail. The whole of it here
    // is the closed evidence object plus the two durations — nothing else may be added, or the
    // bound the envelope schema provides stops meaning anything the moment an event leaves.
    contexts: {
      incident: {
        schema_version: safe.schema_version,
        incident_id: safe.incident_id,
        duration_ms: safe.duration_ms,
        user_action: safe.user_action,
        evidence: safe.evidence,
      },
    },
  };
  for (const key of Object.keys(event)) {
    if (event[key] === undefined) delete event[key];
  }
  return event;
}

/**
 * The bounded, sanitised text a user can read before choosing to file a public bug report.
 *
 * Every line is derived from the envelope, so there is nothing in it that was not already bounded
 * by the schema, and the whole thing goes through redaction anyway. What a user is shown is exactly
 * what would be published — the preview and the payload are the same string, which is the only
 * version of "preview before sending" worth having.
 */
export function toDiagnosticText(incident) {
  const safe = redactIncident(incident);
  const lines = [
    `incident      ${safe.incident_id}`,
    `code          ${safe.code}`,
    `component     ${safe.component}${safe.subsystem ? ` / ${safe.subsystem}` : ""}`,
    `severity      ${safe.severity}${safe.recoverable ? "" : " (session unreliable)"}`,
    `occurred at   ${safe.occurred_at}`,
  ];
  if (safe.operation) lines.push(`operation     ${safe.operation}`);
  if (safe.duration_ms !== undefined) lines.push(`duration      ${safe.duration_ms} ms`);
  if (safe.release) lines.push(`release       ${safe.release}`);
  if (safe.environment) lines.push(`environment   ${safe.environment}`);
  if (safe.correlation_id) lines.push(`correlation   ${safe.correlation_id}`);
  lines.push(`message       ${redactText(safe.message)}`);
  if (safe.user_action) lines.push(`what to do    ${safe.user_action}`);
  if (safe.evidence && Object.keys(safe.evidence).length > 0) {
    lines.push("evidence");
    for (const [key, value] of Object.entries(safe.evidence)) {
      lines.push(`  ${key.padEnd(18)}${value}`);
    }
  }
  return lines.join("\n");
}
