// Operator tenant storage. Ownership is environment_id + workspace_id + operator_id.
// A request slug is only a lookup key inside this scope. It is never an owner.
// Membership user_id stores croupier_auth.users.id rendered as text. It is not
// the username and not a digest of the username: usernames can change, the
// numeric identity does not. The text must match the partner-policy id pattern
// so it can be compared with account.userId.
// Every configuration write and its operator_audit_events row commit together.
// A missing/unwritable journal rejects the mutation; server logging is not durability.
// Branding is package data. It is not a permission boundary.
import { createHash, randomUUID } from 'node:crypto';
import { publicEditableBranding } from './partner-branding.mjs';
import { OPERATOR_LIFECYCLE_KEY, readOperatorLifecycle } from './operator-lifecycle.mjs';
import { isAdministratorRole } from '../../packages/studio-access/account-role.mjs';
import { PARTNER_PERMISSIONS, isPartnerPermission, isOperatorAdmin } from '../../packages/studio-access/server/partner-access-policy.mjs';
import {
  StudioStorageError, canonicalStudioJson, cloneStudioJson, studioStorageFailure, validateActor, validateStudioScope,
} from './studio-contract.mjs';

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const slugPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const tokenPattern = /^[a-z][a-z0-9-]{0,63}$/;
const reservedTokens = new Set(['original', 'constructor', 'prototype']);
const operatorStatuses = new Set(['active', 'suspended']);
const membershipStatuses = new Set(['active', 'suspended', 'invited']);
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const auditClasses = new Set(['internal-admin', 'partner', 'activation', 'system']);
const auditActions = new Set(['operator.create', 'role.save', 'membership.create', 'membership.update', 'team.invite', 'team.role', 'team.suspend', 'team.reactivate', 'membership.activate', 'membership.compensate', 'package.publish']);
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
export async function createOperatorStore({ sql, scope, now = Date.now, transaction = null } = {}) {
  scope = validateStudioScope(scope);
  const run = queryRunner(sql);
  if (typeof now !== 'function' || transaction !== null && typeof transaction !== 'function') fail('studio_invalid_configuration', 503);
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
  // One statement gives a current, internally consistent publication snapshot
  // even inside a caller's READ COMMITTED wallet transaction.
  async function getCurrentPresentationContext(slug) {
    const rows = await query(`/* operator-store:presentation-context */
      SELECT row_to_json(o) AS operator,
        (SELECT row_to_json(p) FROM croupier_studio.operator_packages p
          WHERE p.environment_id=o.environment_id AND p.workspace_id=o.workspace_id AND p.operator_id=o.operator_id
          ORDER BY p.package_revision DESC LIMIT 1) AS package,
        (SELECT d.value FROM croupier_studio.documents d
          WHERE d.environment_id=o.environment_id AND d.workspace_id=o.workspace_id AND d.kind='administration') AS administration
      FROM croupier_studio.operators o WHERE o.environment_id=$1 AND o.workspace_id=$2 AND o.slug=$3 LIMIT 2`, [slugText(slug)]);
    if (rows.length > 1) fail('studio_corrupt_operator');
    if (!rows.length) return { operator: null, package: null };
    const row = rows[0], owner = operator(row.operator), pack = row.package ? packageRow(row.package) : null;
    if (pack && pack.operatorId !== owner.id) fail('studio_corrupt_operator');
    return { operator: owner, package: pack, administration: row.administration };
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
  // READ COMMITTED gives every statement a fresh snapshot, but a single
  // statement's subqueries do not. Two demotions can both count the other
  // admin and both commit (write skew) unless the check and the write share
  // one connection: lock the operator, then read, then write.
  async function withOperatorLock(work) {
    if (transaction) return transaction(async client => {
      const run = queryRunner(client);
      return work(async (text, values = []) => {
        let result;
        try { result = await run(text, [...parameters, ...values]); } catch (error) { throw studioStorageFailure(error); }
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.rows)) return result.rows;
        fail('studio_storage_unavailable');
      });
    });
    if (typeof sql?.connect !== 'function') fail('studio_invalid_configuration', 503);
    let client, begun = false;
    try {
      client = await sql.connect();
      if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') fail('studio_invalid_configuration', 503);
      await client.query('BEGIN');
      begun = true;
      await client.query("SET LOCAL statement_timeout = '5000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
      async function txQuery(text, values = []) {
        let result;
        try { result = await client.query(text, [...parameters, ...values]); }
        catch (error) { throw studioStorageFailure(error); }
        if (Array.isArray(result)) return result;
        if (result && Array.isArray(result.rows)) return result.rows;
        fail('studio_storage_unavailable');
      }
      const result = await work(txQuery);
      const committed = await client.query('COMMIT');
      begun = false;
      if (committed?.command === 'ROLLBACK') fail('studio_transaction_rolled_back', 503);
      return result;
    } catch (error) {
      if (begun) try { await client.query('ROLLBACK'); } catch { /* Never expose the secondary database error. */ }
      throw studioStorageFailure(error);
    } finally {
      try { client?.release?.(); } catch { /* Caller owns pool health. */ }
    }
  }
  async function lockOperator(txQuery, operatorId) {
    const rows = await txQuery(`/* operator-store:lock-operator */
      SELECT environment_id, workspace_id, operator_id
      FROM croupier_studio.operators
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
      FOR UPDATE`, [operatorId]);
    if (rows.length > 1) fail('studio_corrupt_operator');
    return rows[0] ?? null;
  }
  async function guardRoles(txQuery, operatorId) {
    return txQuery(`/* operator-store:guard-roles */
      SELECT environment_id, workspace_id, operator_id, role_id, label, permissions, delegable
      FROM croupier_studio.operator_roles
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
      ORDER BY role_id`, [operatorId]);
  }
  async function guardMemberships(txQuery, operatorId) {
    return txQuery(`/* operator-store:guard-memberships */
      SELECT environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms
      FROM croupier_studio.operator_memberships
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
      ORDER BY user_id`, [operatorId]);
  }
  function countActiveAdmins(membershipRows, roleRows) {
    const roles = new Map();
    for (const row of roleRows) {
      const parsed = role(row);
      if (roles.has(parsed.id)) fail('studio_corrupt_operator');
      roles.set(parsed.id, parsed);
    }
    const seen = new Set();
    let count = 0;
    for (const row of membershipRows) {
      const member = membership(row);
      if (seen.has(member.userId)) fail('studio_corrupt_operator');
      seen.add(member.userId);
      const assigned = roles.get(member.roleId);
      if (assigned && isOperatorAdmin(member, assigned)) count += 1;
    }
    return count;
  }
  function rejectIfRemovesLastAdmin(beforeMemberships, beforeRoles, afterMemberships, afterRoles) {
    const before = countActiveAdmins(beforeMemberships, beforeRoles);
    const after = countActiveAdmins(afterMemberships, afterRoles);
    if (before >= 1 && after === 0) fail('studio_last_operator_admin', 409);
  }
  async function auditWrite(txQuery, input, { operatorId, action, resourceType, resourceId, beforeRevision = null, afterRevision = null, before = null, after = null }) {
    const actor = actorOf(input);
    const supplied = optionalOwn(input, 'audit');
    const context = supplied === undefined ? {
      actorId: 'actor-' + createHash('sha256').update(actor).digest('hex'), accessClass: 'system', requestId: randomUUID(),
    } : supplied;
    const actorId = idText(ownValue(context, 'actorId'));
    const accessClass = ownValue(context, 'accessClass'), requestId = ownValue(context, 'requestId');
    if (!auditClasses.has(accessClass) || typeof requestId !== 'string' || !uuidPattern.test(requestId)) fail('studio_invalid_data', 422);
    const requestedAction = optionalOwn(context, 'action') ?? action;
    if (!auditActions.has(requestedAction)) fail('studio_invalid_data', 422);
    const id = randomUUID();
    const rows = await txQuery(`/* operator-store:audit-write */
      INSERT INTO croupier_studio.operator_audit_events
        (environment_id, workspace_id, operator_id,event_id,actor_id,access_class,action,resource_type,resource_id,before_revision,after_revision,occurred_at_ms,request_id,changes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING event_id`,
      [operatorId,id,actorId,accessClass,requestedAction,resourceType,resourceId,beforeRevision,afterRevision,clock(),requestId,canonicalStudioJson({before,after})]);
    if (rows.length !== 1 || rows[0].event_id !== id) fail('studio_storage_unavailable');
  }
  async function listAuditEvents(operatorId, { limit = 50, cursor = null } = {}) {
    operatorId = idText(operatorId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('studio_invalid_data', 400);
    if (cursor !== null && (!plain(cursor) || !Number.isSafeInteger(cursor.atMs) || cursor.atMs < 0 || !uuidPattern.test(cursor.id))) fail('studio_invalid_data', 400);
    const rows = await query(`/* operator-store:list-audit */
      SELECT environment_id,workspace_id,operator_id,event_id,actor_id,access_class,action,resource_type,resource_id,before_revision,after_revision,occurred_at_ms,request_id,changes
      FROM (
        SELECT environment_id,workspace_id,operator_id,event_id,actor_id,access_class,action,resource_type,resource_id,before_revision,after_revision,occurred_at_ms,request_id,changes
        FROM croupier_studio.operator_audit_events WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
        UNION ALL
        SELECT environment_id,workspace_id,operator_id,event_id,actor_id,access_class,action,'draft' AS resource_type,operator_id AS resource_id,
          NULLIF(draft_revision-1,0) AS before_revision,draft_revision AS after_revision,occurred_at_ms,request_id,changes
        FROM croupier_studio.operator_branding_drafts WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
      ) journal
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
        AND ($4::bigint IS NULL OR (occurred_at_ms,event_id) < ($4::bigint,$5::text))
      ORDER BY occurred_at_ms DESC,event_id DESC LIMIT $6`, [operatorId,cursor?.atMs ?? null,cursor?.id ?? null,limit+1]);
    const entries = rows.slice(0,limit).map(row => {
      if (row.environment_id !== scope.environment || row.workspace_id !== scope.workspaceId || row.operator_id !== operatorId
        || !uuidPattern.test(row.event_id) || !uuidPattern.test(row.request_id) || !auditClasses.has(row.access_class)
        || !auditActions.has(row.action) && !['draft.save','draft.restore','draft.publish'].includes(row.action)) fail('studio_corrupt_operator');
      return {id:row.event_id,atMs:integer(row.occurred_at_ms,0,'studio_corrupt_operator',503),actor:idText(row.actor_id,'studio_corrupt_operator',503),
        accessClass:row.access_class,action:row.action,resourceType:row.resource_type,resourceId:idText(row.resource_id,'studio_corrupt_operator',503),
        beforeRevision:row.before_revision === null ? null : integer(row.before_revision,1,'studio_corrupt_operator',503),
        afterRevision:row.after_revision === null ? null : integer(row.after_revision,1,'studio_corrupt_operator',503),
        requestId:row.request_id,changes:storedJson(row.changes,canonicalStudioJson)};
    });
    const last=entries.at(-1);
    return {operatorId,entries,nextCursor:rows.length > limit && last ? {atMs:last.atMs,id:last.id} : null};
  }
  const membershipAudit = row => row ? {roleId:row.role_id,status:row.status} : null;
  const roleAudit = row => row ? {permissions:storedJson(row.permissions,canonicalPermissions),delegable:row.delegable} : null;
  async function createOperator(input = {}) {
    actorOf(input);
    const operatorId = idText(ownValue(input, 'operatorId'));
    const slug = slugText(ownValue(input, 'slug'));
    const name = labelText(ownValue(input, 'name'), 120);
    const status = statusText(optionalOwn(input, 'status') ?? 'active', operatorStatuses, 'studio_invalid_data', 422);
    return withOperatorLock(async txQuery => {
    const row = (await txQuery(`/* operator-store:create-operator */
      INSERT INTO croupier_studio.operators
        (environment_id, workspace_id, operator_id, slug, name, status, created_at_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING environment_id, workspace_id, operator_id, slug, name, status, created_at_ms`,
    [operatorId, slug, name, status, clock()]))[0];
    if (!row) fail('studio_storage_unavailable');
    await auditWrite(txQuery,input,{operatorId,action:'operator.create',resourceType:'operator',resourceId:operatorId,after:{status}});
    return operator(row);
    });
  }
  async function upsertRole(input = {}) {
    actorOf(input);
    const operatorId = idText(ownValue(input, 'operatorId'));
    const roleId = idText(ownValue(input, 'roleId'));
    const label = labelText(ownValue(input, 'label'), 80);
    const permissions = canonicalPermissions(ownValue(input, 'permissions'));
    const delegable = ownValue(input, 'delegable');
    if (delegable !== true && delegable !== false) fail('studio_invalid_data', 422);
    return withOperatorLock(async txQuery => {
      await lockOperator(txQuery, operatorId);
      const roles = await guardRoles(txQuery, operatorId);
      const existing = roles.find(row => row.role_id === roleId);
      if (existing) {
        const memberships = await guardMemberships(txQuery, operatorId);
        const nextRoles = roles.map(row => row === existing
          ? { ...row, label, permissions, delegable } : row);
        rejectIfRemovesLastAdmin(memberships, roles, memberships, nextRoles);
      }
      const row = (await txQuery(`/* operator-store:upsert-role */
        INSERT INTO croupier_studio.operator_roles
          (environment_id, workspace_id, operator_id, role_id, label, permissions, delegable)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (environment_id, workspace_id, operator_id, role_id)
        DO UPDATE SET label=EXCLUDED.label, permissions=EXCLUDED.permissions, delegable=EXCLUDED.delegable
        RETURNING environment_id, workspace_id, operator_id, role_id, label, permissions, delegable`,
      [operatorId, roleId, label, permissions, delegable]))[0];
      if (!row) fail('studio_storage_unavailable');
      await auditWrite(txQuery,input,{operatorId,action:'role.save',resourceType:'role',resourceId:roleId,before:roleAudit(existing),after:roleAudit(row)});
      return role(row);
    });
  }
  async function upsertMembership(input = {}) {
    actorOf(input);
    const operatorId = idText(ownValue(input, 'operatorId'));
    const userId = idText(ownValue(input, 'userId'));
    const roleId = idText(ownValue(input, 'roleId'));
    const status = statusText(ownValue(input, 'status'), membershipStatuses, 'studio_invalid_data', 422);
    const expected = optionalOwn(input, 'expectedRevision');
    if (expected === undefined) {
      return withOperatorLock(async txQuery => {
      if (!await lockOperator(txQuery,operatorId)) fail('studio_operator_not_found',404);
      const row = (await txQuery(`/* operator-store:create-membership */
        INSERT INTO croupier_studio.operator_memberships
          (environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms)
        VALUES ($1,$2,$3,$4,$5,$6,1,$7)
        RETURNING environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms`,
      [operatorId, userId, roleId, status, clock()]))[0];
      if (!row) fail('studio_storage_unavailable');
      const saved = membership(row);
      if (saved.revision !== 1) fail('studio_corrupt_operator');
      await auditWrite(txQuery,input,{operatorId,action:'membership.create',resourceType:'membership',resourceId:userId,afterRevision:1,after:membershipAudit(row)});
      return saved;
      });
    }
    const revision = integer(expected, 1, 'studio_invalid_data', 422);
    return withOperatorLock(async txQuery => {
      await lockOperator(txQuery, operatorId);
      const memberships = await guardMemberships(txQuery, operatorId);
      const roles = await guardRoles(txQuery, operatorId);
      const current = memberships.find(row => row.user_id === userId
        && integer(row.revision, 1, 'studio_corrupt_operator', 503) === revision);
      const nextRole = roles.find(row => row.role_id === roleId);
      if (current && nextRole) {
        const nextMemberships = memberships.map(row => row === current
          ? { ...row, role_id: roleId, status } : row);
        rejectIfRemovesLastAdmin(memberships, roles, nextMemberships, roles);
      }
      const row = (await txQuery(`/* operator-store:cas-membership */
        UPDATE croupier_studio.operator_memberships
        SET role_id=$6, status=$7, revision=revision+1
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND user_id=$4 AND revision=$5
        RETURNING environment_id, workspace_id, operator_id, user_id, role_id, status, revision, created_at_ms`,
      [operatorId, userId, revision, roleId, status]))[0];
      if (!row) fail('studio_conflict', 409);
      const saved = membership(row);
      if (saved.revision !== revision + 1) fail('studio_corrupt_operator');
      await auditWrite(txQuery,input,{operatorId,action:'membership.update',resourceType:'membership',resourceId:userId,beforeRevision:revision,afterRevision:saved.revision,before:membershipAudit(current),after:membershipAudit(row)});
      return saved;
    });
  }
  async function publishWithin(txQuery,input) {
      // Validation is part of the transaction callback, so a caught local error
      // poisons a shared repository mutation just like an SQL/CAS failure.
      actorOf(input);
      const operatorId = idText(ownValue(input, 'operatorId'));
      const lanes = canonicalIdList(ownValue(input, 'lanes'));
      const games = canonicalIdList(ownValue(input, 'games'));
      const tables = canonicalIdList(ownValue(input, 'tables'));
      let branding = canonicalBranding(ownValue(input, 'branding'));
      const expectedRevision = optionalOwn(input, 'expectedRevision');
      if (expectedRevision !== undefined && expectedRevision !== null) integer(expectedRevision, 1, 'studio_invalid_data', 422);
      if (!await lockOperator(txQuery, operatorId)) fail('studio_operator_not_found', 404);
      {
        const rows = await txQuery(`/* operator-store:current-package */
          SELECT environment_id, workspace_id, operator_id, package_revision, lanes, games, tables, branding, published_at_ms
          FROM croupier_studio.operator_packages
          WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
          ORDER BY package_revision DESC LIMIT 1`, [operatorId]);
        const current = rows[0] ? packageRow(rows[0]) : null;
        if (expectedRevision !== undefined && (current?.revision ?? null) !== expectedRevision) fail('studio_conflict', 409);
        const lifecycle = optionalOwn(input, 'lifecycle');
        if (lifecycle !== undefined && (!plain(lifecycle) || Object.keys(lifecycle).sort().join(',') !== 'archived,resourceId,resourceType'
          || !['operator','room'].includes(lifecycle.resourceType) || typeof lifecycle.archived !== 'boolean')) fail('studio_invalid_data',422);
        if (lifecycle !== undefined) idText(lifecycle.resourceId);
        const nextBranding = JSON.parse(branding);
        // Ordinary publication, including restoration of design drafts, may not
        // discard archives or bring an archived room back through old table IDs.
        if (lifecycle === undefined) {
          delete nextBranding[OPERATOR_LIFECYCLE_KEY];
          if (Object.hasOwn(current?.branding ?? {}, OPERATOR_LIFECYCLE_KEY)) nextBranding[OPERATOR_LIFECYCLE_KEY] = structuredClone(current.branding[OPERATOR_LIFECYCLE_KEY]);
        }
        const archived = readOperatorLifecycle(nextBranding);
        if (archived.rooms.some(entry => JSON.parse(tables).includes(entry.room.id) || entry.room.operatorId !== operatorId)) fail('studio_conflict',409);
        branding = canonicalBranding(nextBranding);
      }
      const row = (await txQuery(`/* operator-store:publish-package */
      INSERT INTO croupier_studio.operator_packages
        (environment_id, workspace_id, operator_id, package_revision, lanes, games, tables, branding, published_at_ms)
      SELECT $1,$2,$3,COALESCE((SELECT MAX(package_revision) FROM croupier_studio.operator_packages
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3),0)+1,$4,$5,$6,$7,$8
      RETURNING environment_id, workspace_id, operator_id, package_revision, lanes, games, tables, branding, published_at_ms`,
    [operatorId, lanes, games, tables, branding, clock()]))[0];
    if (!row) fail('studio_storage_unavailable');
      const saved=packageRow(row);
      await auditWrite(txQuery,input,{operatorId,action:'package.publish',resourceType:'package',resourceId:operatorId,beforeRevision:saved.revision > 1 ? saved.revision-1 : null,afterRevision:saved.revision,after:{lanes:saved.lanes,games:saved.games,tables:saved.tables,...(optionalOwn(input,'lifecycle') ? {lifecycle:optionalOwn(input,'lifecycle')} : {})}});
      return saved;
  }
  async function publishPackage(input={}) { return withOperatorLock(txQuery=>publishWithin(txQuery,input)); }
  async function changeOperatorStatus(input={}) {
    actorOf(input);
    const operatorId=idText(ownValue(input,'operatorId'));
    const status=statusText(ownValue(input,'status'),operatorStatuses,'studio_invalid_data',422);
    const expectedStatus=statusText(ownValue(input,'expectedStatus'),operatorStatuses,'studio_invalid_data',422);
    if (!Object.hasOwn(input,'expectedRevision') || !input.lifecycle || input.lifecycle.resourceType!=='operator'
      || input.lifecycle.resourceId!==operatorId || input.lifecycle.archived!==(status==='suspended')) fail('studio_invalid_data',422);
    const lifecycle=readOperatorLifecycle(ownValue(input,'branding'));
    if (Boolean(lifecycle.operator)!==(status==='suspended')) fail('studio_invalid_data',422);
    return withOperatorLock(async txQuery=>{
      if (!await lockOperator(txQuery,operatorId)) fail('studio_operator_not_found',404);
      const rows=await txQuery(`/* operator-store:operator-status */ UPDATE croupier_studio.operators SET status=$4
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND status=$5
        RETURNING environment_id,workspace_id,operator_id,slug,name,status,created_at_ms`,[operatorId,status,expectedStatus]);
      if(rows.length!==1)fail('studio_conflict',409);
      const pack=await publishWithin(txQuery,input);
      return {operator:operator(rows[0]),package:pack};
    });
  }

  const packageColumns='environment_id,workspace_id,operator_id,package_revision,lanes,games,tables,branding,published_at_ms';
  const draftColumns='environment_id,workspace_id,operator_id,draft_revision,base_package_revision,branding,source_package_revision,published_package_revision,action,occurred_at_ms';
  async function getPackage(operatorId, revision) {
    const rows=await query(`/* operator-store:package-by-revision */ SELECT ${packageColumns} FROM croupier_studio.operator_packages
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND package_revision=$4`,
      [idText(operatorId),integer(revision,1,'studio_invalid_data',400)]);
    if(rows.length>1)fail('studio_corrupt_operator');
    return rows[0]?packageRow(rows[0]):null;
  }
  async function listPackages(operatorId,{limit=20,beforeRevision=null}={}) {
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)fail('studio_invalid_data',400);
    if(beforeRevision!==null)integer(beforeRevision,1,'studio_invalid_data',400);
    return (await query(`/* operator-store:list-packages */ SELECT ${packageColumns} FROM croupier_studio.operator_packages
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND ($4::bigint IS NULL OR package_revision<$4)
      ORDER BY package_revision DESC LIMIT $5`,[idText(operatorId),beforeRevision,limit])).map(packageRow);
  }
  function draftRow(row) {
    if(!row||row.environment_id!==scope.environment||row.workspace_id!==scope.workspaceId)fail('studio_corrupt_operator');
    if(!['draft.save','draft.restore','draft.publish'].includes(row.action))fail('studio_corrupt_operator');
    return {operatorId:idText(row.operator_id,'studio_corrupt_operator',503),
      revision:integer(row.draft_revision,1,'studio_corrupt_operator',503),
      basePackageRevision:integer(row.base_package_revision,1,'studio_corrupt_operator',503),
      branding:storedJson(row.branding,canonicalBranding),action:row.action,
      sourcePackageRevision:row.source_package_revision===null?null:integer(row.source_package_revision,1,'studio_corrupt_operator',503),
      publishedPackageRevision:row.published_package_revision===null?null:integer(row.published_package_revision,1,'studio_corrupt_operator',503),
      updatedAt:integer(row.occurred_at_ms,0,'studio_corrupt_operator',503)};
  }
  async function latestDraft(run,operatorId) {
    const rows=await run(`/* operator-store:current-branding-draft */ SELECT ${draftColumns}
      FROM croupier_studio.operator_branding_drafts WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3
      ORDER BY draft_revision DESC LIMIT 1`,[idText(operatorId)]);
    if(rows.length>1)fail('studio_corrupt_operator');
    return rows[0]?draftRow(rows[0]):null;
  }
  async function getBrandingDraft(operatorId) { return latestDraft(query,operatorId); }
  async function draftWrite(txQuery,input,{before,branding,publishedPackageRevision=null}) {
    const operatorId=idText(ownValue(input,'operatorId')),actor=actorOf(input);
    const context=optionalOwn(input,'audit')??{actorId:'actor-'+createHash('sha256').update(actor).digest('hex'),accessClass:'system',requestId:randomUUID()};
    const actorId=idText(ownValue(context,'actorId')),accessClass=ownValue(context,'accessClass'),requestId=ownValue(context,'requestId');
    if(!['partner','internal-admin','system'].includes(accessClass)||!uuidPattern.test(requestId))fail('studio_invalid_data',422);
    const base=integer(ownValue(input,'expectedPackageRevision'),1,'studio_invalid_data',422);
    const source=publishedPackageRevision===null?(optionalOwn(input,'sourcePackageRevision')??null):null;
    if(source!==null)integer(source,1,'studio_invalid_data',422);
    const revision=(before?.revision??0)+1,action=publishedPackageRevision?'draft.publish':source?'draft.restore':'draft.save';
    let changes=canonicalStudioJson({before:before?{basePackageRevision:before.basePackageRevision,branding:publicEditableBranding(before.branding)}:null,
      after:{basePackageRevision:base,branding:publicEditableBranding(branding),sourcePackageRevision:source,publishedPackageRevision}});
    if(changes.length>10000){
      // Full snapshots remain in immutable draft revisions. Bound the journal without losing their identity.
      const brandingSha256=value=>createHash('sha256').update(canonicalStudioJson(publicEditableBranding(value))).digest('hex');
      changes=canonicalStudioJson({before:before?{draftRevision:before.revision,basePackageRevision:before.basePackageRevision,
        sourcePackageRevision:before.sourcePackageRevision,publishedPackageRevision:before.publishedPackageRevision,brandingSha256:brandingSha256(before.branding)}:null,
        after:{draftRevision:revision,basePackageRevision:base,sourcePackageRevision:source,publishedPackageRevision,brandingSha256:brandingSha256(branding)}});
    }
    if(changes.length>10000)fail('studio_invalid_data',422);
    const row=(await txQuery(`/* operator-store:write-branding-draft */ INSERT INTO croupier_studio.operator_branding_drafts
      (environment_id,workspace_id,operator_id,draft_revision,base_package_revision,branding,source_package_revision,published_package_revision,action,event_id,actor_id,access_class,occurred_at_ms,request_id,changes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${draftColumns}`,
      [operatorId,revision,base,canonicalBranding(branding),source,publishedPackageRevision,action,randomUUID(),actorId,accessClass,clock(),requestId,changes]))[0];
    if(!row)fail('studio_storage_unavailable');
    const saved=draftRow(row);
    if(saved.revision!==revision)fail('studio_corrupt_operator');
    return saved;
  }
  async function changeBrandingDraft(input,publish) {
    return withOperatorLock(async txQuery=>{
      const operatorId=idText(ownValue(input,'operatorId'));
      const expected=integer(ownValue(input,'expectedDraftRevision'),0,'studio_invalid_data',422);
      const expectedPackage=integer(ownValue(input,'expectedPackageRevision'),1,'studio_invalid_data',422);
      if(!await lockOperator(txQuery,operatorId))fail('studio_operator_not_found',404);
      const rows=await txQuery(`/* operator-store:current-package */ SELECT ${packageColumns} FROM croupier_studio.operator_packages
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 ORDER BY package_revision DESC LIMIT 1`,[operatorId]);
      const pack=rows[0]?packageRow(rows[0]):null;
      const before=await latestDraft(txQuery,operatorId);
      if(pack?.revision!==expectedPackage||(before?.revision??0)!==expected)fail('studio_conflict',409);
      if(publish&&(!before||before.action==='draft.publish'||before.basePackageRevision!==expectedPackage))fail('studio_conflict',409);
      const branding=storedJson(canonicalBranding(ownValue(input,'branding')),canonicalBranding);
      if(!publish)return draftWrite(txQuery,input,{before,branding});
      // One connection and transaction: any failure in either audit rolls back publication too.
      const saved=await publishWithin(txQuery,{...input,expectedRevision:expectedPackage,lanes:pack.lanes,games:pack.games,tables:pack.tables,branding});
      const draft=await draftWrite(txQuery,input,{before,branding:before.branding,publishedPackageRevision:saved.revision});
      return {package:saved,draft};
    });
  }
  async function saveBrandingDraft(input={}) { return changeBrandingDraft(input,false); }
  async function publishBrandingDraft(input={}) { return changeBrandingDraft(input,true); }

  return Object.freeze({
    scope, listAuditEvents, listOperators, getOperatorBySlug, getOperatorById, listRoles, getRole, getMembership, listMemberships,
    getCurrentPackage, getCurrentPresentationContext, getPackage, listPackages, getBrandingDraft, saveBrandingDraft, publishBrandingDraft, resolvePartnerContext, createOperator, changeOperatorStatus, upsertRole, upsertMembership, publishPackage,
  });
}
