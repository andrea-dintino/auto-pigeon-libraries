export type NoticeSeverity = "critical" | "maintenance" | "warning" | "info";
export type NoticeSurface = "aup" | "aug" | "aucom";
export type NoticeVisibility = "public" | "authenticated";
export type NoticePhase = "pending" | "upcoming" | "active" | "expired";

export interface OperationalNotice {
  id: string;
  revision: number;
  title: string;
  body: string;
  severity: NoticeSeverity;
  show_from: string;
  starts_at: string;
  ends_at: string;
  visibility: NoticeVisibility;
  dismissible: boolean;
}

export interface NoticeResponse {
  schema: "auto-pigeon-operational-notices/1.0";
  server_time: string;
  surface: NoticeSurface;
  visibility: NoticeVisibility;
  poll_after_seconds: number;
  notices: OperationalNotice[];
}

export interface NoticeCacheEntry {
  response: NoticeResponse;
  offset_ms: number;
}

export const noticeRules: Record<string, unknown>;
export const noticeResponseSchema: Record<string, unknown>;
export const NOTICE_SCHEMA: "auto-pigeon-operational-notices/1.0";
export const NOTICE_SEVERITIES: readonly NoticeSeverity[];
export const NOTICE_SURFACES: readonly NoticeSurface[];
export const NOTICE_VISIBILITIES: readonly NoticeVisibility[];
export const NOTICE_LIMITS: Readonly<Record<string, number>>;
export const NOTICE_POLL: Readonly<Record<string, number | string>>;
export const NOTICE_TELEMETRY_EVENTS: readonly string[];

export function checkNoticeText(value: unknown, options: { field: "title" | "body" }): { ok: boolean; reason?: string };
export function checkNoticeSchedule(
  schedule: { show_from: string; starts_at: string; ends_at: string },
  nowMs: number,
): { ok: boolean; reason?: string };
export function normalizeNotice(raw: unknown): OperationalNotice | undefined;
export function parseNoticeResponse(
  value: unknown,
): { ok: true; response: NoticeResponse; dropped: number } | { ok: false; reason: string };
export function clockOffsetMs(serverTime: string, requestStartMs: number, responseEndMs: number): number | undefined;
export function noticePhase(notice: OperationalNotice, serverNowMs: number): NoticePhase;
export function dismissalKey(account: string | undefined, notice: Pick<OperationalNotice, "id" | "revision">): string;
export function selectVisibleNotices(options: {
  response: NoticeResponse | undefined;
  authenticated: boolean;
  serverNowMs: number;
  account?: string;
  dismissed?: { has(key: string): boolean };
}): Array<{ notice: OperationalNotice; phase: "upcoming" | "active" }>;
export function cacheableResponse(response: NoticeResponse | undefined, offsetMs: number): NoticeCacheEntry | undefined;
export function restoreCachedResponse(entry: unknown, localNowMs: number): NoticeCacheEntry | undefined;
export function nextPollDelayMs(options?: { failures?: number; pollAfterSeconds?: number; random?: number }): number;
export function selectServerNotices(
  rows: unknown[],
  options: { surface: NoticeSurface; authenticated: boolean; nowMs: number },
): OperationalNotice[];
