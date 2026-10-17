import type {UploadOptions} from './video-local-readers.mjs';
export type {UploadOptions} from './video-local-readers.mjs';
export function uploadVideo(request: Request, options?: UploadOptions): Promise<{id: string; duplicate: boolean}>;
