export class SceneExportError extends Error { code: string }
export function validateSceneExportRequest(body: unknown): {laneId:string;expectedRevision:string;dealer:{videoId:string;contentType:string;bytes:Buffer}|null};
export function illustrationLabel(laneLabel: string, project: import('../../../packages/presentation/contracts/studio-model.mjs').StudioProject): string;
export function withExportedIllustration(project: import('../../../packages/presentation/contracts/studio-model.mjs').StudioProject, laneLabel: string, record: Record<string, unknown>, now?: string, options?: {archive?: boolean}): import('../../../packages/presentation/contracts/studio-model.mjs').StudioProject;
export function createSceneExportApi(options: Record<string, unknown>): {path:string;handle(request: Request): Promise<Response>};
export function handleSceneExportRequest(request: Request): Promise<Response>;
