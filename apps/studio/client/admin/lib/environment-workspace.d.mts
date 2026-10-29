import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type {Catalog} from './connected-studio.mjs';
export type EnvironmentRoom = {id:string;name:string;game:'blackjack'|'roulette';state:'live'|'paused';published:boolean;operatorId:string;operatorName:string;href:string};
export function environmentRooms(catalog:Catalog|null|undefined,laneId:string|null|undefined):EnvironmentRoom[];
export function environmentCounts(project:StudioProject|null|undefined):{miljoer:number;material:number;bakgrund:number;bordsgrafik:number;arkiverat:number};
