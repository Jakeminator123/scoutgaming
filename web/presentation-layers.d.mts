import type {LayerAsset, StudioLane, StudioProject} from '../lab/lib/studio-model.mjs';
export const LAYER_ASSET_TYPES: Readonly<Record<string,string>>;
export const MAX_LAYER_ASSET_BYTES: number;
export const LAYER_ASSET_ROLES: readonly ['background','table'];
export interface PresentationPackage {schemaVersion:1; projectRevision:string; lanes:StudioLane[]; assets:LayerAsset[]}
export function layerAssetPath(asset: Partial<LayerAsset>): string;
export function validateLayerAsset(value: unknown): LayerAsset;
export function validatePresentationLane(value: unknown): StudioLane;
export function validatePresentationPackage(value: unknown): PresentationPackage;
export function buildPresentationPackage(project: StudioProject, ids: string[], library: LayerAsset[]): PresentationPackage;
