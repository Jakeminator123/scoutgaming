import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
export const MAX_FILMED_PROFILE_BYTES:number;
export function readFilmedProfileFile(file:Pick<File,'size'|'text'>):Promise<{derivedFrom:string;takes:{key:string;sourceTakeKey?:string}[]}>;
export function importDealerFilmedProfile(dealerId:string,expectedRevision:string,profile:unknown,options?:{fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<StudioProject>;
