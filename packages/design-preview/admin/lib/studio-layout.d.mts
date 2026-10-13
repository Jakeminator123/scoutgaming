import type { ClipSlot, Room } from './connected-studio.mjs';
import type { StudioProject } from '../../../../lab/lib/studio-model.mjs';
export type ClipGroup = {id:string;title:string;subtitle:string;color:string;slots:ClipSlot[]};
export function slotCaption(slot:ClipSlot):string;
export function slotSpeech(slot:ClipSlot):string;
export function groupSlots(slots:ClipSlot[]):ClipGroup[];
export function affectedRooms(before:StudioProject,after:StudioProject,rooms:Room[]):Room[];
