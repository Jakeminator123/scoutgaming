import type { StudioProject } from './studio-model.mjs';
export interface UploadOptions { uploadDir?: string; project?: StudioProject; projectStore?: {load(): Promise<StudioProject>} }
export function uploadDirectory(options?: UploadOptions): string;
export function safeDirectory(directory: string, create?: boolean): Promise<void>;
export function readUploads(options?: UploadOptions): Promise<any[]>;
export function uploadVideo(request: Request, options?: UploadOptions): Promise<{id: string; duplicate: boolean}>;
