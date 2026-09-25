import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readSettings } from '../../open-claw/lab/src/settings.mjs';
import { normalizeSocialInput, socialChat, validateSocialReply } from '../../open-claw/lab/src/social.mjs';
import { createSocialStore } from './social-store.mjs';
import { remoteRequest, connectionStatus } from './studio-server.mjs';
import { StudioError } from './project-store.mjs';
import { generateVoicePreview, voicePreviewStatus } from './voice-preview.mjs';
import { assertLocalRequest, readLocalJson, jsonResponse, errorResponse } from './http-guard.mjs';
import { companionRequest, labCompanionIdentity } from './companion-server.mjs';
import { getGeneratedSpeechService, generatedSpeechStatus, speechVisitor } from './generated-speech-server.mjs';

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
export function createSocialService({ store = socialStore(), settings = settingsNow, fetchImpl = fetch, generateVoice = generateVoicePreview, generatedSpeechService = getGeneratedSpeechService, now = Date.now } = {}) {
  const sessions = new Map();
  function getSession(id, identity) {
    for (const [key, value] of sessions) if (!value.pending && now() - value.touched > 3600000) sessions.delete(key);
    let session = sessions.get(id);
    if (!session) {
      if (sessions.size >= 128) throw new StudioError('För många labbsamtal är öppna. Vänta innan du startar ett till.', 429);
      session = { identity, touched: now(), lastReaction: -Infinity, pending: null, receipts: new Map(), controller: null, invalidated: false };
      sessions.set(id, session);
    }
    session.touched = now(); return session;
  }
  const currentSettings = () => typeof settings === 'function' ? settings() : settings;
  async function revisionStillCurrent(revision) {
    if ((await store.load()).revision !== revision) throw new StudioError('Policyn ändrades medan svaret skapades. Svaret spelas inte; prova igen.', 409);
  }
  async function chat(body, identity = null, speechOwner = null, { signal } = {}) {
    const cancelled = () => { throw new StudioError('Chattprovet avbröts. Inget nytt tal startas.', 499); };
    if (signal?.aborted) cancelled();
    if (!exactKeys(body, ['requestId', 'conversationId', 'message', 'history', 'policyRevision', 'scene', 'voice', ...(body?.companion ? ['companion'] : [])]) || typeof body.voice !== 'boolean') throw new StudioError('Ogiltigt socialt chattprov.');
    if (body.companion && (!identity || !exactKeys(body.companion, ['fun', 'web']) || typeof body.companion.fun !== 'boolean' || typeof body.companion.web !== 'boolean')) throw new StudioError('Ogiltigt namn- och minnesprov.');
    const policy = await store.load();
    if (body.policyRevision !== policy.revision) throw new StudioError('Läs in den aktuella sociala policyn innan du chattar.', 409);
    let input;
    try { input = normalizeSocialInput({ requestId: body.requestId, conversationId: body.conversationId, message: body.message, history: body.history, policy, scene: body.scene }); }
    catch { throw new StudioError('Chattprovet kräver Astrids vänteläge och ett kort meddelande.', 422); }
    if (signal?.aborted) cancelled();
    const sessionIdentity = identity || input.conversationId;
    const session = getSession(JSON.stringify([sessionIdentity, speechOwner]), sessionIdentity);
    const fingerprint = createHash('sha256').update(JSON.stringify({ input, voice: body.voice, companion: body.companion, speechOwner })).digest('hex');
    const previous = session.receipts.get(input.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new StudioError('Samma test-ID har redan använts för andra indata.', 409);
      return previous.promise;
    }
    if (session.pending) throw new StudioError('Astrid behandlar redan ett meddelande i detta samtal.', 409);
    const controller = new AbortController();
    const workSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const checkpoint = () => { if (workSignal.aborted || session.invalidated) cancelled(); };
    const scopedFetch = (url, options = {}) => fetchImpl(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, workSignal]) : workSignal });
    const work = async () => {
      checkpoint();
      const config = currentSettings();
      const extra = identity && body.companion ? await companionRequest({ operation: 'chat', identity, input, ...body.companion }, config, scopedFetch) : null;
      const raw = extra ? extra.result : config.remoteUrl
        ? await remoteRequest('/api/studio/social-chat', input, config, scopedFetch, 32000)
        : await socialChat(input, config, scopedFetch);
      checkpoint();
      const result = validateLocalReply(raw, input);
      await revisionStillCurrent(policy.revision);
      const expressionCoolingDown = Boolean(result.triggerId && now() - session.lastReaction < policy.cooldownMs);
      // Repeating a fixed trigger phrase would repeat the same reprimand.
      // A free reply belongs to the conversation and survives expression cooldown.
      if (expressionCoolingDown && policy.response.mode === 'fixed') {
        return { ...result, triggerId: null, assetId: 'idle.ready.standard', suppressed: 'cooldown', reply: 'Reaktionen väntar: den sociala triggerns paus har inte löpt ut.', systemNotice: true };
      }
      let audio; let voiceError; let speechPackage;
      if (body.voice) {
        try {
          checkpoint();
          const speech = speechOwner && generatedSpeechService();
          if (speech) speechPackage = await speech.generate({ requestId: input.requestId, text: result.reply, dealerId: 'astrid', owner: speechOwner, signal: workSignal });
          else audio = await generateVoice({ text: result.reply });
        }
        catch { checkpoint(); voiceError = 'Tal kunde inte skapas. Textsvaret finns kvar; ingen automatisk ny generering görs.'; }
      }
      checkpoint();
      await revisionStillCurrent(policy.revision);
      if (result.triggerId && !expressionCoolingDown) session.lastReaction = now();
      return { ...result, ...(extra ? { companion: { profile: extra.profile, search: extra.search, comedy: extra.comedy } } : {}), ...(expressionCoolingDown ? { triggerId: null, suppressed: 'cooldown' } : {}), assetId: expressionCoolingDown ? 'idle.ready.standard' : result.triggerId || 'idle.ready.standard', ...(audio ? { audio } : {}), ...(speechPackage ? { speechPackage } : {}), ...(voiceError ? { voiceError } : {}) };
    };
    session.pending = input.requestId;
    session.controller = controller;
    const promise = work().catch(error => { checkpoint(); throw error; }).finally(() => { session.pending = null; session.controller = null; session.touched = now(); });
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
  function forgetSession(identity) {
    for (const [key, session] of sessions) if (session.identity === identity) {
      session.invalidated = true; session.controller?.abort(); sessions.delete(key);
    }
  }
  return { chat, voice, forgetSession };
}

// Lazy initialization keeps test imports/builds from reading any credentials.
let service;
function currentService() { return service ??= createSocialService(); }
export async function socialEndpoint(request, { store = socialStore(), service: suppliedService, settings, voiceSettings, speechStatus = generatedSpeechStatus, fetchImpl = fetch } = {}) {
  try {
    assertLocalRequest(request);
    const path = new URL(request.url).pathname;
    const config = settings ?? settingsNow();
    if (path === '/api/social' && request.method === 'GET') {
      const generatedSpeech = speechStatus();
      const speech = generatedSpeech.configured ? speechVisitor(request, { create: true }) : null;
      const response = jsonResponse({ policy: await store.load(), configured: connectionStatus(config).configured, voiceConfigured: voicePreviewStatus(voiceSettings).configured, generatedSpeech, companionEnabled: config.companionEnabled === true });
      if (speech?.cookie) response.headers.append('Set-Cookie', speech.cookie);
      return response;
    }
    if (path === '/api/social/profile') {
      const visitor = labCompanionIdentity(request, config);
      const body = request.method === 'GET' ? { operation: 'profile' } : await readLocalJson(request);
      if (!['GET', 'POST'].includes(request.method) || !(exactKeys(body, ['operation']) && ['profile', 'forget'].includes(body.operation) || exactKeys(body, ['operation', 'name']) && body.operation === 'name')) throw new StudioError('Ogiltigt profilval.');
      const response = jsonResponse(await companionRequest({ ...body, identity: visitor.identity }, config, fetchImpl));
      if (body.operation === 'forget') (suppliedService ?? service)?.forgetSession?.(visitor.identity);
      if (visitor.cookie) response.headers.set('Set-Cookie', visitor.cookie);
      return response;
    }
    const body = await readLocalJson(request);
    if (path === '/api/social' && request.method === 'PUT') {
      if (!exactKeys(body, ['policy', 'expectedRevision'])) throw new StudioError('Ogiltig social policybegäran.');
      return jsonResponse({ policy: await store.save(body.policy, body.expectedRevision) });
    }
    if (path === '/api/social/chat' && request.method === 'POST') {
      const visitor = body.companion ? labCompanionIdentity(request, config) : null;
      const speech = speechStatus().configured ? speechVisitor(request, { create: true }) : null;
      // Establish ownership before a long/paid request. If this POST is the
      // first visit, no model/TTS/GPU work starts until the browser has a cookie.
      if (speech?.cookie) {
        const response = jsonResponse({ error: 'Läs in chattvyn före talprovet så att labbsessionen är klar.' }, 409);
        response.headers.set('Set-Cookie', speech.cookie);
        return response;
      }
      const response = jsonResponse(await (suppliedService ?? currentService()).chat(body, visitor?.identity, speech?.owner, { signal: request.signal }));
      if (visitor?.cookie) response.headers.set('Set-Cookie', visitor.cookie);
      if (speech?.cookie) response.headers.append('Set-Cookie', speech.cookie);
      return response;
    }
    if (path === '/api/social/voice' && request.method === 'POST') return jsonResponse(await (suppliedService ?? currentService()).voice(body));
    return jsonResponse({ error: 'Metoden stöds inte.' }, 405);
  } catch (error) { return errorResponse(error); }
}
