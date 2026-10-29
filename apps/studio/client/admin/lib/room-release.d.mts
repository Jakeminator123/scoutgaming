export type RoomReleaseGameConfig = { language: string; limitPreset: string };
export type RoomReleaseBlocker = { area: string; code: string; step?: string; reason?: string; materialReason?: string; roomId?: string;
  draftRevision?: number; compositionId?: string|null; assetId?: string|null };
export type RoomReleaseChange = { area: string; [key: string]: unknown };
export type RoomReleaseAreasView = { dealerId: string|null; clips: { count: number }; speech: { lineId: string; language: string|null; takeId: string|null; approvedBy: string|null }[];
  idle: { mediaId: string|null; policySha256: string|null }; placement: { compositionSha256: string }; settings: RoomReleaseGameConfig|null;
  roomChoices: { dealer: string|null; table: string|null; background: string|null } };
export type RoomReleasePreview = {
  ok: true; operatorId: string; roomId: string;
  revisions: { package: number; project: string; administration: string; configVersion: string|null; roomGameConfigDraft: string|null; brandingDraft: number|null };
  gameConfig: RoomReleaseGameConfig|null; live: RoomReleaseAreasView|null; candidate: RoomReleaseAreasView|null;
  changes: RoomReleaseChange[]; changed: boolean; affectedRooms: { id: string; name: string; bound: boolean; rebinds: boolean }[];
  ready: boolean; blockers: RoomReleaseBlocker[]; previewToken: string; materialWarnings?: unknown[];
  /** Bolagets utseendeutkast (servern med steg D v2); saknas från äldre servrar. */
  appearanceDraft?: { revision: number; included: boolean }|null;
};
/** Området `appearance` i `changes` (servern med steg D v2). */
export type RoomReleaseAppearanceChange = { area: 'appearance'; draftRevision: number;
  changes: { roomId: string|null; key: string; before: unknown; after: unknown }[]; affectedRooms: string[] };
export type RoomReleaseReceipt = { ok: true; operatorId: string; roomId: string; previousPackageRevision: number; packageRevision: number;
  configVersion: string; gameConfig: RoomReleaseGameConfig; administrationRevision: string; publishedAt: string; actor: string; changes: RoomReleaseChange[] };
export type RoomReleaseFailure = { ok: false; status: number; error: string; code?: string; step?: string; reason?: string; materialReason?: string };
export type RoomReleaseErrorDetail = { status?: number; code?: string; step?: string; reason?: string; materialReason?: string; phase?: 'read'|'publish' };

export const ROOM_RELEASE_READ_PATH: string;
export const ROOM_RELEASE_PUBLISH_PATH: string;
export function languageLabel(value: unknown): string;
export function limitLabel(value: unknown): string;
export function materialReasonText(reason: unknown): string;
export function roomReleaseErrorMessage(detail?: RoomReleaseErrorDetail): string;
export function roomReleaseBlocker(blocker: RoomReleaseBlocker, context?: { roomId?: string; dealerId?: string|null; rooms?: { id: string; name: string }[] }): { text: string; href: string|null; linkLabel: string|null };
export function roomReleaseAreas(preview: RoomReleasePreview|null|undefined, options?: { dealerName?: (id: string) => string; rooms?: { id: string; name: string }[] }): { area: string; label: string; changed: boolean; rows: string[] }[];
export function roomReleaseChangeCount(preview: RoomReleasePreview|null|undefined): number;
export function roomReleaseButton(input?: { status?: 'idle'|'loading'|'ready'|'error'; preview?: RoomReleasePreview|null; blockedBy?: string }): { disabled: boolean; label: string; hint: string };
export function roomReleaseCanPublish(preview: RoomReleasePreview|null|undefined): boolean;
export function readRoomRelease(input: { operatorId: string; roomId: string; fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<{ ok: true; preview: RoomReleasePreview }|RoomReleaseFailure>;
export function roomReleaseBody(preview: RoomReleasePreview): { action: 'publish-room'; operatorId: string; roomId: string; gameConfig: RoomReleaseGameConfig|null;
  expectedPackageRevision: number; expectedProjectRevision: string; expectedAdministrationRevision: string; previewToken: string };
export function publishRoomRelease(input: { preview: RoomReleasePreview; fetchImpl?: typeof fetch }): Promise<{ ok: true; receipt: RoomReleaseReceipt }|RoomReleaseFailure>;
export function roomReleaseReceiptText(receipt: RoomReleaseReceipt): string;
