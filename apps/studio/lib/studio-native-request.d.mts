export interface NativeStudioRequestConfiguration {
  allowedOrigins: readonly string[]; publicHosts: readonly string[];
  apiBase: '/studio/api/admin' | '/api/admin'; authBase: '/studio/api/auth' | '/api/auth';
}
export function studioDocumentNavigationMetadata(request: Request): {
  controlDocument: boolean; mode: 'navigate' | 'cors' | 'other' | 'missing';
  destination: 'document' | 'iframe' | 'other' | 'missing'; crossSite: boolean;
  originPresent: boolean; actionPresent: boolean;
};
export function studioDocumentNavigationHeaders(request: Request): Headers;
export function assistantRequestConfiguration(env?: Record<string, string | undefined>): (NativeStudioRequestConfiguration & { unifiedUi?: true }) | null;
export function normalizeNativeStudioRequest(request: Request, config: NativeStudioRequestConfiguration | null): Request;
export function normalizeNativeStudioPageRequest(request: Request, config: NativeStudioRequestConfiguration | null): Request;
