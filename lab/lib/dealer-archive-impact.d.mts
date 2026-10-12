import type {StudioProject} from './studio-model.mjs';
export type DealerArchiveImpact = {token:string;dealerId:string;mediaCount:number;speechEnabled:boolean;compositions:{id:string;label:string}[];rooms:{id:string;name:string;operatorId:string|null}[];operators:{id:string;name:string}[]};
export function dealerArchiveCompositionIds(project:StudioProject,dealerId:string,records?:any[]):string[];
export function withoutPresentationLanes(presentation:any,removedIds:string[]):any;
export function readDealerArchiveImpact(input:any):Promise<{impact:DealerArchiveImpact;projectDocument:any;records:any[];administrationDocument:any;administration:any;packageChanges:any[]}>;
export function applyDealerArchiveImpact(input:any):Promise<DealerArchiveImpact>;
