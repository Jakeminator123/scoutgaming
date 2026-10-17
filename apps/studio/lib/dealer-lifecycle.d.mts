import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
export function lifecycleProject(project:StudioProject,input:{dealerId:string;archived:boolean;records:any[];now?:string}):StudioProject;
export function assertLifecyclePackages(rows:any[],input:{dealerId?:string;mediaIds?:string[]}):void;
export function changeDealerLifecycle(input:any):Promise<StudioProject>;

export function checkDealerArchive(input:any):Promise<{impact:import('./dealer-archive-impact.mjs').DealerArchiveImpact}>;
