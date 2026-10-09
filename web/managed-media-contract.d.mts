import type {VideoMetadata} from '../lab/lib/video-intake.mjs';
export interface StudioMediaRecord {id:string; sha256:string; size:number; contentType:'video/mp4'|'video/webm'; pathname:string; classification:VideoMetadata}
export function validateManagedStudioMedia(record:unknown):StudioMediaRecord;
