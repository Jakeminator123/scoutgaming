import type {ClipSlot,VideoEntry,VideoInventory} from './connected-studio.mjs';
export function rouletteClipSlots():ClipSlot[];
export function rouletteClipMatches(video:VideoEntry,dealerId:string,slot:ClipSlot):boolean;
export function rouletteReferencePreview(inventory:VideoInventory,dealerId:string):VideoEntry|null;
