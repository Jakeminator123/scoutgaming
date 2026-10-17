import type {LayerAsset, StudioLane, StudioProject} from '../packages/presentation/contracts/studio-model.mjs';
export const LAYER_ASSET_TYPES: Readonly<Record<string,string>>;
export const MAX_LAYER_ASSET_BYTES: number;
export const LAYER_ASSET_ROLES: readonly ['background','table'];
import type {StudioMediaRecord} from '../packages/studio-registry/server/managed-media-contract.mjs';
export interface FrozenRegisteredDealer {id:string; label:string; idle:StudioMediaRecord|null;rouletteIdle?:{base:StudioMediaRecord;variants:StudioMediaRecord[];foregroundPolygons?:import('../packages/presentation/contracts/roulette-idle-contract.mjs').RouletteForegroundPolygons};rouletteStart?:import('../packages/presentation/contracts/roulette-start-contract.mjs').RouletteStartProfile&{clip:StudioMediaRecord}}
export interface LegacyPresentationPackage {schemaVersion:1; projectRevision:string; lanes:StudioLane[]; assets:LayerAsset[]}
export interface FrozenPresentationPackage {schemaVersion:2; projectRevision:string; lanes:StudioLane[]; assets:LayerAsset[]; registeredDealers:FrozenRegisteredDealer[]}
export interface FrozenDealerPlayback {dealerIdlePolicies?:StudioProject['dealerIdlePolicies']; lines:StudioProject['lines']; triggers:StudioProject['triggers']; assets:StudioProject['assets']; media:StudioMediaRecord[]}
export interface EventPresentationPackage {schemaVersion:3; projectRevision:string; lanes:StudioLane[]; assets:LayerAsset[]; registeredDealers:FrozenRegisteredDealer[]; playback:FrozenDealerPlayback}
export type PresentationPackage = LegacyPresentationPackage|FrozenPresentationPackage|EventPresentationPackage;
export function validateFrozenRegisteredDealers(value:unknown, options:{dealerIds:readonly string[]}):FrozenRegisteredDealer[];
export function layerAssetPath(asset: Partial<LayerAsset>): string;
export function validateLayerAsset(value: unknown): LayerAsset;
export function validatePresentationLane(value: unknown, options?:{dealerIds?:readonly string[]}): StudioLane;
export function validatePresentationPackage(value: unknown): PresentationPackage;
export function buildPresentationPackage(project: StudioProject, ids: string[], library: LayerAsset[], options?:{registeredDealers?:readonly FrozenRegisteredDealer[]; playback?:FrozenDealerPlayback}): PresentationPackage;
