import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import { VOICE_PREVIEW, VOICE_PHRASES, readVoiceSettings, voicePreviewStatus, voicePreviewText, voicePreviewId, generateVoicePreview, voicePreviewResponse, voicePreviewEndpoint } from '../lib/voice-preview.mjs';

// Isolated test directories and fake provider only. Never read root .env or spend credits.
const MP3 = Buffer.from('ID3-fixture-mp3-bytes');
const noFetch = () => assert.fail('Must not contact any provider.');
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-voice-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { key: 'fixture-voice-secret', mismatch: false, cacheDir: join(directory, 'voice-cache') };
}
const provider = () => Promise.resolve(new Response(MP3, { headers: { 'Content-Type': 'audio/mpeg' } }));
function request(method = 'POST', body = { text: 'Hej!' }, extraHeaders = {}) {
  return new Request('http://127.0.0.1:4188/api/voice', { method, headers: { Host: '127.0.0.1:4188', Origin: 'http://127.0.0.1:4188', 'Content-Type': 'application/json', ...extraHeaders }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
}

test('stock voice and three demo phrases are fixed, separate from game event contracts', () => {
  assert.equal(VOICE_PREVIEW.voiceId, 'EXAVITQu4vr4xnSDxMaL');
  assert.equal(VOICE_PREVIEW.modelId, 'eleven_multilingual_v2');
  assert.deepEqual(VOICE_PHRASES.map(item => item.label), ['Välkommen', 'Godkväll', 'Tjena']);
  assert.ok(VOICE_PHRASES.every(item => item.text.length <= 500 && !Object.hasOwn(item, 'eventId')));
});

test('existing credentials support either alias, reject mismatches and never appear in status', () => {
  for (const env of [{ ELEVENLABS_API_KEY: 'a-secret' }, { ELEVENLABS_OC_API: 'a-secret' }, { ELEVENLABS_API_KEY: 'a-secret', ELEVENLABS_OC_API: 'a-secret' }]) {
    const settings = readVoiceSettings({ env, envFiles: [] });
    assert.equal(settings.key, 'a-secret');
    assert.equal(voicePreviewStatus(settings).configured, true);
    assert.ok(!JSON.stringify(voicePreviewStatus(settings)).includes('a-secret'));
  }
  const mismatch = readVoiceSettings({ env: { ELEVENLABS_API_KEY: 'first-secret', ELEVENLABS_OC_API: 'other-secret' }, envFiles: [] });
  assert.equal(mismatch.key, ''); assert.equal(mismatch.mismatch, true);
  assert.equal(voicePreviewStatus(mismatch).configured, false);
  assert.equal(voicePreviewStatus(readVoiceSettings({ env: {}, envFiles: [] })).configured, false);
});

test('text validation rejects oversized input and arbitrary provider parameters without truncation', () => {
  assert.equal(voicePreviewText({ text: '  Hej!\r\nGodkväll.  ' }), 'Hej!\nGodkväll.');
  assert.equal(voicePreviewText({ text: 'a'.repeat(500) }).length, 500);
  for (const body of [{ text: '' }, { text: '  ' }, { text: 'a'.repeat(501) }, { text: 'Hej\0' }, { text: 'Hej', voiceId: 'other' }, { text: 'Hej', url: 'https://untrusted.test' }, null, 'Hej']) assert.throws(() => voicePreviewText(body));
  assert.notEqual(voicePreviewId('Hej'), voicePreviewId('Godkväll'));
});

test('explicit generation writes content-addressed audio/metadata then reuses cache with no new call', async t => {
  const settings = await fixture(t); let calls = 0;
  const result = await generateVoicePreview({ text: 'Hej!' }, { settings, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(String(url), 'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128');
    assert.equal(options.headers['xi-api-key'], settings.key);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), { text: 'Hej!', model_id: VOICE_PREVIEW.modelId, voice_settings: VOICE_PREVIEW.voiceSettings });
    return provider();
  } });
  assert.equal(calls, 1); assert.equal(result.cached, false);
  assert.equal(result.id, voicePreviewId('Hej!'));
  assert.equal(result.audioUrl, `/api/voice/${result.id}`);
  assert.ok(!JSON.stringify(result).includes(settings.key));
  assert.ok(!JSON.stringify(result).includes(settings.cacheDir));
  assert.equal(result.productionApproved, false); assert.equal(result.syncedVideo, null);
  const files = await readdir(settings.cacheDir);
  assert.deepEqual(files.sort(), [`${result.id}.json`, `${result.id}.mp3`].sort());
  const metadata = JSON.parse(await readFile(join(settings.cacheDir, `${result.id}.json`), 'utf8'));
  assert.equal(metadata.text, 'Hej!'); assert.equal(metadata.voiceId, VOICE_PREVIEW.voiceId);
  assert.equal(metadata.purpose, 'standalone-lab-voice-preview');
  const cached = await generateVoicePreview({ text: 'Hej!' }, { settings, fetchImpl: noFetch });
  assert.equal(cached.cached, true); assert.equal(cached.id, result.id);
});

test('concurrent same-text requests share one paid generation', async t => {
  const settings = await fixture(t); let calls = 0;
  const fetchImpl = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 20)); return provider(); };
  const results = await Promise.all(Array.from({ length: 6 }, () => generateVoicePreview({ text: 'Samma text' }, { settings, fetchImpl })));
  assert.equal(calls, 1);
  assert.equal(new Set(results.map(item => item.id)).size, 1);
  assert.equal(results.filter(item => !item.cached).length, 1);
});

test('a cross-process disk lock blocks duplicate spending and is not silently bypassed', async t => {
  const settings = await fixture(t);
  await mkdir(settings.cacheDir, { recursive: true });
  const release = await lockfile.lock(settings.cacheDir, { lockfilePath: join(settings.cacheDir, '.generation.lock'), stale: 120000, retries: 0 });
  try { await assert.rejects(generateVoicePreview({ text: 'Hej' }, { settings, fetchImpl: noFetch }), error => error.statusCode === 429); }
  finally { await release(); }
});

test('missing or conflicting keys never trigger a provider request', async t => {
  const settings = await fixture(t);
  for (const patch of [{ key: '' }, { mismatch: true }]) await assert.rejects(generateVoicePreview({ text: 'Hej' }, { settings: { ...settings, ...patch }, fetchImpl: noFetch }), error => error.statusCode === 503);
});

test('HTTP failure is not retried and provider bodies/secrets are never reflected', async t => {
  const settings = await fixture(t); let calls = 0;
  const response = await voicePreviewEndpoint(request(), { settings, fetchImpl: async () => { calls++; return Response.json({ secret: settings.key, arbitrary: 'upstream-private' }, { status: 401 }); } });
  assert.equal(response.status, 502); assert.equal(calls, 1);
  const body = await response.text();
  assert.match(body, /401/); assert.ok(!body.includes(settings.key)); assert.ok(!body.includes('upstream-private'));
  assert.deepEqual(await readdir(settings.cacheDir), []);
});

test('network failure is bounded to a safe error and never auto-retried', async t => {
  const settings = await fixture(t); let calls = 0;
  await assert.rejects(generateVoicePreview({ text: 'Hej' }, { settings, fetchImpl: async () => { calls++; throw new Error('network dump: fixture-voice-secret'); } }), error => error.statusCode === 502 && !error.message.includes(settings.key));
  assert.equal(calls, 1);
});

test('non-audio, invalid MP3 and oversized response declarations are rejected', async t => {
  const settings = await fixture(t);
  for (const response of [new Response('not audio'), new Response('abc', { headers: { 'Content-Type': 'audio/mpeg' } }), new Response(MP3, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(6 * 1024 * 1024) } })]) {
    await assert.rejects(generateVoicePreview({ text: 'Hej' }, { settings, fetchImpl: async () => response }), error => error.statusCode === 502);
  }
  assert.deepEqual(await readdir(settings.cacheDir), []);
});

test('streamed audio limit is enforced even without Content-Length', async t => {
  const settings = await fixture(t); let cancelled = false;
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024 + 1)); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'audio/mpeg' } });
  await assert.rejects(generateVoicePreview({ text: 'Hej' }, { settings, fetchImpl: async () => response }), error => error.statusCode === 502);
  assert.equal(cancelled, true);
});

test('corrupt or incomplete cache is preserved and never silently regenerated', async t => {
  const settings = await fixture(t);
  const made = await generateVoicePreview({ text: 'Hej' }, { settings, fetchImpl: provider });
  await writeFile(join(settings.cacheDir, `${made.id}.mp3`), 'ID3-corrupt');
  await assert.rejects(generateVoicePreview({ text: 'Hej' }, { settings, fetchImpl: noFetch }), error => error.statusCode === 409);
  const orphan = voicePreviewId('Ofullständig');
  await writeFile(join(settings.cacheDir, `${orphan}.mp3`), MP3);
  await assert.rejects(generateVoicePreview({ text: 'Ofullständig' }, { settings, fetchImpl: noFetch }), error => error.statusCode === 409);
});

test('audio GET/HEAD only serve verified cached bytes; unknown IDs and other origins are blocked', async t => {
  const settings = await fixture(t);
  const made = await generateVoicePreview({ text: 'Hej' }, { settings, fetchImpl: provider });
  const get = await voicePreviewResponse(request('GET'), made.id, { settings });
  assert.equal(get.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual(Buffer.from(await get.arrayBuffer()), MP3);
  const head = await voicePreviewResponse(request('HEAD'), made.id, { settings });
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const id of ['../../.env', 'https://untrusted.test', 'a'.repeat(64)]) await assert.rejects(voicePreviewResponse(request('GET'), id, { settings }), error => error.statusCode === 404);
  await assert.rejects(voicePreviewResponse(request('GET', null, { Origin: 'https://untrusted.test' }), made.id, { settings }), error => error.statusCode === 403);
});

test('HTTP entrypoint checks localhost/origin, JSON and text before any paid request', async t => {
  const settings = await fixture(t);
  assert.equal((await voicePreviewEndpoint(request('POST', { text: 'Hej' }, { Origin: 'https://untrusted.test' }), { settings, fetchImpl: noFetch })).status, 403);
  assert.equal((await voicePreviewEndpoint(request('POST', { text: 'Hej' }, { Host: 'public.example.test' }), { settings, fetchImpl: noFetch })).status, 403);
  assert.equal((await voicePreviewEndpoint(request('POST', { text: 'Hej' }, { 'Content-Type': 'text/plain' }), { settings, fetchImpl: noFetch })).status, 415);
  assert.equal((await voicePreviewEndpoint(request('POST', { text: 'a'.repeat(501) }), { settings, fetchImpl: noFetch })).status, 400);
  const status = await voicePreviewEndpoint(request('GET'), { settings, fetchImpl: noFetch });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).configured, true);
});

test('voice UI has explicit opt-in generation, no audio autoplay and unmount cleanup', async () => {
  const source = await readFile(new URL('../components/voice-preview-panel.tsx', import.meta.url), 'utf8');
  assert.match(source, /Generera röstprov/);
  assert.match(source, /kan förbruka krediter/);
  assert.match(source, /inget kapas automatiskt/);
  assert.match(source, /generation\.current\?\.abort\(\)/);
  assert.match(source, /if \(audioRef\.current !== element\) audioRef\.current\?\.pause\(\)/);
  assert.doesNotMatch(source, /<audio[^>]*autoPlay/);
  assert.match(source, /import type \{ VoiceResult, VoiceStatus \}/);
});
