export type StudioRole = 'admin' | 'superadmin';
/** Only admin is issued; superadmin is accepted for legacy stored identities. */
export function normalizeStudioRole(value: unknown): 'admin' | null;
export type StudioAdminSectionId = 'ops' | 'voice' | 'clips' | 'gens' | 'apikeys'
  | 'emails' | 'users' | 'rooms' | 'dealers' | 'pit' | 'tours' | 'players' | 'pay' | 'shoes';
export type StudioAdminActionId = 'overview' | 'config' | 'voicelines' | 'clips'
  | 'generations' | 'gen-verdicts' | 'apikeys' | 'users' | 'players' | 'transactions' | 'emails' | 'shoes'
  | 'voiceline-review' | 'tournament' | 'pitboss' | 'tier' | 'room' | 'clip-landing'
  | 'clip-never' | 'gen-landing' | 'gen-verdict' | 'players/create' | 'players/status' | 'players/password'
  | 'users/invite' | 'users/resend' | 'users/role' | 'users/remove' | 'apikeys/create'
  | 'apikeys/revoke' | 'apikeys/rotate' | 'apikeys/launch' | 'apikeys/credit' | 'speech-qa';
export type StudioAdminHandlerRequirement = 'player-lifecycle-and-ledger'
  | 'cancel-player-runtime' | 'forbid-self-role-change' | 'forbid-self-removal'
  | 'revoke-changed-identity' | 'game-authority' | 'operator-speech-qa-gate';
export interface StudioAdminSectionPolicy {
  readonly id: StudioAdminSectionId;
  readonly label: string;
  readonly minimumRole: StudioRole;
}
export interface StudioAdminActionPolicy {
  readonly id: StudioAdminActionId;
  readonly minimumRole: StudioRole;
  readonly handlerRequirements: readonly StudioAdminHandlerRequirement[];
}
export const STUDIO_ROLES: readonly StudioRole[];
export const STUDIO_ADMIN_SECTIONS: readonly StudioAdminSectionPolicy[];
export const STUDIO_ADMIN_ACTIONS: readonly StudioAdminActionPolicy[];
export function isStudioRole(value: unknown): value is StudioRole;
export function studioRoleMeetsMinimum(role: unknown, minimumRole: unknown): boolean;
export function studioAdminSectionPolicy(value: unknown): StudioAdminSectionPolicy | null;
export function studioAdminActionPolicy(value: unknown): StudioAdminActionPolicy | null;
/** Role-floor check only; callers must perform complete server authorization. */
export function meetsStudioAdminSectionRole(role: unknown, section: unknown): boolean;
/** Role-floor check only; handlerRequirements are not evaluated by this helper. */
export function meetsStudioAdminActionRole(role: unknown, action: unknown): boolean;
