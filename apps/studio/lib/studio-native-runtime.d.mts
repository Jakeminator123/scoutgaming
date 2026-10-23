import type { NativeStudioSession } from '../../../packages/studio-access/studio-native-auth.mjs';
export interface NativeStudioConfiguration {
  scope: Readonly<{environment: string; workspaceId: string}>;
  connectionString: string; allowedOrigins: string[]; publicHosts: string[];
  apiBase: '/studio/api/admin' | '/api/admin'; authBase: '/studio/api/auth' | '/api/auth';
}
export function nativeStudioAdminEnabled(env?: Record<string,string | undefined>): boolean;
export function nativeStudioAdminConfiguration(env?: Record<string,string | undefined>): NativeStudioConfiguration | null;
export function assertNativeStudioRequest(request: Request, config: NativeStudioConfiguration | null): void;
export function readAssistantDatabaseInventory(pool: {query(sql: string): Promise<{rows: {table_schema:string;table_name:string}[]}>}): ReturnType<NativeStudioRuntime['assistantDatabaseInventory']>;
export interface NativeStudioRuntime {
  /** Server-only derived signer; never include in a client payload. */
  readonly speechReceiptKey: Uint8Array;
  /** Optional established server-only capability; native initialization never creates it. */
  readonly speechBuildDriver?: {generate(input:any):Promise<any>;media(input:any):Promise<any>};
  config: NativeStudioConfiguration; authorize(request: Request): Promise<NativeStudioSession>;
  api: {handle(request: Request): Promise<Response>; availableActions(session: NativeStudioSession): string[]};
  repository: any; gamePolicy: any;
  replyRepository: any;
  readDesignCatalog(): Promise<unknown>;
  assistantDatabaseInventory(): Promise<{source:string;partial:boolean;tables:{schema:string;name:string}[]}>;
  mutationTransaction<T>(work: () => Promise<T>): Promise<T>;
  validateProjectBindings?: (project: any) => Promise<void>;
  videoRegistry?: () => Promise<any>;
  videoResponse?: (id: string, request: Request) => Promise<Response>;
  legacyControls?: (project: any) => Promise<any>;
  uploads?: { prepare(body: any, context: any): Promise<any>; commit(body: any, context: any): Promise<any> };
  layerUploads?: NativeStudioRuntime['uploads'];
  authActions: {handle(request: Request): Promise<Response>; availableActions: readonly string[]};
  listLaneOperators?: () => Promise<Array<{ id: string; slug: string; name: string; publishedPackage?: { revision: number; lanes: string[] } | null }>>;
  listOperatorDirectory?: () => Promise<OperatorDirectoryEntry[]>;
}
export interface OperatorDirectoryRole { id: string; label: string; permissions: string[]; delegable: boolean }
export interface OperatorDirectoryMember { userId: string; username: string | null; roleId: string; status: string; revision: number }
export interface OperatorDirectoryEntry {
  id: string; slug: string; name: string; status: string;
  roles: OperatorDirectoryRole[]; missingRoles: string[]; members: OperatorDirectoryMember[];
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
