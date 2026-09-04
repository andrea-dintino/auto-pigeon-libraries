// Types for @auto-pigeon/offline-workspace-contract.
//
// Hand-written rather than generated, and narrow on purpose: the role, capability, state and reason
// unions are the values a TypeScript consumer should be prevented from mistyping, and everything
// that is genuinely open — a schema document, a machine definition — is typed loosely rather than
// pinned to a shape that would need editing every time the JSON grows a descriptive field.

export type Role = "overlord" | "lord" | "knight" | "pilgrim";
export type AssignableRole = "lord" | "knight" | "pilgrim";
export type Visibility = "public" | "private";
export type AssetType = "map" | "texture_source" | "entity_catalogue" | "game_profile" | "prefab_package";

export type Capability =
  | "workspace.read"
  | "workspace.activity.read"
  | "workspace.metadata.write"
  | "workspace.visibility.change"
  | "workspace.delete"
  | "member.invite"
  | "member.role.change"
  | "member.remove"
  | "member.leave"
  | "role_request.create"
  | "role_request.resolve"
  | "asset.read"
  | "asset.download"
  | "asset.upload"
  | "asset.import"
  | "asset.edit"
  | "asset.save"
  | "asset.detach"
  | "annotation.read"
  | "annotation.write"
  | "annotation.resolve"
  | "escalation.request"
  | "escalation.accept";

export type MachineId =
  | "asset_collaboration"
  | "asset_edit_lease"
  | "workspace"
  | "workspace_membership"
  | "workspace_invitation"
  | "role_request"
  | "escalation_request"
  | "linked_session"
  | "annotation_thread";

export type AssetCollaborationState =
  | "unattached"
  | "workspace_idle"
  | "offline_editing"
  | "realtime_starting"
  | "realtime_active";

export type EntityName =
  | "workspace"
  | "workspace_public_card"
  | "workspace_member"
  | "workspace_asset"
  | "asset_record"
  | "dependency_entry"
  | "dependency_manifest"
  | "workspace_invitation"
  | "role_request"
  | "asset_edit_lease"
  | "escalation_request"
  | "linked_session"
  | "annotation_anchor"
  | "annotation_thread"
  | "annotation_message"
  | "annotation_read_state"
  | "activity_event"
  | "blocking_reference"
  | "refusal";

export interface ReasonEntry {
  code: string;
  area: string;
  http_status: number;
  retryable: boolean;
  summary: string;
  remedy: string;
}

export interface Transition {
  from: string;
  event: string;
  to: string;
  guards?: string[];
  refusals?: string[];
  sets?: string[];
  identity?: string[];
  on_replay?: "return_current" | "conflict";
  notes?: string;
}

export interface StateDefinition {
  name: string;
  terminal: boolean;
  description: string;
}

export interface Machine {
  id: MachineId;
  subject: string;
  description: string;
  initial: string;
  states: StateDefinition[];
  events: string[];
  transitions: Transition[];
}

export interface PolicyEntry {
  name: string;
  value: number;
  source: "product" | "contract_default";
  summary: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

export interface Refusal {
  schema_version: string;
  reason: string;
  http_status?: number;
  message?: string;
  subject_type?: string;
  subject_id?: string;
  required_capability?: Capability;
  roles_with_capability?: Role[];
  blocking?: Array<{ type: string; id: string; label?: string; label_visible: boolean; asset_type?: AssetType }>;
  current_revision?: number;
  retry_after_ms?: number;
  correlation_id?: string;
}

export const SCHEMA_VERSION: string;
export const CAPABILITY_SCHEMA_VERSION: string;
export const CAPABILITY_SCOPE: string;

export const entitiesSchema: Record<string, unknown>;
export const rolesDocument: Record<string, unknown>;
export const reasonsDocument: Record<string, unknown>;
export const machinesDocument: Record<string, unknown>;
export const policyDocument: Record<string, unknown>;
export const assetTypesDocument: Record<string, unknown>;

export const ROLES: readonly Role[];
export const ROLE_OVERLORD: "overlord";
export const ROLE_LORD: "lord";
export const ROLE_KNIGHT: "knight";
export const ROLE_PILGRIM: "pilgrim";
export const CAPABILITIES: readonly Capability[];

export function isKnownRole(value: unknown): value is Role;
export function isKnownCapability(value: unknown): value is Capability;
export function can(role: string, capability: string): boolean;
export function capabilitiesFor(role: string): Capability[];
export function rolesWith(capability: string): Role[];
export function rank(role: string): number;
export function roleSummary(role: string): { role: Role; rank: number; summary: string } | undefined;
export function capabilitySummary(capability: string): { capability: Capability; summary: string } | undefined;
export function additionalGates(capability: string): string[];
export function nonNestingCapabilities(): Array<{ capability: Capability; held_by: Role[]; why: string }>;

export const REASON_CODES: readonly ReasonEntry[];
export function isReasonCode(code: unknown): boolean;
export function reasonCode(code: string): ReasonEntry | undefined;
export function reasonsForArea(area: string): ReasonEntry[];
export function httpStatusFor(code: string): number | undefined;
export function createRefusal(code: string, fields?: Partial<Refusal>): Refusal;

export const MACHINES: readonly Machine[];
export const MACHINE_IDS: readonly MachineId[];
export function machine(id: string): Machine | undefined;
export function statesOf(id: string): string[];
export function eventsOf(id: string): string[];
export function initialState(id: string): string | undefined;
export function isTerminal(id: string, state: string): boolean;
export function transitionsFrom(id: string, from: string): Transition[];
export function transitionsFor(id: string, from: string, event: string): Transition[];
export function nextStates(id: string, from: string, event: string): string[];
export function canTransition(id: string, from: string, event: string, to?: string): boolean;
export function refusalsFor(id: string, from: string, event: string): string[];
export function fieldsSetBy(id: string, from: string, event: string): string[];
export function idempotencyFor(
  id: string,
  from: string,
  event: string,
): { identity: string[]; on_replay: "return_current" | "conflict" } | undefined;

export const LEASE_INACTIVITY_TIMEOUT_MS: number;
export const LEASE_HEARTBEAT_MAX_INTERVAL_MS: number;
export const ESCALATION_REQUEST_TTL_MS: number;
export const ESCALATION_REQUEST_MIN_INTERVAL_MS: number;
export const INVITATION_TTL_MS: number;
export const ROLE_REQUEST_TTL_MS: number;
export const REALTIME_STARTING_TIMEOUT_MS: number;
export const PERMITTED_URL_SCHEMES: readonly string[];
export function duration(name: string): PolicyEntry | undefined;
export function limit(name: string): PolicyEntry | undefined;
export function durations(): PolicyEntry[];
export function limits(): PolicyEntry[];
export function isPermittedUrl(value: string): boolean;
export function leaseExpiryFrom(heartbeatAtMs: number): number;

export const ASSET_TYPES: readonly AssetType[];
export function isKnownAssetType(value: unknown): value is AssetType;
export function assetType(value: string):
  | { asset_type: AssetType; aub_collection: string; mutable: boolean; realtime_eligible: boolean; summary: string }
  | undefined;
export function isMutable(value: string): boolean;
export function isRealtimeEligible(value: string): boolean;

export const ENTITY_NAMES: readonly EntityName[];
export function validateEntity(entityName: string, value: unknown): ValidationResult;
export function isSupportedVersion(schemaVersion: unknown): boolean;
