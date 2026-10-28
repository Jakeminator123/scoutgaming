// Bolagets eget material: storage for a company's own backgrounds and table
// graphics, its AI policy and its AI attempts (Studio migration 021).
// Tolerant before 021: every read returns nothing (no material, limit 0, no
// attempts) and every write fails with the fixed code operator_materials_unavailable.
// The readiness check never errors, so it is safe inside a publication
// transaction: a missing table must not abort the surrounding work.
// Ownership is environment_id + workspace_id + operator_id, always bound first;
// a material id belongs to one company per workspace and never to Admin's project.
// A row this code cannot read is returned as state 'corrupt' (skipped by the
// merge with a warning), so one bad row does not stop the company's publications.
import { createHash, randomUUID } from 'node:crypto';
import { validateLayerAsset } from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
import { LANE_ID, RESERVED_LANE_IDS } from '../../../packages/presentation/contracts/studio-model.mjs';
import {
  StudioStorageError, canonicalStudioJson, studioStorageFailure, validateActor, validateStudioScope,
} from '../../../packages/studio-registry/server/storage-contract.mjs';

export const OPERATOR_MATERIALS_STORAGE_VERSION = '021';
export const OPERATOR_MATERIAL_STATES = Object.freeze(['pending', 'approved', 'rejected', 'revoked']);
export const OPERATOR_MATERIAL_SOURCES = Object.freeze(['upload', 'ai']);
// v1: still images only. Videos and game-tagged tables wait for their own decision.
export const OPERATOR_MATERIAL_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);
// Waiting and approved material per company; rejected and revoked rows are history.
export const MAX_OPERATOR_MATERIALS = 500;
// Every material id a company has ever proposed, the bound of each read.
export const MAX_OPERATOR_MATERIAL_IDS = 2000;
export const MAX_OPERATOR_DAILY_AI_LIMIT = 100;
const TRANSITIONS = Object.freeze({ pending: ['approved', 'rejected'], approved: ['revoked'], rejected: [], revoked: [], corrupt: [] });

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const dealerPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const fail = (code, status = 503) => { throw new StudioStorageError(code, status); };
const unavailable = () => fail('operator_materials_unavailable', 503);
const corrupt = () => fail('studio_corrupt_operator_material');
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const idText = (value, code = 'studio_invalid_data', status = 422) => typeof value === 'string' && idPattern.test(value) ? value : fail(code, status);
const uuidText = (value, code = 'studio_invalid_data', status = 422) => typeof value === 'string' && uuidPattern.test(value) ? value : fail(code, status);
function integer(value, min, max, code = 'studio_invalid_data', status = 422) {
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) value = Number(value);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : fail(code, status);
}
const utcDay = at => new Date(at).toISOString().slice(0, 10);

/** The exact asset a company may own in v1: a valid LayerAsset, a still image, no game tag. */
export function validateOperatorMaterialAsset(value, materialId) {
  let asset;
  try { asset = validateLayerAsset(value); } catch { fail('studio_invalid_data', 422); }
  if (asset.id !== materialId || !OPERATOR_MATERIAL_TYPES.includes(asset.contentType) || Object.hasOwn(asset, 'game')
    || canonicalStudioJson(asset).length > 4000) fail('studio_invalid_data', 422);
  return asset;
}

/** The landing template a table graphic was drawn for; computed by the server, never the client. */
export function validateOperatorTableBinding(value) {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'dealerId,laneId,profileId,templateSha256'
    || typeof value.dealerId !== 'string' || value.dealerId.length > 40 || !dealerPattern.test(value.dealerId)
    || typeof value.profileId !== 'string' || !idPattern.test(value.profileId)
    || typeof value.laneId !== 'string' || !LANE_ID.test(value.laneId) || RESERVED_LANE_IDS.has(value.laneId)
    || typeof value.templateSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.templateSha256)) fail('studio_invalid_data', 422);
  return { dealerId: value.dealerId, profileId: value.profileId, laneId: value.laneId, templateSha256: value.templateSha256 };
}

function queryRunner(sql) {
  if (typeof sql?.query === 'function') return (text, values) => sql.query(text, values);
  if (typeof sql === 'function') return sql;
  return fail('studio_invalid_configuration', 503);
}
const rowsOf = result => Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : fail('studio_storage_unavailable');

// sql is the pool, a repository transaction client or async (text, values) => rows.
// Writes lock the company row: through `transaction` (a caller's client), the
// pool's own connection, or fail closed.
export function createOperatorMaterialStore({ sql, scope, now = Date.now, transaction = null } = {}) {
  scope = validateStudioScope(scope);
  const run = queryRunner(sql);
  if (typeof now !== 'function' || transaction !== null && typeof transaction !== 'function') fail('studio_invalid_configuration', 503);
  const parameters = [scope.environment, scope.workspaceId];
  const bind = runner => async (text, values = []) => {
    try { return rowsOf(await runner(text, [...parameters, ...values])); } catch (error) { throw studioStorageFailure(error); }
  };
  const query = bind(run);
  let ready = null;
  function clock() {
    const at = now();
    return Number.isSafeInteger(at) && at >= 0 ? at : fail('studio_invalid_data', 422);
  }
  // Never references a missing relation, so it cannot abort a caller's transaction.
  async function availableWith(txQuery) {
    const rows = await txQuery(`/* operator-materials:materials-ready */ SELECT
        (SELECT count(*)::integer FROM croupier_studio.storage_migrations WHERE version=$3) AS ledgered,
        (to_regclass('croupier_studio.operator_materials') IS NOT NULL
          AND to_regclass('croupier_studio.operator_material_policies') IS NOT NULL
          AND to_regclass('croupier_studio.operator_ai_attempts') IS NOT NULL) AS present
      WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL`, [OPERATOR_MATERIALS_STORAGE_VERSION]);
    return rows.length === 1 && rows[0].ledgered === 1 && rows[0].present === true;
  }
  async function available() { return ready ??= await availableWith(query); }
  // Only a proposal may fall back to a system audit; decisions, policy and AI
  // attempts name their actor, access class and request explicitly.
  function audit(input, classes, { explicit = true } = {}) {
    const actor = validateActor(input?.actor);
    if (explicit && input?.audit === undefined) fail('studio_invalid_data', 422);
    const context = input?.audit === undefined
      ? { actorId: 'actor-' + createHash('sha256').update(actor).digest('hex'), accessClass: 'system', requestId: randomUUID() }
      : input.audit;
    if (!plain(context) || !classes.includes(context.accessClass)) fail('studio_invalid_data', 422);
    return { actorId: idText(context.actorId), accessClass: context.accessClass, requestId: uuidText(context.requestId) };
  }
  function material(row) {
    // The scope and the id are the row's identity; without them nothing is trusted.
    if (!row || row.environment_id !== scope.environment || row.workspace_id !== scope.workspaceId) corrupt();
    const materialId = uuidText(row.material_id, 'studio_corrupt_operator_material', 503);
    const operatorId = idText(row.operator_id, 'studio_corrupt_operator_material', 503);
    const revision = integer(row.revision, 1, Number.MAX_SAFE_INTEGER, 'studio_corrupt_operator_material', 503);
    try {
      if (!OPERATOR_MATERIAL_STATES.includes(row.state) || !OPERATOR_MATERIAL_SOURCES.includes(row.source)
        || !['background', 'table'].includes(row.role)) corrupt();
      const asset = validateOperatorMaterialAsset(JSON.parse(row.asset), materialId);
      if (canonicalStudioJson(asset) !== row.asset || asset.role !== row.role) corrupt();
      let tableBinding = null;
      if (row.table_binding !== null) {
        tableBinding = validateOperatorTableBinding(JSON.parse(row.table_binding));
        if (canonicalStudioJson(tableBinding) !== row.table_binding) corrupt();
      }
      if ((row.role === 'table') !== (tableBinding !== null)) corrupt();
      return Object.freeze({ operatorId, materialId, revision, state: row.state, source: row.source, role: row.role,
        asset: Object.freeze(asset), tableBinding: tableBinding && Object.freeze(tableBinding),
        actorId: idText(row.actor_id), accessClass: row.access_class, occurredAtMs: integer(row.occurred_at_ms, 0, Number.MAX_SAFE_INTEGER) });
    } catch {
      return Object.freeze({ operatorId, materialId, revision, state: 'corrupt', source: null, role: null, asset: null, tableBinding: null,
        actorId: null, accessClass: null, occurredAtMs: Number.isSafeInteger(Number(row.occurred_at_ms)) ? Number(row.occurred_at_ms) : 0 });
    }
  }
  const columns = 'environment_id,workspace_id,operator_id,material_id,revision,state,source,role,asset,table_binding,actor_id,access_class,occurred_at_ms';
  async function latest(txQuery, operatorId) {
    const rows = await txQuery(`/* operator-materials:list */ SELECT ${columns} FROM (
        SELECT DISTINCT ON (material_id) ${columns} FROM croupier_studio.operator_materials
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 ORDER BY material_id, revision DESC) current
      ORDER BY occurred_at_ms, material_id LIMIT $4`, [operatorId, MAX_OPERATOR_MATERIAL_IDS + 1]);
    if (rows.length > MAX_OPERATOR_MATERIAL_IDS) corrupt();
    return rows.map(material);
  }
  function policy(row, operatorId) {
    if (!row) return Object.freeze({ operatorId, revision: 0, dailyAiLimit: 0, blocked: false, updatedAtMs: null });
    if (row.environment_id !== scope.environment || row.workspace_id !== scope.workspaceId || typeof row.blocked !== 'boolean') corrupt();
    return Object.freeze({ operatorId, revision: integer(row.revision, 1, Number.MAX_SAFE_INTEGER, 'studio_corrupt_operator_material', 503),
      dailyAiLimit: integer(row.daily_ai_limit, 0, MAX_OPERATOR_DAILY_AI_LIMIT, 'studio_corrupt_operator_material', 503), blocked: row.blocked,
      updatedAtMs: integer(row.updated_at_ms, 0, Number.MAX_SAFE_INTEGER, 'studio_corrupt_operator_material', 503) });
  }
  async function readPolicy(txQuery, operatorId) {
    const rows = await txQuery(`/* operator-materials:policy */ SELECT environment_id,workspace_id,operator_id,revision,daily_ai_limit,blocked,updated_at_ms
      FROM croupier_studio.operator_material_policies WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3`, [operatorId]);
    if (rows.length > 1) corrupt();
    return policy(rows[0], operatorId);
  }
  // Admin's own material ids (project and its trash) can never become company material.
  async function adminAssetId(txQuery, materialId) {
    const rows = await txQuery(`/* operator-materials:admin-asset */ SELECT
        EXISTS (SELECT 1 FROM croupier_studio.documents d, jsonb_array_elements(COALESCE(d.value->'layerAssets','[]'::jsonb)) a
          WHERE d.environment_id=$1 AND d.workspace_id=$2 AND d.kind='project' AND a->>'id'=$3)
        OR EXISTS (SELECT 1 FROM croupier_studio.documents d, jsonb_array_elements(COALESCE(d.value->'layerAssetTrash','[]'::jsonb)) t
          WHERE d.environment_id=$1 AND d.workspace_id=$2 AND d.kind='project' AND t->'asset'->>'id'=$3) AS taken`, [materialId]);
    return rows[0]?.taken === true;
  }
  async function countAttempts(txQuery, operatorId, day) {
    const rows = await txQuery(`/* operator-materials:count-ai */ SELECT count(*)::integer AS used FROM croupier_studio.operator_ai_attempts
      WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND day=$4::date`, [operatorId, day]);
    return integer(rows[0]?.used, 0, Number.MAX_SAFE_INTEGER, 'studio_corrupt_operator_material', 503);
  }
  async function withLock(operatorId, work) {
    const locked = async runner => {
      const txQuery = bind(runner);
      if (!await availableWith(txQuery)) unavailable();
      const rows = await txQuery(`/* operator-materials:lock-operator */ SELECT operator_id FROM croupier_studio.operators
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE`, [operatorId]);
      if (rows.length !== 1) fail('studio_operator_not_found', 404);
      return work(txQuery);
    };
    if (transaction) return transaction(client => locked(queryRunner(client)));
    if (typeof sql?.connect !== 'function') fail('studio_invalid_configuration', 503);
    let client, begun = false;
    try {
      client = await sql.connect();
      await client.query('BEGIN'); begun = true;
      await client.query("SET LOCAL statement_timeout = '5000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
      const result = await locked((text, values) => client.query(text, values));
      const committed = await client.query('COMMIT'); begun = false;
      if (committed?.command === 'ROLLBACK') fail('studio_transaction_rolled_back', 503);
      return result;
    } catch (error) {
      if (begun) try { await client.query('ROLLBACK'); } catch { /* Never expose the secondary database error. */ }
      throw studioStorageFailure(error);
    } finally { try { client?.release?.(); } catch { /* Caller owns pool health. */ } }
  }

  /** Current state of every material (latest revision each), oldest first. Empty without 021. */
  async function listMaterials(operatorId) {
    operatorId = idText(operatorId);
    return await available() ? Object.freeze(await latest(query, operatorId)) : Object.freeze([]);
  }
  async function listApprovedMaterials(operatorId) {
    return Object.freeze((await listMaterials(operatorId)).filter(row => row.state === 'approved'));
  }
  /** Append one journal revision. expectedRevision 0 creates a pending material. */
  async function appendMaterial(input = {}) {
    if (!plain(input)) fail('studio_invalid_data', 422);
    const operatorId = idText(input.operatorId), materialId = uuidText(input.materialId);
    const expected = integer(input.expectedRevision, 0, Number.MAX_SAFE_INTEGER);
    const state = OPERATOR_MATERIAL_STATES.includes(input.state) ? input.state : fail('studio_invalid_data', 422);
    // Only Scoutgaming staff decides, by name; a company can only propose.
    if (state !== 'pending' && input.audit?.accessClass === 'partner') fail('studio_forbidden', 403);
    const context = state === 'pending' ? audit(input, ['internal-admin', 'partner', 'system'], { explicit: false }) : audit(input, ['internal-admin']);
    let source, asset, binding;
    if (expected === 0) {
      if (state !== 'pending') fail('studio_invalid_data', 422);
      source = OPERATOR_MATERIAL_SOURCES.includes(input.source) ? input.source : fail('studio_invalid_data', 422);
      asset = validateOperatorMaterialAsset(input.asset, materialId);
      binding = asset.role === 'table' ? validateOperatorTableBinding(input.tableBinding) : null;
      if (asset.role !== 'table' && input.tableBinding !== undefined && input.tableBinding !== null) fail('studio_invalid_data', 422);
    } else if (['source', 'asset', 'tableBinding'].some(key => input[key] !== undefined)) fail('studio_invalid_data', 422);
    return withLock(operatorId, async txQuery => {
      const all = await latest(txQuery, operatorId), current = all.find(row => row.materialId === materialId) ?? null;
      if ((current?.revision ?? 0) !== expected) fail('studio_conflict', 409);
      if (current) {
        if (!TRANSITIONS[current.state].includes(state)) fail('studio_conflict', 409);
        ({ source, asset } = current); binding = current.tableBinding;
      } else {
        if ((await readPolicy(txQuery, operatorId)).blocked) fail('operator_materials_blocked', 403);
        if (all.filter(row => ['pending', 'approved'].includes(row.state)).length >= MAX_OPERATOR_MATERIALS
          || all.length >= MAX_OPERATOR_MATERIAL_IDS) fail('operator_materials_limit_reached', 409);
        if (await adminAssetId(txQuery, materialId)) fail('studio_conflict', 409);
      }
      // Another company's id fails on UNIQUE (workspace, material_id, revision): 409.
      const rows = await txQuery(`/* operator-materials:append */ INSERT INTO croupier_studio.operator_materials
        (environment_id,workspace_id,operator_id,material_id,revision,state,source,role,asset,table_binding,event_id,actor_id,access_class,occurred_at_ms,request_id,first_revision)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,1) RETURNING ${columns}`,
      [operatorId, materialId, expected + 1, state, source, asset.role, canonicalStudioJson(asset), binding ? canonicalStudioJson(binding) : null,
        randomUUID(), context.actorId, context.accessClass, clock(), context.requestId]);
      if (rows.length !== 1) fail('studio_storage_unavailable');
      return material(rows[0]);
    });
  }
  /** Daily AI limit (0 = off) and block. Without 021 or a row: limit 0, not blocked. */
  async function getPolicy(operatorId) {
    operatorId = idText(operatorId);
    return await available() ? readPolicy(query, operatorId) : policy(null, operatorId);
  }
  async function setPolicy(input = {}) {
    if (!plain(input)) fail('studio_invalid_data', 422);
    const operatorId = idText(input.operatorId), expected = integer(input.expectedRevision, 0, Number.MAX_SAFE_INTEGER);
    const dailyAiLimit = integer(input.dailyAiLimit, 0, MAX_OPERATOR_DAILY_AI_LIMIT);
    if (typeof input.blocked !== 'boolean') fail('studio_invalid_data', 422);
    const context = audit(input, ['internal-admin']);
    return withLock(operatorId, async txQuery => {
      if ((await readPolicy(txQuery, operatorId)).revision !== expected) fail('studio_conflict', 409);
      const values = [operatorId, expected + 1, dailyAiLimit, input.blocked, context.actorId, context.accessClass, clock()];
      const rows = expected === 0
        ? await txQuery(`/* operator-materials:insert-policy */ INSERT INTO croupier_studio.operator_material_policies
            (environment_id,workspace_id,operator_id,revision,daily_ai_limit,blocked,actor_id,access_class,updated_at_ms)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING environment_id,workspace_id,operator_id,revision,daily_ai_limit,blocked,updated_at_ms`, values)
        : await txQuery(`/* operator-materials:update-policy */ UPDATE croupier_studio.operator_material_policies
            SET revision=$4,daily_ai_limit=$5,blocked=$6,actor_id=$7,access_class=$8,updated_at_ms=$9
            WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND revision=$4-1
            RETURNING environment_id,workspace_id,operator_id,revision,daily_ai_limit,blocked,updated_at_ms`, values);
      if (rows.length !== 1) fail('studio_conflict', 409);
      return policy(rows[0], operatorId);
    });
  }
  async function countAiAttempts(operatorId, { day = utcDay(clock()) } = {}) {
    operatorId = idText(operatorId);
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) fail('studio_invalid_data', 422);
    return await available() ? countAttempts(query, operatorId, day) : 0;
  }
  /** Count and record one attempt under the company lock, before any provider call. */
  async function reserveAiAttempt(input = {}) {
    if (!plain(input)) fail('studio_invalid_data', 422);
    const operatorId = idText(input.operatorId), attemptId = uuidText(input.attemptId);
    const context = audit(input, ['internal-admin', 'partner']);
    return withLock(operatorId, async txQuery => {
      const current = await readPolicy(txQuery, operatorId), at = clock(), day = utcDay(at);
      if (current.blocked) fail('operator_materials_blocked', 403);
      const used = await countAttempts(txQuery, operatorId, day);
      if (used >= current.dailyAiLimit) fail('operator_ai_limit_reached', 429);
      await txQuery(`/* operator-materials:reserve-ai */ INSERT INTO croupier_studio.operator_ai_attempts
        (environment_id,workspace_id,operator_id,attempt_id,day,actor_id,access_class,occurred_at_ms)
        VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8)`, [operatorId, attemptId, day, context.actorId, context.accessClass, at]);
      return Object.freeze({ attemptId, day, used: used + 1, limit: current.dailyAiLimit });
    });
  }
  return Object.freeze({ scope, available, listMaterials, listApprovedMaterials, appendMaterial, getPolicy, setPolicy, countAiAttempts, reserveAiAttempt });
}
