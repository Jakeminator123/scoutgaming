import { readFileSync } from 'node:fs';
import { mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { StudioError } from './project-store.mjs';
import { assertLocalRequest, readLocalJson, jsonResponse, errorResponse } from './http-guard.mjs';
import { ASTRID_VOICE_PROFILE } from '../../packages/presentation/contracts/astrid-voice-profile.mjs';

const LAB_DIR = basename(process.cwd()) === 'lab' ? process.cwd() : resolve(process.cwd(), 'lab');
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const ID = /^[a-f0-9]{64}$/;
const inFlight = new Map();
const neonMode = env => env?.CROUPIER_STUDIO_NEON_POLICY === '1' || env?.CROUPIER_STUDIO_NATIVE_ADMIN === '1';
const disabledMessage = 'Det fristående röstprovet är avstängt. Tal i molnläget kräver Render och dess beständiga kostnadsjournal.';
function assertPreviewEnabled(options = {}) {
  if (neonMode(process.env) || neonMode(options.env) || options.settings?.disabled)
    throw new StudioError(disabledMessage, 503);
}
export const VOICE_PREVIEW = Object.freeze({
  voiceId: ASTRID_VOICE_PROFILE.voiceId, voiceName: ASTRID_VOICE_PROFILE.name, modelId: ASTRID_VOICE_PROFILE.modelId,
  outputFormat: Object.freeze({ container: 'mp3', sample_rate: 44100, bit_rate: 128000 }), maxTextLength: 500,
});
export const VOICE_PHRASES = Object.freeze([
  Object.freeze({ id: 'welcome', label: 'Välkommen', text: 'Välkommen till bordet! Jag heter Astrid.' }),
  Object.freeze({ id: 'evening', label: 'Godkväll', text: 'Godkväll och välkommen! Vad roligt att se dig här.' }),
  Object.freeze({ id: 'casual', label: 'Tjena', text: 'Tjena! Kul att du tittar förbi.' }),
]);

// Server-only, selective key read. Never write credentials into process.env or responses.
export function readVoiceSettings({ env = process.env, envFiles = [resolve(LAB_DIR, '../.env')] } = {}) {
  if (neonMode(env)) return { key: '', mismatch: false, cacheDir: '', disabled: true };
  const values = {};
  for (const file of envFiles) {
    try {
      const parsed = parseEnv(readFileSync(file, 'utf8'));
      if (parsed.CARTESIA_API_KEY !== undefined) values.CARTESIA_API_KEY = parsed.CARTESIA_API_KEY;
    } catch (error) { if (error.code !== 'ENOENT') throw new StudioError('Rotens miljöfil kunde inte läsas.', 503); }
  }
  if (env.CARTESIA_API_KEY !== undefined) values.CARTESIA_API_KEY = env.CARTESIA_API_KEY;
  return {
    key: values.CARTESIA_API_KEY?.trim() || '',
    mismatch: false,
    cacheDir: resolve(LAB_DIR, 'data', 'voice-cache'),
  };
}

export function voicePreviewStatus(settings = readVoiceSettings()) {
  if (settings.disabled || neonMode(process.env)) return {
    configured: false, message: disabledMessage, voiceName: VOICE_PREVIEW.voiceName, modelId: VOICE_PREVIEW.modelId,
    maxTextLength: VOICE_PREVIEW.maxTextLength, phrases: VOICE_PHRASES,
  };
  return {
    configured: Boolean(settings.key) && !settings.mismatch,
    message: settings.key ? 'Cartesia-nyckel finns på servern. Ingen röst genereras förrän du trycker på knappen.' : 'Lägg CARTESIA_API_KEY i rotens .env.',
    voiceName: VOICE_PREVIEW.voiceName, modelId: VOICE_PREVIEW.modelId,
    maxTextLength: VOICE_PREVIEW.maxTextLength, phrases: VOICE_PHRASES,
  };
}

export function voicePreviewText(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.text !== 'string') throw new StudioError('Röstprovet tar bara emot ett textfält.');
  if (body.text.length > VOICE_PREVIEW.maxTextLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.text)) throw new StudioError('Skriv högst 500 tecken utan kontrolltecken.');
  const text = body.text.trim().replace(/\r\n?/g, '\n');
  if (!text) throw new StudioError('Skriv en kort text för röstprovet.');
  return text;
}

function fingerprint(text) {
  return { schemaVersion: 2, purpose: 'standalone-lab-voice-preview', text, voiceId: VOICE_PREVIEW.voiceId, modelId: VOICE_PREVIEW.modelId, outputFormat: VOICE_PREVIEW.outputFormat };
}
export function voicePreviewId(text) { return createHash('sha256').update(JSON.stringify(fingerprint(text))).digest('hex'); }
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function publicResult(metadata, cached) {
  return { id: metadata.id, audioUrl: `/api/voice/${metadata.id}`, cached, text: metadata.text, voiceName: VOICE_PREVIEW.voiceName, modelId: VOICE_PREVIEW.modelId, productionApproved: false, syncedVideo: null };
}
async function boundedFile(path, limit) {
  const file = await open(path, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size < 1 || info.size > limit) throw new StudioError('Det lokala röstprovet har ogiltig storlek.', 409);
    const buffer = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < buffer.length) {
      const chunk = await file.read(buffer, offset, buffer.length - offset, offset);
      if (!chunk.bytesRead) throw new StudioError('Det lokala röstprovet är ofullständigt.', 409);
      offset += chunk.bytesRead;
    }
    return buffer;
  } finally { await file.close(); }
}

async function cachedVoice(id, cacheDir) {
  let metadata;
  try {
    const raw = await boundedFile(join(cacheDir, `${id}.json`), 16 * 1024);
    metadata = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      const exists = await stat(join(cacheDir, `${id}.mp3`)).then(() => true, cause => { if (cause.code === 'ENOENT') return false; throw cause; });
      if (exists) throw new StudioError('Ett ofullständigt röstprov finns redan. Ingen ny avgiftsbelagd generering gjordes.', 409);
      return null;
    }
    throw new StudioError('Röstprovets metadata är skadad. Ingen ny generering gjordes.', 409);
  }
  if (metadata?.id !== id || typeof metadata.text !== 'string' || voicePreviewId(metadata.text) !== id || metadata.productionApproved !== false || metadata.syncedVideo !== null) throw new StudioError('Röstprovets metadata matchar inte dess ID.', 409);
  const expected = fingerprint(metadata.text);
  const actual = Object.fromEntries(Object.keys(expected).map(key => [key, metadata[key]]));
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new StudioError('Röstprovets inställningar matchar inte dess ID.', 409);
  let audio;
  try { audio = await boundedFile(join(cacheDir, `${id}.mp3`), MAX_AUDIO_BYTES); }
  catch { throw new StudioError('Ljudfilen saknas eller är ofullständig. Ingen ny generering gjordes.', 409); }
  if (audio.length !== metadata.bytes || sha256(audio) !== metadata.sha256) throw new StudioError('Ljudfilen matchar inte röstprovets kontrollsumma.', 409);
  return { metadata, audio };
}

async function boundedAudio(response) {
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'audio/mpeg' || Number(response.headers.get('content-length')) > MAX_AUDIO_BYTES) {
    await response.body?.cancel();
    throw new StudioError('Cartesia returnerade inte ett rimligt MP3-röstprov.', 502);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new StudioError('Cartesia returnerade inget ljud.', 502);
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.length;
      if (size > MAX_AUDIO_BYTES) { await reader.cancel(); throw new StudioError('Röstprovet blev för stort.', 502); }
      chunks.push(Buffer.from(item.value));
    }
  } finally { reader.releaseLock(); }
  const audio = Buffer.concat(chunks);
  if (audio.length < 3 || !(audio.subarray(0, 3).toString('ascii') === 'ID3' || audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)) throw new StudioError('Svaret saknar MP3-signatur.', 502);
  return audio;
}

async function generateOnce(text, id, settings, fetchImpl) {
  await mkdir(settings.cacheDir, { recursive: true });
  let release;
  try { release = await lockfile.lock(settings.cacheDir, { lockfilePath: join(settings.cacheDir, '.generation.lock'), stale: 120000, update: 10000, retries: 0 }); }
  catch { throw new StudioError('Ett röstprov genereras redan. Försök igen när det är klart.', 429); }
  let temporary;
  try {
    const existing = await cachedVoice(id, settings.cacheDir);
    if (existing) return publicResult(existing.metadata, true);
    if (!settings.key || settings.mismatch) throw new StudioError(voicePreviewStatus(settings).message, 503);
    let audio;
    try {
      const response = await fetchImpl('https://api.cartesia.ai/tts/bytes', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${settings.key}`, 'Cartesia-Version': '2026-08-14', 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ transcript: text, voice: VOICE_PREVIEW.voiceId, model_id: VOICE_PREVIEW.modelId, output_format: VOICE_PREVIEW.outputFormat }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new StudioError(`Cartesia svarade ${response.status}. Ingen automatisk omkörning görs.`, 502); }
      audio = await boundedAudio(response);
    } catch (error) {
      if (error instanceof StudioError) throw error;
      throw new StudioError('Röstprovet kunde inte hämtas inom 30 sekunder. Ingen automatisk omkörning görs.', 502);
    }
    const metadata = { ...fingerprint(text), id, generatedAt: new Date().toISOString(), bytes: audio.length, sha256: sha256(audio), productionApproved: false, syncedVideo: null };
    // Audio is immutable. The atomic metadata rename is the cache commit marker.
    await writeFile(join(settings.cacheDir, `${id}.mp3`), audio, { flag: 'wx' });
    temporary = join(settings.cacheDir, `${id}.${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, join(settings.cacheDir, `${id}.json`));
    temporary = undefined;
    return publicResult(metadata, false);
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
    await release();
  }
}

export async function generateVoicePreview(body, options = {}) {
  assertPreviewEnabled(options);
  const settings = options.settings ?? readVoiceSettings({ env: options.env ?? process.env });
  assertPreviewEnabled({ ...options, settings });
  const fetchImpl = options.fetchImpl ?? fetch;
  const text = voicePreviewText(body), id = voicePreviewId(text);
  const key = `${settings.cacheDir}\0${id}`;
  if (inFlight.has(key)) return { ...await inFlight.get(key), cached: true };
  const existing = await cachedVoice(id, settings.cacheDir);
  if (existing) return publicResult(existing.metadata, true);
  // Recheck after disk I/O so two identical callers cannot both start a request.
  if (inFlight.has(key)) return { ...await inFlight.get(key), cached: true };
  const task = generateOnce(text, id, settings, fetchImpl);
  inFlight.set(key, task);
  try { return await task; } finally { inFlight.delete(key); }
}

export async function voicePreviewResponse(request, id, options = {}) {
  assertPreviewEnabled(options);
  const settings = options.settings ?? readVoiceSettings({ env: options.env ?? process.env });
  assertPreviewEnabled({ ...options, settings });
  assertLocalRequest(request);
  if (!['GET', 'HEAD'].includes(request.method)) throw new StudioError('Metoden stöds inte.', 405);
  if (!ID.test(id)) throw new StudioError('Okänt röstprov.', 404);
  const cached = await cachedVoice(id, settings.cacheDir);
  if (!cached) throw new StudioError('Röstprovet finns inte lokalt.', 404);
  return new Response(request.method === 'HEAD' ? null : cached.audio, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(cached.audio.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'none' } });
}

export async function voicePreviewEndpoint(request, options = {}) {
  try {
    assertPreviewEnabled(options);
    assertLocalRequest(request);
    if (request.method === 'GET') return jsonResponse(voicePreviewStatus(options.settings));
    if (request.method !== 'POST') throw new StudioError('Metoden stöds inte.', 405);
    return jsonResponse(await generateVoicePreview(await readLocalJson(request), options));
  } catch (error) { return errorResponse(error); }
}
