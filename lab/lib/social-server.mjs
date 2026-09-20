import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readSettings } from '../../open-claw/lab/src/settings.mjs';
import { normalizeSocialInput, socialChat, validateSocialReply } from '../../open-claw/lab/src/social.mjs';
import { createSocialStore } from './social-store.mjs';
import { remoteRequest, connectionStatus } from './studio-server.mjs';
import { StudioError } from './project-store.mjs';
import { generateVoicePreview, voicePreviewStatus } from './voice-preview.mjs';
import { assertLocalRequest, readLocalJson, jsonResponse, errorResponse } from './http-guard.mjs';

const LAB_DIR = basename(process.cwd()) === 'lab' ? process.cwd() : resolve(process.cwd(), 'lab');
const settingsNow = () => readSettings({ envFiles: [resolve(LAB_DIR, '../.env'), resolve(LAB_DIR, '.env.local')] });
export const socialStore = () => createSocialStore(process.env.LAB_STUDIO_DATA_DIR || resolve(LAB_DIR, 'data'));
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

function validateLocalReply(reply, input) {
  try { return validateSocialReply(reply, input); }
  catch { throw new StudioError('OpenClaw gav inget giltigt socialt svar. Inget tal eller uttryck har spelats.', 502); }
}

// One bounded session operation at a time. Retries with the same request ID reuse
// the result, but never reinterpret changed input. All state is local and ephemeral.
export function createSocialService({ store = socialStore(), settings = settingsNow, fetchImpl = fetch, generateVoice = generateVoicePreview, now = Date.now } = {}) {
  const sessions = new Map();
  function getSession(id) {
    for (const [key, value] of sessions) if (!value.pending && now() - value.touched > 3600000) sessions.delete(key);
    let session = sessions.get(id);
    if (!session) {
      if (sessions.size >= 128) throw new StudioError('För många labbsamtal är öppna. Vänta innan du startar ett till.', 429);
      session = { touched: now(), lastReaction: -Infinity, pending: null, receipts: new Map() };
      sessions.set(id, session);
    }
    session.touched = now(); return session;
  }
  const currentSettings = () => typeof settings === 'function' ? settings() : settings;
  async function revisionStillCurrent(revision) {
    if ((await store.load()).revision !== revision) throw new StudioError('Policyn ändrades medan svaret skapades. Svaret spelas inte; prova igen.', 409);
  }
  async function chat(body) {
    if (!exactKeys(body, ['requestId', 'conversationId', 'message', 'history', 'policyRevision', 'scene', 'voice']) || typeof body.voice !== 'boolean') throw new StudioError('Ogiltigt socialt chattprov.');
    const policy = await store.load();
    if (body.policyRevision !== policy.revision) throw new StudioError('Läs in den aktuella sociala policyn innan du chattar.', 409);
    let input;
    try { input = normalizeSocialInput({ requestId: body.requestId, conversationId: body.conversationId, message: body.message, history: body.history, policy, scene: body.scene }); }
    catch { throw new StudioError('Chattprovet kräver Astrids vänteläge och ett kort meddelande.', 422); }
    const session = getSession(input.conversationId);
    const fingerprint = createHash('sha256').update(JSON.stringify({ input, voice: body.voice })).digest('hex');
    const previous = session.receipts.get(input.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new StudioError('Samma test-ID har redan använts för andra indata.', 409);
      return previous.promise;
    }
    if (session.pending) throw new StudioError('Astrid behandlar redan ett meddelande i detta samtal.', 409);
    const work = async () => {
      const config = currentSettings();
      const raw = config.remoteUrl
        ? await remoteRequest('/api/studio/social-chat', input, config, fetchImpl, 32000)
        : await socialChat(input, config, fetchImpl);
      const result = validateLocalReply(raw, input);
      await revisionStillCurrent(policy.revision);
      const expressionCoolingDown = Boolean(result.triggerId && now() - session.lastReaction < policy.cooldownMs);
      // Repeating a fixed trigger phrase would repeat the same reprimand.
      // A free reply belongs to the conversation and survives expression cooldown.
      if (expressionCoolingDown && policy.response.mode === 'fixed') {
        return { ...result, triggerId: null, assetId: 'idle.ready.standard', suppressed: 'cooldown', reply: 'Reaktionen väntar: den sociala triggerns paus har inte löpt ut.', systemNotice: true };
      }
      let audio; let voiceError;
      if (body.voice) {
        try { audio = await generateVoice({ text: result.reply }); }
        catch { voiceError = 'Tal kunde inte skapas. Textsvaret finns kvar; ingen automatisk ny generering görs.'; }
      }
      await revisionStillCurrent(policy.revision);
      if (result.triggerId && !expressionCoolingDown) session.lastReaction = now();
      return { ...result, ...(expressionCoolingDown ? { triggerId: null, suppressed: 'cooldown' } : {}), assetId: expressionCoolingDown ? 'idle.ready.standard' : result.triggerId || 'idle.ready.standard', ...(audio ? { audio } : {}), ...(voiceError ? { voiceError } : {}) };
    };
    session.pending = input.requestId;
    const promise = work().finally(() => { session.pending = null; session.touched = now(); });
    session.receipts.set(input.requestId, { fingerprint, promise });
    while (session.receipts.size > 20) session.receipts.delete(session.receipts.keys().next().value);
    return promise;
  }
  async function voice(body) {
    if (!exactKeys(body, ['policyRevision'])) throw new StudioError('Ogiltigt röstprov.');
    const policy = await store.load();
    if (body.policyRevision !== policy.revision) throw new StudioError('Läs in aktuell social policy först.', 409);
    const audio = await generateVoice({ text: policy.response.fixedText });
    await revisionStillCurrent(policy.revision);
    return audio;
  }
  return { chat, voice };
}

// Lazy initialization keeps test imports/builds from reading any credentials.
let service;
function currentService() { return service ??= createSocialService(); }
export async function socialEndpoint(request, { store = socialStore(), service: suppliedService, settings, voiceSettings } = {}) {
  try {
    assertLocalRequest(request);
    const path = new URL(request.url).pathname;
    if (path === '/api/social' && request.method === 'GET') return jsonResponse({ policy: await store.load(), configured: connectionStatus(settings ?? settingsNow()).configured, voiceConfigured: voicePreviewStatus(voiceSettings).configured });
    const body = await readLocalJson(request);
    if (path === '/api/social' && request.method === 'PUT') {
      if (!exactKeys(body, ['policy', 'expectedRevision'])) throw new StudioError('Ogiltig social policybegäran.');
      return jsonResponse({ policy: await store.save(body.policy, body.expectedRevision) });
    }
    if (path === '/api/social/chat' && request.method === 'POST') return jsonResponse(await (suppliedService ?? currentService()).chat(body));
    if (path === '/api/social/voice' && request.method === 'POST') return jsonResponse(await (suppliedService ?? currentService()).voice(body));
    return jsonResponse({ error: 'Metoden stöds inte.' }, 405);
  } catch (error) { return errorResponse(error); }
}
