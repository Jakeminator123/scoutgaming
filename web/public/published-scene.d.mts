import type {CompositionSettings} from './composition-settings.mjs';
export type PublishedSceneSource = {src:string;contentType:string};
export function mountPublishedScene(canvas:HTMLCanvasElement, options:{
  dealer:PublishedSceneSource;
  background?:PublishedSceneSource|null;
  table?:PublishedSceneSource|null;
  settings?:CompositionSettings|null;
  compositing?:{mode:'green-screen';threshold:number;softness:number;despill:number};
  still?:boolean;
  onReady?:()=>void;
  onFailure?:()=>void;
  onPlaying?:(playing:boolean)=>void;
}):{toggle:()=>void;close:()=>void};
