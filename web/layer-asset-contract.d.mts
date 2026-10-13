import type {LayerAsset} from '../lab/lib/studio-model.mjs';
export const LAYER_ASSET_ROLES: readonly ['background','table'];
export const LAYER_ASSET_TYPES: Readonly<Record<string,string>>;
export const MAX_LAYER_ASSET_BYTES: number;
export function layerAssetPath(asset:Partial<LayerAsset>):string;
export function validateLayerAsset(value:unknown):LayerAsset;
export function layerAssetFitsGame(asset:LayerAsset|undefined,game?:string):boolean;
