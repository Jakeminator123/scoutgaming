import type { NativeStudioSession } from './studio-native-auth.mjs';
export interface NativeStudioConfiguration {
  scope: Readonly<{environment: string; workspaceId: string}>;
  connectionString: string; allowedOrigins: string[]; publicHosts: string[];
  apiBase: '/studio/api/admin' | '/api/admin'; authBase: '/studio/api/auth' | '/api/auth';
}
export function nativeStudioAdminEnabled(env?: Record<string,string | undefined>): boolean;
export function nativeStudioAdminConfiguration(env?: Record<string,string | undefined>): NativeStudioConfiguration | null;
export function assertNativeStudioRequest(request: Request, config: NativeStudioConfiguration | null): void;
export interface NativeStudioRuntime {
  config: NativeStudioConfiguration; authorize(request: Request): Promise<NativeStudioSession>;
  api: {handle(request: Request): Promise<Response>; availableActions(session: NativeStudioSession): string[]};
  repository: any; gamePolicy: any;
  mutationTransaction<T>(work: () => Promise<T>): Promise<T>;
  validateProjectBindings?: (project: any) => Promise<void>;
  videoRegistry?: () => Promise<any>;
  videoResponse?: (id: string, request: Request) => Promise<Response>;
  legacyControls?: (project: any) => Promise<any>;
  uploads?: { prepare(body: any, context: any): Promise<any>; commit(body: any, context: any): Promise<any> };
  authActions: {handle(request: Request): Promise<Response>; availableActions: readonly string[]};
}
export function studioNativeRuntime(): Promise<NativeStudioRuntime>;
export function createNativeStudioRequestHandlers(options?: {
  configuration?: () => NativeStudioConfiguration | null;
  runtime?: () => Promise<Pick<NativeStudioRuntime, 'api' | 'authorize'>>;
  clock?: () => number;
}): {
  handleNativeAdmin(request: Request): Promise<Response>;
  handleNativeSession(request: Request): Promise<Response>;
};
export function handleNativeAdmin(request: Request): Promise<Response>;
export function handleNativeAuthAction(request: Request): Promise<Response>;
export function handleNativeSession(request: Request): Promise<Response>;
export function nativeStudioErrorResponse(error: unknown): Response;
