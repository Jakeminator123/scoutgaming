import type { DealerId, StudioAsset, StudioProject, StudioVariant } from '../lib/studio-model.mjs';
import { labUrl, stripLabBasePath } from "../lib/lab-url.mjs";
import type { VideoMetadata } from '../lib/video-intake.mjs';

export type StudioView = 'tree' | 'lab' | 'videos' | 'activity' | 'openclaw' | 'guide' | 'probe';
export type DirectorMode = 'off' | 'rules' | 'random' | 'shadow' | 'active';

export interface VideoEntry {
  classification?: VideoMetadata;
  source?: 'emil' | 'archive' | 'upload';
  familyId?: string;
  role?: 'standard' | 'variant';
  relativePath?: string;
  eventId?: string;
  situation?: string;
  playbackType?: 'once' | 'idle-pool';
  addedAt?: string;
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
  bindingScope: 'lab-only' | 'shared-local';
}

export interface MediaFamily {
  id: string;
  dealerId: string;
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

// Staff editor views use the public /control addresses. OpenClaw chat is the
// tab on /control/openclaw. Model settings stay on that path without the tab.
export const viewPaths: Record<StudioView, string> = {
  tree: '/control/tree', lab: '/control/events', videos: '/control/videos', activity: '/control/activity',
  openclaw: '/control/openclaw?tab=chat', guide: '/control/guide', probe: '/control/probe',
};

const EDITOR_TABS = new Set(['event', 'triggers', 'variants']);

// Public control URL plus dealer, event, an optional variant and an optional allowlisted tab.
export function studioHref(path: string, selection: { dealerId?: string; eventId?: string; variantId?: string; tab?: string; situation?: string } = {}) {
  const base = path.split(/[?#]/, 1)[0];
  const params = new URLSearchParams();
  if (selection.dealerId) params.set('dealer', selection.dealerId);
  if (selection.eventId) params.set('event', selection.eventId);
  if (selection.variantId) params.set('variant', selection.variantId);
  if (selection.situation) params.set('situation', selection.situation);
  if (selection.tab === 'chat' || (selection.tab && EDITOR_TABS.has(selection.tab))) params.set('tab', selection.tab);
  const query = params.toString();
  return labUrl(query ? `${base}?${query}` : base);
}

// Current document path with the selection written into dealer and event.
// Editor tab is kept only on the events page. OpenClaw chat tab is kept only there.
// A variant is kept only where a video binding targets it: events and videos.
export function selectionHref(pathname: string, search: string, dealerId: string, eventId: string, variantId = '') {
  const path = stripLabBasePath((pathname || '/').split(/[?#]/, 1)[0]) || '/';
  const tab = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tab') ?? '';
  const onEvents = path === '/events' || path.endsWith('/events');
  const onVideos = path === '/videos' || path.endsWith('/videos');
  const onOpenClaw = path === '/openclaw' || path.endsWith('/openclaw');
  const previous = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const situation = previous.get('event') === eventId ? previous.get('situation') ?? undefined : undefined;
  const nextTab = onEvents && EDITOR_TABS.has(tab) ? tab : onOpenClaw && tab === 'chat' ? tab : undefined;
  return studioHref(path, { dealerId, eventId, variantId: onEvents || onVideos ? variantId : undefined, tab: nextTab, situation });
}

export function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveStudioDealerId(project: StudioProject, initial?: string): DealerId {
  const match = project.dealers.find(item => item.id === initial);
  return (match?.id ?? project.dealers[0]?.id ?? 'astrid') as DealerId;
}

export function resolveStudioEventId(project: StudioProject, initial?: string) {
  return initial && project.events.some(item => item.id === initial) ? initial : project.events[0].id;
}

export function studioViewForPath(path: string): StudioView {
  const bare = stripLabBasePath(path).split('#')[0];
  const [pathname, query = ''] = bare.split('?');
  const parts = pathname.split('/').filter(Boolean);
  const segment = parts[0] === 'control' ? parts[1] : parts[0];
  const tab = query.split('&').find((part: string) => part.startsWith('tab='))?.slice(4) ?? '';
  if (segment === 'operator-chat' || (segment === 'openclaw' && tab === 'chat')) return 'openclaw';
  if (segment === 'events') return 'lab';
  return segment === 'tree' || segment === 'videos' || segment === 'activity' || segment === 'guide' || segment === 'probe' ? segment : 'lab';
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
