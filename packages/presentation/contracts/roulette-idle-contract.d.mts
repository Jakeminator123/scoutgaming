export type RouletteForegroundPolygons = Array<Array<[number, number]>>;
export type RouletteIdleBinding = {videoId:string; variantVideoIds?:string[]; foregroundPolygons?:RouletteForegroundPolygons};
export function validateRouletteIdleBinding(value:unknown):RouletteIdleBinding;
export function validateRouletteForegroundPolygons(value:unknown):RouletteForegroundPolygons;
export function assertRouletteIdleRecord<T>(record:T,dealerId:string,action?:string):T;
export function validateFrozenRouletteIdle<T>(value:unknown,dealerId:string,validateRecord:(value:unknown)=>T):{base:T;variants:T[];foregroundPolygons?:RouletteForegroundPolygons};
