import type {VideoMetadata} from '../packages/presentation/contracts/video-intake.mjs';
export interface StudioMediaRecord {id:string; sha256:string; size:number; contentType:'video/mp4'|'video/webm'|'audio/mpeg'|'audio/wav'; pathname:string; classification:VideoMetadata}
export function validateManagedStudioMedia(record:unknown):StudioMediaRecord;
