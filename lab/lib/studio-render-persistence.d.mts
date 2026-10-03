export interface StudioReadPersistence {
  projectStore: {load(): Promise<any>; save(...args: any[]): Promise<never>};
  socialStore: {load(): Promise<any>; save(...args: any[]): Promise<never>};
  videoRegistry(): Promise<any>;
  videoResponse(id: string, request: Request): Promise<Response>;
  legacyControls(project: any): Promise<any>;
  validateProjectBindings(project: any): Promise<void>;
  configurationSource: 'neon/croupier_studio';
  scope: Readonly<{environment: string; workspaceId: string}>;
}
export function renderStudioPolicyEnabled(env?: Record<string,string | undefined>): boolean;
export function assertRenderStudioWritable(env?: Record<string,string | undefined>): void;
export function createStudioRenderPersistence(options?: any): Promise<StudioReadPersistence | null>;
export function studioRenderPersistence(): Promise<StudioReadPersistence | null>;
