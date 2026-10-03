import type { VideoRegistry, VideoRegistryOptions } from './video-registry.mjs';
export function createNeonVideoRegistry(options: {
  repository: {scope: Readonly<{environment: string; workspaceId: string}>; listMedia(options: {limit: number}): Promise<any[]>};
  scope: Readonly<{environment: string; workspaceId: string}>;
  env?: Record<string,string | undefined>; options?: VideoRegistryOptions;
}): {load(): Promise<VideoRegistry>; response(id: string, request: Request): Promise<Response>};
