import {
  PARTNER_PERMISSIONS, allowsPartnerResource, allowsPartnerInviteRole, allowsPartnerInvite,
  allowsPartnerRoleAssignment, allowsPartnerSuspension,
} from '../../web/partner-access-policy.mjs';
import { validateStudioScope } from '../../web/storage/studio-contract.mjs';

const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value);
const sameScope = (left, right) => {
  try {
    const a = validateStudioScope(left), b = validateStudioScope(right);
    return a.environment === b.environment && a.workspaceId === b.workspaceId;
  } catch { return false; }
};

// A distinct server-owned N1 context. It is not a partner membership or an
// impersonated partner account, and never changes the partner policy itself.
export function internalPartnerContext(session, operator) {
  return {
    accessClass: 'internal-admin',
    account: { userId: session.accountId, role: session.role, status: 'active' },
    scope: session.scope,
    operator,
  };
}
function internal(context) {
  return context?.accessClass === 'internal-admin' && context.account?.role === 'admin'
    && context.account.status === 'active' && id(context.account.userId)
    && id(context.operator?.id) && context.operator.status === 'active'
    && sameScope(context.scope, context.operator.scope);
}
function bound(context, value) {
  return value?.operatorId === context.operator.id && sameScope(value.scope, context.scope);
}
function role(context, value) {
  return bound(context, value) && id(value.id) && value.delegable === true
    && Array.isArray(value.permissions) && new Set(value.permissions).size === value.permissions.length
    && value.permissions.every(permission => PARTNER_PERMISSIONS.includes(permission));
}

export function allowsWorkspaceResource(context, permission, resource) {
  return internal(context)
    ? PARTNER_PERMISSIONS.includes(permission) && bound(context, resource)
    : allowsPartnerResource(context, permission, resource);
}
export function allowsWorkspaceInviteRole(context, nextRole) {
  return internal(context) ? role(context, nextRole) : allowsPartnerInviteRole(context, nextRole);
}
export function allowsWorkspaceInvite(context, invitation) {
  if (!internal(context)) return allowsPartnerInvite(context, invitation);
  return role(context, invitation?.nextRole) && id(invitation.account?.userId)
    && invitation.account.role === 'partner' && invitation.account.userId !== context.account.userId;
}
export function allowsWorkspaceRoleAssignment(context, assignment) {
  if (!internal(context)) return allowsPartnerRoleAssignment(context, assignment);
  const { membership, currentRole, nextRole } = assignment ?? {};
  return bound(context, membership) && id(membership.userId) && membership.userId !== context.account.userId
    && membership.status === 'active' && membership.roleId === currentRole?.id
    && role(context, currentRole) && role(context, nextRole);
}
export function allowsWorkspaceSuspension(context, change) {
  if (!internal(context)) return allowsPartnerSuspension(context, change);
  const { membership, currentRole, nextStatus } = change ?? {};
  const from = nextStatus === 'suspended' ? 'active' : nextStatus === 'active' ? 'suspended' : null;
  return from !== null && bound(context, membership) && id(membership.userId)
    && membership.userId !== context.account.userId && membership.status === from
    && membership.roleId === currentRole?.id && role(context, currentRole);
}
