import type {StudioProject} from './studio-model.mjs';
import type {VideoMetadata} from './video-intake.mjs';
import type {VideoInventory,VideoEntry} from '../components/studio-types';
export const DEALER_MEDIA_CATEGORIES: ReadonlyArray<{id:string;label:string}>;
export interface DealerMediaSlot {id:string;eventId:string;situation:string;category:string;label:string}
export function dealerMediaSlots(project:StudioProject,category?:string):DealerMediaSlot[];
export function mediaClassification(project:StudioProject,input:{dealerId:string;slotId:string;label:string;contentType:string}):VideoMetadata;
export function dealerLibraryVideos(project:StudioProject,inventory:VideoInventory,dealerId:string,category?:string,archived?:boolean):VideoEntry[];
export function draftUsesMedia(project:StudioProject,id:string):boolean;
