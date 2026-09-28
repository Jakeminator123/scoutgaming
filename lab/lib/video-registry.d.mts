import type { VideoMetadata } from './video-intake.mjs';
export interface VideoRegistryOptions { archiveDir?: string | null; snapshotPath?: string; uploadDir?: string }
export interface RegistryVideo {
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
