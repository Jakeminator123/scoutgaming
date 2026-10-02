import type { NativeStudioSession } from './studio-native-auth.mjs';
export interface NativeStudioConfiguration {
  scope: Readonly<{environment: string; workspaceId: string}>;
  connectionString: string; allowedOrigins: string[]; publicHosts: string[];
  apiBase: '/studio/api/admin' | '/api/admin'; authBase: '/studio/api/auth' | '/api/auth';
}
export function nativeStudioAdminEnabled(env?: Record<string,string | undefined>): boolean;
export function nativeStudioAdminConfiguration(env?: Record<string,string | undefined>): NativeStudioConfiguration | null;
export function assertNativeStudioRequest(request: Request, config: NativeStudioConfiguration | null): void;
export function studioNativeRuntime(): Promise<{
  config: NativeStudioConfiguration; authorize(request: Request): Promise<NativeStudioSession>;
  api: {handle(request: Request): Promise<Response>; availableActions(session: NativeStudioSession): string[]};
}>;
export function handleNativeAdmin(request: Request): Promise<Response>;
export function handleNativeSession(request: Request): Promise<Response>;
export function nativeStudioErrorResponse(error: unknown): Response;
