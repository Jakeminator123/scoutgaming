import type { VideoMetadata } from './video-intake.mjs';
export interface VideoRegistryOptions {
  archiveDir?: string | null; snapshotPath?: string; uploadDir?: string;
  project?: import('./studio-model.mjs').StudioProject;
  projectStore?: {load(): Promise<import('./studio-model.mjs').StudioProject>};
  strict?: boolean; repositoryRoot?: string; indexPath?: string; cacheDir?: string;
  env?: Record<string, string | undefined>;
  readUploads?(options: VideoRegistryOptions): Promise<any[]>;
  readClassifications?(options: VideoRegistryOptions): Promise<any[]>;
}
export interface RegistryVideo {
  retainedBank?: true;
  classification?: VideoMetadata;
  source?: 'emil' | 'archive' | 'upload';
  storage?: 'disk' | 'private-blob';
  familyId?: string;
  role?: 'standard' | 'variant';
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
  dealerId: 'astrid' | 'dragge' | 'paow';
  eventId: string;
  situation: string;
  playbackType: 'once' | 'idle-pool';
  standardIds: string[];
  variantIds: string[];
}
export interface VideoRegistry {
  videos: RegistryVideo[];
  families: MediaFamily[];
  summary: {
    total: number; available: number; missing: number; unavailable: number;
    configured: boolean; readable: boolean; snapshotReadable: boolean;
    archiveSource: 'explicit' | 'environment' | 'emil-default' | 'none';
    intakeCounts: Record<'want' | 'no' | 'unrated', number>;
    notes: string[];
  };
}
export function loadVideoRegistry(options?: VideoRegistryOptions): Promise<VideoRegistry>;
export function rescanVideoRegistry(): Promise<VideoRegistry>;
export function getVideoResponse(id: string, request: Request, options?: VideoRegistryOptions): Promise<Response>;
export function getLabVideoResponse(id: string, request: Request, options?: VideoRegistryOptions): Promise<Response>;
