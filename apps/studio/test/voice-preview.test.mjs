import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  assert.equal(VOICE_PREVIEW.voiceId, 'dc30854e-e398-4579-9dc8-16f6cb2c19b9');
  assert.equal(VOICE_PREVIEW.modelId, 'sonic-3.5');
  assert.deepEqual(VOICE_PHRASES.map(item => item.label), ['Välkommen', 'Godkväll', 'Tjena']);
  assert.ok(VOICE_PHRASES.every(item => item.text.length <= 500 && !Object.hasOwn(item, 'eventId')));
});

test('shared Neon and native Studio fail before secret/cache/provider access even with caller settings', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-disabled-voice-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cacheDir = join(directory, 'must-not-exist'), settings = { key: 'fixture-only', mismatch: false, cacheDir };
  // Neon and native Admin are fixed, so even an empty environment is disabled.
  for (const env of [{}, { CROUPIER_PUBLIC_ORIGIN: 'https://www.example.invalid' }]) {
    const disabled = readVoiceSettings({ env, envFiles: [directory] }); // Directory read would fail if attempted.
    assert.equal(disabled.disabled, true); assert.equal(disabled.key, '');
    assert.equal(voicePreviewStatus(disabled).configured, false);
    await assert.rejects(generateVoicePreview({ text: 'Hej' }, { env, settings, fetchImpl: noFetch }), error => error.statusCode === 503);
    await assert.rejects(voicePreviewResponse(request('GET'), 'a'.repeat(64), { env, settings }), error => error.statusCode === 503);
    for (const method of ['GET', 'POST']) assert.equal((await voicePreviewEndpoint(request(method), { env, settings, fetchImpl: noFetch })).status, 503);
  }
  assert.deepEqual(await readdir(directory), []);
});

test('text validation rejects oversized input and arbitrary provider parameters without truncation', () => {
  assert.equal(voicePreviewText({ text: '  Hej!\r\nGodkväll.  ' }), 'Hej!\nGodkväll.');
  assert.equal(voicePreviewText({ text: 'a'.repeat(500) }).length, 500);
  for (const body of [{ text: '' }, { text: '  ' }, { text: 'a'.repeat(501) }, { text: 'Hej\0' }, { text: 'Hej', voiceId: 'other' }, { text: 'Hej', url: 'https://untrusted.test' }, null, 'Hej']) assert.throws(() => voicePreviewText(body));
  assert.notEqual(voicePreviewId('Hej'), voicePreviewId('Godkväll'));
});

test('missing or conflicting keys never trigger a provider request', async t => {
  const settings = await fixture(t);
  for (const patch of [{ key: '' }, { mismatch: true }]) await assert.rejects(generateVoicePreview({ text: 'Hej' }, { settings: { ...settings, ...patch }, fetchImpl: noFetch }), error => error.statusCode === 503);
});

test('voice UI never autoplays generated audio', async () => {
  const source = await readFile(new URL('../components/voice-preview-panel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<audio[^>]*autoPlay/);
});
