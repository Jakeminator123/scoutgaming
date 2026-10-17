import type {CompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
export type PublishedSceneSource = {src:string;contentType:string};
export function mountPublishedScene(canvas:HTMLCanvasElement, options:{
  dealer?:(PublishedSceneSource&{framing?:import('../../../packages/presentation/contracts/dealer-framing.mjs').DealerFraming;variants?:Array<PublishedSceneSource&{framing?:import('../../../packages/presentation/contracts/dealer-framing.mjs').DealerFraming}>;foregroundPolygons?:import('../../../packages/presentation/contracts/roulette-idle-contract.mjs').RouletteForegroundPolygons;wheelStart?:import('../../../packages/presentation/contracts/operator-preview-contract.mjs').PublicPreviewDealerClip&import('../../../packages/presentation/contracts/roulette-start-contract.mjs').RouletteStartProfile})|null;
  background?:PublishedSceneSource|null;
  table?:PublishedSceneSource|null;
  /** Static PNG alpha mask registered to the table image/video, not a luma matte. */
  tableMask?:PublishedSceneSource|null;
  /** Game graphics in the table's pixel coordinates, below the dealer hands. */
  tableOverlay?:null|(()=>HTMLCanvasElement|null|undefined);
  layout?:'mobile'|'desktop';
  settings?:CompositionSettings|null;
  compositing?:{mode:'alpha'}|{mode:'green-screen';threshold:number;softness:number;despill:number};
  still?:boolean;
  onReady?:()=>void;
  onFailure?:()=>void;
  onPlaying?:(playing:boolean)=>void;
  onDealerClip?:(clip:{src:string;variant:boolean})=>void;
}):{toggle:()=>void;refresh:()=>void;playWheelStart:(options?:{onFrame?:(timeMs:number)=>void})=>Promise<boolean>;setRoundActive:(active:boolean)=>void;close:()=>void};
