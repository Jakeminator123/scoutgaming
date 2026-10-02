import type { StudioRole, StudioAdminActionId, StudioAdminHandlerRequirement } from './studio-access-policy.mjs';

/** Future-only contract shapes; neither validation nor an activated route. */

export interface StudioAdminEndpoint {
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly action: StudioAdminActionId;
  readonly path: string;
  readonly minimumRole: StudioRole;
  readonly handlerRequirements: readonly StudioAdminHandlerRequirement[];
}
export type StudioAuthAction = 'session' | 'login' | 'logout' | 'reset-request' | 'set-password';
export interface StudioAuthEndpoint {
  readonly method: 'GET' | 'POST';
  readonly action: StudioAuthAction;
  readonly path: string;
  readonly handlerRequirements: readonly string[];
}
export interface StudioLoginRequest { user: string; pass: string; }
export type StudioSessionResult = { authenticated: false } | {
  authenticated: true; user: string; role: StudioRole; permissions: readonly StudioAdminActionId[];
};
export interface StudioUserRoleRequest { username: string; role: StudioRole; }
export interface StudioUserRemoveRequest { username: string; }
export interface StudioPlayerCreateRequest {
  username: string; name: string; password: string; currency: string; reason: string;
}
export interface StudioPlayerStatusRequest {
  playerId: string; status: 'active' | 'blocked' | 'closed'; reason: string;
}
export const STUDIO_ROUTES: Readonly<{
  home: '/studio'; login: '/studio/login'; administration: '/studio/administration';
  authApi: '/studio/api/auth'; adminApi: '/studio/api/admin'; blackjack: '/blackjack'; game: '/game';
}>;
export const STUDIO_ADMIN_ENDPOINTS: readonly StudioAdminEndpoint[];
export const STUDIO_AUTH_ENDPOINTS: readonly StudioAuthEndpoint[];
export function studioAdminSectionPath(section: unknown): string | null;
/** Exact future-only descriptor lookup; no session, Origin/CSRF or revision/CAS checks. */
export function studioAdminEndpoint(method: unknown, pathname: unknown): StudioAdminEndpoint | null;
/** Exact method/path descriptor lookup; never reads or changes a session. */
export function studioAuthEndpoint(method: unknown, pathname: unknown): StudioAuthEndpoint | null;
