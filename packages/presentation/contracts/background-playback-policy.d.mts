export type BackgroundPlaybackEventId = 'speak.blackjack' | 'speak.win' | 'speak.dealerblackjack' | 'speak.dealerbust'
  | 'speak.push' | 'speak.lose' | 'speak.sidebet' | 'speak.bust' | 'speak.double' | 'speak.insurance'
  | 'speak.goodluck' | 'speak.placebets' | 'speak.greeting';
export type LayerPlaybackRole = 'background' | 'table';
export type BackgroundPlaybackTrigger = { eventId: BackgroundPlaybackEventId } | { everyMs: number; jitterMs?: number };
export interface BackgroundPlaybackRule { id: string; assetId: string; trigger: BackgroundPlaybackTrigger;
  maxDurationMs: number; cooldownMs: number; maxPerMinute: number; maxSecondsPerMinute: number }
export interface BackgroundPlaybackPolicy { schemaVersion: 1; rules: BackgroundPlaybackRule[] }
export type LayerPlaybackPolicy = BackgroundPlaybackPolicy;
export type LayerPlaybackRule = BackgroundPlaybackRule;
export const BACKGROUND_EVENT_IDS: readonly BackgroundPlaybackEventId[];
export const LAYER_PLAYBACK_ROLES: readonly LayerPlaybackRole[];
export const MAX_PLAYBACK_JITTER_MS: number;
export function validateLayerPlayback(value: unknown, options?: {
  role?: LayerPlaybackRole;
  assets?: readonly { id: string; role: string; contentType: string }[];
  allowed?: readonly string[]; defaultAssetId?: string | null;
}): BackgroundPlaybackPolicy;
export function validateBackgroundPlayback(value: unknown, options?: {
  assets?: readonly { id: string; role: string; contentType: string }[];
  allowed?: readonly string[]; defaultAssetId?: string | null;
}): BackgroundPlaybackPolicy;
export function playbackUsesJitter(value: unknown): boolean;
export function backgroundRuleAssetIds(value: unknown): string[];
export function layerRuleAssetIds(value: unknown, role?: LayerPlaybackRole): string[];
export function selectableLayerBases(allowed: readonly string[] | null | undefined, policy: unknown, defaultAssetId?: string | null): string[];
export function defaultBackgroundRule(assetId: string, id: string): BackgroundPlaybackRule;
export function defaultLayerRule(assetId: string, id: string, options?: { role?: LayerPlaybackRole; everyMs?: number; jitterMs?: number }): BackgroundPlaybackRule;
