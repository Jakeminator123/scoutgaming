import type {PublicOperatorRooms,PublicOperatorRoom} from '../../../packages/presentation/contracts/operator-rooms-contract.mjs';
import type {PublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
export type RoomPreviewResult={status:'ready';preview:PublicOperatorPreview}|{status:'unavailable'|'changed'};
export function dealerPortrait(id:string):string|null;
export function loadRoomPreview(catalog:PublicOperatorRooms,room:PublicOperatorRoom,dealerId:string,options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<RoomPreviewResult>;
