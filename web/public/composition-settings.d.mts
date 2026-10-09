export interface CompositionPlane {scale:number; x:number; y:number}
export interface CompositionTable {width:number; x:number; y:number}
export interface CompositionSettings {
  mobile:{dealer:CompositionPlane; background:CompositionPlane; table:CompositionTable};
  desktop:{dealer:CompositionPlane; background:CompositionPlane; table:CompositionTable};
  tableFront:boolean;
}
export function defaultCompositionSettings():CompositionSettings;
export function validateCompositionSettings(value:unknown):CompositionSettings;
export function sceneForComposition(settings:CompositionSettings, layout:'mobile'|'desktop',
  show?:Partial<Record<'background'|'dealer'|'table'|'cards'|'foreground'|'overlay',boolean>>,
  key?:{enabled?:boolean; mode?:string; threshold?:number; softness?:number; despill?:number}):Record<string,unknown>;
