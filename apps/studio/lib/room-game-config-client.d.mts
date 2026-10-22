export type RoomGameConfig={language:'en'|'sv';limitPreset:'casual'|'prive'|'high'};
export type RoomGameContext={operatorId:string;roomId:string};
export type RoomGameReceipt={ok:true;operatorId:string;roomId:string;administrationRevision:string;packageRevision:number;draft:null|{revision:string;gameConfig:RoomGameConfig};published:null|{configVersion:string;packageRevision:number;gameConfig:RoomGameConfig;betMs:20000;actionMs:15000};publication:{ready:boolean;reason?:string}};
export const ROOM_GAME_DEFAULTS:Readonly<RoomGameConfig>;
export function validRoomGameConfig(value:unknown):value is RoomGameConfig;
export class RoomGameConfigError extends Error{status:number;constructor(message:string,status?:number);}
export function createRoomGameConfigClient(options?:{fetchImpl?:typeof fetch}):{
read(context:RoomGameContext,options?:{signal?:AbortSignal}):Promise<RoomGameReceipt>;
save(context:RoomGameContext,previous:RoomGameReceipt,fields:RoomGameConfig,options?:{signal?:AbortSignal}):Promise<RoomGameReceipt>;
publish(context:RoomGameContext,previous:RoomGameReceipt,options?:{signal?:AbortSignal}):Promise<RoomGameReceipt>;
};
export function createRoomGameConfigController(options?:{client?:ReturnType<typeof createRoomGameConfigClient>}):{
getSnapshot():{context:RoomGameContext|null;receipt:RoomGameReceipt|null;fields:RoomGameConfig;busy:boolean;stale:boolean;error:string;message:string};
subscribe(fn:()=>void):()=>void;configure(context:RoomGameContext):Promise<RoomGameReceipt|null>;cancel():void;edit(field:keyof RoomGameConfig,value:string):void;refresh():Promise<RoomGameReceipt|null>;dirty():boolean;save():Promise<RoomGameReceipt|null>;publish():Promise<RoomGameReceipt|null>;
};
