import type { VideoMetadata } from './video-intake.mjs';
export function uploadNativeVideo(file:Blob,classification:VideoMetadata,contentType:string,options?:{
  fetchImpl?:typeof fetch;putImpl?:(pathname:string,file:Blob,options:any) => Promise<{pathname:string;contentType:string}>;cryptoImpl?:Crypto;
  signal?:AbortSignal;onUploadProgress?:(event:{loaded:number;total:number;percentage:number}) => void;
}):Promise<{id:string;duplicate:boolean}>;
