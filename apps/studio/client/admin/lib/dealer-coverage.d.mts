import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type {Catalog,VideoInventory,Workspace} from './connected-studio.mjs';
export type Coverage={bound:number;total:number};
export type DealerCoverage={deal:Coverage;speech:Coverage;idle:Coverage;optional:Coverage;complete:boolean;anyClip:boolean;speechProfile:unknown|null};
export function dealerCoverage(project:StudioProject,inventory:VideoInventory,dealerId:string):DealerCoverage;
export function dealerTemplates(project:StudioProject,dealerId:string):{id:string;label:string;isDefault:boolean}[];
export function dealerUses(catalog:Catalog,dealerId:string):{rooms:Catalog['administration']['rooms'];operators:Catalog['administration']['operators']};
export function adminMenuCounts(workspace:Partial<Workspace>|null):Record<string,number>;
export function dealerStill(project:StudioProject,inventory:VideoInventory,dealerId:string):{url:string;image:boolean;label:string}|null;
