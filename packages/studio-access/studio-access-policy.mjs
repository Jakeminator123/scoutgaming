// Role floors for the future native Studio, not complete authorization.
// Handlers must still validate the live account/session, input and Origin/CSRF,
// enforce revisions/CAS and audit/lifecycle rules, and satisfy extra gates below.
// This module does not read cookies, identify an actor, or authorize a provider job.
// Shared with game login; this role module is safe for the client UI.
import { isAdministratorRole } from './account-role.mjs';

// Administrator is the only Studio role. Stored superadmin remains a legacy alias.
export const STUDIO_ROLES = Object.freeze(['admin']);
export const normalizeStudioRole = value => isAdministratorRole(value) ? 'admin' : null;

export const STUDIO_ADMIN_SECTIONS = Object.freeze([
  ['ops', 'Driftöversikt', 'admin'],
  ['lanes', 'Spel och lanes', 'admin'],
  ['voice', 'Tal och synkgranskning', 'admin'],
  ['clips', 'Klipp och granskning', 'admin'],
  ['gens', 'Genererat material', 'admin'],
  ['apikeys', 'Partner och API-nycklar', 'admin'],
  ['emails', 'E-postmallar', 'admin'],
  ['users', 'Användare och roller', 'admin'],
  ['rooms', 'Bord och rum', 'admin'],
  ['dealers', 'Dealers', 'admin'],
  ['pit', 'Pit bosses', 'admin'],
  ['tours', 'Turneringar', 'admin'],
  ['players', 'Spelarkonton', 'admin'],
  ['pay', 'Betalningar och journal', 'admin'],
  ['shoes', 'Shoe och spelintegritet', 'admin'],
].map(([id, label, minimumRole]) => Object.freeze({ id, label, minimumRole })));

// Explicit existing BO floors: unknown actions never inherit the old admin default.
export const STUDIO_ADMIN_ACTIONS = Object.freeze([
  ['overview', 'admin'], ['config', 'admin'],
  ['clips', 'admin'], ['generations', 'admin'], ['gen-verdicts', 'admin'],
  ['apikeys', 'admin'], ['users', 'admin'], ['players', 'admin'],
  ['transactions', 'admin'], ['emails', 'admin'], ['shoes', 'admin'],
  ['tournament', 'admin'],
  ['pitboss', 'admin'], ['tier', 'admin'], ['room', 'admin'], ['game-lane', 'admin'],
  ['game-lanes/create', 'admin'], ['game-lanes/remove', 'admin'],
  ['clip-landing', 'admin'], ['clip-never', 'admin'],
  ['gen-landing', 'admin'], ['gen-verdict', 'admin'],
  ['players/create', 'admin', ['player-lifecycle-and-ledger']],
  ['players/status', 'admin', ['player-lifecycle-and-ledger', 'cancel-player-runtime']],
  ['players/password', 'admin', ['game-authority', 'player-lifecycle-and-ledger', 'cancel-player-runtime']],
  ['users/invite', 'admin'], ['users/resend', 'admin'],
  ['users/role', 'admin', ['forbid-self-role-change', 'revoke-changed-identity']],
  ['users/remove', 'admin', ['forbid-self-removal', 'revoke-changed-identity']],
  ['apikeys/create', 'admin'], ['apikeys/revoke', 'admin'],
  ['apikeys/rotate', 'admin'],
  ['apikeys/launch', 'admin', ['game-authority']],
  ['apikeys/credit', 'admin', ['game-authority']],
  ['moving-drift', 'admin', ['moving-drift-control']],
  ['operator-package', 'admin'], ['presentation-room', 'admin'],
  ['room-game-config', 'admin'], ['shared-table-proof', 'admin'],
  ['operator-create-demo', 'admin'],
  ['operator-create', 'admin'], ['operator-role', 'admin'], ['operator-membership', 'admin'],
  ['resource-lifecycle','admin'], ['operator-lifecycle','admin'], ['room-lifecycle','admin'], ['room-state','admin'],
  ['material-trash-check','admin'], ['material-trash','admin'],
].map(([id, minimumRole, requirements = []]) => Object.freeze({
  id, minimumRole, handlerRequirements: Object.freeze(requirements),
})));

const sections = new Map(STUDIO_ADMIN_SECTIONS.map(section => [section.id, section]));
const actions = new Map(STUDIO_ADMIN_ACTIONS.map(action => [action.id, action]));

export function isStudioRole(value) {
  return normalizeStudioRole(value) !== null;
}

export function studioRoleMeetsMinimum(role, minimumRole) {
  return normalizeStudioRole(role) === 'admin' && normalizeStudioRole(minimumRole) === 'admin';
}

export function studioAdminSectionPolicy(value) {
  return typeof value === 'string' ? sections.get(value) ?? null : null;
}

export function studioAdminActionPolicy(value) {
  return typeof value === 'string' ? actions.get(value) ?? null : null;
}

export function meetsStudioAdminSectionRole(role, section) {
  const policy = studioAdminSectionPolicy(section);
  return policy !== null && studioRoleMeetsMinimum(role, policy.minimumRole);
}

export function meetsStudioAdminActionRole(role, action) {
  const policy = studioAdminActionPolicy(action);
  return policy !== null && studioRoleMeetsMinimum(role, policy.minimumRole);
}
