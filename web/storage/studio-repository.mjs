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
  const lifecycleAuthority = Symbol('dealer-lifecycle');
  const contains = (value, id) => value === id || value && typeof value === 'object' && Object.values(value).some(item => contains(item,id));
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
  async function lockMediaObject(pathname) {
    // Scope lock is always first; object lock second; neither path takes another
    // scope lock. Imports/register/purge share this pathname lock across scopes.
    await query(`/* studio:media-object-lock */ SELECT pg_advisory_xact_lock(hashtextextended($3::text,0))
      WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL`, ['croupier:managed-media:' + pathname]);
  }
  async function mediaAliases(record) {
    return (await query(`/* studio:media-aliases */ SELECT environment_id,workspace_id,id,record
      FROM croupier_studio.media_records WHERE NOT(environment_id=$1 AND workspace_id=$2 AND id=$3::uuid)
      AND (id=$3::uuid OR record->>'pathname'=$4) LIMIT 2`,[record.id,record.pathname])).rows;
  }
  async function loadMedia(id) {
    return media((await query(`/* studio:read-media */ SELECT id,revision,record,updated_at FROM croupier_studio.media_records
      WHERE environment_id=$1 AND workspace_id=$2 AND id=$3::uuid`, [id])).rows[0]);
  }
  const api = {
    async withTransactionClient(work) {
      const active = context.getStore();
      if (typeof work !== 'function' || !active || active.closed || active.readOnly
        || active.pool !== pool || active.scopeKey !== scopeKey || active.failed) {
        throw poison(new StudioStorageError('studio_invalid_transaction', 503));
      }
      const client = Object.freeze({ query: async (text, values = []) => {
        if (context.getStore() !== active || active.closed || active.failed) throw poison(new StudioStorageError('studio_invalid_transaction', 503));
        // Shared SQL follows the repository's scope-first parameter convention.
        // Trusted adapters own SQL structure; callers cannot substitute a tenant.
        if (typeof text !== 'string' || !Array.isArray(values) || values.length < 2
          || values[0] !== scope.environment || values[1] !== scope.workspaceId) {
          throw poison(new StudioStorageError('studio_scope_mismatch', 409));
        }
        try { return await active.client.query(text, [...values]); } catch (error) { throw poison(error); }
      } });
      try { return await work(client); } catch (error) { throw poison(error); }
    },
    scope, transaction,
    readPresentationSnapshot() {
      // A single MVCC snapshot binds dealer registration, selected UUIDs and
      // classification. Nested reads reuse the current scoped write client.
      return operation(() => null, async () => {
        const projectDocument = await loadDocument('project');
        const administrationDocument = await loadDocument('administration');
        if (!projectDocument || !administrationDocument) fail('studio_document_missing', 503);
        const rows = (await query(`/* studio:list-media */ SELECT id,revision,record,updated_at FROM croupier_studio.media_records
          WHERE environment_id=$1 AND workspace_id=$2 ORDER BY id LIMIT $3`, [5001])).rows;
        if (rows.length > 5000) fail('studio_media_limit_exceeded', 503);
        const mediaRows = rows.map(row => media(row));
        const freeze = value => {
          if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
          return value;
        };
        return freeze({scope, projectDocument, administrationDocument, mediaRows});
      }, true);
    },
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
          value: validateDocumentValue(kind, options.value, revision, {allowLegacyRead:options.lifecycleAuthority === lifecycleAuthority}), actor: validateActor(options.actor) };
      }, async prepared => {
        const previous = await loadDocument(kind);
        if (!previous) fail('studio_document_missing', 404);
        if (previous.revision !== prepared.expectedRevision) fail('studio_conflict');
        if (kind === 'project') {
          const lifecycle = options.lifecycleAuthority === lifecycleAuthority;
          if (!lifecycle && canonicalStudioJson(previous.value.dealerTrash ?? []) !== canonicalStudioJson(prepared.value.dealerTrash ?? [])) fail('studio_dealer_lifecycle_required');
          const removed = previous.value.dealers.filter(dealer => !prepared.value.dealers.some(next => next.id === dealer.id));
          const rows = await api.listMedia({limit:5000});
          if (!lifecycle && removed.some(dealer => rows.some(row => row.classification.dealerId === dealer.id))) fail('studio_dealer_lifecycle_required');
          const {dealerTrash, ...activeProject} = prepared.value;
          for (const row of rows) if ((row.deletion || row.classification.archived) && contains(activeProject,row.id)) fail('studio_media_in_use');
        }
        if(kind!=='project')for(const row of await api.listMedia({limit:5000}))if(row.deletion&&contains(prepared.value,row.id))fail('studio_media_in_use');
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
    // Server-only lifecycle entry point. HTTP project PUT cannot mint this authority.
    saveDealerLifecycle(value, {expectedRevision,actor} = {}) {
      return api.saveDocument('project', {value,expectedRevision,actor,lifecycleAuthority});
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
        if (prepared.record.deletion) fail('studio_media_deletion_pending');
        await lockMediaObject(prepared.record.pathname);
        if (!prepared.record.retainedBank && (await mediaAliases(prepared.record)).length) fail('studio_media_owned_elsewhere');
        const project = await loadDocument('project');
        if (project?.value.dealerTrash?.some(entry => entry.dealer.id === prepared.record.classification.dealerId)) fail('studio_dealer_archived');
        const existing = await loadMedia(prepared.record.id);
        if (existing?.deletion) fail('studio_media_deletion_pending');
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
        if (previous.deletion) fail('studio_media_deletion_pending');
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
    withMediaObjectLock(id, work) {
      return operation(() => validateMediaId(id), async checked => {
        const record = await loadMedia(checked);
        if (!record) fail('studio_media_missing',404);
        await lockMediaObject(record.pathname);
        return work(record);
      });
    },
    mediaRegisteredAt(id) {
      return operation(()=>validateMediaId(id),async checked=>{
        const row=(await query(`/* studio:media-registered-at */ SELECT min(at) AS registered_at FROM croupier_studio.audit_events
          WHERE environment_id=$1 AND workspace_id=$2 AND subject=$3 AND action='register_media'`,[checked])).rows[0];
        return row?.registered_at?timestamp(row.registered_at):null;
      },true);
    },
    inspectMediaDeletion(record) {
      return operation(() => validateMediaId(record?.id), async () => {
        const documents = (await query(`/* studio:media-current-owners */ SELECT environment_id,workspace_id,kind,revision,value
          FROM croupier_studio.documents WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL
          AND (jsonb_path_exists(value,'$.** ? (@ == $id)',jsonb_build_object('id',$3::text)) OR position($4::text in value::text)>0)
          LIMIT 101`, [record.id,record.pathname])).rows;
        const packages = (await query(`/* studio:media-all-packages */ SELECT operator_id,package_revision,lanes,branding
          FROM croupier_studio.operator_packages WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL LIMIT 1001`)).rows;
        if(documents.length>100 || packages.length>1000)fail('studio_media_delete_coverage_incomplete',503);
        return {documents,packages,aliases:await mediaAliases(record)};
      },true);
    },
    setMediaDeletion(id,{expectedRevision,sha256,deletion,actor}={}) {
      return operation(()=>({id:validateMediaId(id),expectedRevision:validateRevision(expectedRevision),actor:validateActor(actor)}),async checked=>{
        const previous=await loadMedia(checked.id);
        if(!previous||previous.revision!==checked.expectedRevision||previous.sha256!==sha256)fail('studio_conflict');
        if(previous.retainedBank||previous.classification.archived!==true)fail('studio_media_archive_required');
        await lockMediaObject(previous.pathname);
        if(previous.deletion?previous.deletion.state!=='pending'||deletion?.state!=='deleted'||previous.deletion.requestedAt!==deletion.requestedAt:deletion?.state!=='pending')fail('studio_media_deletion_pending');
        const {revision:oldRevision,updatedAt,...record}=previous;
        const next=validateStudioMedia({...record,deletion}),revision=newRevision('media');
        const row=(await query(`/* studio:classify-media */ UPDATE croupier_studio.media_records SET revision=$4,record=$5::jsonb,updated_at=now()
          WHERE environment_id=$1 AND workspace_id=$2 AND id=$3::uuid AND revision=$6 RETURNING id,revision,record,updated_at`,
          [checked.id,revision,canonicalStudioJson(next),oldRevision])).rows[0];
        if(!row)fail('studio_conflict');
        // Existing immutable audit vocabulary; state/revision stay on the durable row.
        await audit('classify_media',checked.id,revision,checked.actor);
        return media(row);
      });
    },
    listLifecyclePackages() {
      return operation(() => null, async () => {
        const rows = (await query(`/* studio:lifecycle-packages */ SELECT operator_id,package_revision,lanes,branding
          FROM croupier_studio.operator_packages WHERE environment_id=$1 AND workspace_id=$2
          ORDER BY operator_id,package_revision LIMIT 1001`)).rows;
        if (rows.length > 1000) fail('studio_media_delete_coverage_incomplete',503);
        return rows;
      }, true);
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
