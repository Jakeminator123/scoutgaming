import type {PublicOperatorRooms,PublicOperatorRoom} from '../presentation/contracts/operator-rooms-contract.mjs';
export type RoomSelection={dealer:string;tableAsset?:string;background?:string};
export function roomSelection(room:Pick<PublicOperatorRoom,'dealers'|'dealerDefault'>,preferred?:Partial<RoomSelection>):RoomSelection|null;
export function roomLaunch(catalog:PublicOperatorRooms,roomId:string,preferred:RoomSelection,options?:{directPlay?:boolean}):{choices:RoomSelection;href:string}|null;
export function rememberRoomSelection(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,operator:string,selection:RoomSelection):boolean;

export function readRoomSelection(storage:Pick<Storage,'getItem'>,operator:string):Partial<RoomSelection>;
