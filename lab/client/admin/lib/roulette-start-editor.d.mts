import type {StudioProject,StudioLane} from '../../../../packages/presentation/contracts/studio-model.mjs';
import type {VideoInventory} from './connected-studio.mjs';
export type RouletteStartForm={videoId:string;tableDesignId:string;durationMs:string;wheelImpulseMs:string;ballReleaseMs:string;foregroundPolygons:string};
export function rouletteStartTables(project:StudioProject,laneId:string):{assetId:string;designId:string;label:string}[];
export function rouletteStartCompositions(project:StudioProject,dealerId:string):StudioLane[];
export function rouletteStartForm(project:StudioProject,dealerId:string,videoId?:string):RouletteStartForm;
export function bindRouletteStart(project:StudioProject,inventory:VideoInventory,dealerId:string,laneId:string,form:RouletteStartForm):StudioProject;
export function removeRouletteStart(project:StudioProject,dealerId:string):StudioProject;
