import type { StudioProject,StudioLine,MediaVariantPolicy } from '../../../../lab/lib/studio-model.mjs';
import type { IdlePolicy } from '../../../../lab/lib/idle-policy.mjs';
import type { VideoInventory,VideoEntry,MediaFamily,ClipSlot } from './connected-studio.mjs';
export type StudioPolicyContext={kind:'idle'|'family'|'line';family:MediaFamily|null;line:StudioLine;clips:VideoEntry[];policy:IdlePolicy|null;global:boolean;frequency:boolean};
export function studioPolicyContext(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot):StudioPolicyContext;
export function applyStudioIdlePolicy(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,policy:IdlePolicy):StudioProject;
export function addStudioIdleClip(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string,durationMs:number,asBase?:boolean):StudioProject;
export function setStudioBaseWeight(policy:IdlePolicy,videoId:string,weight:number):IdlePolicy;
export function applyStudioVariantPolicy(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,variantId:string,patch:Partial<Omit<MediaVariantPolicy,'videoId'>>):StudioProject;

export type StudioClipUsage={configured:boolean;when:string;rules:string[]};
export function studioClipUsage(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string,variantId?:string):StudioClipUsage;
