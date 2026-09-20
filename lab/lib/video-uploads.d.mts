export interface UploadOptions { uploadDir?: string }
export function uploadDirectory(options?: UploadOptions): string;
export function readUploads(options?: UploadOptions): Promise<any[]>;
export function uploadVideo(request: Request, options?: UploadOptions): Promise<{id: string; duplicate: boolean}>;
