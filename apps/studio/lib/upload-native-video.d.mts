import type { VideoMetadata } from '../../../packages/presentation/contracts/video-intake.mjs';
export function uploadNativeVideo(file:Blob,classification:VideoMetadata,contentType:string,options?:{
  fetchImpl?:typeof fetch;putImpl?:(pathname:string,file:Blob,options:any) => Promise<{pathname:string;contentType:string}>;cryptoImpl?:Crypto;
  signal?:AbortSignal;onUploadProgress?:(event:{loaded:number;total:number;percentage:number}) => void;
  inspectAlpha?:typeof import('./media-alpha-browser.mjs').inspectAlphaFile;
}):Promise<{id:string;duplicate:boolean}>;
