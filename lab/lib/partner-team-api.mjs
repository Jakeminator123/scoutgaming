import { operatorAuditContext } from './operator-audit-context.mjs';
import { randomUUID } from 'node:crypto';
import { OPERATOR_ADMIN_PERMISSION } from '../../packages/studio-access/server/partner-access-policy.mjs';
import {
  allowsWorkspaceInvite as allowsPartnerInvite, allowsWorkspaceInviteRole as allowsPartnerInviteRole,
  allowsWorkspaceResource as allowsPartnerResource, allowsWorkspaceRoleAssignment as allowsPartnerRoleAssignment,
  allowsWorkspaceSuspension as allowsPartnerSuspension,
} from './partner-workspace-access.mjs';
import {
  consumePartnerInvite, createOperatorAccounts, insertInvitedPartner, maskOperatorEmail, partnerInviteDelivery,
  partnerMailbox, playerOwnsEmail, sendPartnerInvite, visibleOperatorUsername,
} from './operator-accounts.mjs';
import { createOperatorJournal } from './operator-journal.mjs';
import { createNativeStudioMail } from './studio-native-mail.mjs';

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
export function createPartnerTeamApi({
  store, boDb, gameDb, journal = createOperatorJournal(), mail, now = () => Date.now(), publicOrigin,
  reauthorize, withWriteContext,
} = {}) {
  const accounts = () => createOperatorAccounts(boDb);
  const clock = typeof now === 'function' ? now : () => Date.now();
  const delivery = typeof mail?.send === 'function' ? mail : createNativeStudioMail({ env: process.env });
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
        username: visibleOperatorUsername(names.get(member.userId)),
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
        journal: admin,
        invite: inviteRoles.length > 0,
        role: rows.some(row => row.allowed.role.length > 0),
        suspend: rows.some(row => row.allowed.suspend || row.allowed.reactivate),
      },
      roles: roles.map(role => ({ id: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable })),
      inviteRoles,
      members: rows,
    };
  }
  async function roleOf(operatorId, roleId, source = store) {
    if (typeof roleId !== 'string') fail(422);
    const found = await source.getRole(operatorId, roleId);
    if (!found) fail(422);
    return found;
  }
  async function memberOf(operatorId, userId, source = store) {
    if (typeof userId !== 'string') fail(400);
    const found = await source.getMembership(operatorId, userId);
    if (!found) fail(404);
    return found;
  }
  async function save(action, input, source) {
    try { return await source.upsertMembership(input); }
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
      const requestId = randomUUID();
      const audit = operatorAuditContext({ ...decided, user: actor }, `team.${action}`, requestId);
      // The HTTP adapter locks the operator before this callback. Resolve the
      // account/session and exact action grants again on that same SQL source;
      // changing an actor's role cannot race between the guard and the write.
      const locked = async ({ store: source = store, reauthorize: authorize = reauthorize } = {}) => {
        const fresh = async () => {
          const latest = typeof authorize === 'function' ? await authorize() : decided;
          if (!latest || !writable(latest)) fail(403);
          return latest;
        };
        await fresh();
        let saved;
      if (action === 'invite') {
        keys(body, ['action', 'email', 'roleId']);
        const nextRole = await roleOf(operatorId, body.roleId, source);
        let latest = await fresh();
        if (!allowsPartnerInviteRole(latest, nextRole)) fail(403);
        const email = partnerMailbox(body.email);
        if (!email) fail(422);
        let account = await accounts().byEmail(email);
        if (account && account.role !== 'partner') fail(422);
        if (account && !allowsPartnerInvite(latest, { account: { userId: account.userId, role: account.role }, nextRole })) fail(403);
        if (!account && await playerOwnsEmail(gameDb, email)) fail(422);
        const operator = typeof source.getOperatorById === 'function' ? await source.getOperatorById(operatorId) : null;
        latest = await fresh();
        if (!allowsPartnerInviteRole(latest, nextRole)) fail(403);
        const release = consumePartnerInvite(actor, clock());
        let invitation = null;
        let createdNew = false;
        try {
          if (!account) {
            const created = await insertInvitedPartner(boDb, email, clock, publicOrigin);
            if (created) {
              createdNew = true;
              account = { userId: created.userId, role: 'partner' };
              if (created.link) invitation = partnerInviteDelivery({
                to: email, link: created.link, operatorName: operator?.name || operatorId, roleLabel: nextRole.label,
              });
            } else account = await accounts().byEmail(email);
            if (!account || account.role !== 'partner') fail(422);
            if (!allowsPartnerInvite(latest, { account: { userId: account.userId, role: account.role }, nextRole })) fail(403);
          }
          latest = await fresh();
          if (!allowsPartnerInvite(latest, { account: { userId: account.userId, role: account.role }, nextRole })) fail(403);
          await save(action, {
            actor, audit, operatorId, userId: account.userId, roleId: nextRole.id, status: createdNew ? 'invited' : 'active',
          }, source);
        } catch (error) {
          release();
          throw error;
        }
        return { invitation, email, invited: true };
      } else if (action === 'role') {
        keys(body, ['action', 'userId', 'roleId', 'expectedRevision']);
        const expectedRevision = revisionOf(body.expectedRevision);
        const membership = await memberOf(operatorId, body.userId, source);
        const currentRole = await roleOf(operatorId, membership.roleId, source);
        const nextRole = await roleOf(operatorId, body.roleId, source);
        if (!allowsPartnerRoleAssignment(await fresh(), { membership, currentRole, nextRole })) fail(403);
        saved = await save(action, { actor, audit, operatorId, userId: membership.userId, roleId: nextRole.id, status: membership.status, expectedRevision }, source);
      } else if (action === 'suspend' || action === 'reactivate') {
        keys(body, ['action', 'userId', 'expectedRevision']);
        const expectedRevision = revisionOf(body.expectedRevision);
        const membership = await memberOf(operatorId, body.userId, source);
        const currentRole = await roleOf(operatorId, membership.roleId, source);
        const nextStatus = action === 'suspend' ? 'suspended' : 'active';
        if (!allowsPartnerSuspension(await fresh(), { membership, currentRole, nextStatus })) fail(403);
        saved = await save(action, { actor, audit, operatorId, userId: membership.userId, roleId: membership.roleId, status: nextStatus, expectedRevision }, source);
      } else fail(400);
        return { changed: { userId: saved.userId, roleId: saved.roleId, status: saved.status, revision: saved.revision } };
      };
      // Durable audit was inserted by the store inside the SQL transaction.
      // Mail and the optional diagnostic logger run only after commit.
      const result = typeof withWriteContext === 'function' ? await withWriteContext(locked) : await locked();
      if (result.invited) {
        if (result.invitation) await sendPartnerInvite(delivery, result.invitation);
        journal.record({ actor, action: 'team.invite', operatorId, target: { email: maskOperatorEmail(result.email) } });
        return { invited: true };
      }
      const { changed } = result;
      journal.record({ actor, action: `team.${action}`, operatorId, target: changed });
      return { ...(await listing(decided)), changed };
    },
  });
}
