// Scoped SQL for the Dealer Forge journal (migration 008). Every statement runs
// through the studio repository transaction so scope, locks and failure
// sanitization match the rest of Studio. Nothing here touches media_records.
import { randomUUID } from 'node:crypto';
import { canonicalStudioJson, StudioStorageError } from '../../web/storage/studio-contract.mjs';

// Thrown inside repository transactions: only StudioStorageError survives the repository's failure sanitizer, so codes carry the meaning.
const fail = (message, statusCode = 503, code = 'studio_forge_store_failed') => { const error = new StudioStorageError(code, statusCode); error.detail = message; throw error; };
export const JOB_STATUSES = Object.freeze(['submitting', 'submit_unknown', 'queued', 'running', 'generated', 'committing', 'succeeded', 'failed', 'cancelled']);
export const ACTIVE_STATUSES = Object.freeze(['submitting', 'submit_unknown', 'queued', 'running', 'generated', 'committing']);
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

  return Object.freeze({
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
    async insertJob({ dealerId, slotId, kind, status, taskId = null, request, result = null, error = null, actor }) {
      if (!JOB_STATUSES.includes(status)) fail('Ogiltig jobbstatus.', 422, 'studio_forge_invalid_status');
      const jobId = randomUUID(), at = now();
      return run(async client => {
        await query(client, `/* forge:job-insert */ INSERT INTO croupier_studio.forge_jobs
          (environment_id,workspace_id,job_id,dealer_id,slot_id,kind,status,provider,task_id,request,result,error,actor_id,created_at_ms,updated_at_ms)
          VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,'runway',$8,$9::jsonb,$10::jsonb,$11,$12,$13,$13)`,
        [jobId, dealerId, slotId, kind, status, taskId, canonicalStudioJson(request), result === null ? null : canonicalStudioJson(result), error, actor, at]);
        return { jobId, dealerId, slotId, kind, status, provider: 'runway', taskId, request, result, error, actor, createdAt: at, updatedAt: at };
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
