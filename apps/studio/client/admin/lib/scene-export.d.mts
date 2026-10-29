import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
export const SCENE_EXPORT_PATH: string;
export function sceneExportMessage(code: string|null|undefined): string;
export function sceneExportBody(input:{laneId:string;expectedRevision:string;dealer?:{videoId:string;frame:string}|null}):{laneId:string;expectedRevision:string;dealer?:{videoId:string;frame:string}};
export function captureVideoFrame(url:string,options?:{signal?:AbortSignal;maxEdge?:number}):Promise<string>;
export function exportSceneIllustration(input:{laneId:string;expectedRevision:string;video?:{id:string;previewUrl:string}|null;signal?:AbortSignal;fetchImpl?:typeof fetch;capture?:typeof captureVideoFrame}):Promise<{id:string;label:string;project:StudioProject;skipped:string[];dealer:'included'|'missing'|'none'}>;
