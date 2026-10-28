import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type {AiImageErrorCode,AiImagePresetId,AiImageRole} from '../../../lib/ai-image-contract.mjs';

export type AiProposal={id:string;dataUrl:string;width:number;height:number};
export type AiImageStatus={configured:boolean;dailyLimit:number;remaining:number};
export const AI_IMAGE_ENDPOINT: string;
export const AI_IMAGE_MESSAGES: Readonly<Record<AiImageErrorCode,string>>;
export class AiImageRequestError extends Error { readonly code:AiImageErrorCode|null; constructor(code:string|null); }
export function aiImageErrorMessage(error:unknown):string;
export function readAiImageStatus(options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<AiImageStatus>;
export function requestAiProposals(input:{role:AiImageRole;prompt:string;preset:AiImagePresetId;count:number;dealerId?:string;reference?:string|null},
  options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<{images:AiProposal[];remaining:number}>;
export function aiTableDealers<T extends {id:string}>(dealers:readonly T[]|null|undefined):T[];
export function dataUrlFile(dataUrl:string,name:string):File;
export function registerAiProposal(proposal:AiProposal,input:{role:AiImageRole;prompt:string},options?:{
  fetchImpl?:typeof fetch;put?:(pathname:string,file:File,options:Record<string,unknown>)=>Promise<{pathname:string}>;
  upload?:(...args:any[])=>Promise<{id:string;project:StudioProject}>;signal?:AbortSignal;
  onUploadProgress?:(event:{percentage:number})=>void;onCommit?:()=>void;
}):Promise<{id:string;project:StudioProject}>;
export function prepareReferenceImage(file:File):Promise<string>;
