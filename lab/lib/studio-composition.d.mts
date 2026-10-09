import type {StudioProject} from './studio-model.mjs';
import type {VideoCompositing} from '../components/composition-preview';
import type {put} from '@vercel/blob/client';
import type {PutBlobResult} from '@vercel/blob';
type Role='dealer'|'table'|'background';
type LayerUploadResponse={id:string;project?:StudioProject;pathname?:string;clientToken?:string;ticket?:string};
export function compositionPreviewLayers(show:Record<Role,boolean>,compositing?:VideoCompositing,hasDealer?:boolean):Record<Role,boolean>;
export function registerCompositionLayer(base:StudioProject,draft:StudioProject,remote:StudioProject,selection:{id:string;role:'background'|'table';laneId:string}):{project:StudioProject;conflicts:string[]};
export function uploadCompositionLayer(file:File,metadata:{role:'background'|'table';label:string;width:number;height:number},dependencies:{post:(body:unknown,signal:AbortSignal)=>Promise<LayerUploadResponse>;put:(pathname:string,file:File,options:Parameters<typeof put>[2])=>Promise<Pick<PutBlobResult,'pathname'>>;signal:AbortSignal;onUploadProgress?:(event:{percentage:number})=>void;onCommit?:()=>void}):Promise<{id:string;project:StudioProject}>;
