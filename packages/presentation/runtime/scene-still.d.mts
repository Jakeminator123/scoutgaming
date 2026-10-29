import type {CompositionSettings} from '../contracts/composition-settings.mjs';
export type StillRect = [number, number, number, number];
export type StillLayer = {role:'background'|'table'|'dealer'; rect:StillRect};
export const SCENE_STILL_SIZE: Readonly<{width:1920;height:1080}>;
export function desktopSceneStill(input?:{composition?:CompositionSettings|null;background?:{width:number;height:number}|null;table?:{width:number;height:number}|null;dealer?:boolean}):{width:number;height:number;layers:StillLayer[]};
export function stillRectPercent(rect:StillRect, frame?:{width:number;height:number}):{left:number;top:number;width:number;height:number};
