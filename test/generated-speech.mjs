import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createGeneratedSpeechService, generatedSpeechStatus } from '../web/generated-speech.mjs';
import { GENERATED_SPEECH_DEFAULTS } from '../web/generated-speech-provider.mjs';
import { validateSpeechPackage } from '../web/public/speech-package.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const input = extra => ({ requestId: 'fixture-generated-1', text: 'Hej, dina kort är ess och nio.', dealerId: 'astrid', owner: 'fixture-private-session', ...extra });
const result = text => {
  const audio = Buffer.from('fixture WAV exact text:' + text), video = Buffer.from('fixture MP4 lip sync:' + text);
  return { exactText: text, ...GENERATED_SPEECH_DEFAULTS,
    audio: { bytes: audio, sha256: digest(audio), durationMs: 2000, contentType: 'audio/wav' },
    video: { bytes: video, sha256: digest(video), frameCount: 48, fps: 24, contentType: 'video/mp4' }, provider: { kind: 'cartesia-runpod' } };
};
async function fixture(t, generate = async ({ text }) => result(text)) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-generated-speech-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = { directory };
  const provider = { generate };
  return { directory, config, provider, service: createGeneratedSpeechService(config, { provider }) };
}

test('env gate requires both opt-ins, loopback, private directory and dedicated speech endpoint', () => {
  const env = { HOST: '127.0.0.1', CROUPIER_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH_PREVIEW: '1',
    CROUPIER_GENERATED_SPEECH_DIR: join(tmpdir(), 'croupier-preview-fixture'), CARTESIA_API_KEY: 'fixture-cartesia-secret', RUNPOD_API_KEY: 'fixture-runpod-secret', CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-speech-endpoint' };
  assert.deepEqual(generatedSpeechStatus(env), { enabled: true, configured: true, preview: true, dealerId: 'astrid', reviewStatus: 'pending' });
  for (const patch of [{ HOST: '0.0.0.0' }, { HOST: undefined }, { CROUPIER_GENERATED_SPEECH: '0' }, { CROUPIER_GENERATED_SPEECH_PREVIEW: '0' },
    { CROUPIER_GENERATED_SPEECH_DIR: undefined }, { CROUPIER_GENERATED_SPEECH_DIR: resolve('web/public/generated') }, { CARTESIA_API_KEY: '' },
    { CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: undefined, RUNPOD_ENDPOINT_ID: 'old-shared-endpoint' }]) {
    assert.equal(generatedSpeechStatus({ ...env, ...patch }).configured, false);
  }
  assert.equal(generatedSpeechStatus({ ...env, CARTESIA_API_KEY: undefined, ELEVENLABS_API_KEY: 'fixture-primary' }).configured, false);
  assert.doesNotMatch(JSON.stringify(generatedSpeechStatus(env)), /secret|endpoint|directory|API/);
  assert.throws(() => createGeneratedSpeechService({ directory: process.cwd() }), { code: 'generated_speech_invalid_directory' });
  assert.throws(() => createGeneratedSpeechService({ directory: join(tmpdir(), 'fixture'), voiceId: 'other-dealer' }), { code: 'generated_speech_unknown_profile' });
});

test('production speech needs an explicit cloud opt-in, HTTPS origin and authenticated mode', () => {
  const env = { HOST: '0.0.0.0', NODE_ENV: 'production', PUBLIC_URL: 'https://astrid.example.com',
    CROUPIER_GENERATED_SPEECH: '1', CROUPIER_CLOUD_GENERATED_SPEECH: '1',
    CROUPIER_GENERATED_SPEECH_DIR: join(tmpdir(), 'croupier-cloud-speech-fixture'),
    CARTESIA_API_KEY: 'fixture-cartesia-secret', RUNPOD_API_KEY: 'fixture-runpod-secret',
    CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-speech-endpoint' };
  assert.equal(generatedSpeechStatus(env).configured, true);
  for (const patch of [
    { CROUPIER_CLOUD_GENERATED_SPEECH: '0' }, { NODE_ENV: 'development' }, { HOST: '127.0.0.1' },
    { PUBLIC_URL: 'http://astrid.example.com' }, { PUBLIC_URL: 'https://localhost' },
    { PUBLIC_URL: 'https://169.254.169.254' }, { PUBLIC_URL: 'https://astrid.local' },
    { PUBLIC_URL: 'https://astrid.example.com:444' },
    { PUBLIC_URL: 'https://name:secret@astrid.example.com' },
    { PUBLIC_URL: 'https://astrid.example.com/path' }, { DEMO_GUEST_ACCESS: '1' },
  ]) assert.equal(generatedSpeechStatus({ ...env, ...patch }).configured, false, JSON.stringify(patch));
  assert.doesNotMatch(JSON.stringify(generatedSpeechStatus(env)), /secret|endpoint|directory|API/);
});

test('successful package binds exact text and hashes, stays pending and serves only same-owner media', async t => {
  const { service, directory } = await fixture(t);
  const speechPackage = await service.generate(input());
  assert.equal(speechPackage.schemaVersion, 2);
  assert.equal(speechPackage.exactText, input().text);
  assert.equal(speechPackage.source.voiceId, GENERATED_SPEECH_DEFAULTS.voiceId);
  assert.equal(speechPackage.generation.avatarId, 'astrid_spel2x');
  assert.equal(speechPackage.generation.textSha256, digest(input().text));
  assert.equal(speechPackage.reviewStatus, 'pending');
  assert.throws(() => validateSpeechPackage(speechPackage), { code: 'speech_package_not_approved' });
  assert.deepEqual(validateSpeechPackage(speechPackage, { requireApproved: false }), speechPackage);
  const id = speechPackage.packageId.slice('generated-'.length);
  for (const kind of ['audio', 'video']) {
    const media = await service.media({ id, kind, owner: input().owner });
    assert.equal(digest(media.bytes), speechPackage[kind].sha256);
    assert.equal(media.contentType, kind === 'audio' ? 'audio/wav' : 'video/mp4');
    await assert.rejects(service.media({ id, kind, owner: 'different-session' }), { code: 'generated_speech_not_found' });
  }
  const metadata = await readFile(join(directory, id, 'metadata.json'), 'utf8');
  assert.ok(!metadata.includes(input().owner));
  await assert.rejects(service.media({ id: '../metadata', kind: 'video', owner: input().owner }), { code: 'generated_speech_not_found' });
  await assert.rejects(service.media({ id, kind: 'video' }), { code: 'invalid_generated_speech_owner' });
});

test('deduplication is concurrent, durable, conflict-safe and returns independent package objects', async t => {
  let calls = 0;
  const seen = [];
  const { service, config, provider } = await fixture(t, async value => { calls++; seen.push(value.requestId); return result(value.text); });
  const [first, duplicate] = await Promise.all([service.generate(input()), service.generate(input())]);
  assert.equal(calls, 1); assert.deepEqual(first, duplicate); assert.notEqual(first, duplicate);
  duplicate.exactText = 'mutated';
  const restarted = createGeneratedSpeechService(config, { provider });
  assert.deepEqual(await restarted.generate(input()), first);
  assert.equal(calls, 1);
  await assert.rejects(restarted.generate(input({ text: 'Other words.' })), { code: 'generated_speech_request_conflict' });
  const otherOwner = await restarted.generate(input({ owner: 'other-private-session' }));
  assert.notEqual(otherOwner.packageId, first.packageId);
  assert.equal(calls, 2); assert.notEqual(seen[0], seen[1]);
});

test('failed or uncertain paid requests are never automatically retried after a restart', async t => {
  let calls = 0;
  const { service, config, provider, directory } = await fixture(t, async () => { calls++; throw new Error('https://secret-provider/?token=PRIVATE'); });
  await assert.rejects(service.generate(input()), error => error.code === 'generated_speech_failed' && !error.message.includes('PRIVATE'));
  await assert.rejects(service.generate(input()), { code: 'generated_speech_request_already_attempted' });
  await assert.rejects(createGeneratedSpeechService(config, { provider }).generate(input()), { code: 'generated_speech_request_already_attempted' });
  assert.equal(calls, 1);
  assert.equal((await readdir(directory)).includes('provider.lock'), false);
  for (const name of await readdir(directory)) assert.doesNotMatch(await readFile(join(directory, name), 'utf8'), /PRIVATE|secret-provider/);
});

test('single-flight lock works across services and a duplicate changed while pending conflicts', async t => {
  let release, started;
  const beginning = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const { service, config, provider } = await fixture(t, async ({ text }) => { started(); await gate; return result(text); });
  const first = service.generate(input());
  await beginning;
  await assert.rejects(service.generate(input({ text: 'Different text.' })), { code: 'generated_speech_request_conflict' });
  const other = createGeneratedSpeechService(config, { provider });
  await assert.rejects(other.generate(input({ requestId: 'second-request' })), { code: 'generated_speech_busy' });
  release(); await first;
  assert.equal((await other.generate(input({ requestId: 'second-request' }))).reviewStatus, 'pending');
});

test('wrong dealer, missing owner, overlong text, cancellation and provider tuple mismatches cannot create a playable package', async t => {
  let calls = 0;
  const { service } = await fixture(t, async ({ text }) => { calls++; const value = result(text); value.audio.sha256 = '0'.repeat(64); return value; });
  for (const patch of [{ dealerId: 'vera' }, { text: 'x'.repeat(501) }, { text: ' leading space' }, { text: 'control\0text' }]) {
    await assert.rejects(service.generate(input(patch)), { code: 'invalid_generated_speech_request' });
  }
  await assert.rejects(service.generate(input({ owner: undefined })), { code: 'invalid_generated_speech_owner' });
  await assert.rejects(service.generate(input({ signal: AbortSignal.abort() })), { code: 'generated_speech_cancelled' });
  assert.equal(calls, 0);
  await assert.rejects(service.generate(input()), { code: 'generated_speech_output_mismatch' });
  assert.equal(calls, 1);
});

test('persisted media tampering is detected before bytes reach HTTP', async t => {
  const { service, directory } = await fixture(t);
  const speechPackage = await service.generate(input());
  const id = speechPackage.packageId.slice('generated-'.length);
  await writeFile(join(directory, id, 'video.mp4'), 'tampered-fixture');
  await assert.rejects(service.media({ id, kind: 'video', owner: input().owner }), { code: 'generated_speech_corrupt_artifact' });
});
