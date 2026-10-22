import type { NativeStudioConfiguration } from './studio-native-runtime.mjs';
import type { NativeStudioSession } from '../../../packages/studio-access/studio-native-auth.mjs';
export interface OpenClawAdminModel {primary:string;fallbacks:string[];}
export interface OpenClawAdminSnapshot {
  version:1; baseHash:string; gateway:{connected:true;version:string;applied:boolean|null};
  agents:{id:string;model:OpenClawAdminModel}[]; models:{id:string;provider:string}[];
}
export interface OpenClawAdminPatch {version:1;baseHash:string;agentId:string;model:OpenClawAdminModel;}
export interface OpenClawAdminReceipt {saved:true;baseHash:string;agentId:string;model:OpenClawAdminModel;restartScheduled:boolean;verifiedAt:string;}
export function handleOpenClawAdmin(request:Request):Promise<Response>;
export function createOpenClawAdminApi(options:{config:NativeStudioConfiguration;authorize(request:Request):Promise<NativeStudioSession>;
  settings?:()=>Record<string,unknown>;fetchImpl?:typeof fetch}):{handle(request:Request):Promise<Response>};
