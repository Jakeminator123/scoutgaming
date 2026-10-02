export interface PlaybackRow {
  id: string; channel: string; epoch: number; dealerId?: string; event: { type: string; line?: string; to?: string; box?: number; shoeDraw?: number }; time?: string;
  requestId: string | null; commandRequestId: string | null; version: number | null;
  projectRevision: string | null; familyId: string | null; variantId: string | null; mediaId: string | null; fileName: string | null;
  reason: string | null; provider: string | null; mode: string | null; selected: boolean; started: boolean; played: boolean; ended: boolean;
  interrupted: boolean; failed: boolean; fallback: boolean; historical: boolean;
  receipts: { state: string; time?: string; evidence?: string; reason?: string }[];
}
export interface SpeechTrace {
  id: string; channel: string; epoch: number; requestId: string;
  stages: { stage: string; time?: string; elapsedMs?: number; evidence?: string; reason?: string }[];
  started: boolean; played: boolean; ended: boolean; interrupted: boolean; failed: boolean; fallback: boolean; historical: boolean;
}
export function playbackOutcome(row: Pick<PlaybackRow, 'interrupted' | 'fallback' | 'failed' | 'ended' | 'played' | 'started' | 'selected'>): string;
export function buildPlaybackTrace(records: Record<string, unknown>[], options?: { inventory?: unknown; clipInventory?: unknown; dealerId?: string; savedRevision?: string | null }): {
  rows: PlaybackRow[]; speech: SpeechTrace[]; mode: string | null; projectRevision: string | null; savedRevision: string | null;
  latestChannel: string | null; latestVersion: number | null; duplicates: number; stale: number; diagnostics: number; gaps: number;
  sources: { dealerId: string; registered: number; previewAvailable: number; runtimeConfigured: number; played: number }[];
  inventory: { registered: number; previewAvailable: number; runtimeFamily: number; played: number };
};
