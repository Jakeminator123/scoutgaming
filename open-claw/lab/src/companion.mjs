import { createHash } from 'node:crypto';
import { GatewayError } from './openclaw.mjs';
import { normalizeSocialInput, socialChat } from './social.mjs';
import { createCompanionStore, COMPANION_RETENTION_DAYS } from './companion-store.mjs';
import { searchPublicWeb } from './companion-search.mjs';
import { COMPANION_NAMES, companionName, roastFor } from './companion-personas.mjs';
export { COMPANION_NAMES, companionName, roastFor } from './companion-personas.mjs';

const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export function normalizeCompanionRequest(body) {
  const fields = body?.operation === 'chat' ? ['identity', 'operation', 'input', 'fun', 'web']
    : body?.operation === 'name' ? ['identity', 'operation', 'name'] : ['identity', 'operation'];
  if (!exact(body, fields) || !/^[a-f0-9]{64}$/.test(body.identity || '') || !['profile', 'name', 'forget', 'chat'].includes(body.operation)) throw new GatewayError('invalid_companion_request', 400);
  if (body.operation === 'name' && !companionName(body.name)) throw new GatewayError('invalid_companion_name', 400);
  if (body.operation === 'chat') {
    if (typeof body.fun !== 'boolean' || typeof body.web !== 'boolean') throw new GatewayError('invalid_companion_request', 400);
    return { ...body, input: normalizeSocialInput(body.input) };
  }
  return { ...body, ...(body.operation === 'name' ? { name: companionName(body.name) } : {}) };
}
function publicProfile(profile) {
  return { name: profile.name, history: profile.history, names: [...COMPANION_NAMES], retentionDays: COMPANION_RETENTION_DAYS,
    greeting: profile.name ? `Tjena ${profile.name}! ${profile.history.length ? 'Kul att du är tillbaka. Vi kan fortsätta där vi slutade.' : 'Vad vill du prata om?'}` : 'Tjena! Vem kom in? Välj Jakob, Emil, Kevin, Alex eller John.',
    search: { provider: 'openai-web-search', maxPerHour: 10, reserveSek: 0.5, budgetSekPerHour: 5, paidFallback: false } };
}

export function createCompanionService({ directory, store = createCompanionStore(directory), settings, fetchImpl = fetch, model = socialChat } = {}) {
  const pending = new Map();
  const configNow = () => typeof settings === 'function' ? settings() : settings;
  async function handle(raw) {
    const body = normalizeCompanionRequest(raw), config = configNow();
    if (config.companionEnabled === false) throw new GatewayError('companion_disabled', 503);
    const { identity, operation } = body;
    if (operation === 'profile') return publicProfile(store.profile(identity));
    if (operation === 'name') {
      const existing = store.profile(identity);
      if (existing.name && existing.name !== body.name) throw new GatewayError('forget_before_changing_person', 409);
      return publicProfile(store.rename(identity, body.name));
    }
    if (operation === 'forget') return publicProfile(store.forget(identity));
    if (!store.profile(identity).name) throw new GatewayError('companion_name_required', 400);
    const key = `${identity}:${body.input.requestId}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    if (pending.has(key)) {
      const previous = pending.get(key);
      if (previous.fingerprint !== fingerprint) throw new GatewayError('companion_request_conflict', 409);
      return previous.promise;
    }
    const cached = store.reserve(identity, body.input.requestId, fingerprint);
    if (cached?.error) throw new GatewayError(cached.error, 502);
    if (cached) return cached;
    const work = async () => {
      const profile = store.profile(identity);
      // Browser-supplied history is deliberately ignored for persistent profiles.
      const input = { ...body.input, history: profile.history };
      let search = { status: 'not_requested', results: [], costSek: 0 };
      const roast = body.fun && config.companionFunEnabled !== false ? roastFor(input.message) : null;
      const result = await model(input, config, fetchImpl, {
        name: profile.name, roast, personas: body.fun && config.companionFunEnabled !== false,
        search: body.web && config.companionWebEnabled !== false ? async query => {
          search = await searchPublicWeb(query, { store, settings: config, fetchImpl }); return search;
        } : null,
      });
      const history = [...profile.history, { role: 'user', content: input.message }, { role: 'assistant', content: result.reply }].slice(-12);
      while (history.reduce((sum, row) => sum + row.content.length, 0) > 8000) history.shift();
      const response = { result, profile: publicProfile({ ...profile, history }), search, comedy: Boolean(roast) };
      store.finish(identity, input.requestId, profile.revision, history, response);
      return response;
    };
    const promise = work().catch(error => { store.fail(identity, body.input.requestId, error.code || 'companion_failed'); throw error; }).finally(() => pending.delete(key));
    pending.set(key, { fingerprint, promise });
    return promise;
  }
  return { handle, close: () => store.close() };
}
