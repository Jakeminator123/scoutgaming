import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type {AiImageErrorCode,AiImagePresetId,AiImageRole,AiTableFit} from '../../../lib/ai-image-contract.mjs';
export {AI_TABLE_MISFIT,aiTableFitsTemplate,aiTableMisfits,aiTableMisfitMessage} from '../../../lib/ai-image-contract.mjs';
export type {AiTableFitResult,AiTableMisfitCode,AiTableMisfit} from '../../../lib/ai-image-contract.mjs';
import type {CompositionSettings} from '../../../../../packages/presentation/contracts/composition-settings.mjs';

export type AiSceneTemplate={id:string;label:string;dealers:readonly string[];composition?:CompositionSettings};
// The server's landing check (apps/studio/lib/ai-table-landing-check.mjs); it only warns, and older servers send none.
export type AiLandingReason='busy'|'edges'|'low_contrast';
export type AiLandingCheck={ok:boolean;worst:{zone:string;score:number;reason:AiLandingReason};
  zones:{zone:string;ok:boolean;score:number;reason:AiLandingReason;spread:number;edges:number;contrast:number|null}[]};
export type AiProposal={id:string;dataUrl:string;width:number;height:number;check?:AiLandingCheck|null};
export type AiImageStatus={enabled:boolean;configured:boolean;problem:'missing_key'|'invalid_setting'|null;dailyLimit:number;remaining:number};
export const AI_IMAGE_ENDPOINT: string;
export const AI_IMAGE_MESSAGES: Readonly<Record<AiImageErrorCode,string>>;
export class AiImageRequestError extends Error { readonly code:AiImageErrorCode|null; constructor(code:string|null); }
export function aiImageErrorMessage(error:unknown):string;
export function readAiImageStatus(options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<AiImageStatus>;
export function requestAiProposals(input:{role:AiImageRole;prompt:string;preset:AiImagePresetId;count:number;dealerId?:string;sceneTemplate?:{id:string;composition?:CompositionSettings}|null;reference?:string|null},
  options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<{images:AiProposal[];remaining:number;fit:AiTableFit|null}>;
export function aiTableDealers<T extends {id:string}>(dealers:readonly T[]|null|undefined):T[];
export function aiSceneTemplates<T extends AiSceneTemplate>(templates:readonly T[]|null|undefined,dealerId:string):T[];
export function aiTableShapePreview(dealerId:string,composition:CompositionSettings|undefined,preset:AiImagePresetId):AiProposal|null;
export type AiReferenceMaterial={id:string;label:string;url:string};
export function aiReferenceMaterials(assets:StudioProject['layerAssets']|null|undefined,role:AiImageRole):AiReferenceMaterial[];
export function prepareMaterialReference(id:string,options?:{fetchImpl?:typeof fetch;signal?:AbortSignal;prepare?:(file:File)=>Promise<string>}):Promise<string>;
export function dataUrlFile(dataUrl:string,name:string):File;
export function registerAiProposal(proposal:AiProposal,input:{role:AiImageRole;prompt:string;fit?:AiTableFit|null},options?:{
  fetchImpl?:typeof fetch;put?:(pathname:string,file:File,options:Record<string,unknown>)=>Promise<{pathname:string}>;
  upload?:(...args:any[])=>Promise<{id:string;project:StudioProject}>;signal?:AbortSignal;
  onUploadProgress?:(event:{percentage:number})=>void;onCommit?:()=>void;
}):Promise<{id:string;project:StudioProject}>;
export function prepareReferenceImage(file:File,options?:{
  measure?:(file:File)=>Promise<{width:number;height:number}>;
  shrink?:(file:File,size:{width:number;height:number},quality:number)=>Promise<Blob|null>;
}):Promise<string>;
export function aiPackageMisfit(input:{endpoint:string;lanes:readonly string[];fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<import('../../../lib/ai-image-contract.mjs').AiTableMisfit|null>;

export type AiTableWidthSuggestion={changed:boolean;range:{readonly min:number;readonly target:number;readonly max:number};
  current:{share:number;percent:{desktop:number;mobile:number}};
  suggested:{share:number;percent:{desktop:number;mobile:number};composition:CompositionSettings;tableWidth:{mobile:number;desktop:number}}};
export function aiTableWidthSuggestion(dealerId:string,composition?:CompositionSettings|null):AiTableWidthSuggestion|null;
export type AiAdoptMaterial={role:AiImageRole;assetId:string};
export function adoptInTemplate(input:{project:StudioProject;compositionId:string;materials:AiAdoptMaterial[];tableWidth?:{mobile:number;desktop:number}|null},
  options:{save:(project:StudioProject,signal?:AbortSignal)=>Promise<StudioProject>;signal?:AbortSignal}):Promise<StudioProject>;
export type AiAdoptReceipt={ok:true;operatorId:string;roomId:string;previousPackageRevision:number;packageRevision:number;projectRevision:string;configVersion:string;publishedAt:string;actor:string};
export function adoptInRoom(input:{operatorId:string;roomId:string;compositionId:string;materials:AiAdoptMaterial[];tableWidth?:{mobile:number;desktop:number}|null;expectedProjectRevision:string},
  options?:{fetchImpl?:typeof fetch}):Promise<{ok:true;receipt:AiAdoptReceipt}|{ok:false;status:number;error:string;code?:string;reason?:string}>;
