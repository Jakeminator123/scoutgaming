import type {CompositionSettings} from './composition-settings.mjs';
export type PublishedSceneSource = {src:string;contentType:string};
export function mountPublishedScene(canvas:HTMLCanvasElement, options:{
  dealer?:(PublishedSceneSource&{framing?:import('./dealer-framing.mjs').DealerFraming;variants?:Array<PublishedSceneSource&{framing?:import('./dealer-framing.mjs').DealerFraming}>;foregroundPolygons?:import('./roulette-idle-contract.mjs').RouletteForegroundPolygons})|null;
  background?:PublishedSceneSource|null;
  table?:PublishedSceneSource|null;
  /** Static PNG alpha mask registered to the table image/video, not a luma matte. */
  tableMask?:PublishedSceneSource|null;
  layout?:'mobile'|'desktop';
  settings?:CompositionSettings|null;
  compositing?:{mode:'alpha'}|{mode:'green-screen';threshold:number;softness:number;despill:number};
  still?:boolean;
  onReady?:()=>void;
  onFailure?:()=>void;
  onPlaying?:(playing:boolean)=>void;
  onDealerClip?:(clip:{src:string;variant:boolean})=>void;
}):{toggle:()=>void;setRoundActive:(active:boolean)=>void;close:()=>void};
