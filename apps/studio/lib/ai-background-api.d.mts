import type {AiImagePresetId,AiImageRole} from './ai-image-contract.mjs';
import type {FilmedTableTemplate} from './filmed-table-template.mjs';
import type {CompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';

export type AiImageConfiguration={readonly apiKey:string;readonly endpoint:string;readonly model:string;readonly reasoning:string;readonly dailyLimit:number};
export type AiImageRequest={readonly role:AiImageRole;readonly prompt:string;readonly preset:AiImagePresetId;readonly count:number;readonly dealerId:string|null;
  readonly sceneTemplate:{readonly id:string;readonly composition:CompositionSettings|null}|null;
  readonly reference:{contentType:string;bytes:Uint8Array}|null};
export type AiImageDailyLimit={remaining(limit:number):number;reserve(limit:number,count:number):boolean};

export const AI_IMAGE_DEFAULT_MODEL: string;
export const AI_IMAGE_DEFAULT_REASONING: string;
export const AI_IMAGE_REASONING_LEVELS: readonly string[];
export const AI_IMAGE_DEFAULT_DAILY_LIMIT: number;
export const AI_IMAGE_RENDERER: string;
export function aiImageConfiguration(env?:Record<string,string|undefined>):AiImageConfiguration|null;
export function createAiImageDailyLimit(options?:{clock?:()=>number}):AiImageDailyLimit;
export function validateAiImageRequest(body:unknown):AiImageRequest;
export function aiImageProviderBody(settings:AiImageConfiguration,input:{text:string;images:string[];size:{width:number;height:number};action:'generate'|'edit'}):Record<string,unknown>;
export function renderAiProposal(bytes:Uint8Array,input:{role:AiImageRole;template:FilmedTableTemplate|null;preset:AiImagePresetId},options:{sharp:unknown}):Promise<{width:number;height:number;bytes:Uint8Array}>;
export function createAiBackgroundApi(options:{
  authorize:(request:Request)=>Promise<{user:string;role:string;scope:unknown}|null>;
  config:{scope:unknown;apiBase:string;[key:string]:unknown};
  configuration?:()=>AiImageConfiguration|null;
  limiter?:AiImageDailyLimit;
  fetchImpl?:typeof fetch;
  imageLibrary?:()=>Promise<unknown>;
  templateFor?:(dealerId:string,composition:CompositionSettings|null)=>FilmedTableTemplate|null;
}):{handle(request:Request):Promise<Response>};
export function handleAiBackgroundRequest(request:Request):Promise<Response>;
