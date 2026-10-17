export type MaterialSource={kind:'image'|'video';contentType:string;sha256:string;size:number;width:number;height:number;hasAlpha?:boolean};
export type Material={id:string;role:'table'|'background';game:'blackjack'|'roulette'|'poker'|null;label:string;sources:readonly MaterialSource[]};
export const MATERIAL_CATALOG_VERSION:1;
export const MATERIALS:readonly Material[];
export function materialById(id:string):Material|null;
export function materialSource(materialId:string,kind?:'image'|'video'):MaterialSource|null;
export function materialForAsset(asset:{role:string;sha256:string;size:number;contentType:string;width:number;height:number}|null|undefined):Material|null;
export function materialLabel<T extends {label:string;role:string;sha256:string;size:number;contentType:string;width:number;height:number}>(asset:T):string;
export function materialFitsGame(asset:Parameters<typeof materialForAsset>[0],game:string):boolean;
