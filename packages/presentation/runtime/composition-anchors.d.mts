import type {CompositionSettings,AnchorRect,AnchorTarget,TableAnchor,BlackjackTableGeometry,BlackjackTableLayout} from '../contracts/composition-settings.mjs';
export type AnchorFrames=Record<AnchorTarget,AnchorRect>;
export function compositionAnchorFrames(settings:CompositionSettings,layout:'mobile'|'desktop',asset:{width:number;height:number}):AnchorFrames;
export function resolveAnchorRect(anchor:TableAnchor|undefined,frames:AnchorFrames):AnchorRect;
export function rebindAnchor(anchor:TableAnchor|undefined,target:AnchorTarget,frames:AnchorFrames):TableAnchor;
export function projectAnchorRects(geometry:BlackjackTableLayout,frames:AnchorFrames,viewport:{width:number;height:number}):{cardsRect:AnchorRect;betsRect:AnchorRect};
export function moveCompositionLayer(settings:CompositionSettings,layout:'mobile'|'desktop',role:'dealer'|'background'|'table',field:'x'|'y'|'scale'|'width',value:number,together?:boolean):CompositionSettings;
export function restoreGeometryGroup(current:BlackjackTableGeometry,saved:BlackjackTableGeometry,layout:'mobile'|'desktop',group:'cards'|'bets'):BlackjackTableGeometry;
