export interface StudioUploads {
  prepare(body: any,context: {actor: string}): Promise<{id:string;pathname:string;clientToken:string;ticket:string;expiresAt:number}>;
  commit(body: any,context: {actor:string;request:Request;stillAuthorized():Promise<boolean>;mutationTransaction<T>(work: () => Promise<T>):Promise<T>}): Promise<{id:string;duplicate:boolean}>;
}
export function createStudioUploadService(options: {
  repository:any;scope:Readonly<{environment:string;workspaceId:string}>;ticketKey:Uint8Array;
  env?:Record<string,string | undefined>;options?:any;clientToken?:(args:any) => Promise<string>;
  privateMedia?:(storage:any,request:Request,options:any) => Promise<Response>;now?:() => number;
}): StudioUploads;
