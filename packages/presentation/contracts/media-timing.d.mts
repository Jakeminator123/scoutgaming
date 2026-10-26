import type { RecordedSpeech } from './recorded-speech.mjs';
export const MAX_MEDIA_TIMING_US: number;
export interface MediaTiming {
  schemaVersion:1; mediaId:string; sha256:string; size:number;
  recordedSpeechIdentitySha256:string|null;
  video:{trackId:number;frameCount:number;fps:number;firstPtsUs:0;lastPtsUs:number;endUs:number};
  audio:Array<{trackId:number;firstPtsUs:number;endUs:number}>;
  endUs:number; audioTailUs:number;
}
export function mediaTimingSpeechIdentity(value:RecordedSpeech):string;
export function normalizeMediaTiming(value:unknown,context?:{mediaId?:string;sha256?:string;size?:number;recordedSpeechIdentitySha256?:string|null}):MediaTiming;
