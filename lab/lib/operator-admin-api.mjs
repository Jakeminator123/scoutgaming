import { OPERATOR_ADMIN_PERMISSION, PARTNER_PERMISSIONS, isPartnerPermission } from '../../web/partner-access-policy.mjs';
import { createOperatorAccounts } from './operator-accounts.mjs';
import { createOperatorJournal } from './operator-journal.mjs';
import { openWritableOperatorStore } from './operator-package-api.mjs';
import { workspaceSurfacePath } from './workspace-surfaces.mjs';

// team.roles.assign makes an operator administrator, so only partner-admin
// carries it. partner-admin is not delegable: operator staff cannot appoint,
// demote or suspend an administrator; internal staff do that here.
// overview.read is in every role because the partner portal snapshot requires it.
export const STANDARD_OPERATOR_ROLES = Object.freeze([
  Object.freeze({ id: 'partner-admin', label: 'Partner administrator', delegable: false, permissions: Object.freeze([...PARTNER_PERMISSIONS]) }),
  Object.freeze({
    id: 'partner-editor', label: 'Partner editor', delegable: true,
    permissions: Object.freeze(['overview.read', 'tables.read', 'presentations.read', 'presentations.configure']),
  }),
  Object.freeze({
    id: 'partner-viewer', label: 'Partner viewer', delegable: true,
    permissions: Object.freeze(PARTNER_PERMISSIONS.filter(permission => permission.endsWith('.read'))),
  }),
]);

const membershipStatuses = new Set(['active', 'suspended']);
const fail = statusCode => { throw Object.assign(new Error('operator_admin_rejected'), { statusCode }); };

function keysOf(body, required, optional = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400);
  const allowed = [...required, ...optional];
  if (Object.keys(body).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(body, key))) fail(400);
}

// The slug is the /partner/{slug} address and the operator id. A reserved or
// malformed slug would give an operator nobody can open.
function operatorSlug(value) {
  if (typeof value !== 'string' || workspaceSurfacePath('partner', 'ops', value) === null) fail(422);
  return value;
}

function operatorName(value) {
  if (typeof value !== 'string') fail(422);
  const name = value.trim();
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(name)) fail(422);
  return name;
}

function permissionList(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > PARTNER_PERMISSIONS.length
    || new Set(value).size !== value.length || !value.every(isPartnerPermission)) fail(422);
  return PARTNER_PERMISSIONS.filter(permission => value.includes(permission));
}

function standardRole(roleId) {
  return STANDARD_OPERATOR_ROLES.find(role => role.id === roleId) ?? null;
}

function publicRole(role) {
  return { id: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable };
}

export function createOperatorAdminApi({ pool, boDb, scope, now = () => Date.now(), storeFactory, journal = createOperatorJournal({ now }) } = {}) {
  const handlers = new Map();
  const store = () => openWritableOperatorStore({ pool, scope, now, storeFactory });
  const accounts = () => createOperatorAccounts(boDb);

  // Usernames are display only. An unreadable users table leaves them null.
  async function usernames(userIds) {
    try { return await accounts().usernames(userIds); } catch { return new Map(); }
  }
  async function load(operators, operator) {
    const [roles, members] = await Promise.all([operators.listRoles(operator.id), operators.listMemberships(operator.id)]);
    return { operator, roles, members };
  }
  function entry({ operator, roles, members }, names) {
    return {
      id: operator.id, slug: operator.slug, name: operator.name, status: operator.status,
      roles: roles.map(publicRole),
      missingRoles: STANDARD_OPERATOR_ROLES.filter(role => !roles.some(item => item.id === role.id)).map(role => role.id),
      members: members.map(member => ({
        userId: member.userId, username: names.get(member.userId) ?? null,
        roleId: member.roleId, status: member.status, revision: member.revision,
      })),
    };
  }
  async function operatorEntry(operators, operatorId) {
    const operator = await operators.getOperatorById(operatorId);
    if (!operator) return null;
    const loaded = await load(operators, operator);
    return entry(loaded, await usernames(loaded.members.map(member => member.userId)));
  }
  async function existingOperator(operators, operatorId) {
    const operator = await operators.getOperatorById(operatorId);
    if (!operator) fail(404);
    return operator;
  }

  handlers.set('POST /studio/api/admin/operator-create', async context => {
    keysOf(context.body, ['slug', 'name']);
    const slug = operatorSlug(context.body.slug);
    const name = operatorName(context.body.name);
    const actor = context.actor.user;
    const operators = await store();
    const created = await operators.createOperator({ actor, operatorId: slug, slug, name });
    journal.record({ actor, action: 'operator-create', operatorId: created.id, target: { slug: created.slug } });
    // The operator row has committed. A role that fails here is reported, and
    // operator-role can add it later; the operator is not rolled back.
    const missingRoles = [];
    for (const role of STANDARD_OPERATOR_ROLES) {
      try {
        await operators.upsertRole({
          actor, operatorId: created.id, roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable,
        });
        journal.record({ actor, action: 'operator-role', operatorId: created.id, target: { roleId: role.id, permissions: [...role.permissions] } });
      } catch {
        missingRoles.push(role.id);
      }
    }
    let operator;
    try { operator = entry(await load(operators, created), new Map()); }
    catch { operator = { id: created.id, slug: created.slug, name: created.name, status: created.status, roles: [], missingRoles, members: [] }; }
    return { ok: true, operator, missingRoles };
  });

  handlers.set('POST /studio/api/admin/operator-role', async context => {
    keysOf(context.body, ['operatorId', 'roleId', 'permissions']);
    const standard = standardRole(context.body.roleId);
    if (!standard) fail(422);
    const permissions = permissionList(context.body.permissions);
    const admin = permissions.includes(OPERATOR_ADMIN_PERMISSION);
    if (standard.id === 'partner-admin' ? !admin : admin) fail(422);
    const actor = context.actor.user;
    const operators = await store();
    const operator = await existingOperator(operators, context.body.operatorId);
    const existing = await operators.getRole(operator.id, standard.id);
    const saved = await operators.upsertRole({
      actor, operatorId: operator.id, roleId: standard.id,
      label: existing?.label ?? standard.label, permissions, delegable: existing?.delegable ?? standard.delegable,
    });
    journal.record({ actor, action: 'operator-role', operatorId: operator.id, target: { roleId: saved.id, permissions: [...saved.permissions] } });
    return { ok: true, role: publicRole(saved), operator: await operatorEntry(operators, operator.id) };
  });

  handlers.set('POST /studio/api/admin/operator-membership', async context => {
    const body = context.body;
    keysOf(body, ['operatorId', 'roleId', 'status'], ['userId', 'username', 'expectedRevision']);
    if (Object.hasOwn(body, 'userId') === Object.hasOwn(body, 'username')) fail(400);
    const change = Object.hasOwn(body, 'expectedRevision');
    if (change && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1)) fail(400);
    if (typeof body.status !== 'string' || !membershipStatuses.has(body.status)) fail(422);
    const actor = context.actor.user;
    const operators = await store();
    const operator = await existingOperator(operators, body.operatorId);
    const role = await operators.getRole(operator.id, body.roleId);
    if (!role) fail(422);
    const lookup = accounts();
    const account = Object.hasOwn(body, 'userId') ? await lookup.byId(body.userId) : await lookup.byUsername(body.username);
    if (!account || account.role !== 'partner') fail(422);
    const input = { actor, operatorId: operator.id, userId: account.userId, roleId: role.id, status: body.status };
    // Without expectedRevision the store only inserts (an existing member is 409).
    // With it the store locks the operator, refuses to remove the last
    // administrator and compares the revision before it writes.
    const saved = await operators.upsertMembership(change ? { ...input, expectedRevision: body.expectedRevision } : input);
    journal.record({
      actor, action: 'operator-membership', operatorId: operator.id,
      target: { userId: saved.userId, roleId: saved.roleId, status: saved.status, revision: saved.revision },
    });
    return {
      ok: true,
      membership: { userId: saved.userId, username: account.username, roleId: saved.roleId, status: saved.status, revision: saved.revision },
      operator: await operatorEntry(operators, operator.id),
    };
  });

  return Object.freeze({
    handlers,
    listOperatorDirectory: async () => {
      const operators = await store();
      const loaded = await Promise.all((await operators.listOperators()).map(operator => load(operators, operator)));
      const names = await usernames(loaded.flatMap(item => item.members.map(member => member.userId)));
      return loaded.map(item => entry(item, names));
    },
  });
}
