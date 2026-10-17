import type {ClipSlot,VideoEntry,VideoInventory} from './connected-studio.mjs';
import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
export function rouletteClipSlots():ClipSlot[];
export function rouletteClipMatches(video:VideoEntry,dealerId:string,slot:ClipSlot):boolean;
export function rouletteReferencePreview(inventory:VideoInventory,dealerId:string):VideoEntry|null;
export function rouletteConfiguredClipIds(project:StudioProject,dealerId:string,slot:ClipSlot):string[];
export function bindRouletteClip(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string):StudioProject;
export function unbindRouletteClip(project:StudioProject,dealerId:string,slot:ClipSlot,videoId:string):StudioProject;
export function setRouletteIdleForeground(project:StudioProject,inventory:VideoInventory,dealerId:string,videoId:string,text:string):StudioProject;
