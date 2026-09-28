import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isIP } from 'node:net';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASTRID_VOICE_PROFILE } from './public/astrid-voice-profile.mjs';

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');
const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const identifier = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
function fail(code, statusCode = 503) { throw Object.assign(new Error(code), { code, statusCode }); }
function privateDirectory(value) {
  if (typeof value !== 'string' || !isAbsolute(value)) return false;
  const path = resolve(value), inside = relative(REPOSITORY, path);
  return ![parse(path).root, homedir(), process.cwd()].some(v => equalPath(path, resolve(v)))
    && (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside));
}

export function generatedSpeechStreamConfiguration(env = process.env) {
  let origin = null;
  const local = env.CROUPIER_GENERATED_SPEECH_PREVIEW === '1' && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(env.HOST);
  if (local) origin = `http://${env.HOST === '::1' ? '[::1]' : env.HOST}:${Number(env.PORT || 4173)}`;
  let cloud = false;
  if (env.CROUPIER_CLOUD_GENERATED_SPEECH === '1' && env.NODE_ENV === 'production' && env.DEMO_GUEST_ACCESS !== '1'
    && ['0.0.0.0', '::', '[::]'].includes(env.HOST)) {
    try {
      const url = new URL(env.PUBLIC_URL);
      cloud = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' && !url.port
        && !isIP(url.hostname) && url.hostname.includes('.') && !url.hostname.endsWith('.local') && url.hostname !== 'localhost';
      if (cloud) origin = url.origin;
    } catch {}
  }
  const enabled = env.CROUPIER_GENERATED_SPEECH_STREAMING === '1' && env.CROUPIER_GENERATED_SPEECH === '1' && (local || cloud);
  const configuration = { directory: env.CROUPIER_GENERATED_SPEECH_DIR, origin,
    workerSecret: env.CROUPIER_SPEECH_STREAM_WORKER_SECRET, ticketSecret: env.CROUPIER_SPEECH_STREAM_TICKET_SECRET,
    apiKey: env.CARTESIA_API_KEY, voiceId: ASTRID_VOICE_PROFILE.voiceId, modelId: ASTRID_VOICE_PROFILE.modelId };
  const secret = v => typeof v === 'string' && v.length >= 32 && v.length <= 2048 && !/\s/.test(v);
  const configured = enabled && privateDirectory(configuration.directory) && secret(configuration.workerSecret) && secret(configuration.ticketSecret)
    && typeof configuration.apiKey === 'string' && configuration.apiKey.length > 0 && !/\s/.test(configuration.apiKey);
  return { enabled, configured, configuration };
}

/** No websocket dependency is loaded unless this opt-in service is constructed.
 * prepare reserves durable request identity; TTS starts only on an authenticated
 * browser attachment. Normal HTTP result completion does not own this lifetime.
 */
export async function createGeneratedSpeechStreamService(server, configuration, {
  resolveOwner, attachRelay, pcmSource,
  freshnessIntervalMs = 500, ticketLifetimeMs = 30000, streamLifetimeMs = 120000,
} = {}) {
  if (!privateDirectory(configuration?.directory) || typeof resolveOwner !== 'function') fail('generated_speech_stream_not_configured');
  const [{ issueTicket, ticketAuthenticator }, { createCartesiaSource }] = await Promise.all([
    import('../services/astrid-gpu-worker/gateway/auth.mjs'),
    import('../services/astrid-gpu-worker/gateway/cartesia-source.mjs'),
  ]);
  const { directory, workerSecret, ticketSecret, origin } = configuration;
  const authenticateTicket = ticketAuthenticator(ticketSecret);
  const source = pcmSource ?? createCartesiaSource(configuration);
  const attach = attachRelay ?? (await import('../services/astrid-gpu-worker/gateway/relay.mjs')).attachSpeechRelay;
  const records = new Map(), owners = new Map(), preparations = new Map();
  let relay;
  const forget = record => {
    clearTimeout(record.deadline); clearInterval(record.monitor);
    record.input.signal?.removeEventListener('abort', record.externalAbort);
    record.wireSignal?.removeEventListener('abort', record.wireAbort);
    if (records.get(record.id) === record) records.delete(record.id);
    if (owners.get(record.input.owner) === record) owners.delete(record.input.owner);
  };
  const cancel = record => {
    if (!records.has(record.id)) return;
    record.controller.abort(); record.handle?.abort(); forget(record);
  };
  const fresh = async record => {
    if (record.controller.signal.aborted || record.input.signal?.aborted || records.get(record.id) !== record) fail('generated_speech_stream_cancelled', 499);
    await record.input.beforeCostly();
    if (record.controller.signal.aborted || record.input.signal?.aborted || records.get(record.id) !== record) fail('generated_speech_stream_cancelled', 499);
  };
  relay = attach(server, {
    workerSecret, allowedOrigins: [origin], maxAudioSeconds: 25, allowClientPCM: false,
    async authenticateClient(req) {
      const claims = authenticateTicket(req);
      if (!claims) return null;
      const record = records.get(claims.sessionId);
      if (!record || record.state !== 'prepared' || Date.now() > record.descriptor.expiresAt || claims.userId !== digest(record.input.owner)) return null;
      try {
        if (await resolveOwner(req, record.input.playerId) !== record.input.owner) return null;
        await fresh(record);
        return claims;
      } catch { cancel(record); return null; }
    },
    async onSessionReady(identity) {
      const record = records.get(identity.sessionId);
      if (!record || record.state !== 'prepared' || identity.userId !== digest(record.input.owner)) throw Error('Stale speech request');
      record.state = 'streaming';
      clearTimeout(record.deadline);
      record.deadline = setTimeout(() => cancel(record), streamLifetimeMs); record.deadline.unref?.();
      record.wireSignal = identity.signal;
      record.wireAbort = () => { record.controller.abort(); forget(record); };
      identity.signal.addEventListener('abort', record.wireAbort, { once: true });
      if (identity.signal.aborted) { record.wireAbort(); return; }
      try {
        await fresh(record);
        if (identity.signal.aborted) return;
        record.handle = relay.openSource({ ...identity, rate: 24000 });
        record.monitor = setInterval(() => {
          if (record.checking) return;
          record.checking = true;
          fresh(record).catch(() => cancel(record)).finally(() => { record.checking = false; });
        }, freshnessIntervalMs); record.monitor.unref?.();
        const signal = AbortSignal.any([identity.signal, record.controller.signal]);
        for await (const pcm of source({ text: record.input.text, signal, beforeCostly: () => fresh(record) })) {
          await fresh(record);
          await record.handle.writePCM(pcm);
        }
        await fresh(record); record.handle.end();
        // Keep freshness monitoring through the final encoded fragment, even
        // after the HTTP TTS response has ended. Wire terminal ack owns cleanup.
      } catch { cancel(record); throw Error('Speech source unavailable'); }
    },
  });
  async function reserve(input, key, fingerprint) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || !equalPath(await realpath(directory), resolve(directory))) fail('generated_speech_stream_invalid_directory');
    const reservations = (await readdir(directory)).filter(name => /^(?:stream-)?[a-f0-9]{64}\.request\.json$/.test(name));
    if (reservations.length >= 1024) fail('generated_speech_stream_ledger_full');
    // Recognize early experimental reservations, then use the exact full-file
    // service key so capability changes cannot pay twice for one request.
    try { await lstat(join(directory, `stream-${key}.request.json`)); fail('generated_speech_request_already_attempted', 409); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    let file;
    try { file = await open(join(directory, `${key}.request.json`), 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('generated_speech_request_already_attempted', 409); throw error; }
    try { await file.writeFile(JSON.stringify({ fingerprint, ownerHash: digest(input.owner), state: 'reserved', createdAt: Date.now() })); await file.sync(); }
    finally { await file.close(); }
  }
  return {
    status: () => ({ enabled: true, pending: records.size, ...relay.status() }),
    async prepare(input) {
      if (!input || !identifier(input.requestId) || input.dealerId !== 'astrid' || typeof input.owner !== 'string' || !input.owner || input.owner.length > 512
        || typeof input.text !== 'string' || !input.text.trim() || input.text !== input.text.trim() || input.text.length > 500
        || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(input.text) || typeof input.beforeCostly !== 'function') fail('invalid_generated_speech_stream_request', 400);
      if (!preparations.has(input.owner) && !owners.has(input.owner) && records.size + preparations.size >= 32) fail('generated_speech_stream_busy', 429);
      const preparation = { playerId: input.playerId };
      preparations.set(input.owner, preparation);
      const current = () => { input.signal?.throwIfAborted(); if (preparations.get(input.owner) !== preparation) fail('generated_speech_stream_cancelled', 499); };
      try {
      current(); await input.beforeCostly(); current();
      const key = digest(`${digest(input.owner)}\0${input.requestId}`), fingerprint = digest(JSON.stringify([input.text, configuration.voiceId, configuration.modelId]));
      // Never silently fall back to a paid full-file job on unavailable capacity.
      if (!relay.status().available) fail('generated_speech_stream_worker_unavailable', 503);
      if (records.size >= 32) fail('generated_speech_stream_busy', 429);
      if (owners.has(input.owner)) cancel(owners.get(input.owner));
      await reserve(input, key, fingerprint);
      current(); await input.beforeCostly(); current();
      const id = randomBytes(16).toString('hex'), controller = new AbortController(), issuedAt = Date.now(), expiresAt = issuedAt + ticketLifetimeMs;
      const descriptor = { schemaVersion: 1, kind: 'generated-speech-stream', id, requestId: input.requestId, dealerId: 'astrid', exactText: input.text,
        textSha256: digest(input.text), reviewStatus: 'pending', url: '/speech-stream',
        ticket: issueTicket(ticketSecret, { userId: digest(input.owner), sessionId: id, ttlSeconds: ticketLifetimeMs / 1000 }, issuedAt), expiresAt };
      const record = { id, descriptor, input, controller, state: 'prepared' };
      records.set(id, record); owners.set(input.owner, record);
      record.externalAbort = () => cancel(record);
      input.signal?.addEventListener('abort', record.externalAbort, { once: true });
      record.deadline = setTimeout(() => cancel(record), ticketLifetimeMs); record.deadline.unref?.();
      return descriptor;
      } catch (error) {
        if (/^(?:generated_speech_|invalid_generated_speech_)/.test(error?.code || '') || /^(?:stale_chat_|chat_cancelled)/.test(error?.message || '')) throw error;
        if (input.signal?.aborted) fail('generated_speech_stream_cancelled', 499);
        fail('generated_speech_stream_failed');
      } finally { if (preparations.get(input.owner) === preparation) preparations.delete(input.owner); }
    },
    cancelOwner(owner) { preparations.delete(owner); const record = owners.get(owner); if (record) cancel(record); },
    cancelPlayer(playerId) { for (const [owner, preparation] of preparations) if (preparation.playerId === playerId) preparations.delete(owner); for (const record of records.values()) if (record.input.playerId === playerId) cancel(record); },
    close() { preparations.clear(); for (const record of [...records.values()]) cancel(record); relay.close(); },
  };
}
