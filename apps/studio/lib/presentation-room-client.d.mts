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
type LegacyPresentationRoomCapability = { schemaVersion: 1; registeredDealerIds: readonly ['nora']; compositing: 'per-clip' }
  | { schemaVersion: 2; registeredDealerIds: readonly ['nora']; compositing: 'per-clip'; rooms: 'operator-owned-v2' }
  | { schemaVersion: 3; registeredDealerIds: readonly ['nora']; compositing: 'per-clip'; rooms: 'operator-owned-v2'; registeredDealerMode: 'saved-registry-idle-v1'; frozenDealerIdle: 'operator-package-v2' }
  | { schemaVersion: 4; registeredDealerIds: readonly ['nora']; compositing: 'per-clip'; rooms: 'operator-owned-v2'; registeredDealerMode: 'saved-registry-idle-v1'; frozenDealerIdle: 'operator-package-v2'; frozenDealerEvents: 'operator-package-v3' };
type RouletteRoomCapability = Omit<Extract<LegacyPresentationRoomCapability, { schemaVersion: 4 }>, 'schemaVersion'> & {
  schemaVersion: 9; dealerLifecycle: 'trash-v1'; resourceLifecycle: 'operator-room-archive-v1';
  dealerArchiveCascade: 'dealer-compositions-rooms-v1'; backgroundPlayback: 'rules-v1'; rouletteRooms: 'european-single-zero-v1';
};
type CategoryRoomCapability = Omit<RouletteRoomCapability, 'schemaVersion'> & {
  schemaVersion: 14; dealerSets: 'authoring-categories-v1'; materialTrash: 'detached-assets-v1';
  mediaAlpha: 'png-vp9-v1'; rouletteMedia: 'action-pose-slots-v1'; tableGame: 'immutable-game-v1'; dealerCategoryTrash: 'retained-categories-v1';
};
export type PresentationRoomCapability = LegacyPresentationRoomCapability | RouletteRoomCapability | CategoryRoomCapability
  | (Omit<CategoryRoomCapability, 'schemaVersion'> & { schemaVersion: 15; rouletteIdle: 'explicit-game-idle-v1'; rouletteStart: 'explicit-game-start-v1' });
export type PresentationRoomConflictCode = 'presentation_shared_dealer_conflict' | 'presentation_shared_layer_conflict'
  | 'presentation_room_binding_conflict' | 'presentation_game_lane_conflict' | 'presentation_legacy_package_conflict' | 'presentation_room_environment_conflict';
export interface PresentationRoomPreflight {
  ok: true; operator: PresentationRoomOperator; presentationLaneId: string;
  projectRevision: string; administrationRevision: string; packageRevision: number | null;
  ready: boolean; reason: null | 'studio_presentation_runtime_update_required' | 'presentation_lane_incompatible' | 'presentation_package_conflict' | 'presentation_package_too_large' | 'presentation_room_environment_required';
  environment?: { kind: 'baked' | 'image' | 'video' | 'variable'; fixed: boolean; label: string } | null;
  conflictCode?: PresentationRoomConflictCode | null;
  capabilities: PresentationRoomCapability | null;
  rooms: readonly { id: string; name: string; playUrl: string }[];
}
export interface PresentationRoomPayload {
  game?: 'blackjack' | 'roulette';
  operatorId: string; presentationLaneId: string; name: string; idempotencyKey: string;
  expectedProjectRevision: string; expectedAdministrationRevision: string; expectedPackageRevision: number | null;
}
export interface PresentationRoomReceipt {
  ok: true; duplicate: boolean;
  room: { schemaVersion: 2; id: string; name: string; operatorId: string; presentationLaneId: string; gameLaneId: string; state: 'live'; game?: 'blackjack' | 'roulette' };
  administrationRevision: string; packageRevision: number; playUrl: string;
}
export class PresentationRoomError extends Error { status: number; uncertain: boolean; constructor(message: string, options?: { status?: number; uncertain?: boolean }) }
export function presentationRoomContextKey(context: PresentationRoomContext): string;
export function presentationRoomPlayUrl(value: unknown, expected: { operatorSlug: string; roomId: string }): string;
export interface PresentationRoomClient {
  read(context: PresentationRoomContext, options?: { signal?: AbortSignal; game?: 'blackjack' | 'roulette' }): Promise<PresentationRoomPreflight>;
  create(context: PresentationRoomContext, payload: PresentationRoomPayload, options?: { signal?: AbortSignal }): Promise<PresentationRoomReceipt>;
}
export function createPresentationRoomClient(options?: { fetchImpl?: typeof fetch }): PresentationRoomClient;
export interface PresentationRoomSnapshot {
  game: 'blackjack' | 'roulette';
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
  setGame(value: string): Promise<boolean>;
  refresh(): Promise<boolean>;
  create(expectedKey: string): Promise<PresentationRoomReceipt | null>;
}
export function createPresentationRoomController(options?: { client?: PresentationRoomClient; newKey?: () => string }): PresentationRoomController;
