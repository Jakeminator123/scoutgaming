import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import type {VideoMetadata} from '../../../packages/presentation/contracts/video-intake.mjs';
import type { VideoInventory, VideoEntry } from '../../../packages/presentation/contracts/media-inventory.mjs';
export const DEALER_MEDIA_CATEGORIES: ReadonlyArray<{id:string;label:string}>;
export interface DealerMediaSlot {id:string;eventId:string;situation:string;category:string;label:string}
export function dealerMediaSlots(project:StudioProject,category?:string):DealerMediaSlot[];
export function blackjackMediaSlots(project:StudioProject,category?:string):DealerMediaSlot[];
export function mediaClassification(project:StudioProject,input:{dealerId:string;slotId:string;label:string;contentType:string}):VideoMetadata;
export function dealerLibraryVideos(project:StudioProject,inventory:VideoInventory,dealerId:string,category?:string,archived?:boolean):VideoEntry[];
export function draftUsesMedia(project:StudioProject,id:string):boolean;


export function mediaMatchesSlot(video:VideoEntry,slot:DealerMediaSlot):boolean;
export function mediaUsage(project:StudioProject,video:VideoEntry,dealerId:string):string;
export function dealerSlotStatus(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:DealerMediaSlot):{level:'ready'|'required'|'recommended'|'optional';label:string;count:number};
export function mediaPage<T>(items:T[],requested?:number,size?:number):{items:T[];page:number;pages:number;total:number};
