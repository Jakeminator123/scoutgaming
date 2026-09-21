import type { DealerId } from './studio-model.mjs';
export interface OriginalMediaEntry {
  id: string; label: string; dealerId: DealerId; eventId: string | null;
  kind: 'idle' | 'speech' | 'action'; situation: string; available: boolean;
  durationMs: number; reviewStatus: 'unreviewed' | 'review'; previewUrl: string;
  playbackKind: 'indexed' | 'native' | 'packed'; sourcePath: string; clipKey?: string;
  caption?: string; audioDelayMs?: number; note: string;
}
export interface OriginalMediaCatalog { entries: OriginalMediaEntry[]; notes: string[] }
export const ORIGINAL_MEDIA_PREFIX: string;
export function originalMediaId(dealer: string, kind: string, key: string): string;
export function isOriginalMediaId(id: unknown): boolean;
export function originalEventId(event: Record<string, unknown>): string | null;
export function resolveOriginalDefault(catalog: OriginalMediaCatalog | null | undefined, dealerId: string, event: Record<string, unknown>): OriginalMediaEntry | null;
