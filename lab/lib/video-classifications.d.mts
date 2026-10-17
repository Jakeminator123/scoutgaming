import type { VideoMetadata } from '../../packages/presentation/contracts/video-intake.mjs';
export function classifyVideo(body: unknown, registry: {videos:any[]}, options?: {uploadDir?:string; readAlphaMedia?(id:string, options:unknown):Promise<Response>}): Promise<unknown>;
