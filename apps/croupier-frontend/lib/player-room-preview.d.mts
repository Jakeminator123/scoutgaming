import type {PublicOperatorRooms,PublicOperatorRoom} from '../../../web/public/operator-rooms-contract.mjs';
import type {PublicOperatorPreview} from '../../../web/public/operator-preview-contract.mjs';
export type RoomPreviewResult={status:'ready';preview:PublicOperatorPreview}|{status:'unavailable'|'changed'};
export function dealerPortrait(id:string):string|null;
export function loadRoomPreview(catalog:PublicOperatorRooms,room:PublicOperatorRoom,dealerId:string,options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<RoomPreviewResult>;
