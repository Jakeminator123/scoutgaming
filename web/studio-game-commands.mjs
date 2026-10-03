import { timingSafeEqual } from 'node:crypto';
import { studioCommandSignature } from '../lab/lib/studio-game-authority.mjs';
import { validateStudioScope, canonicalStudioJson } from './storage/studio-contract.mjs';
import { studioAdminActionPolicy, meetsStudioAdminActionRole } from '../lab/lib/studio-access-policy.mjs';

const actions = new Set(['players/status', 'apikeys/revoke', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit']);
const fail = (statusCode = 403) => { throw Object.assign(new Error('studio_game_command_rejected'), { statusCode }); };
const response = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });

export function createStudioGameCommandApi({ scope, secret, publicOrigin, authorize, execute, boDb, now = Date.now } = {}) {
  scope = validateStudioScope(scope);
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || typeof authorize !== 'function' || typeof execute !== 'function' || !boDb?.transaction) fail(503);
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
      return await boDb.transaction(async () => {
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
        const result = await execute({ action: command.action, body: command.body, actor: session, scope });
        if (!result || result.error || result.ok === false) fail(result?.statusCode || 400);
        return response(200, { ...result, ok: true, authority: 'render', scope });
      });
    } catch (error) {
      const status = [400,401,403,404,409,413,422,423].includes(error?.statusCode) ? error.statusCode : 503;
      return response(status, { error: 'studio_game_command_rejected' });
    }
  };
}
