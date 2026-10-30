import type {Workspace} from './connected-studio.mjs';
export type ResourceKind='operator'|'room'|'composition'|'dealer'|'media'|'material'|'project';
export type ResourceRef={kind:ResourceKind;id:string;label:string;relation:string};
export type MissingResourceReference={kind:ResourceKind;id:string;label:string;uses:ResourceRef[]};
export type ResourceNode={id:string;label:string;archived:boolean;missing:boolean;publishedOnly:boolean;uses:ResourceRef[]};
export type DeletionOperator=ResourceNode&{status:string;roomIds:string[]};
export type DeletionRoom=ResourceNode&{operatorId:string;game:string|null;compositionId:string|null;published:boolean;playable:boolean;state:string;publishedDealerIds:string[];publication:PublishedRoomChoices|null;choicesPath:string|null};
export type PublishedLayer={enabled:boolean;defaultId:string|null;allowed:{id:string;label:string}[];mode?:string};
export type PublishedRoomChoices={packageRevision:number;dealerDefault:string;dealers:{id:string;label:string;independentLayers:boolean;background:PublishedLayer;table:PublishedLayer}[]};
export type DeletionLayer={enabled:boolean;defaultId:string|null;ids:string[]};
export type DeletionComposition=ResourceNode&{layers:Record<'background'|'dealer'|'table',DeletionLayer>|null;publishedTo:ResourceRef[]|null;historicalPackageReferences:number|null};
export type DeletionDealer=ResourceNode&{mediaIds:string[]};
export type DeletionMaterial=ResourceNode&{role:'background'|'table'|'illustration';game:string|null;contentType:string|null};
export type DeletionMedia=ResourceNode&{kind:'video'|'image'|'audio';ownerIds:string[];primaryOwnerId:string|null;eventId:string;situation:string;game:string|null;available:boolean};
export type ResourceDeletionTree={
  readAt:string;projectRevision:string;lifecycleAvailable:boolean;historyCoverage:'complete'|'incomplete'|'unavailable';warnings:string[];missingReferences:MissingResourceReference[];
  operators:DeletionOperator[];rooms:DeletionRoom[];compositions:DeletionComposition[];
  dealers:DeletionDealer[];materials:DeletionMaterial[];media:DeletionMedia[];
  unownedRoomIds:string[];coverage:string[];
};
export function resourceAnchor(kind:ResourceKind,id:string):string;
export function buildResourceDeletionTree(workspace:Workspace,lifecycle?:unknown):ResourceDeletionTree;
export function createResourceDeletionClient(options?:{
  workspaceClient?:{load:(signal?:AbortSignal)=>Promise<Workspace>};fetchImpl?:typeof fetch;
}):{load:(signal?:AbortSignal)=>Promise<ResourceDeletionTree>};
