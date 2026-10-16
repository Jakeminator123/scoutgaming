import type {PresentationSnapshot} from '../../web/storage/frozen-presentation-capture.mjs';
import type {FrozenMediaPrecondition} from '../../web/storage/frozen-dealer-idle.mjs';
export function createStudioPublicMediaAvailability(options?: { env?: Record<string,string | undefined>; repositoryRoot?: string; repository?:any; runtimeCatalog?:any }): (file: string) => Promise<boolean>;
export function createStudioMediaRuntime(options: { repository: any; scope: {environment: string; workspaceId: string}; env?: Record<string,string | undefined>; repositoryRoot?: string }): {
  videoRegistry(): Promise<any>; videoResponse(id: string, request: Request): Promise<Response>;
  videoRegistryCaptured(snapshot:PresentationSnapshot):Promise<any>;
  videoResponseCaptured(id:string, request:Request, snapshot:PresentationSnapshot):Promise<Response>;
  verifyCapturedMedia(preconditions:readonly FrozenMediaPrecondition[]):Promise<void>;
  publicMediaResponse(pathname:string, request:Request):Promise<Response|null>;
  readMetadata(relativePublicPath:string):Promise<any|null>; hasPublicMedia(relativePublicPath:string):Promise<boolean>;
  legacyControls(project: any): Promise<any>; validateProjectBindings(project: any): Promise<void>;
};
