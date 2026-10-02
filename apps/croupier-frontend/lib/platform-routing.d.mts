export interface PlatformConfiguration { publicOrigin: string; backendOrigin: string; labUiOrigin: string; secret: string; }
export function exactPlatformOrigin(value: unknown, name: string): string;
export function platformConfiguration(env?: Record<string, string | undefined>): PlatformConfiguration | null;
export function canonicalPlatformPath(value: string): string | null;
export function backendPlatformPath(value: string): boolean;
export function platformRoute(url: URL, config: PlatformConfiguration): {kind: 'reject'} | {kind: 'frontend'} | {kind: 'backend'; destination: string} | {kind: 'lab'; destination: string} | {kind: 'redirect'; destination: string};
export function platformBackendHeaders(headers: Headers, config: PlatformConfiguration): Headers;
