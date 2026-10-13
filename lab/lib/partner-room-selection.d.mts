export type PartnerRoom = {id:string;operatorId:string;status?:string;name?:string};
export type PartnerRoomSnapshot = {operator?:{id:string};tables?:PartnerRoom[]};
export function availablePartnerRooms(snapshot:PartnerRoomSnapshot):PartnerRoom[];
export function initialPartnerRoomSelection(snapshot:PartnerRoomSnapshot,requestedRoomId?:string|string[]):{roomId:string;unavailable:boolean};
