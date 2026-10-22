export function createSharedTableProofReadout(options: { repository: any; scope: {environment: string; workspaceId: string} }): { handlers: Map<string, (context: any) => Promise<any>> };
