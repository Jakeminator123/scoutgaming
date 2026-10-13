export type NativeStudioSession = Readonly<{
  user: string; role: 'admin';
  scope: Readonly<{environment: string; workspaceId: string}>;
}>;
export class NativeStudioAuthError extends Error { code: string; statusCode: number; }
export function createStudioNativeAuth(options: {
  boDb: unknown; scope: {environment: string; workspaceId: string}; now?: () => number;
}): (request: Request) => Promise<NativeStudioSession>;
