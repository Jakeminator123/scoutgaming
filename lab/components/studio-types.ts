import type { StudioAsset, StudioVariant } from '../lib/studio-model.mjs';

export type StudioView = 'tree' | 'lab' | 'videos' | 'openclaw';
export type DirectorMode = 'off' | 'rules' | 'shadow' | 'active';

export interface VideoEntry {
  id: string;
  label: string;
  dealer?: string;
  fileName: string;
  verdict: 'want' | 'no' | 'unrated';
  bytes: number;
  sha256: string;
  duration?: number;
  available: boolean;
  previewUrl: string;
  reviewStatus: 'unreviewed';
  integrity: 'unchecked' | 'verified' | 'unavailable';
  suggestedEventId?: string;
  bindingScope: 'lab-only';
}

export interface VideoInventory {
  videos: VideoEntry[];
  summary?: {
    total: number;
    available: number;
    missing: number;
    unavailable: number;
    configured: boolean;
    readable: boolean;
    archiveSource?: string;
    intakeCounts: { want: number; no: number; unrated: number };
    notes: string[];
  };
  configured?: boolean;
}

export interface ConnectionStatus {
  configured?: boolean;
  provider?: string;
  mode?: string;
  reachable?: boolean;
  message?: string;
  dashboardUrl?: string;
  [key: string]: unknown;
}

export interface TestContext {
  chat: { signal: 'none' | 'praise' | 'inappropriate' };
  playerHistory: { returning: boolean; preferredLanguage: 'sv' | 'en' | 'de' };
  session: { recentWins: number; recentLosses: number };
  temperament: { mood: 'calm' | 'warm' | 'playful' | 'reserved' };
}

export interface SimulationResult {
  decision?: { variantId?: string; reason?: string; [key: string]: unknown };
  trace?: unknown;
  eligible?: (string | { id?: string; variantId?: string; label?: string })[];
  variant?: StudioVariant;
  asset?: StudioAsset;
  videoGenerationId?: string | null;
  provider?: string;
  [key: string]: unknown;
}

export const viewPaths: Record<StudioView, string> = { tree: '/tree', lab: '/', videos: '/videos', openclaw: '/openclaw' };

export function studioViewForPath(path: string): StudioView {
  const segment = path.split('/').filter(Boolean)[0];
  return segment === 'tree' || segment === 'videos' || segment === 'openclaw' ? segment : 'lab';
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.error === 'string' ? data.error : typeof data.message === 'string' ? data.message : 'Begäran misslyckades.';
    throw new Error(`${detail}${Array.isArray(data.errors) ? ` ${data.errors.join(' ')}` : ''}`);
  }
  return data as T;
}
