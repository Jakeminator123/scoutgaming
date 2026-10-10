export interface PresentationRoomOperator { id: string; slug: string; name: string }
export interface PresentationRoomPresentation { id: string; label: string }
export interface PresentationRoomContext {
  operator: PresentationRoomOperator | null;
  presentation: PresentationRoomPresentation | null;
  projectRevision: string;
  projectSaved: boolean;
  storeAvailable: boolean;
  disabled?: boolean;
}
export type PresentationRoomCapability = { schemaVersion: 1; registeredDealerIds: readonly ['nora']; compositing: 'per-clip' }
  | { schemaVersion: 2; registeredDealerIds: readonly ['nora']; compositing: 'per-clip'; rooms: 'operator-owned-v2' }
  | { schemaVersion: 3; registeredDealerIds: readonly ['nora']; compositing: 'per-clip'; rooms: 'operator-owned-v2'; registeredDealerMode: 'saved-registry-idle-v1'; frozenDealerIdle: 'operator-package-v2' }
  | { schemaVersion: 4; registeredDealerIds: readonly ['nora']; compositing: 'per-clip'; rooms: 'operator-owned-v2'; registeredDealerMode: 'saved-registry-idle-v1'; frozenDealerIdle: 'operator-package-v2'; frozenDealerEvents: 'operator-package-v3' };
export interface PresentationRoomPreflight {
  ok: true; operator: PresentationRoomOperator; presentationLaneId: string;
  projectRevision: string; administrationRevision: string; packageRevision: number | null;
  ready: boolean; reason: null | 'studio_presentation_runtime_update_required' | 'presentation_lane_incompatible' | 'presentation_package_conflict' | 'presentation_package_too_large';
  capabilities: PresentationRoomCapability | null;
  rooms: readonly { id: string; name: string; playUrl: string }[];
}
export interface PresentationRoomPayload {
  operatorId: string; presentationLaneId: string; name: string; idempotencyKey: string;
  expectedProjectRevision: string; expectedAdministrationRevision: string; expectedPackageRevision: number | null;
}
export interface PresentationRoomReceipt {
  ok: true; duplicate: boolean;
  room: { schemaVersion: 2; id: string; name: string; operatorId: string; presentationLaneId: string; gameLaneId: string; state: 'live' };
  administrationRevision: string; packageRevision: number; playUrl: string;
}
export class PresentationRoomError extends Error { status: number; uncertain: boolean; constructor(message: string, options?: { status?: number; uncertain?: boolean }) }
export function presentationRoomContextKey(context: PresentationRoomContext): string;
export function presentationRoomPlayUrl(value: unknown, expected: { operatorSlug: string; roomId: string }): string;
export interface PresentationRoomClient {
  read(context: PresentationRoomContext, options?: { signal?: AbortSignal }): Promise<PresentationRoomPreflight>;
  create(context: PresentationRoomContext, payload: PresentationRoomPayload, options?: { signal?: AbortSignal }): Promise<PresentationRoomReceipt>;
}
export function createPresentationRoomClient(options?: { fetchImpl?: typeof fetch }): PresentationRoomClient;
export interface PresentationRoomSnapshot {
  key: string | null; name: string;
  status: 'idle' | 'loading' | 'ready' | 'busy' | 'uncertain' | 'conflict' | 'success' | 'unavailable' | 'error';
  preflight: PresentationRoomPreflight | null; receipt: PresentationRoomReceipt | null; message: string | null;
}
export interface PresentationRoomController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): PresentationRoomSnapshot;
  cancel(): void;
  configure(context: PresentationRoomContext): Promise<boolean>;
  setName(value: string): void;
  refresh(): Promise<boolean>;
  create(expectedKey: string): Promise<PresentationRoomReceipt | null>;
}
export function createPresentationRoomController(options?: { client?: PresentationRoomClient; newKey?: () => string }): PresentationRoomController;
