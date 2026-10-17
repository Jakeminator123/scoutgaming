// Scoped SQL for the Dealer Forge journal (migration 008). Every statement runs
// through the studio repository transaction so scope, locks and failure
// sanitization match the rest of Studio. Media references are read under that
// same scope lock; this journal never writes media_records.
import { randomUUID } from 'node:crypto';
import { canonicalStudioJson, StudioStorageError } from '../../web/storage/studio-contract.mjs';

// Thrown inside repository transactions: only StudioStorageError survives the repository's failure sanitizer, so codes carry the meaning.
const fail = (message, statusCode = 503, code = 'studio_forge_store_failed') => { const error = new StudioStorageError(code, statusCode); error.detail = message; throw error; };
// prepared: journaled, no provider POST has started (safe to pay or to drop). submitting: a POST may be in flight.
export const JOB_STATUSES = Object.freeze(['prepared', 'submitting', 'submit_unknown', 'queued', 'running', 'generated', 'committing', 'succeeded', 'failed', 'cancelled']);
export const ACTIVE_STATUSES = Object.freeze(['prepared', 'submitting', 'submit_unknown', 'queued', 'running', 'generated', 'committing']);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

const rowToJob = row => row && ({
  jobId: row.job_id, dealerId: row.dealer_id, slotId: row.slot_id, kind: row.kind, status: row.status, provider: row.provider, taskId: row.task_id,
  request: row.request, result: row.result, error: row.error, actor: row.actor_id, createdAt: Number(row.created_at_ms), updatedAt: Number(row.updated_at_ms),
});

export function createDealerForgeStore({ repository, scope, now = Date.now } = {}) {
  if (!repository?.transaction || !repository?.withTransactionClient || !scope?.environment || !scope?.workspaceId) fail('Forge-lagret saknar repository eller scope.', 503, 'studio_forge_store_configuration');
  const base = [scope.environment, scope.workspaceId];
  const run = work => repository.transaction(() => repository.withTransactionClient(work));
  const query = (client, sql, values = []) => client.query(sql, [...base, ...values]);
  const requireDealer = async dealerId => {
    const project = await repository.readDocument('project');
    if (!project?.value.dealers?.some(row => row.id === dealerId)) {
      fail('Dealern är inte längre registrerad.', 409, 'studio_dealer_inactive');
    }
  };
  // The caller already holds Studio's scope lock. Reading before entering
  // this transaction leaves a race with the durable deletion tombstone.
  const requireMedia = async (dealerId, request, { acquiring = true } = {}) => {
    const ids = new Set(['referenceMediaId', 'audioMediaId'].flatMap(key => [request?.[key], request?.options?.[key]]).filter(id => id !== null && id !== undefined));
    const captured = request?.mediaReferences;
    if (captured !== undefined && (!Array.isArray(captured) || captured.length > 2)) fail('Ogiltiga mediareferenser.', 409, 'studio_forge_reference_conflict');
    for (const id of ids) {
      if (typeof id !== 'string' || !uuid.test(id) || typeof repository.getMedia !== 'function') fail('Ogiltig mediareferens.', 409, 'studio_forge_reference_conflict');
      const row = await repository.getMedia(id);
      const expected = captured?.find(value => value?.id === id);
      if (!row || row.deletion || acquiring && row.classification.archived || row.classification.dealerId !== dealerId
        || captured && (!expected || ['sha256', 'pathname', ...(acquiring ? ['revision'] : [])].some(key => expected[key] !== row[key]))
        || request.referenceMediaId === id && request.referenceSha256 && request.referenceSha256 !== row.sha256
        || request.audioMediaId === id && request.audioSha256 && request.audioSha256 !== row.sha256) {
        fail('Mediareferensen har ändrats eller arkiverats.', 409, 'studio_forge_reference_conflict');
      }
    }
    if (captured?.some(value => !value || !ids.has(value.id)) || new Set(captured?.map(value => value.id)).size !== (captured?.length ?? 0)) {
      fail('Ogiltiga mediareferenser.', 409, 'studio_forge_reference_conflict');
    }
  };

  return Object.freeze({
    async assertJobReferences(job) {
      return run(() => requireMedia(job.dealerId, job.request, { acquiring: false }));
    },
    /** True when migration 008 is applied in this database. */
    async ready() {
      return run(async client => {
        const result = await query(client, `/* forge:ready */ SELECT to_regclass('croupier_studio.forge_jobs') IS NOT NULL AND to_regclass('croupier_studio.forge_dealers') IS NOT NULL AS ready
          WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL`);
        return result.rows[0]?.ready === true;
      });
    },
    async getProfile(dealerId) {
      return run(async client => {
        const result = await query(client, `/* forge:profile */ SELECT dealer_id,revision,profile FROM croupier_studio.forge_dealers
          WHERE environment_id=$1 AND workspace_id=$2 AND dealer_id=$3`, [dealerId]);
        const row = result.rows[0];
        return row ? { dealerId: row.dealer_id, revision: Number(row.revision), profile: row.profile } : null;
      });
    },
    /** Insert or compare-and-swap update. expectedRevision null means "must not exist yet". */
    async saveProfile(dealerId, profile, { expectedRevision = null, actor } = {}) {
      if (typeof actor !== 'string' || !actor) fail('Aktör saknas.', 403, 'studio_forge_actor_required');
      return run(async client => {
        await requireDealer(dealerId);
        const json = canonicalStudioJson(profile);
        if (expectedRevision === null) {
          const inserted = await query(client, `/* forge:profile-insert */ INSERT INTO croupier_studio.forge_dealers
            (environment_id,workspace_id,dealer_id,revision,profile,actor_id) VALUES ($1,$2,$3,1,$4::jsonb,$5)
            ON CONFLICT DO NOTHING RETURNING revision`, [dealerId, json, actor]);
          if (!inserted.rows[0]) fail('Forge-profilen finns redan.', 409, 'studio_forge_conflict');
          return { dealerId, revision: 1, profile };
        }
        const updated = await query(client, `/* forge:profile-update */ UPDATE croupier_studio.forge_dealers SET revision=revision+1,profile=$4::jsonb,actor_id=$5,updated_at=now()
          WHERE environment_id=$1 AND workspace_id=$2 AND dealer_id=$3 AND revision=$6 RETURNING revision`, [dealerId, json, actor, expectedRevision]);
        if (!updated.rows[0]) fail('Forge-profilen ändrades av någon annan. Ladda om.', 409, 'studio_forge_conflict');
        return { dealerId, revision: Number(updated.rows[0].revision), profile };
      });
    },
    /** Idempotent on jobId (the client's request key): a second insert returns the stored row with created=false. */
    async insertJob({ jobId = randomUUID(), dealerId, slotId, kind, status, taskId = null, request, result = null, error = null, actor }) {
      if (!JOB_STATUSES.includes(status)) fail('Ogiltig jobbstatus.', 422, 'studio_forge_invalid_status');
      if (typeof jobId !== 'string' || !uuid.test(jobId)) fail('Ogiltigt jobb-ID.', 422, 'studio_forge_invalid_job');
      const at = now();
      return run(async client => {
        await requireDealer(dealerId);
        await requireMedia(dealerId, request);
        const inserted = await query(client, `/* forge:job-insert */ INSERT INTO croupier_studio.forge_jobs
          (environment_id,workspace_id,job_id,dealer_id,slot_id,kind,status,provider,task_id,request,result,error,actor_id,created_at_ms,updated_at_ms)
          VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,'runway',$8,$9::jsonb,$10::jsonb,$11,$12,$13,$13) ON CONFLICT DO NOTHING RETURNING *`,
        [jobId, dealerId, slotId, kind, status, taskId, canonicalStudioJson(request), result === null ? null : canonicalStudioJson(result), error, actor, at]);
        if (inserted.rows[0]) return { job: rowToJob(inserted.rows[0]), created: true };
        const existing = (await query(client, `/* forge:job */ SELECT * FROM croupier_studio.forge_jobs
          WHERE environment_id=$1 AND workspace_id=$2 AND job_id=$3::uuid`, [jobId])).rows[0];
        if (!existing) fail('Jobbet kunde inte journalföras.', 409, 'studio_forge_conflict');
        return { job: rowToJob(existing), created: false };
      });
    },
    async getJob(jobId) {
      if (typeof jobId !== 'string' || !uuid.test(jobId)) fail('Ogiltigt jobb-ID.', 422, 'studio_forge_invalid_job');
      return run(async client => rowToJob((await query(client, `/* forge:job */ SELECT * FROM croupier_studio.forge_jobs
        WHERE environment_id=$1 AND workspace_id=$2 AND job_id=$3::uuid`, [jobId])).rows[0]) ?? null);
    },
    /** CAS on status so two pollers never commit the same output twice. */
    async updateJob(jobId, { expectedStatus, status, taskId, result, error }) {
      if (!JOB_STATUSES.includes(status)) fail('Ogiltig jobbstatus.', 422, 'studio_forge_invalid_status');
      return run(async client => {
        // Reopening a terminal row must acquire its references again. Existing
        // active jobs retain them even after a provider lease expires.
        if (ACTIVE_STATUSES.includes(status)) {
          const previous = (await query(client, `/* forge:job */ SELECT * FROM croupier_studio.forge_jobs
            WHERE environment_id=$1 AND workspace_id=$2 AND job_id=$3::uuid`, [jobId])).rows[0];
          if (!previous || expectedStatus && previous.status !== expectedStatus) fail('Jobbet ändrades samtidigt.', 409, 'studio_forge_conflict');
          const acquiring = !ACTIVE_STATUSES.includes(previous.status);
          if (acquiring) await requireDealer(previous.dealer_id);
          // Recording an ambiguous provider response must remain possible even
          // after retirement. Only submission/commit/reopening consumes media.
          if (acquiring || ['submitting', 'committing'].includes(status)) await requireMedia(previous.dealer_id, previous.request, { acquiring });
        }
        const updated = await query(client, `/* forge:job-update */ UPDATE croupier_studio.forge_jobs
          SET status=$4,task_id=COALESCE($5,task_id),result=COALESCE($6::jsonb,result),error=$7,updated_at_ms=$8
          WHERE environment_id=$1 AND workspace_id=$2 AND job_id=$3::uuid AND ($9::text IS NULL OR status=$9) RETURNING *`,
        [jobId, status, taskId ?? null, result === undefined || result === null ? null : canonicalStudioJson(result), error ?? null, now(), expectedStatus ?? null]);
        if (!updated.rows[0]) fail('Jobbet ändrades samtidigt; läs om statusen.', 409, 'studio_forge_conflict');
        return rowToJob(updated.rows[0]);
      });
    },
    async listJobs(dealerId, { limit = 200 } = {}) {
      return run(async client => (await query(client, `/* forge:jobs */ SELECT * FROM croupier_studio.forge_jobs
        WHERE environment_id=$1 AND workspace_id=$2 AND dealer_id=$3 ORDER BY created_at_ms DESC LIMIT $4`, [dealerId, Math.max(1, Math.min(500, limit))])).rows.map(rowToJob));
    },
  });
}
