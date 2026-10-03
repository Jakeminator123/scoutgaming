import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import {
  StudioStorageError, studioStorageFailure, validateStudioScope, validateDocumentKind,
  validateDocumentValue, validateRevision, validateActor, validateStudioMedia,
  validateMediaId, validateSnapshot, canonicalStudioJson, studioContentHash, STUDIO_SNAPSHOT_FORMAT,
} from './studio-contract.mjs';

const context = new AsyncLocalStorage();
const fail = (code, status = 409) => { throw new StudioStorageError(code, status); };
const newRevision = kind => `${kind === 'social-policy' ? 'social' : 'studio'}-${randomUUID()}`;
const timestamp = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail('studio_corrupt_document', 503);
  return date.toISOString();
};

// Caller owns the pool and authenticated scope. Construction does no I/O.
// No provider/HTTP calls may be performed inside transaction(callback).
export function createStudioRepository({ pool, scope } = {}) {
  if (!pool || typeof pool.connect !== 'function') fail('studio_invalid_configuration', 503);
  scope = validateStudioScope(scope);
  const scopeKey = canonicalStudioJson(scope);
  const parameters = [scope.environment, scope.workspaceId];
  // One scope lock before any row lock: a stable, ordered scope tuple avoids
  // opposite document/media lock order across concurrent editors.
  const digest = createHash('sha256').update(`croupier-studio\0${scopeKey}`).digest();
  const lockKeys = [digest.readInt32BE(0), digest.readInt32BE(4)];
  function poison(error) {
    const safe = studioStorageFailure(error), active = context.getStore();
    if (active && !active.closed && !active.failed) active.failed = safe;
    return safe;
  }
  async function transaction(work, { readOnly = false } = {}) {
    if (typeof work !== 'function') throw poison(new StudioStorageError('studio_invalid_data', 422));
    const active = context.getStore();
    if (active) {
      if (active.closed) throw poison(new StudioStorageError('studio_invalid_transaction', 503));
      if (active.pool !== pool || active.scopeKey !== scopeKey || active.readOnly && !readOnly) throw poison(new StudioStorageError('studio_scope_mismatch', 409));
      if (active.failed) throw active.failed;
      try { return await work(api); } catch (error) { throw poison(error); }
    }
    let client, current, begun = false;
    try {
      client = await pool.connect();
      if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') fail('studio_invalid_configuration', 503);
      await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'); begun = true;
      await client.query("SET LOCAL statement_timeout = '5000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
      if (!readOnly) await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', lockKeys);
      current = { pool, client, scopeKey, readOnly, failed: null, closed: false };
      const result = await context.run(current, () => work(api));
      if (current.failed) throw current.failed;
      const committed = await client.query('COMMIT'); begun = false; current.closed = true;
      if (committed?.command === 'ROLLBACK') fail('studio_transaction_rolled_back', 503);
      return result;
    } catch (error) {
      if (begun) try { await client.query('ROLLBACK'); } catch { /* Never expose the secondary database error. */ }
      throw studioStorageFailure(error);
    } finally {
      if (current) current.closed = true;
      // Release failures cannot reveal driver messages or invalidate a committed result.
      try { client?.release?.(); } catch { /* Caller owns pool health/replacement. */ }
    }
  }
  async function query(sql, values = []) {
    const current = context.getStore();
    if (!current || current.closed || current.pool !== pool || current.scopeKey !== scopeKey) fail('studio_invalid_transaction', 503);
    if (current.failed) throw current.failed;
    try { return await current.client.query(sql, [...parameters, ...values]); }
    catch (error) { throw poison(error); }
  }
  async function operation(prepare, work, readOnly = false) {
    let prepared;
    try { prepared = prepare(); } catch (error) { throw poison(error); }
    return transaction(() => work(prepared), { readOnly });
  }
  function document(row) {
    if (!row) return null;
    try {
      if (row.kind !== 'administration' && row.value?.revision !== row.revision) fail('studio_corrupt_document', 503);
      const value = validateDocumentValue(row.kind, row.value, row.revision, { allowLegacyRead: true });
      if (canonicalStudioJson(value) !== canonicalStudioJson(row.value)) fail('studio_corrupt_document', 503);
      return { kind: row.kind, revision: row.revision, value, updatedAt: timestamp(row.updated_at) };
    } catch { fail('studio_corrupt_document', 503); }
  }
  async function loadDocument(kind) {
    return document((await query(`/* studio:read-document */
      SELECT kind, revision, value, updated_at FROM croupier_studio.documents
      WHERE environment_id=$1 AND workspace_id=$2 AND kind=$3`, [kind])).rows[0]);
  }
  async function audit(action, subject, revision, actor) {
    await query(`/* studio:audit */ INSERT INTO croupier_studio.audit_events
      (environment_id,workspace_id,event_id,action,subject,revision,actor) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7)`,
    [randomUUID(), action, subject, revision, actor]);
  }
  async function insertDocument(kind, { value, revision, actor, updatedAt }, action = 'initialize_document') {
    const row = (await query(`/* studio:insert-document */ INSERT INTO croupier_studio.documents
      (environment_id,workspace_id,kind,revision,value,updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,COALESCE($6::timestamptz,now()))
      ON CONFLICT (environment_id,workspace_id,kind) DO NOTHING RETURNING kind,revision,value,updated_at`,
    [kind, revision, canonicalStudioJson(value), updatedAt ?? null])).rows[0];
    if (!row) fail('studio_conflict');
    await audit(action, kind, revision, actor);
    return document(row);
  }
  const media = row => {
    if (!row) return null;
    try {
      const record = validateStudioMedia(row.record);
      if (record.id !== row.id) fail('studio_corrupt_media', 503);
      return { ...record, revision: validateRevision(row.revision), updatedAt: timestamp(row.updated_at) };
    } catch { fail('studio_corrupt_media', 503); }
  };
  async function loadMedia(id) {
    return media((await query(`/* studio:read-media */ SELECT id,revision,record,updated_at FROM croupier_studio.media_records
      WHERE environment_id=$1 AND workspace_id=$2 AND id=$3::uuid`, [id])).rows[0]);
  }
  const api = {
    scope, transaction,
    readDocument(kind) {
      return operation(() => validateDocumentKind(kind), checked => loadDocument(checked), true);
    },
    initializeDocument(kind, options = {}) {
      return operation(() => {
        validateDocumentKind(kind);
        const revision = options.revision === undefined ? newRevision(kind) : validateRevision(options.revision);
        return { revision, value: validateDocumentValue(kind, options.value, revision), actor: validateActor(options.actor) };
      }, prepared => insertDocument(kind, prepared));
    },
    saveDocument(kind, options = {}) {
      return operation(() => {
        validateDocumentKind(kind); const revision = newRevision(kind);
        return { expectedRevision: validateRevision(options.expectedRevision), revision,
          value: validateDocumentValue(kind, options.value, revision), actor: validateActor(options.actor) };
      }, async prepared => {
        const previous = await loadDocument(kind);
        if (!previous) fail('studio_document_missing', 404);
        if (previous.revision !== prepared.expectedRevision) fail('studio_conflict');
        await query(`/* studio:history */ INSERT INTO croupier_studio.document_history
          (environment_id,workspace_id,kind,revision,value,original_updated_at,replaced_by,actor)
          VALUES ($1,$2,$3,$4,$5::jsonb,$6::timestamptz,$7,$8)`,
        [kind, previous.revision, canonicalStudioJson(previous.value), previous.updatedAt, prepared.revision, prepared.actor]);
        const row = (await query(`/* studio:save-document */ UPDATE croupier_studio.documents SET revision=$4,value=$5::jsonb,updated_at=now()
          WHERE environment_id=$1 AND workspace_id=$2 AND kind=$3 AND revision=$6 RETURNING kind,revision,value,updated_at`,
        [kind, prepared.revision, canonicalStudioJson(prepared.value), prepared.expectedRevision])).rows[0];
        if (!row) fail('studio_conflict');
        await audit('save_document', kind, prepared.revision, prepared.actor);
        return document(row);
      });
    },
    listDocumentHistory(kind, { limit = 100 } = {}) {
      return operation(() => {
        validateDocumentKind(kind);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) fail('studio_invalid_data', 422);
        return limit;
      }, async checked => (await query(`/* studio:list-history */
        SELECT kind,revision,value,original_updated_at AS updated_at,replaced_at,replaced_by,actor
        FROM croupier_studio.document_history WHERE environment_id=$1 AND workspace_id=$2 AND kind=$3
        ORDER BY replaced_at DESC,revision LIMIT $4`, [kind, checked])).rows.map(row => ({ ...document(row),
        replacedAt: timestamp(row.replaced_at), replacedBy: row.replaced_by, actor: row.actor })), true);
    },
    getMedia(id) {
      return operation(() => validateMediaId(id), checked => loadMedia(checked), true);
    },
    listMedia({ limit = 1000 } = {}) {
      return operation(() => {
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) fail('studio_invalid_data', 422);
        return limit;
      }, async checked => {
        const rows = (await query(`/* studio:list-media */ SELECT id,revision,record,updated_at FROM croupier_studio.media_records
          WHERE environment_id=$1 AND workspace_id=$2 ORDER BY id LIMIT $3`, [checked + 1])).rows;
        // An incomplete library can hide a saved binding. Fail explicitly
        // rather than silently truncate or fill it from a legacy disk index.
        if (rows.length > checked) fail('studio_media_limit_exceeded', 503);
        return rows.map(row => media(row));
      }, true);
    },
    registerMedia(record, { actor } = {}) {
      return operation(() => ({ record: validateStudioMedia(record), actor: validateActor(actor) }), async prepared => {
        const existing = await loadMedia(prepared.record.id);
        if (existing) {
          const { revision, updatedAt, ...stored } = existing;
          if (canonicalStudioJson(stored) !== canonicalStudioJson(prepared.record)) fail('studio_conflict');
          return { media: existing, duplicate: true };
        }
        const revision = newRevision('media');
        const row = (await query(`/* studio:insert-media */ INSERT INTO croupier_studio.media_records
          (environment_id,workspace_id,id,revision,record) VALUES ($1,$2,$3::uuid,$4,$5::jsonb)
          RETURNING id,revision,record,updated_at`, [prepared.record.id, revision, canonicalStudioJson(prepared.record)])).rows[0];
        await audit('register_media', prepared.record.id, revision, prepared.actor);
        return { media: media(row), duplicate: false };
      });
    },
    classifyMedia(id, { sha256, expectedRevision, metadata, actor } = {}) {
      return operation(() => ({ id: validateMediaId(id), expectedRevision: validateRevision(expectedRevision), actor: validateActor(actor) }), async prepared => {
        const previous = await loadMedia(prepared.id);
        if (!previous) fail('studio_media_missing', 404);
        if (previous.retainedBank) fail('studio_retained_media_immutable',410);
        if (previous.revision !== prepared.expectedRevision || previous.sha256 !== sha256) fail('studio_conflict');
        const { revision: oldRevision, updatedAt, ...record } = previous;
        const next = validateStudioMedia({ ...record, classification: metadata }), revision = newRevision('media');
        const row = (await query(`/* studio:classify-media */ UPDATE croupier_studio.media_records SET revision=$4,record=$5::jsonb,updated_at=now()
          WHERE environment_id=$1 AND workspace_id=$2 AND id=$3::uuid AND revision=$6 RETURNING id,revision,record,updated_at`,
        [prepared.id, revision, canonicalStudioJson(next), oldRevision])).rows[0];
        if (!row) fail('studio_conflict');
        await audit('classify_media', prepared.id, revision, prepared.actor);
        return media(row);
      });
    },
    findMediaReferences(id) {
      return operation(() => validateMediaId(id), async checked => {
        const references = (await query(`/* studio:media-references */
          SELECT kind,revision,false AS historical FROM croupier_studio.documents
          WHERE environment_id=$1 AND workspace_id=$2 AND jsonb_path_exists(value,'$.** ? (@ == $id)',jsonb_build_object('id',$3::text))
          UNION ALL SELECT kind,revision,true AS historical FROM croupier_studio.document_history
          WHERE environment_id=$1 AND workspace_id=$2 AND jsonb_path_exists(value,'$.** ? (@ == $id)',jsonb_build_object('id',$3::text))
          ORDER BY historical,kind,revision`, [checked])).rows;
        // No deletion authority: deployed game manifests and B's job journals
        // are deliberately outside this minimal document-only lookup.
        return { references, checked: ['documents', 'document_history'], complete: false };
      }, true);
    },
    exportSnapshot() {
      return operation(() => null, async () => {
        const documents = (await query(`/* studio:list-documents */ SELECT kind,revision,value,updated_at FROM croupier_studio.documents
          WHERE environment_id=$1 AND workspace_id=$2 ORDER BY kind`)).rows.map(row => {
          const result = document(row); return { ...result, checksum: studioContentHash(result.value) };
        });
        return { format: STUDIO_SNAPSHOT_FORMAT, scope, documents };
      }, true);
    },
    importSnapshot(snapshot, { actor, expectedTargetEmpty } = {}) {
      return operation(() => {
        if (expectedTargetEmpty !== true) fail('studio_import_requires_empty_target', 409);
        return { snapshot: validateSnapshot(snapshot, scope), actor: validateActor(actor) };
      }, async prepared => {
        const existing = (await query(`/* studio:list-documents */ SELECT kind,revision,value,updated_at FROM croupier_studio.documents
          WHERE environment_id=$1 AND workspace_id=$2 ORDER BY kind`)).rows.map(row => {
          const result = document(row); return { ...result, checksum: studioContentHash(result.value) };
        });
        const incoming = [...prepared.snapshot.documents].sort((a, b) => a.kind.localeCompare(b.kind));
        if (existing.length) {
          if (existing.length !== incoming.length || existing.some((item, index) => item.kind !== incoming[index].kind
            || item.revision !== incoming[index].revision || item.updatedAt !== incoming[index].updatedAt
            || item.checksum !== incoming[index].checksum || canonicalStudioJson(item.value) !== canonicalStudioJson(incoming[index].value))) fail('studio_import_target_conflict');
          return { imported: 0, replayed: true };
        }
        for (const item of incoming) await insertDocument(item.kind, { ...item, actor: prepared.actor }, 'import_document');
        return { imported: incoming.length, replayed: false };
      });
    },
  };
  return Object.freeze(api);
}
