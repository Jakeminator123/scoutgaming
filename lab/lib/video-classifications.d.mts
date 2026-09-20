import type { VideoMetadata } from './video-intake.mjs';
export function readClassifications(options?: {uploadDir?: string}): Promise<{id:string;sha256:string;metadata:VideoMetadata}[]>;
export function classifyVideo(body: unknown, registry: {videos:any[]}, options?: {uploadDir?:string}): Promise<unknown>;
