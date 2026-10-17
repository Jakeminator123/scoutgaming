import type {VideoRegistry,VideoRegistryOptions} from '../../packages/studio-registry/server/registry-core.mjs';
export type {VideoRegistry,VideoRegistryOptions,RegistryVideo,MediaFamily} from '../../packages/studio-registry/server/registry-core.mjs';
export function loadVideoRegistry(options?: VideoRegistryOptions): Promise<VideoRegistry>;
export function rescanVideoRegistry(): Promise<VideoRegistry>;
export function getVideoResponse(id: string, request: Request, options?: VideoRegistryOptions): Promise<Response>;
export function getLabVideoResponse(id: string, request: Request, options?: VideoRegistryOptions): Promise<Response>;
