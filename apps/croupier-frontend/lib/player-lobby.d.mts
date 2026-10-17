import type {PublicOperatorRooms,PublicOperatorRoom} from '../../../web/public/operator-rooms-contract.mjs';
export type RoomSelection={dealer:string;tableAsset?:string;background?:string};
export function roomSelection(room:PublicOperatorRoom,preferred?:Partial<RoomSelection>):RoomSelection|null;
export function roomLaunch(catalog:PublicOperatorRooms,roomId:string,preferred:RoomSelection,options?:{directPlay?:boolean}):{choices:RoomSelection;href:string}|null;
export function rememberRoomSelection(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,operator:string,selection:RoomSelection):boolean;

export function demoLobbyPath(params?:Record<string,string|string[]|undefined>):string;
