import {
  OPERATOR_ADMIN_PERMISSION, allowsPartnerInvite, allowsPartnerInviteRole, allowsPartnerResource,
  allowsPartnerRoleAssignment, allowsPartnerSuspension,
} from '../../web/partner-access-policy.mjs';
import { createOperatorAccounts } from './operator-accounts.mjs';
import { createOperatorJournal } from './operator-journal.mjs';

// Reasons a client may show for a 409. Anything else stays a bare status.
export const PARTNER_TEAM_CONFLICTS = Object.freeze(['last-admin', 'revision', 'member']);
const fail = (statusCode, reason) => { throw Object.assign(new Error('partner_team_rejected'), { statusCode, ...(reason ? { reason } : {}) }); };

function keys(body, allowed) {
  if (Object.keys(body).length !== allowed.length || allowed.some(key => !Object.hasOwn(body, key))) fail(400);
}
function revisionOf(value) {
  if (!Number.isSafeInteger(value) || value < 1) fail(400);
  return value;
}

// `decided` is the fresh partner context built for this request: account,
// scope, operator, membership and role, all read from storage after the
// session check. The store re-checks the last administrator under its lock.
export function createPartnerTeamApi({ store, boDb, journal = createOperatorJournal() }) {
  const accounts = () => createOperatorAccounts(boDb);
  async function usernames(userIds) {
    try { return await accounts().usernames(userIds); } catch { return new Map(); }
  }
  async function listing(decided) {
    const operatorId = decided.operator.id;
    const resource = { scope: decided.scope, operatorId };
    const [roles, members] = await Promise.all([store.listRoles(operatorId), store.listMemberships(operatorId)]);
    const names = await usernames(members.map(member => member.userId));
    const admin = allowsPartnerResource(decided, OPERATOR_ADMIN_PERMISSION, resource);
    const byId = new Map(roles.map(role => [role.id, role]));
    const inviteRoles = admin ? roles.filter(role => allowsPartnerInviteRole(decided, role)).map(role => role.id) : [];
    const rows = members.map(member => {
      const currentRole = byId.get(member.roleId);
      const may = nextStatus => Boolean(admin && currentRole && allowsPartnerSuspension(decided, { membership: member, currentRole, nextStatus }));
      return {
        userId: member.userId,
        username: names.get(member.userId) ?? null,
        roleId: member.roleId,
        roleLabel: currentRole?.label ?? member.roleId,
        status: member.status,
        revision: member.revision,
        allowed: {
          role: admin && currentRole ? roles.filter(nextRole => nextRole.id !== member.roleId
            && allowsPartnerRoleAssignment(decided, { membership: member, currentRole, nextRole })).map(role => role.id) : [],
          suspend: may('suspended'),
          reactivate: may('active'),
        },
      };
    });
    return {
      operatorId,
      viewer: { userId: decided.account.userId },
      can: {
        invite: inviteRoles.length > 0,
        role: rows.some(row => row.allowed.role.length > 0),
        suspend: rows.some(row => row.allowed.suspend || row.allowed.reactivate),
      },
      roles: roles.map(role => ({ id: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable })),
      inviteRoles,
      members: rows,
    };
  }
  async function roleOf(operatorId, roleId) {
    if (typeof roleId !== 'string') fail(422);
    const found = await store.getRole(operatorId, roleId);
    if (!found) fail(422);
    return found;
  }
  async function memberOf(operatorId, userId) {
    if (typeof userId !== 'string') fail(400);
    const found = await store.getMembership(operatorId, userId);
    if (!found) fail(404);
    return found;
  }
  async function save(action, input) {
    try { return await store.upsertMembership(input); }
    catch (error) {
      if (error?.code === 'studio_last_operator_admin') fail(409, 'last-admin');
      if (error?.statusCode === 409) fail(409, action === 'invite' ? 'member' : 'revision');
      throw error;
    }
  }
  // Every write also needs team.roles.assign: only an operator administrator changes the team.
  function writable(decided) {
    const resource = { scope: decided.scope, operatorId: decided.operator.id };
    return allowsPartnerResource(decided, 'team.read', resource) && allowsPartnerResource(decided, OPERATOR_ADMIN_PERMISSION, resource);
  }
  return Object.freeze({
    writable,
    async read(decided) {
      if (!allowsPartnerResource(decided, 'team.read', { scope: decided.scope, operatorId: decided.operator.id })) fail(403);
      return listing(decided);
    },
    async write(decided, { actor, body }) {
      const operatorId = decided.operator.id;
      if (!writable(decided)) fail(403);
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400);
      const { action } = body;
      let saved;
      if (action === 'invite') {
        // Links an existing partner account found by e-mail. No mail is sent (N2.6).
        keys(body, ['action', 'email', 'roleId']);
        const nextRole = await roleOf(operatorId, body.roleId);
        const account = await accounts().byEmail(body.email);
        if (!account || account.role !== 'partner') fail(422);
        if (!allowsPartnerInvite(decided, { account: { userId: account.userId, role: account.role }, nextRole })) fail(403);
        saved = await save(action, { actor, operatorId, userId: account.userId, roleId: nextRole.id, status: 'active' });
      } else if (action === 'role') {
        keys(body, ['action', 'userId', 'roleId', 'expectedRevision']);
        const expectedRevision = revisionOf(body.expectedRevision);
        const membership = await memberOf(operatorId, body.userId);
        const currentRole = await roleOf(operatorId, membership.roleId);
        const nextRole = await roleOf(operatorId, body.roleId);
        if (!allowsPartnerRoleAssignment(decided, { membership, currentRole, nextRole })) fail(403);
        saved = await save(action, { actor, operatorId, userId: membership.userId, roleId: nextRole.id, status: membership.status, expectedRevision });
      } else if (action === 'suspend' || action === 'reactivate') {
        keys(body, ['action', 'userId', 'expectedRevision']);
        const expectedRevision = revisionOf(body.expectedRevision);
        const membership = await memberOf(operatorId, body.userId);
        const currentRole = await roleOf(operatorId, membership.roleId);
        const nextStatus = action === 'suspend' ? 'suspended' : 'active';
        if (!allowsPartnerSuspension(decided, { membership, currentRole, nextStatus })) fail(403);
        saved = await save(action, { actor, operatorId, userId: membership.userId, roleId: membership.roleId, status: nextStatus, expectedRevision });
      } else fail(400);
      const changed = { userId: saved.userId, roleId: saved.roleId, status: saved.status, revision: saved.revision };
      journal.record({ actor, action: `team.${action}`, operatorId, target: changed });
      return { ...(await listing(decided)), changed };
    },
  });
}
