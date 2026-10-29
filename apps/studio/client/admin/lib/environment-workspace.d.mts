import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type {Catalog} from './connected-studio.mjs';
export type EnvironmentRoom = {id:string;name:string;game:'blackjack'|'roulette';state:'live'|'paused';published:boolean;operatorId:string;operatorName:string;href:string};
export function environmentRooms(catalog:Catalog|null|undefined,laneId:string|null|undefined):EnvironmentRoom[];
export function environmentCounts(project:StudioProject|null|undefined):{miljoer:number;material:number;bakgrund:number;bordsgrafik:number;arkiverat:number};
export type EnvironmentRoomContext = {operatorId:string;operatorSlug:string;operatorName:string;room:{id:string;name:string;compositionId:string;game:'blackjack'|'roulette'}|null;sameEnvironment:boolean;choicesHref:string|null;query:Record<string,string>};
export function environmentRoomContext(catalog:Catalog|null|undefined,laneId:string,context?:{operator?:string|null;table?:string|null}):EnvironmentRoomContext|null;
export const UPLOAD_NAVIGATION_MESSAGE:string;
export function holdNavigationDuringUpload(target:Pick<EventTarget,'addEventListener'|'removeEventListener'>,onBlocked?:(message:string)=>void):()=>void;
