export interface RemoteUiConfiguration {publicOrigin: string; backendOrigin: string; zoneOrigin: string; secret: string;}
export function remoteUiConfiguration(env?: Record<string, string | undefined>): RemoteUiConfiguration | null;
export function assertRemoteUiPage(request: Request, config: RemoteUiConfiguration): void;
export function remoteUiRequest(path: string, request: Request, options?: {config?: RemoteUiConfiguration | null; fetchImpl?: typeof fetch}): Promise<any>;
export function authorizeRemoteUi(request: Request, options?: {config?: RemoteUiConfiguration | null; fetchImpl?: typeof fetch}): Promise<void>;
export function remoteUiInitialData(request: Request, options?: {config?: RemoteUiConfiguration | null; fetchImpl?: typeof fetch}): Promise<any>;
