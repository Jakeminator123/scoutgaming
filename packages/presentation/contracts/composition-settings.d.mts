export interface CompositionPlane {scale:number; x:number; y:number}
export interface CompositionTable {width:number; x:number; y:number}
export interface TablePoint {x:number; y:number}
export interface AnchorRect {x:number;y:number;width:number;height:number}
export type AnchorTarget='table'|'dealer'|'scene';
export interface TableAnchor {target:AnchorTarget;rect:AnchorRect}
export interface BlackjackTableLayout {cardWidth:number; dealer:TablePoint; seats:Array<{card:TablePoint; bet:TablePoint}>; betMode?:'under-cards';anchors?:{cards?:TableAnchor;bets?:TableAnchor}}
export interface BlackjackTableGeometry {tableId:string; mobile:BlackjackTableLayout; desktop:BlackjackTableLayout}
export interface CompositionSettings {
  mobile:{dealer:CompositionPlane; background:CompositionPlane; table:CompositionTable};
  desktop:{dealer:CompositionPlane; background:CompositionPlane; table:CompositionTable};
  tableFront:boolean;
  blackjackTables?:BlackjackTableGeometry[];
}
export function defaultBlackjackTableGeometry(tableId:string):BlackjackTableGeometry;
export function defaultCompositionSettings():CompositionSettings;
export function validateCompositionSettings(value:unknown,context?:{tableIds?:string[];assets?:Array<{id:string;role:string;game?:string}>}):CompositionSettings;
export function retainBlackjackTableGeometry(settings:CompositionSettings|undefined,tableIds:string[]):void;
export function sceneForComposition(settings:CompositionSettings, layout:'mobile'|'desktop',
  show?:Partial<Record<'background'|'dealer'|'table'|'cards'|'foreground'|'overlay',boolean>>,
  key?:{enabled?:boolean; mode?:string; threshold?:number; softness?:number; despill?:number}):Record<string,unknown>;
