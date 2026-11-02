export type PartnerRoom = {id:string;operatorId:string;status?:string;name?:string};
export type PartnerRoomSnapshot = {operator?:{id:string};tables?:PartnerRoom[]};
export type PartnerRoomRequest = {roomId?:string|string[];scope?:string|string[]};
export function availablePartnerRooms(snapshot:PartnerRoomSnapshot):PartnerRoom[];
export function initialPartnerRoomSelection(snapshot:PartnerRoomSnapshot,requestedRoomId?:string|string[],requestedScope?:string|string[]):{roomId:string;unavailable:boolean};
export function partnerRoomRequest(search:URLSearchParams):PartnerRoomRequest;
export function partnerRoomQuery(request:PartnerRoomRequest):string;
