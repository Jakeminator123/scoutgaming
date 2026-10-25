import type { StudioProject,StudioLine,MediaVariantPolicy } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type { IdlePolicy,IdleVariantPolicy } from '../../../../../packages/presentation/runtime/idle-policy.mjs';
import type { VideoInventory,VideoEntry,MediaFamily,ClipSlot } from './connected-studio.mjs';
export type StudioPolicyContext={kind:'idle'|'family'|'line';family:MediaFamily|null;line:StudioLine;clips:VideoEntry[];policy:IdlePolicy|null;global:boolean;frequency:boolean};
export function studioPolicyContext(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot):StudioPolicyContext;
export function prepareStudioPaowIdleRotation(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot):{policy:IdlePolicy|null;matched:number;total:number;error:string|null}|null;
export function applyStudioIdlePolicy(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,policy:IdlePolicy):StudioProject;
export function addStudioIdleClip(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string,durationMs:number,asBase?:boolean):StudioProject;
export function setStudioBaseWeight(policy:IdlePolicy,videoId:string,weight:number):IdlePolicy;
export const IDLE_EVENT_RULES:readonly {id:string;label:string;type:string;conditions:unknown[][]}[];
export function applyStudioIdleVariantPolicy(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string,patch:Partial<IdleVariantPolicy>):StudioProject;
export function studioIdleEventRule(project:StudioProject,dealerId:string,videoId:string):string;
export function applyStudioIdleEventRule(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string,ruleId:string):StudioProject;
export function applyStudioVariantPolicy(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,variantId:string,patch:Partial<Omit<MediaVariantPolicy,'videoId'>>):StudioProject;

export type StudioClipUsage={configured:boolean;when:string;rules:string[]};
export function studioClipUsage(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string,variantId?:string):StudioClipUsage;
