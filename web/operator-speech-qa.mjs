import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeChatWithSpeech } from './generated-speech-chat.mjs';

const PATH = '/api/bo/speech-qa';
const PREFIX = 'operator-qa-';
const MAX_ATTEMPTS = 3;
const MAX_LIFETIME = 30 * 60 * 1000;
const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const QUESTIONS = [
  'Beskriv med en kort mening hur mamma bakar bullar medan pappa brygger morgonkaffe hemma.',
  'Svara med en kort mening om blåbär, papper och mjuka kuddar på balkongen.',
];
const digest = value => createHash('sha256').update(value).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const fail = (code, statusCode = 503) => { throw Object.assign(new Error(code), { code, statusCode }); };

/** An opt-in operator test inside the existing Web process. It owns no player
 * database or provider. All paid work uses the supplied product stream service,
 * including its immutable reservations, worker admission and budget policy. */
export function createOperatorSpeechQa({ directory, origin, authenticate, service, decide, now = Date.now }) {
  const root = typeof directory === 'string' && isAbsolute(directory) ? resolve(directory) : null;
  let publicOrigin;
  try { const url = new URL(origin); if (url.origin === origin && url.protocol === 'https:') publicOrigin = url; } catch {}
  const inside = root ? relative(REPOSITORY, root) : '';
  const privateRoot = root && ![parse(root).root, homedir(), REPOSITORY].some(path => samePath(resolve(path), root))
    && (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside));
  const identities = new Map();
  let pending = false, preparing = null;

  function principal(req) {
    // Validate the live BO account/epoch before inspecting a QA identity.
    let claims;
    try { claims = authenticate(req); } catch { fail('operator_speech_qa_auth_required', 403); }
    if (!claims || !['admin', 'superadmin'].includes(claims.role)) fail('operator_speech_qa_auth_required', 403);
    const cookies = (req.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('bo_jwt='));
    if (cookies.length !== 1 || !/^bo_jwt=[A-Za-z0-9_.-]{1,8192}$/.test(cookies[0])) fail('operator_speech_qa_auth_required', 403);
    return digest(JSON.stringify([cookies[0].slice(7), claims.sub, claims.role, claims.source_stamp, claims.auth_epoch, claims.exp]));
  }
  function cancel(entry) {
    if (entry.controller.signal.aborted && !identities.has(entry.playerId)) return;
    clearTimeout(entry.timer);
    identities.delete(entry.playerId);
    entry.controller.abort();
    try { entry.stream.cancelOwner(entry.owner); } catch { /* Never close the shared service. */ }
    entry.release?.();
  }
  async function directoryReady() {
    if (!privateRoot || !publicOrigin) fail('operator_speech_qa_disabled');
    const info = await lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(root), root)
      || (process.platform !== 'win32' && (info.mode & 0o077))) fail('operator_speech_qa_disabled');
  }
  async function json(name) {
    const path = join(root, name), info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 2048
      || (process.platform !== 'win32' && (info.mode & 0o077))) fail('operator_speech_qa_invalid_gate');
    const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const opened = await file.stat();
      if (opened.dev !== info.dev || opened.ino !== info.ino || !opened.isFile()) fail('operator_speech_qa_invalid_gate');
      return JSON.parse(await file.readFile('utf8'));
    } finally { await file.close(); }
  }
  async function optional(name) {
    try { return await json(name); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  const fingerprint = gate => JSON.stringify([gate.id, gate.createdAt, gate.expiresAt]);
  const campaignName = gate => `${PREFIX}${gate.id}.campaign.json`;
  const attemptName = (gate, attempt) => `${PREFIX}${gate.id}.attempt-${attempt}.json`;
  async function state() {
    let gate = null, attempts = 0;
    try {
      await directoryReady();
      const value = await json('operator-qa.json'), time = now();
      if (!exact(value, ['id', 'createdAt', 'expiresAt']) || !UUID.test(value.id)
        || !Number.isSafeInteger(time) || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0
        || !Number.isSafeInteger(value.expiresAt) || value.createdAt > time || value.expiresAt <= time
        || value.expiresAt <= value.createdAt || value.expiresAt - value.createdAt > MAX_LIFETIME) fail('operator_speech_qa_disabled');
      const campaign = await optional(campaignName(value));
      if (campaign && (!exact(campaign, ['id', 'createdAt', 'expiresAt']) || fingerprint(campaign) !== fingerprint(value))) fail('operator_speech_qa_invalid_gate');
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const record = await optional(attemptName(value, attempt));
        if (!record) continue;
        if (!campaign || !exact(record, ['campaignId', 'attempt', 'turn', 'reservedAt']) || record.campaignId !== value.id
          || record.attempt !== attempt || ![1, 2].includes(record.turn) || !Number.isSafeInteger(record.reservedAt)
          || record.reservedAt < value.createdAt || record.reservedAt >= value.expiresAt) fail('operator_speech_qa_invalid_gate');
        attempts++;
      }
      if (now() >= value.expiresAt || now() < value.createdAt) fail('operator_speech_qa_disabled');
      gate = value;
    } catch { gate = null; }
    for (const entry of identities.values()) {
      if (!gate || fingerprint(entry.gate) !== fingerprint(gate)) cancel(entry);
    }
    return { gate, attempts };
  }
  function capacity(stream) {
    const status = stream?.status?.() ?? {};
    return Object.fromEntries(['workers', 'busy', 'available', 'pending'].map(key => [key,
      Number.isSafeInteger(status[key]) && status[key] >= 0 ? status[key] : 0]));
  }
  async function status() {
    const current = await state(), stream = service();
    return { enabled: Boolean(current.gate && stream), attempts: current.attempts, maxAttempts: MAX_ATTEMPTS,
      expiresAt: current.gate?.expiresAt ?? null, pending: Number(pending), identities: identities.size, relay: capacity(stream) };
  }
  async function currentEntry(req, playerId) {
    const bound = principal(req);
    const current = await state();
    const entry = identities.get(playerId);
    if (!current.gate || !entry || entry.binding !== bound || principal(req) !== bound || entry.controller.signal.aborted
      || now() >= current.gate.expiresAt
      || fingerprint(entry.gate) !== fingerprint(current.gate)) fail('operator_speech_qa_stale', 401);
    return entry;
  }
  async function writeNew(name, value) {
    const file = await open(join(root, name), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); }
    finally { await file.close(); }
  }
  async function reserve(gate, turn) {
    try { await writeNew(campaignName(gate), gate); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const current = await state();
    if (!current.gate || fingerprint(current.gate) !== fingerprint(gate)) fail('operator_speech_qa_disabled');
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try { await writeNew(attemptName(gate, attempt), { campaignId: gate.id, attempt, turn, reservedAt: now() }); return attempt; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    fail('operator_speech_qa_attempt_limit', 429);
  }
  async function body(req) {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') fail('operator_speech_qa_json_required', 415);
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 128) fail('operator_speech_qa_invalid_request', 413);
      chunks.push(Buffer.from(chunk));
    }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('operator_speech_qa_invalid_request', 400); }
    if (!exact(value, ['turn']) || ![1, 2].includes(value.turn)) fail('operator_speech_qa_invalid_request', 400);
    return value;
  }
  function reply(res, code, value) {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(JSON.stringify(value));
  }
  return {
    // Dispatch only: this never grants access, including after map cleanup.
    ownsIdentity: playerId => typeof playerId === 'string' && playerId.startsWith(PREFIX),
    async resolveOwner(req, playerId) {
      try { return (await currentEntry(req, playerId)).owner; } catch { return null; }
    },
    async handle(req, res, pathname) {
      if (pathname !== PATH) return false;
      let entry, lock, lockInfo, lockPath, attempt, success = false;
      const disconnected = () => { if (!res.writableEnded && entry) cancel(entry); };
      try {
        const binding = principal(req);
        if (!publicOrigin || req.headers.host !== publicOrigin.host || req.url !== PATH) fail('operator_speech_qa_invalid_origin', 403);
        if (!['GET', 'POST', 'DELETE'].includes(req.method)) fail('operator_speech_qa_method', 405);
        if (req.method !== 'GET' && (req.headers.origin !== origin
          || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin'))) fail('operator_speech_qa_invalid_origin', 403);
        if (req.method === 'GET') { reply(res, 200, await status()); return true; }
        if (req.method === 'DELETE') {
          if (preparing?.binding === binding) preparing.controller.abort();
          for (const owned of identities.values()) if (owned.binding === binding) cancel(owned);
          reply(res, 200, await status()); return true;
        }
        const { turn } = await body(req);
        if (pending) fail('operator_speech_qa_busy', 409);
        pending = true;
        preparing = { binding, controller: new AbortController() };
        try {
          const current = await state(), stream = service();
          if (!current.gate || !stream) fail('operator_speech_qa_disabled');
          const relay = capacity(stream);
          if (relay.busy || relay.pending) fail('operator_speech_qa_busy', 409);
          lockPath = join(root, `${PREFIX}${current.gate.id}.lock`);
          try { lock = await open(lockPath, 'wx', 0o600); lockInfo = await lock.stat(); }
          catch (error) { if (error.code === 'EEXIST') fail('operator_speech_qa_busy', 409); throw error; }
          attempt = await reserve(current.gate, turn);
          if (preparing.controller.signal.aborted) fail('operator_speech_qa_cancelled', 499);
          const playerId = `${PREFIX}${randomUUID()}`;
          entry = { playerId, binding, gate: current.gate, owner: `${PREFIX}${current.gate.id}-${binding}`,
            controller: preparing.controller, stream };
          // Each attempt owns only its own stream and cannot replace another QA reply.
          entry.owner += `-${attempt}`;
          if (typeof stream.acquireExclusive !== 'function') fail('operator_speech_qa_disabled');
          entry.release = stream.acquireExclusive(entry.owner);
          identities.set(playerId, entry);
          entry.timer = setTimeout(() => cancel(entry), Math.max(1, entry.gate.expiresAt - now()));
          entry.timer.unref?.();
          res.once('close', disconnected);
          if (res.destroyed || req.aborted) fail('operator_speech_qa_cancelled', 499);
          const request = { requestId: `qa-${entry.gate.id}-${attempt}-${randomUUID()}`, message: QUESTIONS[turn - 1], history: [] };
          const context = { dealerId: 'astrid', sessionRevision: `qa-${entry.gate.id}`, roundRevision: 'qa-idle',
            roundPhase: 'idle', round: null, displayName: 'Läppsynkprov', publishedEvents: [], occupiedBoxes: [],
            policy: { generatedText: true, recordedLines: [], silence: false, mediaFamilies: [] } };
          const timings = {};
          const decision = await completeChatWithSpeech({ request, status: context, owner: entry.owner, playerId,
            signal: entry.controller.signal,
            readOwner: () => !entry.controller.signal.aborted && now() < entry.gate.expiresAt && principal(req) === binding ? entry.owner : null,
            readStatus: async () => { await currentEntry(req, playerId); return context; },
            decide: (value, state) => decide(value, state, entry.controller.signal),
            streamService: stream,
            onTiming: (stage, ms) => { if (/^[a-z_]{1,64}$/.test(stage) && Number.isSafeInteger(ms) && ms >= 0) timings[stage] = ms; },
          });
          if (decision.kind !== 'generatedText' || decision.speechStream?.kind !== 'generated-speech-stream') fail('operator_speech_qa_invalid_decision', 502);
          reply(res, 200, { decision, timings, attempt });
          success = true; // HTTP completion must not abort subsequent WebSocket playback.
        } finally { pending = false; preparing = null; }
      } catch (error) {
        const code = /^(?:operator_speech_qa_|generated_speech_)[a-z_]+$/.test(error?.code || '') ? error.code : 'operator_speech_qa_failed';
        const statusCode = [400, 401, 403, 405, 409, 413, 415, 429, 499, 502, 503, 504].includes(error?.statusCode) ? error.statusCode : 502;
        reply(res, statusCode, { error: code, ...(attempt ? { attempt } : {}) });
      } finally {
        res.removeListener('close', disconnected);
        if (entry && !success) cancel(entry);
        if (lock) {
          await lock.close();
          try {
            const current = await lstat(lockPath);
            if (!current.isSymbolicLink() && current.dev === lockInfo.dev && current.ino === lockInfo.ino) await unlink(lockPath);
          } catch { /* An uncertain or replaced lock stays fail-closed. */ }
        }
      }
      return true;
    },
  };
}
