// Operator tenant storage. Ownership is environment_id + workspace_id + operator_id.
// A request slug is only a lookup key inside this scope. It is never an owner.
// Membership user_id stores croupier_auth.users.id rendered as text. It is not
// the username and not a digest of the username: usernames can change, the
// numeric identity does not. The text must match the partner-policy id pattern
// so it can be compared with account.userId.
// audit_events.action is closed to document and media actions
// (ops/neon-studio/001-studio-metadata.sql). Operator writes do not fit that
// CHECK, so this store does not insert audit rows and does not invent a
// parallel ledger. Writes still require a validated actor for the caller.
// Branding is package data. It is not a permission boundary.
import { isAdministratorRole } from '../account-role.mjs';
import { PARTNER_PERMISSIONS, isPartnerPermission } from '../partner-access-policy.mjs';
import {
  StudioStorageError, canonicalStudioJson, cloneStudioJson, studioStorageFailure, validateActor, validateStudioScope,
} from './studio-contract.mjs';

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const slugPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const tokenPattern = /^[a-z][a-z0-9-]{0,63}$/;
const reservedTokens = new Set(['original', 'constructor', 'prototype']);
const operatorStatuses = new Set(['active', 'suspended']);
const membershipStatuses = new Set(['active', 'suspended', 'invited']);
const fail = (code, status = 503) => { throw new StudioStorageError(code, status); };

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownValue(value, key) {
  if (!plain(value)) fail('studio_invalid_data', 422);
  const property = Object.getOwnPropertyDescriptor(value, key);
  if (!property || !Object.hasOwn(property, 'value')) fail('studio_invalid_data', 422);
  return property.value;
}

function optionalOwn(value, key) {
  if (!plain(value) || !Object.hasOwn(value, key)) return undefined;
  return ownValue(value, key);
}

function actorOf(input) {
  if (!plain(input) || !Object.hasOwn(input, 'actor')) fail('studio_invalid_actor', 422);
  const property = Object.getOwnPropertyDescriptor(input, 'actor');
  if (!property || !Object.hasOwn(property, 'value')) fail('studio_invalid_actor', 422);
  return validateActor(property.value);
}

function idText(value, code = 'studio_invalid_data', status = 422) {
  if (typeof value !== 'string' || !idPattern.test(value)) fail(code, status);
  return value;
}

function slugText(value, code = 'studio_invalid_data', status = 422) {
  if (typeof value !== 'string' || value.length > 63 || !slugPattern.test(value)) fail(code, status);
  return value;
}

function labelText(value, max, code = 'studio_invalid_data', status = 422) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || value.trim() !== value
    || /[\u0000-\u001f\u007f-\u009f]/.test(value)) fail(code, status);
  return value;
}

function integer(value, min, code, status) {
  if (typeof value === 'string') {
    if (!/^(?:0|[1-9]\d*)$/.test(value)) fail(code, status);
    value = Number(value);
  }
  if (!Number.isSafeInteger(value) || value < min) fail(code, status);
  return value;
}

function statusText(value, allowed, code, status) {
  if (typeof value !== 'string' || !allowed.has(value)) fail(code, status);
  return value;
}

function canonicalPermissions(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length > PARTNER_PERMISSIONS.length || new Set(value).size !== value.length
    || value.some(item => !isPartnerPermission(item))) fail('studio_invalid_data', 422);
  const ordered = PARTNER_PERMISSIONS.filter(item => value.includes(item));
  const text = canonicalStudioJson(ordered);
  if (text.length > 4000) fail('studio_invalid_data', 422);
  return text;
}

function canonicalIdList(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 32) fail('studio_invalid_data', 422);
  const ids = value.map(item => {
    if (typeof item !== 'string' || !tokenPattern.test(item) || reservedTokens.has(item)) fail('studio_invalid_data', 422);
    return item;
  });
  if (new Set(ids).size !== ids.length) fail('studio_invalid_data', 422);
  const text = canonicalStudioJson([...ids].sort());
  if (text.length > 8000) fail('studio_invalid_data', 422);
  return text;
}

function canonicalBranding(value) {
  const copy = cloneStudioJson(value, { maxBytes: 8000, maxNodes: 200, maxDepth: 6 });
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) fail('studio_invalid_data', 422);
  const text = canonicalStudioJson(copy);
  if (text.length > 8000) fail('studio_invalid_data', 422);
  return text;
}

function storedJson(text, canonicalize, code = 'studio_corrupt_operator') {
  if (typeof text !== 'string') fail(code);
  let parsed;
  try { parsed = JSON.parse(text); } catch { fail(code); }
  let canonical;
  try { canonical = canonicalize(parsed); } catch { fail(code); }
  if (canonical !== text) fail(code);
  return JSON.parse(canonical);
}

function queryRunner(sql) {
  if (typeof sql?.query === 'function') return (text, values) => sql.query(text, values);
  if (typeof sql === 'function') return sql;
  fail('studio_invalid_configuration', 503);
}

// sql is async (text, values) => rows, or a client with sql.query(text, values).
// The same bound-parameter shape as the other Postgres stores. Not a template tag.
export async function createOperatorStore({ sql, scope, now = Date.now } = {}) {
  scope = validateStudioScope(scope);
  const run = queryRunner(sql);
  if (typeof now !== 'function') fail('studio_invalid_configuration', 503);
  const parameters = [scope.environment, scope.workspaceId];
  async function query(text, values = []) {
    let result;
    try { result = await run(text, [...parameters, ...values]); }
    catch (error) { throw studioStorageFailure(error); }
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.rows)) return result.rows;
    fail('studio_storage_unavailable');
  }
  function clock() {
    const at = now();
    if (!Number.isSafeInteger(at) || at < 0) fail('studio_invalid_data', 422);
    return at;
  }
  function operator(row) {
    if (!row || row.environment_id !== scope.environment || row.workspace_id !== scope.workspaceId) fail('studio_corrupt_operator');
    return Object.freeze({
      id: idText(row.operator_id, 'studio_corrupt_operator', 503),
      slug: slugText(row.slug, 'studio_corrupt_operator', 503),
      name: labelText(row.name, 120, 'studio_corrupt_operator', 503),
      status: statusText(row.status, operatorStatuses, 'studio_corrupt_operator'),
      createdAtMs: integer(row.created_at_ms, 0, 'studio_corrupt_operator', 503),
      scope,
    });
  }
  function role(row) {
    if (!row || row.environment_id !== scope.environment || row.workspace_id !== scope.workspaceId) fail('studio_corrupt_operator');
    return Object.freeze({
      id: idText(row.role_id, 'studio_corrupt_operator', 503),
      operatorId: idText(row.operator_id, 'studio_corrupt_operator', 503),
      label: labelText(row.label, 80, 'studio_corrupt_operator', 503),
      permissions: Object.freeze(storedJson(row.permissions, canonicalPermissions)),
      delegable: row.delegable === true || row.delegable === false ? row.delegable : fail('studio_corrupt_operator'),
      scope,
    });
  }
  function membership(row) {
    if (!row || row.environment_id !== scope.environment || row.workspace_id !== scope.workspaceId) fail('studio_corrupt_operator');
    return Object.freeze({
      userId: idText(row.user_id, 'studio_corrupt_operator', 503),
      operatorId: idText(row.operator_id, 'studio_corrupt_operator', 503),
      roleId: idText(row.role_id, 'studio_corrupt_operator', 503),
      status: statusText(row.status, membershipStatuses, 'studio_corrupt_operator'),
      revision: integer(row.revision, 1, 'studio_corrupt_operator', 503),
      createdAtMs: integer(row.created_at_ms, 0, 'studio_corrupt_operator', 503),
      scope,
    });
  }
  function packageRow(row) {
    if (!row || row.environment_id !== scope.environment || row.workspace_id !== scope.workspaceId) fail('studio_corrupt_operator');
    return Object.freeze({
      operatorId: idText(row.operator_id, 'studio_corrupt_operator', 503),
      revision: integer(row.package_revision, 1, 'studio_corrupt_operator', 503),
      lanes: Object.freeze(storedJson(row.lanes, canonicalIdList)),
      games: Object.freeze(storedJson(row.games, canonicalIdList)),
      tables: Object.freeze(storedJson(row.tables, canonicalIdList)),
      branding: Object.freeze(storedJson(row.branding, canonicalBranding)),
      publishedAtMs: integer(row.published_at_ms, 0, 'studio_corrupt_operator', 503),
      scope,
    });
  }
  async function one(text, values) {
    const rows = await query(text, values);
    if (rows.length > 1) fail('studio_corrupt_operator');
    return rows[0] ? operator(rows[0]) : null;
  }
  async function listOperators() {
    const rows = await query(`/* operator-store:list-operators */
      SELECT environment_id, workspace_id, operator_id, slug, name, status, created_at_ms
      FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 ORDER BY slug`);
    return Object.freeze(rows.map(operator));
  }
  async function getOperatorBySlug(slug) {
    return one(`/* operator-store:operator-by-slug */
      SELECT environment_id, workspace_id, operator_id, slug, name, status, created_at_ms
      FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND slug=$3 LIMIT 2`,
    [slugText(slug)]);
  }
  async function getOperatorById(id) {
    return one(`/* operator-store:operator-by-id */
      SELECT environment_id, workspace_id, operator_id, slug, name, status, created_at_ms
      FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 LIMIT 2`,
    [idText(id)]);
  }
  async function listRoles(operatorId) {
    const rows = await query(`/* operator-store:list-roles */
      SELECT environment_id, workspace_id, operator_id, role_id, label, permissions, delegable
      FROM croupier_studio.operator_roles WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
      ORDER BY role_id`, [idText(operatorId)]);
    return Object.freeze(rows.map(role));
  }
  async function getRole(operatorId, roleId) {
    const rows = await query(`/* operator-store:get-role */
      SELECT environment_id, workspace_id, operator_id, role_id, label, permissions, delegable
      FROM croupier_studio.operator_roles
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND role_id=$4 LIMIT 2`,
    [idText(operatorId), idText(roleId)]);
    if (rows.length > 1) fail('studio_corrupt_operator');
    return rows[0] ? role(rows[0]) : null;
  }
  async function getMembership(operatorId, userId) {
    const rows = await query(`/* operator-store:get-membership */
      SELECT environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms
      FROM croupier_studio.operator_memberships
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND user_id=$4 LIMIT 2`,
    [idText(operatorId), idText(userId)]);
    if (rows.length > 1) fail('studio_corrupt_operator');
    return rows[0] ? membership(rows[0]) : null;
  }
  async function listMemberships(operatorId) {
    const rows = await query(`/* operator-store:list-memberships */
      SELECT environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms
      FROM croupier_studio.operator_memberships
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 ORDER BY user_id`, [idText(operatorId)]);
    return Object.freeze(rows.map(membership));
  }
  async function getCurrentPackage(operatorId) {
    const rows = await query(`/* operator-store:current-package */
      SELECT environment_id, workspace_id, operator_id, package_revision, lanes, games, tables, branding, published_at_ms
      FROM croupier_studio.operator_packages
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
      ORDER BY package_revision DESC LIMIT 1`, [idText(operatorId)]);
    if (rows.length > 1) fail('studio_corrupt_operator');
    return rows[0] ? packageRow(rows[0]) : null;
  }
  async function resolvePartnerContext({ account, operatorSlug } = {}) {
    const userId = idText(ownValue(account, 'userId'));
    const accountRole = ownValue(account, 'role');
    const accountStatus = ownValue(account, 'status');
    if (typeof accountRole !== 'string' || typeof accountStatus !== 'string') fail('studio_invalid_data', 422);
    if (isAdministratorRole(accountRole)) return accountStatus === 'active' ? Object.freeze({ internalPreview: true }) : null;
    if (accountRole !== 'partner' || accountStatus !== 'active') return null;
    const found = await getOperatorBySlug(operatorSlug);
    if (!found) return null;
    const member = await getMembership(found.id, userId);
    if (!member || member.status !== 'active') return null;
    const assigned = await getRole(found.id, member.roleId);
    if (!assigned || assigned.operatorId !== found.id) fail('studio_corrupt_operator');
    return {
      account: Object.freeze({ userId, role: 'partner', status: 'active' }),
      scope,
      operator: Object.freeze({ id: found.id, status: found.status, scope }),
      membership: Object.freeze({
        userId: member.userId, roleId: member.roleId, status: member.status, revision: member.revision,
        operatorId: found.id, scope,
      }),
      role: Object.freeze({
        id: assigned.id, permissions: assigned.permissions, delegable: assigned.delegable,
        operatorId: found.id, scope,
      }),
    };
  }
  async function createOperator(input = {}) {
    actorOf(input);
    const operatorId = idText(ownValue(input, 'operatorId'));
    const slug = slugText(ownValue(input, 'slug'));
    const name = labelText(ownValue(input, 'name'), 120);
    const status = statusText(optionalOwn(input, 'status') ?? 'active', operatorStatuses, 'studio_invalid_data', 422);
    const row = (await query(`/* operator-store:create-operator */
      INSERT INTO croupier_studio.operators
        (environment_id, workspace_id, operator_id, slug, name, status, created_at_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING environment_id, workspace_id, operator_id, slug, name, status, created_at_ms`,
    [operatorId, slug, name, status, clock()]))[0];
    if (!row) fail('studio_storage_unavailable');
    return operator(row);
  }
  async function upsertRole(input = {}) {
    actorOf(input);
    const operatorId = idText(ownValue(input, 'operatorId'));
    const roleId = idText(ownValue(input, 'roleId'));
    const label = labelText(ownValue(input, 'label'), 80);
    const permissions = canonicalPermissions(ownValue(input, 'permissions'));
    const delegable = ownValue(input, 'delegable');
    if (delegable !== true && delegable !== false) fail('studio_invalid_data', 422);
    const row = (await query(`/* operator-store:upsert-role */
      INSERT INTO croupier_studio.operator_roles
        (environment_id, workspace_id, operator_id, role_id, label, permissions, delegable)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (environment_id, workspace_id, operator_id, role_id)
      DO UPDATE SET label=EXCLUDED.label, permissions=EXCLUDED.permissions, delegable=EXCLUDED.delegable
      RETURNING environment_id, workspace_id, operator_id, role_id, label, permissions, delegable`,
    [operatorId, roleId, label, permissions, delegable]))[0];
    if (!row) fail('studio_storage_unavailable');
    return role(row);
  }
  async function upsertMembership(input = {}) {
    actorOf(input);
    const operatorId = idText(ownValue(input, 'operatorId'));
    const userId = idText(ownValue(input, 'userId'));
    const roleId = idText(ownValue(input, 'roleId'));
    const status = statusText(ownValue(input, 'status'), membershipStatuses, 'studio_invalid_data', 422);
    const expected = optionalOwn(input, 'expectedRevision');
    if (expected === undefined) {
      const row = (await query(`/* operator-store:create-membership */
        INSERT INTO croupier_studio.operator_memberships
          (environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms)
        VALUES ($1,$2,$3,$4,$5,$6,1,$7)
        RETURNING environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms`,
      [operatorId, userId, roleId, status, clock()]))[0];
      if (!row) fail('studio_storage_unavailable');
      const saved = membership(row);
      if (saved.revision !== 1) fail('studio_corrupt_operator');
      return saved;
    }
    const revision = integer(expected, 1, 'studio_invalid_data', 422);
    const row = (await query(`/* operator-store:cas-membership */
      UPDATE croupier_studio.operator_memberships
      SET role_id=$6, status=$7, revision=revision+1
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND user_id=$4 AND revision=$5
      RETURNING environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms`,
    [operatorId, userId, revision, roleId, status]))[0];
    if (!row) fail('studio_conflict', 409);
    const saved = membership(row);
    if (saved.revision !== revision + 1) fail('studio_corrupt_operator');
    return saved;
  }
  async function publishPackage(input = {}) {
    actorOf(input);
    const operatorId = idText(ownValue(input, 'operatorId'));
    const lanes = canonicalIdList(ownValue(input, 'lanes'));
    const games = canonicalIdList(ownValue(input, 'games'));
    const tables = canonicalIdList(ownValue(input, 'tables'));
    const branding = canonicalBranding(ownValue(input, 'branding'));
    const row = (await query(`/* operator-store:publish-package */
      INSERT INTO croupier_studio.operator_packages
        (environment_id, workspace_id, operator_id, package_revision, lanes, games, tables, branding, published_at_ms)
      SELECT $1,$2,$3,COALESCE((SELECT MAX(package_revision) FROM croupier_studio.operator_packages
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3),0)+1,$4,$5,$6,$7,$8
      RETURNING environment_id, workspace_id, operator_id, package_revision, lanes, games, tables, branding, published_at_ms`,
    [operatorId, lanes, games, tables, branding, clock()]))[0];
    if (!row) fail('studio_storage_unavailable');
    return packageRow(row);
  }
  return Object.freeze({
    scope, listOperators, getOperatorBySlug, getOperatorById, listRoles, getRole, getMembership, listMemberships,
    getCurrentPackage, resolvePartnerContext, createOperator, upsertRole, upsertMembership, publishPackage,
  });
}
