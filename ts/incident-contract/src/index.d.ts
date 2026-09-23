// Types for @auto-pigeon/incident-contract.
//
// Hand-written rather than generated, because the runtime is plain ESM with no build step: this
// package has to be importable by node's test runner, by a Vite bundle and by tooling without any
// of them compiling anything first. The shapes below mirror
// schema/incident-envelope-1.0.schema.json; that file remains the authority, and the tests validate
// against it rather than against these declarations.

export type IncidentSeverity = "warning" | "error" | "fatal";
export type IncidentComponent = "AUP" | "AUB" | "AUC" | "AUE" | "AUG" | "AUT" | "AUCOM";
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
  /** Sanitised frames from `stackFrames`; anything else is dropped. Since 1.2.0. */
  exception?: { type?: string; frames: SentryFrame[] };
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

// ---- The user bug report (auto-pigeon-bug-report/1.0) -------------------------------------------

export type BugReportComponent = "AUP" | "AUG" | "AUCOM";
export type BugReportRoute = "prefilled" | "server";

export interface BugReportRecent {
  at: string;
  kind: "incident" | "breadcrumb" | "operation";
  name: string;
  duration_ms?: number;
  outcome?: string;
  correlation_id?: string;
}

export interface BugReportDocument {
  schema: "auto-pigeon-bug-report/1.0";
  report_id: string;
  created_at: string;
  component: BugReportComponent;
  release: string;
  environment: string;
  kind: "cold" | "incident";
  user: { summary: string; steps: string; expected: string; actual: string };
  incident?: {
    incident_id: string;
    code: string;
    severity: IncidentSeverity;
    subsystem?: string;
    operation?: string;
    occurred_at?: string;
    recoverable: boolean;
  };
  correlation_id?: string;
  session_correlation_id?: string;
  client: {
    browser?: string;
    os?: string;
    viewport_width?: number;
    viewport_height?: number;
    pixel_ratio_pct?: number;
    cores?: number;
    memory_mb?: number;
    language?: string;
    webgl2?: boolean;
  };
  recent: BugReportRecent[];
  omitted_recent: number;
}

export interface BugReportInput {
  component: BugReportComponent;
  release?: string;
  environment?: string;
  reportId?: string;
  now?: Date | string | number;
  user: { summary?: string; steps?: string; expected?: string; actual?: string };
  incident?: Partial<Incident>;
  correlationId?: string;
  sessionCorrelationId?: string;
  client?: {
    userAgent?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    pixelRatio?: number;
    cores?: number;
    memoryGb?: number;
    language?: string;
    webgl2?: boolean;
  };
  recent?: Array<Partial<BugReportRecent> & { at?: string | number | Date }>;
}

export type BugReportBuild =
  | { ok: true; document: BugReportDocument; prefill: { fits: boolean } }
  | { ok: false; errors: string[] };

export const BUG_REPORT_SCHEMA: "auto-pigeon-bug-report/1.0";
export const BUG_REPORT_REPOSITORY: string;
export const BUG_REPORT_LIMITS: Readonly<Record<string, number>>;
export const bugReportRules: Record<string, unknown>;
export const bugReportSchema: Record<string, unknown>;
export function sanitizeReportText(value: unknown, max: number, options?: { multiline?: boolean }): string;
export function coarseBrowser(userAgent: unknown): string | undefined;
export function coarseOs(userAgent: unknown): string | undefined;
export function buildBugReport(input: BugReportInput): BugReportBuild;
export function canonicalReportJson(document: BugReportDocument): string;
export function reportJsonDownload(document: BugReportDocument): string;
export function validateBugReport(document: unknown): ValidationResult;
export function renderReportText(document: BugReportDocument): string;
export function renderIssue(document: BugReportDocument, options?: { route?: BugReportRoute }): { title: string; body: string };
export function prefilledIssueUrl(document: BugReportDocument): string;
export function reportDownloadNames(document: BugReportDocument): { text: string; json: string };

// ---- Stack frames for source-map symbolication (since 1.2.0) -----------------------------------

export interface SentryFrame {
  abs_path: string;
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: true;
}
export function stackFrames(stack: unknown, options: { origin: string }): SentryFrame[];
export function exceptionType(error: unknown): string;
