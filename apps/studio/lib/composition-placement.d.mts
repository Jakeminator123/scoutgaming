import type {CompositionSettings,AnchorRect} from '../../../packages/presentation/contracts/composition-settings.mjs';
export type CompositionRole='dealer'|'background'|'table';
export type CompositionLayout='mobile'|'desktop';
export type CompositionAssetSize={width:number;height:number};
export function compositionLayerRect(settings:CompositionSettings,layout:CompositionLayout,role:CompositionRole,asset?:CompositionAssetSize):AnchorRect;
export function translateCompositionLayer(settings:CompositionSettings,layout:CompositionLayout,role:CompositionRole,dx:number,dy:number,together?:boolean):CompositionSettings;
export function sizeCompositionLayer(settings:CompositionSettings,layout:CompositionLayout,role:CompositionRole,size:number,options?:{asset?:CompositionAssetSize;keepBottom?:boolean;together?:boolean}):CompositionSettings;
export function alignCompositionLayer(settings:CompositionSettings,layout:CompositionLayout,role:CompositionRole,edge:'center'|'bottom',asset?:CompositionAssetSize,together?:boolean):CompositionSettings;
export function restoreCompositionLayer(settings:CompositionSettings,saved:CompositionSettings,layout:CompositionLayout,role:CompositionRole):CompositionSettings;
