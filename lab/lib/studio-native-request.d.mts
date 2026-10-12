export interface NativeStudioRequestConfiguration {
  allowedOrigins: readonly string[]; publicHosts: readonly string[];
  apiBase: '/studio/api/admin' | '/api/admin'; authBase: '/studio/api/auth' | '/api/auth';
}
export function studioDocumentNavigationHeaders(request: Request): Headers;
export function normalizeNativeStudioRequest(request: Request, config: NativeStudioRequestConfiguration | null): Request;
export function normalizeNativeStudioPageRequest(request: Request, config: NativeStudioRequestConfiguration | null): Request;
