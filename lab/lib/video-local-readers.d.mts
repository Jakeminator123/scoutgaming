import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
export interface UploadOptions { uploadDir?: string; project?: StudioProject; projectStore?: {load(): Promise<StudioProject>} }
export function uploadDirectory(options?: UploadOptions): string;
export function safeDirectory(directory: string, create?: boolean): Promise<void>;
export function readUploads(options?: UploadOptions): Promise<any[]>;

import type { VideoMetadata } from '../../packages/presentation/contracts/video-intake.mjs';
export function readClassifications(options?: {uploadDir?: string}): Promise<{id:string;sha256:string;metadata:VideoMetadata}[]>;
export function localDealerIds(options: UploadOptions): Promise<Set<string>>;
export const validClassificationVideoId: (id: unknown) => boolean;
export const MAX_INDEX_BYTES: number;
export const LIMIT: number;
