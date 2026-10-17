import type { StudioRole, StudioAdminHandlerRequirement } from './studio-access-policy.mjs';
import type { StudioAdminEndpoint } from './studio-admin-contract.mjs';
export interface StudioAdminScope { readonly environment: string; readonly workspaceId: string; }
export interface StudioAdminSession { user: string; role: StudioRole; scope: StudioAdminScope; }
export interface StudioAdminContext {
  readonly request: Request;
  readonly body: Record<string, unknown> | null;
  readonly actor: Readonly<{ user: string; role: StudioRole }>;
  readonly scope: Readonly<StudioAdminScope>;
  readonly endpoint: StudioAdminEndpoint;
  readonly afterCommit?: (work: () => Promise<unknown>) => void;
}
export interface StudioAdminApiOptions {
  apiBase?: '/studio/api/admin' | '/api/admin';
  mutationTransaction?<T>(work: () => Promise<T>): Promise<T>;
  authorize(request: Request): Promise<StudioAdminSession> | StudioAdminSession;
  allowedOrigins: string[];
  publicHosts: string[];
  handlers: Map<string, (context: StudioAdminContext) => unknown | Promise<unknown>>;
  gates?: Map<StudioAdminHandlerRequirement, (context: StudioAdminContext) => boolean | Promise<boolean>>;
}
export function createStudioAdminApi(options: StudioAdminApiOptions): Readonly<{
  handle(request: Request): Promise<Response>;
  availableActions(session: StudioAdminSession | null): string[];
}>;
