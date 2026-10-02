import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createPartnerObserver, partnerEnvironment } from './partner-observer.mjs';
import { assertLocalRequest, readLocalJson, jsonResponse, errorResponse } from './http-guard.mjs';
import { StudioError } from './project-store.mjs';
import { sanitizeObservation } from './partner-trace.mjs';

function generationToken(env) {
  if (Object.hasOwn(env, 'BETTALOTTO_API')) return env.BETTALOTTO_API;
  let configured;
  const labDir = basename(process.cwd()) === 'lab' ? process.cwd() : resolve(process.cwd(), 'lab');
  for (const path of [resolve(labDir, '../.env'), resolve(labDir, '.env.local')]) {
    try {
      const values = parseEnv(readFileSync(path, 'utf8'));
      if (Object.hasOwn(values, 'BETTALOTTO_API')) configured = values.BETTALOTTO_API;
    } catch (error) { if (error.code !== 'ENOENT') throw new StudioError('Generationsinställningen kunde inte läsas.', 503); }
  }
  return configured;
}

// Fixed endpoints only. The browser cannot choose an origin, identity or credentials.
export function createPartnerReference({ env = () => process.env, token = generationToken, fetchImpl = fetch, now = Date.now } = {}) {
  const environment = () => typeof env === 'function' ? env() : env;
  async function upstream(url, options) {
    let response;
    try { response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { throw new StudioError('Bettalotto kunde inte nås inom tidsgränsen.', 502); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new StudioError(`Bettalotto svarade ${response.status}. Kontrollera nyckelns behörighet.`, 502);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new StudioError('Bettalotto gav ett tomt svar.', 502);
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.length;
        if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new StudioError('API-svaret är för stort för detta prov.', 502); }
        chunks.push(Buffer.from(chunk.value));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error instanceof StudioError) throw error;
      throw new StudioError('Bettalottos svar kunde inte läsas.', 502);
    } finally { reader.releaseLock(); }
  }
  function config() {
    const raw = environment();
    const partner = partnerEnvironment(raw);
    const status = createPartnerObserver({ env: raw }).status();
    return { raw, partner, status, origin: status.endpoint ? new URL(status.endpoint).origin : null };
  }
  function post(path, body, settings) {
    if (!settings.status.configured) throw new StudioError('Partner-inställningarna är ofullständiga eller ogiltiga.', 503);
    const timestamp = String(Math.floor(now() / 1000));
    const text = JSON.stringify(body);
    const signature = createHmac('sha256', settings.partner.BETTALOTTO_PARTNER_SECRET).update(`${timestamp}.POST.${path}.${text}`).digest('hex');
    return upstream(`${settings.origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': settings.partner.BETTALOTTO_PARTNER_KEY_ID, 'X-Timestamp': timestamp, 'X-Signature': signature }, body: text });
  }
  async function endpoint(request) {
    try {
      assertLocalRequest(request);
      if (new URL(request.url).search) throw new StudioError('Inställningar anges på labbservern.');
      const settings = config();
      if (request.method === 'GET') {
        let mappingConfigured = false, mappingError = null;
        try { mappingConfigured = Boolean(token(settings.raw)); } catch { mappingError = 'Generationsinställningen kunde inte läsas.'; }
        return jsonResponse({ configured: settings.status.configured, playerId: settings.status.configured ? settings.partner.BETTALOTTO_PARTNER_PLAYER_ID : null, mappingConfigured, mappingError, origin: settings.origin });
      }
      if (request.method !== 'POST') return jsonResponse({ error: 'Använd GET eller POST.' }, 405);
      const body = await readLocalJson(request);
      if (!body || Object.keys(body).length !== 1 || !['verify', 'launch', 'launch-staged-base', 'mapping'].includes(body.action)) throw new StudioError('Välj verifiering, spelöppning eller videokarta.');
      if (body.action === 'verify') {
        const result = await post('/api/v1/ping', {}, settings);
        if (result.ok !== true || !Array.isArray(result.scopes) || !result.scopes.every(value => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(value))) throw new StudioError('Behörighetssvaret hade ett okänt format.', 502);
        return jsonResponse({ verifiedAt: new Date(now()).toISOString(), playerId: settings.partner.BETTALOTTO_PARTNER_PLAYER_ID, scopes: [...new Set(result.scopes)] });
      }
      if (body.action === 'launch' || body.action === 'launch-staged-base') {
        const result = await post('/api/v1/launch', { playerId: settings.partner.BETTALOTTO_PARTNER_PLAYER_ID }, settings);
        let url;
        try { url = new URL(result.url); } catch { throw new StudioError('Spelets öppningslänk är ogiltig.', 502); }
        const gamePath = settings.raw.CROUPIER_PUBLIC_GAME_PATH === '/game' ? '/game' : '/';
        if (url.origin !== settings.origin || url.pathname !== gamePath || url.username || url.password || !url.searchParams.get('launch')) throw new StudioError('Spelets öppningslänk har fel adress.', 502);
        const presentationMode = body.action === 'launch-staged-base' ? 'astrid-staged-base' : 'partner-default';
        if (presentationMode === 'astrid-staged-base') {
          // Explicit diagnostic choice. Keep the validated launch identity but
          // use only the base manifest, never inherit motion/scene overrides.
          const launchToken = url.searchParams.get('launch');
          url = new URL(gamePath, settings.origin);
          url.searchParams.set('launch', launchToken);
          url.searchParams.set('dealer', 'astrid');
          url.searchParams.set('performance', 'staged');
        }
        // This short-lived URL is only for navigation. Never put it in activity/trace data.
        return jsonResponse({ url: url.href, expiresIn: Number.isFinite(result.expiresIn) ? result.expiresIn : null, presentationMode });
      }
      const readToken = token(settings.raw);
      if (!readToken || typeof readToken !== 'string' || /[\r\n\0]/.test(readToken)) throw new StudioError('Generations-API:ts lästoken saknas eller är ogiltig.', 503);
      if (!settings.origin) throw new StudioError('Partner-adressen är ogiltig.', 503);
      const result = await upstream(`${settings.origin}/api/v1/generations/mapping`, { headers: { Authorization: `Bearer ${readToken}` } });
      if (!result || !result.dealers || Array.isArray(result.dealers) || typeof result.dealers !== 'object'
        || !Object.values(result.dealers).every(dealer => dealer && typeof dealer === 'object' && !Array.isArray(dealer))
        || result.notes !== undefined && (!Array.isArray(result.notes) || !result.notes.every(note => typeof note === 'string'))
        || result.revision != null && typeof result.revision !== 'string') throw new StudioError('Videokartan hade ett okänt format.', 502);
      const mapping = sanitizeObservation(Object.fromEntries(['generatedAt', 'revision', 'notes', 'events', 'backofficePicks', 'neverAgain', 'verdicts', 'dealers'].filter(key => Object.hasOwn(result, key)).map(key => [key, result[key]])));
      return jsonResponse({ fetchedAt: new Date(now()).toISOString(), source: `${settings.origin}/api/v1/generations/mapping`, actualPlayback: false, mapping });
    } catch (error) { return errorResponse(error); }
  }
  return { endpoint };
}

let reference;
export function partnerReferenceEndpoint(request) { return (reference ??= createPartnerReference()).endpoint(request); }
