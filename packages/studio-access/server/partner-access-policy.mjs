// Partnerportalens behörighetsgolv, kopplade till inloggning och HTTP: vyer och snapshot
// (apps/studio/lib/partner-data.mjs), API-åtgärderna via partner-workspace-access.mjs och
// partner-team-api.mjs, rollerna i operator-admin-api.mjs och lagret (operator-store.mjs).
// Menyn (components/partner/partner-copy.mjs) läser samma vykarta.
// These are permission floors, not authentication. Inputs must be fresh,
// server-owned projections read in the same transaction as a protected write.
// The caller must also verify session identity/stamp/epoch, membership revision,
// Origin/CSRF, input, CAS and audit requirements.
// The store rejects a membership or role change that would remove the last
// operator administrator (an active member whose role includes team.roles.assign).
// Resource ownership must come from storage, never a request's operator slug.
// Existing internal Studio policy and player/game authority remain separate.
import { validateStudioScope } from '../studio-scope.mjs';

// material.request och integration.request (ADMIN-FORENKLING 5.4, PARTNERPORTAL-KONVERTERING
// 2.4 punkt 5): begära material och nyckelrotation som journalposter. Namnen prövas bara i
// koden (operator_roles.permissions är JSON-text utan CHECK); befintliga roller får dem inte
// automatiskt.
export const PARTNER_PERMISSIONS = Object.freeze([
  'overview.read',
  'players.read',
  'team.read', 'team.invite', 'team.roles.assign', 'team.suspend',
  'tables.read', 'tables.configure',
  'presentations.read', 'presentations.configure', 'material.request',
  'reports.read', 'integrations.read', 'integration.request',
]);

// The only permission that can grant another operator administrator.
export const OPERATOR_ADMIN_PERMISSION = 'team.roles.assign';

// Partnerportalen: the permission each view requires. The menu hides a view
// the role lacks, and the server refuses its direct address with the same map.
export const PARTNER_VIEW_PERMISSIONS = Object.freeze({
  overview: 'overview.read', rooms: 'tables.read', players: 'players.read', reports: 'reports.read',
  team: 'team.read', integration: 'integrations.read', help: 'overview.read',
});

const permissions = new Set(PARTNER_PERMISSIONS);
const id = value => typeof value === 'string' && value.trim() === value
  && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value);
const record = value => value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const own = (value, keys) => record(value)
  && keys.every(key => Object.getOwnPropertyDescriptor(value, key)?.value !== undefined);

function sameScope(left, right) {
  try {
    const a = validateStudioScope(left), b = validateStudioScope(right);
    return a.environment === b.environment && a.workspaceId === b.workspaceId;
  } catch { return false; }
}

export function isPartnerPermission(value) {
  return typeof value === 'string' && permissions.has(value);
}

function validPermissions(value) {
  return Array.isArray(value) && value.length <= PARTNER_PERMISSIONS.length
    && new Set(value).size === value.length && Array.from(value).every(isPartnerPermission);
}

// Active membership whose role, in the same operator, can assign roles.
// Other team permissions do not make an administrator.
export function isOperatorAdmin(membership, role) {
  if (!own(membership, ['status', 'operatorId', 'roleId', 'scope'])) return false;
  if (membership.status !== 'active') return false;
  if (!own(role, ['id', 'operatorId', 'permissions', 'scope'])) return false;
  if (!id(membership.operatorId) || membership.operatorId !== role.operatorId) return false;
  if (!id(role.id) || membership.roleId !== role.id) return false;
  if (!sameScope(membership.scope, role.scope)) return false;
  if (!validPermissions(role.permissions)) return false;
  return role.permissions.includes(OPERATOR_ADMIN_PERMISSION);
}

function boundToOperator(value, scope, operatorId) {
  return own(value, ['scope', 'operatorId']) && id(value.operatorId)
    && value.operatorId === operatorId && sameScope(value.scope, scope);
}

function validRole(role, scope, operatorId) {
  return own(role, ['id', 'permissions']) && id(role.id) && validPermissions(role.permissions)
    && boundToOperator(role, scope, operatorId);
}

function validContext(context) {
  if (!own(context, ['account', 'scope', 'operator', 'membership', 'role'])) return false;
  const { account, scope, operator, membership, role } = context;
  return own(account, ['userId', 'role', 'status']) && id(account.userId)
    // Neither legacy reader/staff nor an internal preview grant is a partner account.
    && account.role === 'partner' && account.status === 'active'
    && own(operator, ['id', 'status', 'scope']) && id(operator.id)
    && operator.status === 'active' && sameScope(operator.scope, scope)
    && own(membership, ['userId', 'roleId', 'status'])
    && membership.userId === account.userId && membership.status === 'active'
    && boundToOperator(membership, scope, operator.id)
    && validRole(role, scope, operator.id) && membership.roleId === role.id;
}

export function allowsPartnerResource(context, permission, resource) {
  return isPartnerPermission(permission) && validContext(context)
    && context.role.permissions.includes(permission)
    && boundToOperator(resource, context.scope, context.operator.id);
}

// Assignment can select a pre-existing, server-loaded role in this operator.
// Creating/editing role definitions and marking them delegable is internal-only.
// Both roles need an explicit delegation mandate; protected staff cannot be
// demoted through this path. An operator can neither elevate their own
// membership nor change staff with permissions beyond theirs.
// This does not authorize inviting, suspending or deleting that staff member.
export function allowsPartnerRoleAssignment(context, assignment) {
  if (!own(assignment, ['membership', 'currentRole', 'nextRole'])) return false;
  const { membership, currentRole, nextRole } = assignment;
  if (!allowsPartnerResource(context, 'team.roles.assign', membership)) return false;
  return own(membership, ['userId', 'roleId', 'status']) && id(membership.userId)
    && membership.userId !== context.account.userId && membership.status === 'active'
    && validRole(currentRole, context.scope, context.operator.id)
    && membership.roleId === currentRole.id
    && validRole(nextRole, context.scope, context.operator.id)
    && own(currentRole, ['delegable']) && currentRole.delegable === true
    && own(nextRole, ['delegable']) && nextRole.delegable === true
    && [...currentRole.permissions, ...nextRole.permissions]
      .every(permission => context.role.permissions.includes(permission));
}

// An invitation links an existing partner account to a pre-existing, delegable
// role in this operator. It never creates an account or a role, and the role
// cannot carry a permission the inviter lacks.
export function allowsPartnerInviteRole(context, role) {
  return allowsPartnerResource(context, 'team.invite', role)
    && validRole(role, context.scope, context.operator.id)
    && own(role, ['delegable']) && role.delegable === true
    && role.permissions.every(permission => context.role.permissions.includes(permission));
}

export function allowsPartnerInvite(context, invitation) {
  if (!own(invitation, ['account', 'nextRole'])) return false;
  const { account, nextRole } = invitation;
  return allowsPartnerInviteRole(context, nextRole)
    && own(account, ['userId', 'role']) && id(account.userId) && account.role === 'partner'
    && account.userId !== context.account.userId;
}

// Suspension and reactivation move another member between active and suspended.
// Their role must be delegable and within the actor's permissions, so protected
// staff cannot be locked out through this path.
export function allowsPartnerSuspension(context, change) {
  if (!own(change, ['membership', 'currentRole', 'nextStatus'])) return false;
  const { membership, currentRole, nextStatus } = change;
  if (!allowsPartnerResource(context, 'team.suspend', membership)) return false;
  const from = nextStatus === 'suspended' ? 'active' : nextStatus === 'active' ? 'suspended' : null;
  return from !== null && own(membership, ['userId', 'roleId', 'status']) && id(membership.userId)
    && membership.userId !== context.account.userId && membership.status === from
    && validRole(currentRole, context.scope, context.operator.id) && membership.roleId === currentRole.id
    && own(currentRole, ['delegable']) && currentRole.delegable === true
    && currentRole.permissions.every(permission => context.role.permissions.includes(permission));
}
