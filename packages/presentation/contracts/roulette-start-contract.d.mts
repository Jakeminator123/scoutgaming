import type {RouletteForegroundPolygons} from './roulette-idle-contract.mjs';
export type RouletteStartProfile={tableDesignId:string;durationMs:number;wheelImpulseMs:number;ballReleaseMs:number;foregroundPolygons?:RouletteForegroundPolygons};
export type RouletteStartBinding=RouletteStartProfile&{videoId:string};
export function validateRouletteStartProfile(value:unknown):RouletteStartProfile;
export function validateRouletteStartBinding(value:unknown):RouletteStartBinding;
export function validateFrozenRouletteStart<T>(value:unknown,dealerId:string,validateRecord:(value:unknown)=>T):RouletteStartProfile&{clip:T};
