import { timingSafeEqual } from 'node:crypto';
import { studioCommandSignature } from '../../packages/shared/studio-game-command.mjs';
import { validateStudioScope, canonicalStudioJson } from '../../packages/studio-registry/server/document-contract.mjs';
import { studioAdminActionPolicy, meetsStudioAdminActionRole } from '../../packages/studio-access/studio-access-policy.mjs';

const actions = new Set(['players/status', 'players/password', 'apikeys/revoke', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit']);
const fail = (statusCode = 403) => { throw Object.assign(new Error('studio_game_command_rejected'), { statusCode }); };
const response = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });

const MAX_SETTLE_HOOKS = 256;
const settleWarning = report => console.warn(JSON.stringify({ event: 'studio_game_command_settle_failed', ...report }));

export function createStudioGameCommandApi({ scope, secret, publicOrigin, authorize, execute, boDb, now = Date.now, onSettleError = settleWarning } = {}) {
  scope = validateStudioScope(scope);
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || typeof authorize !== 'function' || typeof execute !== 'function' || !boDb?.transaction || typeof onSettleError !== 'function') fail(503);
  return async request => {
    try {
      const url = new URL(request.url);
      if (request.method !== 'POST' || url.origin !== publicOrigin || url.pathname !== '/api/studio-game/command' || url.search
        || request.headers.get('origin') !== publicOrigin || request.headers.get('content-type')?.split(';')[0] !== 'application/json') fail();
      const timestamp = request.headers.get('x-croupier-studio-timestamp'), signature = request.headers.get('x-croupier-studio-signature');
      if (!/^\d{13}$/.test(timestamp || '') || !/^[a-f0-9]{64}$/.test(signature || '')) fail();
      const fresh=()=>{const time=now();if(!Number.isSafeInteger(time)||Math.abs(time-Number(timestamp))>30000)fail();return time;};
      fresh();
      let bytes = 0, raw = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
      for await (const chunk of request.body || []) { bytes += chunk.byteLength; if (bytes > 16384) fail(413); raw += decoder.decode(chunk, { stream: true }); }
      raw += decoder.decode();
      fresh();
      const expected = Buffer.from(studioCommandSignature(secret, timestamp, raw), 'hex'), supplied = Buffer.from(signature, 'hex');
      if (!timingSafeEqual(expected, supplied)) fail();
      let command; try { command = JSON.parse(raw); } catch { fail(400); }
      if (!command || typeof command !== 'object' || Array.isArray(command)
        || Object.keys(command).sort().join(',') !== 'action,actor,body,commandId,scope' || !actions.has(command.action)
        || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(command.commandId)
        || canonicalStudioJson(validateStudioScope(command.scope)) !== canonicalStudioJson(scope)) fail();
      const session = await authorize(request), policy = studioAdminActionPolicy(command.action);
      fresh();
      if (!policy || !meetsStudioAdminActionRole(session.role, command.action) || session.user !== command.actor?.user || session.role !== command.actor?.role
        || canonicalStudioJson(validateStudioScope(session.scope)) !== canonicalStudioJson(scope)) fail();
      // Runtime cleanup runs after commit, so it cannot roll back or fail an
      // accepted command, and Studio-scoped work never waits inside this lock.
      const settled = [], subject = typeof command.body?.playerId === 'string' && command.body.playerId.length <= 256 ? command.body.playerId : undefined;
      let open = true;
      const report = (hook, error, code) => {
        const failedFor = typeof error?.subject === 'string' && error.subject.length <= 256 ? error.subject : subject;
        try {
          onSettleError({ action: command.action, hook, code: code ?? (/^[a-z0-9_]{1,64}$/.test(error?.message ?? '') ? error.message : undefined),
            statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : undefined,
            step: ['speech', 'chat', 'probe'].includes(error?.step) ? error.step : undefined, playerId: failedFor });
        } catch { /* Reporting cannot alter the response. */ }
      };
      const afterCommit = (work, hook) => {
        hook = typeof hook === 'string' && /^[a-z0-9_/:.-]{1,64}$/.test(hook) ? hook : undefined;
        if (!open) return report(hook, undefined, 'after_commit_closed');
        if (typeof work !== 'function' || settled.length >= MAX_SETTLE_HOOKS) throw new TypeError('studio_game_command_after_commit_invalid');
        settled.push({ work, hook });
      };
      const accepted = await boDb.transaction(async () => {
        fresh();
        const current = await authorize(request);
        const acceptedAt=fresh();
        if (current.user !== session.user || current.role !== session.role || !meetsStudioAdminActionRole(current.role, command.action)
          || canonicalStudioJson(validateStudioScope(current.scope)) !== canonicalStudioJson(scope)) fail();
        // The nonce and domain mutation share the product's transaction. A lost
        // response cannot cause a second credit when the same command is replayed.
        const key = `studio-command:${command.commandId}`;
        const inserted = await boDb.prepare('INSERT INTO meta (k,v) VALUES (?,?) ON CONFLICT(k) DO NOTHING').run(key, String(acceptedAt));
        if (!inserted.changes) fail(409);
        await boDb.prepare("DELETE FROM meta WHERE k LIKE 'studio-command:%' AND v::bigint<?").run(fresh() - 60000);
        fresh();
        const result = await execute({ action: command.action, body: command.body, actor: session, scope, afterCommit });
        if (!result || result.error || result.ok === false) fail(result?.statusCode || 400);
        // Serialized before commit: an unencodable result still rolls back the mutation and nonce.
        return response(200, { ...result, ok: true, authority: 'render', scope });
      }).finally(() => { open = false; });
      // Sequential: each hook may open its own pooled transaction.
      for (const { work, hook } of settled) {
        try { await work(); } catch (error) { report(hook, error); }
      }
      return accepted;
    } catch (error) {
      const status = [400,401,403,404,409,413,422,423].includes(error?.statusCode) ? error.statusCode : 503;
      return response(status, { error: 'studio_game_command_rejected' });
    }
  };
}
