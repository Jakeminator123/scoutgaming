export function createStudioPublicMediaAvailability(options?: { env?: Record<string,string | undefined>; repositoryRoot?: string }): (file: string) => Promise<boolean>;
export function createStudioMediaRuntime(options: { repository: any; scope: {environment: string; workspaceId: string}; env?: Record<string,string | undefined>; repositoryRoot?: string }): {
  videoRegistry(): Promise<any>; videoResponse(id: string, request: Request): Promise<Response>;
  legacyControls(project: any): Promise<any>; validateProjectBindings(project: any): Promise<void>;
};
