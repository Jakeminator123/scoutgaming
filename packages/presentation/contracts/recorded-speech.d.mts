export const MAX_RECORDED_SPEECH_SECONDS: number;
export interface RecordedSpeechV1Identity {
  dealerId:string; lineId:string; takeId:string; language:string; exactText:string;
  videoSha256:string; audioSha256:string; indexSha256:string;
  fps:number; frameCount:number; audioDelayMs:number;
  entryPose:'VILA'|'REDO'; exitPose:'VILA'|'REDO'; calibrationRevision:string;
}
export interface EmbeddedAvSpeechIdentity {
  sourceKind:'embedded-mp4-av';
  dealerId:string; lineId:string; takeId:string; language:string; exactText:string;
  videoSha256:string; fps:number; frameCount:number; videoTrackId:number; audioTrackId:number;
  entryPose:'VILA'|'REDO'; exitPose:'VILA'|'REDO';
}
export type RecordedSpeechIdentity = RecordedSpeechV1Identity | EmbeddedAvSpeechIdentity;
export type RecordedSpeechProof<T extends string,I extends RecordedSpeechIdentity=RecordedSpeechV1Identity> = {status:'pending'} | {status:T;by:string;at:string;identity:I};
export interface RecordedSpeechV1 extends RecordedSpeechV1Identity {
  schemaVersion:1;
  recording:RecordedSpeechProof<'verified-recording'>;
  review:RecordedSpeechProof<'approved'|'rejected'>;
}
export interface RecordedSpeechV2 extends EmbeddedAvSpeechIdentity {
  schemaVersion:2;
  source:RecordedSpeechProof<'verified-embedded-av',EmbeddedAvSpeechIdentity>;
  review:RecordedSpeechProof<'approved'|'rejected',EmbeddedAvSpeechIdentity>;
}
export type RecordedSpeech = RecordedSpeechV1 | RecordedSpeechV2;
export interface RecordedSpeechSelection {dealerId:string;lineId:string;language:string;takeId?:string;requireApproved?:boolean}
export interface RecordedSpeechVideo {
  id?:string; sha256?:string; dealer?:string; dealerId?:string; available?:boolean; archived?:boolean; contentType?:string;
  bytes?:number; size?:number; mediaTiming?:import('./media-timing.mjs').MediaTiming;
  recordedSpeech?:RecordedSpeech;
  classification?:{dealerId?:string;situation?:string;archived?:boolean;recordedSpeech?:RecordedSpeech};
}
export function recordedSpeechIdentity(value:unknown):RecordedSpeechIdentity;
export function normalizeRecordedSpeech(value:unknown,context?:{dealerId?:string;lineId?:string;videoSha256?:string}):RecordedSpeech;
export function recordedSpeechSourceVerified(value:unknown):boolean;
export function recordedSpeechForVideo(video:RecordedSpeechVideo,selection:RecordedSpeechSelection):RecordedSpeech|null;
export function selectRecordedSpeech<T extends RecordedSpeechVideo>(videos:T[],selection:RecordedSpeechSelection&{takeId:string}):T|null;

