import type { Workspace } from './connected-studio.mjs';
export type SystemContext = { operator?:string; table?:string; composition?:string; dealer?:string };
export type SystemOverviewData = {
  context: SystemContext;
  games: {kind:string;name:string;rooms:number;playable:number}[];
  counts: {operators:number;rooms:number;gameTypes:number;dealers:number;compositions:number;published:number;playable:number};
};
export function systemOverview(workspace:Workspace,search?:string):SystemOverviewData;
export function systemHref(path:string,context:SystemContext):string;
