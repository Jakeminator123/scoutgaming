import type { StudioAsset, StudioVariant } from '../lib/studio-model.mjs';
import { labUrl, stripLabBasePath } from "../lib/lab-url.mjs";
import type { VideoMetadata } from '../lib/video-intake.mjs';

export type StudioView = 'tree' | 'lab' | 'videos' | 'activity' | 'openclaw' | 'guide' | 'probe';
export type DirectorMode = 'off' | 'rules' | 'random' | 'shadow' | 'active';

export interface VideoEntry {
  classification?: VideoMetadata;
  source?: 'emil' | 'archive' | 'upload';
  familyId?: string;
  role?: 'standard' | 'variant';
  eventId?: string;
  situation?: string;
  playbackType?: 'once' | 'idle-pool';
  addedAt?: string;
  id: string;
  label: string;
  dealer?: 'astrid' | 'vera' | 'amira' | 'mei';
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
  bindingScope: 'lab-only' | 'shared-local';
}

export interface MediaFamily {
  id: string;
  dealerId: 'astrid';
  eventId: string;
  situation: string;
  playbackType: 'once' | 'idle-pool';
  standardIds: string[];
  variantIds: string[];
}

export interface VideoInventory {
  videos: VideoEntry[];
  families?: MediaFamily[];
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

// A real test result owns its media choice, including an explicit lack of video.
// Never borrow the editor selection's film for another variant or social reply.
export function previewVideoIdFor(variant: StudioVariant, result: SimulationResult | null, social: boolean) {
  return social ? undefined : result ? result.videoGenerationId : variant.videoGenerationId;
}

export const viewPaths: Record<StudioView, string> = { tree: labUrl('/tree'), lab: labUrl('/'), videos: labUrl('/videos'), activity: labUrl('/activity'), openclaw: labUrl('/openclaw'), guide: labUrl('/guide'), probe: labUrl('/probe') };

export function studioViewForPath(path: string): StudioView {
  const segment = stripLabBasePath(path).split('/').filter(Boolean)[0];
  return segment === 'tree' || segment === 'videos' || segment === 'activity' || segment === 'openclaw' || segment === 'guide' || segment === 'probe' ? segment : 'lab';
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(labUrl(url), { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.error === 'string' ? data.error : typeof data.message === 'string' ? data.message : 'Begäran misslyckades.';
    throw Object.assign(new Error(`${detail}${Array.isArray(data.errors) ? ` ${data.errors.join(' ')}` : ''}`),{statusCode:response.status});
  }
  return data as T;
}
