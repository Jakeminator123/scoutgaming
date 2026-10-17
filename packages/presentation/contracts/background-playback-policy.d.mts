export type BackgroundPlaybackEventId = 'speak.blackjack' | 'speak.win' | 'speak.dealerblackjack' | 'speak.dealerbust'
  | 'speak.push' | 'speak.lose' | 'speak.sidebet' | 'speak.bust' | 'speak.double' | 'speak.insurance'
  | 'speak.goodluck' | 'speak.placebets' | 'speak.greeting';
export type BackgroundPlaybackTrigger = { eventId: BackgroundPlaybackEventId } | { everyMs: number };
export interface BackgroundPlaybackRule { id: string; assetId: string; trigger: BackgroundPlaybackTrigger;
  maxDurationMs: number; cooldownMs: number; maxPerMinute: number; maxSecondsPerMinute: number }
export interface BackgroundPlaybackPolicy { schemaVersion: 1; rules: BackgroundPlaybackRule[] }
export const BACKGROUND_EVENT_IDS: readonly BackgroundPlaybackEventId[];
export function validateBackgroundPlayback(value: unknown, options?: {
  assets?: readonly { id: string; role: string; contentType: string }[];
  allowed?: readonly string[]; defaultAssetId?: string | null;
}): BackgroundPlaybackPolicy;
export function backgroundRuleAssetIds(value: unknown): string[];
export function defaultBackgroundRule(assetId: string, id: string): BackgroundPlaybackRule;
