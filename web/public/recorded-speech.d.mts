export interface RecordedSpeechIdentity {
  dealerId:string; lineId:string; takeId:string; language:string; exactText:string;
  videoSha256:string; audioSha256:string; indexSha256:string;
  fps:number; frameCount:number; audioDelayMs:number;
  entryPose:'VILA'|'REDO'; exitPose:'VILA'|'REDO'; calibrationRevision:string;
}
export type RecordedSpeechProof<T extends string> = {status:'pending'} | {status:T;by:string;at:string;identity:RecordedSpeechIdentity};
export interface RecordedSpeech extends RecordedSpeechIdentity {
  schemaVersion:1;
  recording:RecordedSpeechProof<'verified-recording'>;
  review:RecordedSpeechProof<'approved'|'rejected'>;
}
export interface RecordedSpeechSelection {dealerId:string;lineId:string;language:string;takeId?:string;requireApproved?:boolean}
export interface RecordedSpeechVideo {
  id?:string; sha256?:string; dealer?:string; dealerId?:string; available?:boolean; archived?:boolean; contentType?:string;
  recordedSpeech?:RecordedSpeech;
  classification?:{dealerId?:string;situation?:string;archived?:boolean;recordedSpeech?:RecordedSpeech};
}
export function recordedSpeechIdentity(value:unknown):RecordedSpeechIdentity;
export function normalizeRecordedSpeech(value:unknown,context?:{dealerId?:string;lineId?:string;videoSha256?:string}):RecordedSpeech;
export function recordedSpeechForVideo(video:RecordedSpeechVideo,selection:RecordedSpeechSelection):RecordedSpeech|null;
export function selectRecordedSpeech<T extends RecordedSpeechVideo>(videos:T[],selection:RecordedSpeechSelection&{takeId:string}):T|null;
