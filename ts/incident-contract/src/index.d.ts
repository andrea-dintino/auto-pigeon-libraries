// Types for @auto-pigeon/incident-contract.
//
// Hand-written rather than generated, because the runtime is plain ESM with no build step: this
// package has to be importable by node's test runner, by a Vite bundle and by tooling without any
// of them compiling anything first. The shapes below mirror
// schema/incident-envelope-1.0.schema.json; that file remains the authority, and the tests validate
// against it rather than against these declarations.

export type IncidentSeverity = "warning" | "error" | "fatal";
export type IncidentComponent = "AUP" | "AUB" | "AUC" | "AUE" | "AUG" | "AUT";
export type IncidentEnvironment = "development" | "production" | "test";

export interface IncidentEvidence {
  brush_count?: number;
  face_count?: number;
  entity_count?: number;
  triangle_count?: number;
  selection_count?: number;
  http_status?: number;
  http_reason?: string;
  queue_depth?: number;
  worker_attempt?: number;
  client_count?: number;
  retry_after_ms?: number;
  event_loop_lag_ms?: number;
  memory_mb?: number;
}

export interface Incident {
  schema_version: "1.0";
  incident_id: string;
  occurred_at: string;
  severity: IncidentSeverity;
  component: IncidentComponent;
  subsystem?: string;
  code: string;
  operation?: string;
  message: string;
  duration_ms?: number;
  correlation_id?: string;
  release?: string;
  environment?: IncidentEnvironment;
  recoverable: boolean;
  user_action?: string;
  evidence?: IncidentEvidence;
}

export type IncidentDraft = Omit<Incident, "schema_version" | "incident_id" | "occurred_at"> &
  Partial<Pick<Incident, "incident_id" | "occurred_at">>;

export interface IncidentCodeEntry {
  code: string;
  component: IncidentComponent;
  recoverable: boolean;
  summary: string;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface SentryEventOptions {
  platform?: string;
  release?: string;
  environment?: IncidentEnvironment;
}

export const SCHEMA_VERSION: "1.0";
export const BUG_REPORT_URL: string;
export const envelopeSchema: Record<string, unknown>;
export const codesDocument: { schema_version: string; codes: IncidentCodeEntry[] };
export const redactionDocument: Record<string, unknown>;

export const INCIDENT_CODES: readonly IncidentCodeEntry[];
export function isIncidentCode(code: unknown): boolean;
export function incidentCode(code: string): IncidentCodeEntry | undefined;
export function codesForComponent(component: IncidentComponent): IncidentCodeEntry[];

export const CORRELATION_HEADER: string;
export const CORRELATION_HEADER_LOWER: string;
export const CORRELATION_FIELD: string;
export const CORRELATION_TAG: string;
export function isCorrelationId(value: unknown): boolean;
export function newCorrelationId(): string;
export function correlationIdFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined,
): string | undefined;
export function correlationHeaders(existing?: string): Record<string, string>;

export function redactText<T>(value: T): T;
export function redactValue<T>(value: T): T;
export function redactIncident(incident: Incident): Incident;
export function isDroppedKey(key: string): boolean;
export function isDeniedKey(key: string): boolean;

export function validateIncident(incident: unknown): ValidationResult;

export function newIncidentId(): string;
export function newTransportEventId(): string;
export function formatOccurredAt(when?: Date | string | number): string;
export function createIncident(fields: IncidentDraft): Incident;
export function toSentryEvent(incident: Incident, options?: SentryEventOptions): Record<string, unknown>;
export function toDiagnosticText(incident: Incident): string;
