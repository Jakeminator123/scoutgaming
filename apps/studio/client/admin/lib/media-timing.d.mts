import type {VideoEntry,VideoInventory} from './connected-studio.mjs';
export function timingMeasurable(video:VideoEntry|undefined):boolean;
export function timingMeasured(video:VideoEntry|undefined):boolean;
export function unmeasuredClips(inventory:VideoInventory|null|undefined,dealerId:string):VideoEntry[];
export function timingErrorMessage(status:number,code?:unknown,error?:unknown):string;
export class TimingError extends Error{status:number;constructor(message:string,status?:number);}
export function measureClipTiming(video:VideoEntry,options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<VideoEntry>;
export function measureClipsInOrder(videos:VideoEntry[],options?:{fetchImpl?:typeof fetch;signal?:AbortSignal;onProgress?:(progress:{done:number;total:number;failed:number})=>void}):Promise<{measured:VideoEntry[];failed:{id:string;label:string;message:string}[]}>;
