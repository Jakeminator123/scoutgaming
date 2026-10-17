import type { VideoMetadata } from './video-intake.mjs';

export interface VideoEntry {
  revision?: string;
  deletion?: {state:'pending'|'deleted';requestedAt:string;completedAt?:string};
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
