// Role floors for the future native Studio, not complete authorization.
// Handlers must still validate the live account/session, input and Origin/CSRF,
// enforce revisions/CAS and audit/lifecycle rules, and satisfy extra gates below.
// This module does not read cookies, identify an actor, or authorize a provider job.
export const STUDIO_ROLES = Object.freeze(['reader', 'staff', 'admin', 'superadmin']);

export const STUDIO_ADMIN_SECTIONS = Object.freeze([
  ['ops', 'Driftöversikt', 'reader'],
  ['voice', 'Tal och synkgranskning', 'reader'],
  ['clips', 'Klipp och granskning', 'reader'],
  ['gens', 'Genererat material', 'reader'],
  ['apikeys', 'Partner och API-nycklar', 'reader'],
  ['emails', 'E-postmallar', 'reader'],
  ['users', 'Användare och roller', 'superadmin'],
  ['rooms', 'Bord och rum', 'reader'],
  ['dealers', 'Dealers', 'reader'],
  ['pit', 'Pit bosses', 'reader'],
  ['tours', 'Turneringar', 'reader'],
  ['players', 'Spelarkonton', 'reader'],
  ['pay', 'Betalningar och journal', 'reader'],
  ['shoes', 'Shoe och spelintegritet', 'reader'],
].map(([id, label, minimumRole]) => Object.freeze({ id, label, minimumRole })));

// Explicit existing BO floors: unknown actions never inherit the old admin default.
export const STUDIO_ADMIN_ACTIONS = Object.freeze([
  ['overview', 'reader'], ['config', 'reader'], ['voicelines', 'reader'],
  ['clips', 'reader'], ['generations', 'reader'], ['gen-verdicts', 'reader'],
  ['apikeys', 'reader'], ['users', 'superadmin'], ['players', 'reader'],
  ['transactions', 'reader'], ['emails', 'reader'], ['shoes', 'reader'],
  ['voiceline-review', 'staff'], ['tournament', 'staff'],
  ['pitboss', 'admin'], ['tier', 'admin'], ['room', 'admin'],
  ['clip-landing', 'admin'], ['clip-never', 'admin'],
  ['gen-landing', 'admin'], ['gen-verdict', 'admin'],
  ['players/create', 'admin', ['player-lifecycle-and-ledger']],
  ['players/status', 'admin', ['player-lifecycle-and-ledger', 'cancel-player-runtime']],
  ['users/invite', 'superadmin'], ['users/resend', 'superadmin'],
  ['users/role', 'superadmin', ['forbid-self-role-change', 'revoke-changed-identity']],
  ['users/remove', 'superadmin', ['forbid-self-removal', 'revoke-changed-identity']],
  ['apikeys/create', 'superadmin'], ['apikeys/revoke', 'superadmin'],
  ['apikeys/rotate', 'superadmin'],
  ['apikeys/launch', 'admin', ['game-authority']],
  ['apikeys/credit', 'admin', ['game-authority']],
  ['speech-qa', 'admin', ['operator-speech-qa-gate']],
].map(([id, minimumRole, requirements = []]) => Object.freeze({
  id, minimumRole, handlerRequirements: Object.freeze(requirements),
})));

const sections = new Map(STUDIO_ADMIN_SECTIONS.map(section => [section.id, section]));
const actions = new Map(STUDIO_ADMIN_ACTIONS.map(action => [action.id, action]));

export function isStudioRole(value) {
  return typeof value === 'string' && STUDIO_ROLES.includes(value);
}

export function studioRoleMeetsMinimum(role, minimumRole) {
  return isStudioRole(role) && isStudioRole(minimumRole)
    && STUDIO_ROLES.indexOf(role) >= STUDIO_ROLES.indexOf(minimumRole);
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
