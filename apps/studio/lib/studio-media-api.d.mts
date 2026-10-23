import type { NativeStudioSession } from '../../../packages/studio-access/studio-native-auth.mjs';
import type { NativeStudioConfiguration } from './studio-native-runtime.mjs';
import type { VideoRegistry } from '../../../packages/studio-registry/server/registry-core.mjs';
import type { StudioUploads } from './studio-upload-service.mjs';
export function createStudioMediaApi(options: {
  repository?: any; authorize(request: Request): Promise<NativeStudioSession>;
  config: NativeStudioConfiguration; videoRegistry?(): Promise<VideoRegistry>;
  videoResponse?(id: string, request: Request): Promise<Response>;
  uploads?: StudioUploads;
  mediaDeletion?: {check(body:any):Promise<any>;remove(body:any,context:any):Promise<any>};
  mutationTransaction?<T>(work: () => Promise<T>): Promise<T>;
}): {handle(request: Request): Promise<Response>};
export function handleNativeStudioMedia(request: Request): Promise<Response>;
