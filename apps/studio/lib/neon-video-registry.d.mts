import type {PresentationSnapshot} from '../../../packages/presentation/server/frozen-presentation-capture.mjs';
import type {FrozenMediaPrecondition} from '../../../packages/presentation/server/frozen-dealer-idle.mjs';
import type { VideoRegistry, VideoRegistryOptions } from '../../../packages/studio-registry/server/registry-core.mjs';
export function createNeonVideoRegistry(options: {
  repository: {scope: Readonly<{environment: string; workspaceId: string}>; listMedia(options: {limit: number}): Promise<any[]>; readRuntimeCatalog?(): Promise<{revision:string; value:NonNullable<VideoRegistryOptions['runtimeCatalog']>}>};
  scope: Readonly<{environment: string; workspaceId: string}>;
  env?: Record<string,string | undefined>; options?: VideoRegistryOptions;
}): {load(): Promise<VideoRegistry>; loadCaptured(snapshot:PresentationSnapshot):Promise<VideoRegistry>; verifyCapturedMedia(preconditions:readonly FrozenMediaPrecondition[]):Promise<void>; response(id: string, request: Request): Promise<Response>; responseCaptured(id:string, request:Request, snapshot:PresentationSnapshot):Promise<Response>};
