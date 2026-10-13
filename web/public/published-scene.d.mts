import type {CompositionSettings} from './composition-settings.mjs';
export type PublishedSceneSource = {src:string;contentType:string};
export function mountPublishedScene(canvas:HTMLCanvasElement, options:{
  dealer?:PublishedSceneSource|null;
  background?:PublishedSceneSource|null;
  table?:PublishedSceneSource|null;
  /** Static PNG alpha mask registered to the table image/video, not a luma matte. */
  tableMask?:PublishedSceneSource|null;
  layout?:'mobile'|'desktop';
  settings?:CompositionSettings|null;
  compositing?:{mode:'green-screen';threshold:number;softness:number;despill:number};
  still?:boolean;
  onReady?:()=>void;
  onFailure?:()=>void;
  onPlaying?:(playing:boolean)=>void;
}):{toggle:()=>void;close:()=>void};
