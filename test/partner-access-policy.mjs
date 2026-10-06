import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTNER_PERMISSIONS, isPartnerPermission, allowsPartnerResource, allowsPartnerRoleAssignment,
} from '../web/partner-access-policy.mjs';
import { effectiveAccountRole } from '../web/account-role.mjs';
import { meetsStudioAdminActionRole } from '../lab/lib/studio-access-policy.mjs';

const scope = () => ({ environment: 'qa', workspaceId: 'scoutgaming' });
const resource = (operatorId = 'operator-north') => ({ scope: scope(), operatorId });
const role = (id, permissions, operatorId = 'operator-north') => ({
  id, permissions: [...permissions], delegable: true, ...resource(operatorId),
});
function context(operatorId = 'operator-north', userId = 'staff-1') {
  return {
    account: { userId, role: 'partner', status: 'active' }, scope: scope(),
    operator: { id: operatorId, status: 'active', scope: scope() },
    membership: { userId, status: 'active', roleId: 'manager', ...resource(operatorId) },
    role: role('manager', PARTNER_PERMISSIONS, operatorId),
  };
}
function assignment() {
  return {
    membership: { userId: 'staff-2', status: 'active', roleId: 'viewer', ...resource() },
    currentRole: role('viewer', ['overview.read']),
    nextRole: role('support', ['overview.read', 'players.read']),
  };
}

test('two operators have symmetric isolation even when their role IDs are identical', () => {
  for (const operatorId of ['operator-north', 'operator-south']) {
    const actor = context(operatorId);
    for (const permission of PARTNER_PERMISSIONS) {
      assert.equal(allowsPartnerResource(actor, permission, resource(operatorId)), true);
      const other = operatorId === 'operator-north' ? 'operator-south' : 'operator-north';
      assert.equal(allowsPartnerResource(actor, permission, resource(other)), false);
    }
  }
});

test('missing permissions, unknown actions, production tools and money mutations fail closed', () => {
  const actor = context();
  actor.role.permissions = ['overview.read'];
  assert.equal(allowsPartnerResource(actor, 'overview.read', resource()), true);
  assert.equal(allowsPartnerResource(actor, 'players.read', resource()), false);
  for (const action of [undefined, null, '', '*', 'admin', 'users/role', 'roles.manage',
    'dealers.manage', 'generations', 'wallet.credit', 'apikeys/credit', 'players/password',
    '__proto__', 'constructor', 'Overview.read', 'overview.read ', {}, new String('overview.read')]) {
    assert.equal(isPartnerPermission(action), false);
    assert.equal(allowsPartnerResource(context(), action, resource()), false);
  }
});

test('every stored ownership projection must agree on operator and workspace', () => {
  for (const part of ['membership', 'role']) {
    const actor = context(); actor[part].operatorId = 'operator-south';
    assert.equal(allowsPartnerResource(actor, 'overview.read', resource()), false, part);
  }
  for (const part of ['operator', 'membership', 'role']) {
    for (const key of ['environment', 'workspaceId']) {
      const actor = context(); actor[part].scope[key] = 'other';
      assert.equal(allowsPartnerResource(actor, 'overview.read', resource()), false, `${part}.${key}`);
    }
  }
  for (const key of ['environment', 'workspaceId']) {
    const target = resource(); target.scope[key] = 'other';
    assert.equal(allowsPartnerResource(context(), 'overview.read', target), false);
  }
  const actor = context(); actor.membership.userId = 'someone-else';
  assert.equal(allowsPartnerResource(actor, 'overview.read', resource()), false);
  const wrongRole = context(); wrongRole.membership.roleId = 'other-role';
  assert.equal(allowsPartnerResource(wrongRole, 'overview.read', resource()), false);
});

test('revocation or suspension of account, operator or membership immediately denies the projection', () => {
  for (const part of ['account', 'operator', 'membership']) {
    for (const status of ['invited', 'pending', 'suspended', 'revoked', '', null]) {
      const actor = context(); actor[part].status = status;
      assert.equal(allowsPartnerResource(actor, 'overview.read', resource()), false, `${part}.${status}`);
    }
  }
});

test('legacy accounts and preview grants do not acquire partner access or weaken existing login', () => {
  for (const value of ['reader', 'staff', 'player', 'admin', 'superadmin', 'internal', 'PARTNER', 2]) {
    const actor = context(); actor.account.role = value;
    assert.equal(allowsPartnerResource(actor, 'overview.read', resource()), false);
  }
  assert.equal(effectiveAccountRole('reader'), 'player');
  assert.equal(effectiveAccountRole('staff'), 'player');
  assert.equal(effectiveAccountRole('partner'), null); // Login remains closed until T2 session integration.
  assert.equal(meetsStudioAdminActionRole('partner', 'users/role'), false);
  assert.equal(meetsStudioAdminActionRole('admin', 'users/role'), true);
  assert.equal(allowsPartnerResource({ preview: true, accessClass: 'internal', role: 'admin' },
    'overview.read', resource()), false);
});

test('malformed and inherited policy data fail closed without invoking getters', () => {
  for (const value of [null, undefined, [], 'partner', {}, Object.create(context())]) {
    assert.equal(allowsPartnerResource(value, 'overview.read', resource()), false);
  }
  const getter = Object.defineProperty({}, 'account', { get() { throw Error('must not execute'); } });
  assert.equal(allowsPartnerResource(getter, 'overview.read', resource()), false);
  for (const permissions of [null, '*', ['*'], ['overview.read', 'overview.read'],
    ['overview.read', 'unknown'], [new String('overview.read')], new Array(1)]) {
    const actor = context(); actor.role.permissions = permissions;
    assert.equal(allowsPartnerResource(actor, 'overview.read', resource()), false);
  }
  for (const value of ['', '../north', 'north/south', 1, {}, 'north\n']) {
    const actor = context(value);
    assert.equal(allowsPartnerResource(actor, 'overview.read', resource(value)), false);
  }
  const extraScope = context(); extraScope.scope.admin = true;
  assert.equal(allowsPartnerResource(extraScope, 'overview.read', resource()), false);
  assert.equal(allowsPartnerResource(context(), 'overview.read', Object.create(resource())), false);
});

test('partner managers may assign an existing narrower or equal role to another staff member', () => {
  assert.equal(allowsPartnerRoleAssignment(context(), assignment()), true);
  const target = assignment(); target.nextRole = target.currentRole;
  assert.equal(allowsPartnerRoleAssignment(context(), target), true);
  const empty = assignment(); empty.nextRole = role('no-access', []);
  assert.equal(allowsPartnerRoleAssignment(context(), empty), true);
});

test('role assignment requires the explicit permission and cannot escalate another member', () => {
  const actor = context(); actor.role.permissions = ['overview.read', 'team.read', 'team.invite'];
  assert.equal(allowsPartnerRoleAssignment(actor, assignment()), false);
  actor.role.permissions = ['overview.read', 'team.roles.assign'];
  assert.equal(allowsPartnerRoleAssignment(actor, assignment()), false); // next role includes players.read
  const target = assignment(); target.nextRole.permissions = ['overview.read'];
  assert.equal(allowsPartnerRoleAssignment(actor, target), true);
  target.currentRole.permissions.push('players.read');
  assert.equal(allowsPartnerRoleAssignment(actor, target), false); // cannot demote a superior either
});

test('internal delegation mandates are required for both current and next role', () => {
  for (const part of ['currentRole', 'nextRole']) {
    for (const mandate of [false, undefined, null, 'true', 1]) {
      const target = assignment(); target[part].delegable = mandate;
      assert.equal(allowsPartnerRoleAssignment(context(), target), false);
    }
    const target = assignment(); delete target[part].delegable;
    assert.equal(allowsPartnerRoleAssignment(context(), target), false);
  }
  // A protected operator administrator can still delegate explicitly allowed lesser roles.
  const actor = context(); actor.role.delegable = false;
  assert.equal(allowsPartnerRoleAssignment(actor, assignment()), true);
});

test('role assignment cannot target self, another operator, an inactive member or mismatched current role', () => {
  for (const change of [
    target => { target.membership.userId = 'staff-1'; },
    target => { target.membership.operatorId = 'operator-south'; },
    target => { target.membership.status = 'revoked'; },
    target => { target.membership.status = 'invited'; },
    target => { target.membership.roleId = 'different-role'; },
    target => { target.currentRole.operatorId = 'operator-south'; },
    target => { target.nextRole.operatorId = 'operator-south'; },
    target => { target.nextRole.scope.environment = 'production'; },
    target => { target.nextRole.permissions = ['users/role']; },
  ]) {
    const target = assignment(); change(target);
    assert.equal(allowsPartnerRoleAssignment(context(), target), false);
  }
  for (const value of [null, undefined, {}, Object.create(assignment())]) {
    assert.equal(allowsPartnerRoleAssignment(context(), value), false);
  }
});

test('policy evaluation does not modify the projections or exported permission catalog', () => {
  const actor = context(), target = assignment(), before = structuredClone({ actor, target });
  assert.equal(allowsPartnerRoleAssignment(actor, target), true);
  assert.deepEqual({ actor, target }, before);
  assert.equal(Object.isFrozen(PARTNER_PERMISSIONS), true);
  assert.throws(() => PARTNER_PERMISSIONS.push('users/role'), TypeError);
});
