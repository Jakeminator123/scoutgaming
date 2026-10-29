import type { StudioProject, StudioEvent } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type { VideoMetadata } from '../../../../../packages/presentation/contracts/video-intake.mjs';
export type VideoEntry = {id:string;label:string;available:boolean;integrity:string;previewUrl:string;contentType?:string;classification?:VideoMetadata;familyId?:string;duration?:number;sha256?:string};
export type MediaFamily = {id:string;dealerId:string;eventId:string;situation:string;playbackType:string;standardIds:string[];variantIds:string[]};
export type VideoInventory = {videos:VideoEntry[];families?:MediaFamily[]};
// The registered catalog (apps/studio/lib/design-preview-catalog.mjs): rooms carry their published state, dealers and play URL.
export type Room = { id:string; name:string; operatorId:string; game:string; compositionId:string; laneId:string; state:string; published:boolean; playable:boolean; dealerIds:string[]; dealers:{id:string;name:string}[]; dealerSource:'published'|'saved'; playUrl:string|null; materialWarning?:'catalog_game_material_mismatch';
  /** The published scene when the catalog can describe it (image only for a fixed image background). */
  environment?:{kind:string;fixed:boolean;label:string;image?:string}|null;
  /** Bet profile in the room's saved game settings (draft); for the room picture only, never shown as a key. */
  savedLimitPreset?:string;
  /** A published blackjack room whose package binds no game settings: no seat can be taken (shown as "förbereds" when open). */
  settingsMissing?:true };
export type Catalog = { source:'registered'; readAt:string; administration:{ revisions:{project:string;administration:string}; operators:{id:string;name:string;slug:string;status:string;archivedAt:string|null;packageRevision:number|null;
    /** Bolag › Tilldelat (partner-assignment.mjs adminAssignmentView); null utan fryst presentation. */
    assignment?:import('../components/studio/assignment-field').AssignmentView|null}[]; rooms:Room[]; dealers:{id:string;name:string;archived:boolean}[]; compositions:{id:string;name:string;dealerIds:string[];defaultDealerId:string}[] } };
export type ClipSlot = { id:string; eventId:string; situation:string; title:string; description:string; sourceType:StudioEvent['sourceType']; family:MediaFamily|null; game?:'roulette'; intakeOnly?:boolean; planned?:boolean; localOnly?:boolean };
export function clipSlots(project:StudioProject,inventory:VideoInventory,dealerId:string,game?:'blackjack'|'roulette'):ClipSlot[];
export function clipsForSlot(inventory:VideoInventory,dealerId:string,slot:ClipSlot):VideoEntry[];
export function currentClipId(project:StudioProject,dealerId:string,slot:ClipSlot,variantId?:string,inventory?:VideoInventory):string;
export function configuredClipIds(project:StudioProject,dealerId:string,slot:ClipSlot,variantId?:string,inventory?:VideoInventory):string[];
export function bindNativeFilmedBank(project:StudioProject,inventory:VideoInventory,dealerId:string):StudioProject;
export function bindClip(project:StudioProject,inventory:VideoInventory,dealerId:string,slot:ClipSlot,videoId:string,options?:{variantId?:string;durationMs?:number;asAlternative?:boolean}):StudioProject;
export function roomChoicesPath(operator:Catalog['administration']['operators'][number]|undefined,room:Room|undefined):string|null;
export function navigationKeepsStudioTab(event:Pick<MouseEvent,'button'|'metaKey'|'ctrlKey'|'shiftKey'|'altKey'>,anchor:Pick<HTMLAnchorElement,'target'|'hasAttribute'>):boolean;
export type CompositionUse = {roomId:string;roomName:string;operatorName:string};
export function compositionUses(catalog:Catalog,compositionId?:string):CompositionUse[];
export function uploadMetadata(project:StudioProject,dealerId:string,slot:ClipSlot,file:File,compositing:VideoMetadata['compositing']):VideoMetadata;
export type Workspace = {catalog:Catalog;project:StudioProject;inventory:VideoInventory};
export function createStudioClient(options?:{fetchImpl?:typeof fetch;uploadImpl?:typeof import('../../../lib/upload-native-video.mjs').uploadNativeVideo}):{
  load(signal?:AbortSignal):Promise<Workspace>;
  save(project:StudioProject,signal?:AbortSignal):Promise<StudioProject>;
  upload(file:File,metadata:VideoMetadata,signal?:AbortSignal):Promise<{inventory:VideoInventory;video:VideoEntry}>;
};
