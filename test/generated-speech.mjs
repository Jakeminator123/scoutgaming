import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createGeneratedSpeechService, generatedSpeechStatus } from '../web/generated-speech.mjs';
import { GENERATED_SPEECH_DEFAULTS } from '../web/generated-speech-provider.mjs';
import { validateSpeechPackage } from '../web/public/speech-package.mjs';
import { createSpeechJournal, FULLFILE_ADMISSION_REMAINING_MS } from '../web/postgres-speech-journal.mjs';
import { speechMemoryPool } from './fixtures/speech-memory-pool.mjs';

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

async function sharedFixture(t,{policy=true,configPatch={},providerGenerate}={}){
  const directory=await mkdtemp(join(tmpdir(),'croupier-shared-file-fixture-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  let time=Date.parse('2026-10-03T23:47:59Z'),calls=0,tts=0,gpu=0,saves=0;
  const pool=speechMemoryPool(()=>time),journal=await createSpeechJournal({pool,environmentId:'isolated-file-qa'});
  if(policy){
    await journal.initializeBudgetPolicy({dailyBudgetMicroUsd:1000000,confirmation:'verified-new-empty-cost-journal'});
    await journal.initializeFullfileBudgetPolicy({reserveMicroUsd:250000,currentBudgetMicroUsd:1000000,confirmation:'verified-new-empty-cost-journal'});
  }
  const provider={generate:async value=>{
    calls++;
    if(providerGenerate)return providerGenerate(value,{setTime:v=>{time=v;},getTime:()=>time,tts:()=>{tts++;},gpu:()=>{gpu++;}});
    await value.beforeCostly();tts++;await value.beforeCostly();gpu++;return result(value.text);
  }};
  const blobs=new Map(),artifacts={
    async save(value){saves++;blobs.set(value.artifactId,value);return{speechPackage:value.speechPackage,artifacts:{audio:{sha256:value.audio.sha256},video:{sha256:value.video.sha256}}};},
    async get({artifactId,kind}){return blobs.get(artifactId)[kind];}
  };
  const config={directory,reserveMicroUsd:250000,dailyBudgetMicroUsd:1000000,...configPatch};
  return{pool,journal,config,provider,artifacts,directory,service:createGeneratedSpeechService(config,{provider,journal,artifacts,journalRequired:true}),
    counts:()=>({calls,tts,gpu,saves}),getTime:()=>time,setTime:v=>{time=v;}};
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
  assert.equal(generatedSpeechStatus({ ...env, HOST: '127.0.0.1', CROUPIER_CLOUD_RUNTIME: '1' }).configured, true,
    'a guarded cloud Web child can use loopback behind the HTTPS gateway');
  assert.equal(generatedSpeechStatus({ ...env, CROUPIER_GENERATED_SPEECH_STREAMING: '1' }).enabled, false,
    'managed streaming disables unbudgeted fullfile for legacy clients and Probe');
  assert.equal(generatedSpeechStatus({ ...env, HOST: '127.0.0.1', CROUPIER_CLOUD_RUNTIME: '1', CROUPIER_GENERATED_SPEECH_STREAMING: '1', CROUPIER_GENERATED_SPEECH_PREVIEW: '1' }).enabled, false,
    'local-preview flag cannot reopen cloud file generation');
  assert.equal(generatedSpeechStatus({ ...env, HOST: '127.0.0.1', CROUPIER_CLOUD_GENERATED_SPEECH: '', CROUPIER_GENERATED_SPEECH_PREVIEW: '1', CROUPIER_GENERATED_SPEECH_STREAMING: '1' }).configured, true,
    'explicit isolated local fullfile tests keep their existing path');
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

test('shared fullfile cannot invoke a provider without persisted policy and explicit configured bounds',async t=>{
  const absent=await sharedFixture(t,{policy:false});
  await assert.rejects(absent.service.generate(input()),{code:'generated_speech_fullfile_budget_policy_missing'});
  assert.deepEqual(absent.counts(),{calls:0,tts:0,gpu:0,saves:0});assert.equal(absent.pool.state.requests.size,0);
  for(const configPatch of [{reserveMicroUsd:undefined},{dailyBudgetMicroUsd:undefined},{reserveMicroUsd:10000001},{reserveMicroUsd:1},{dailyBudgetMicroUsd:249999}]){
    const f=await sharedFixture(t,{configPatch});
    await assert.rejects(f.service.generate(input()));assert.equal(f.counts().calls,0);assert.equal(f.pool.state.fileReservations.size,0);
  }
});

test('shared fullfile reserves before both paid POSTs and completed replay needs no new budget or persistent disk',async t=>{
  const f=await sharedFixture(t),first=await f.service.generate(input());
  assert.deepEqual(f.counts(),{calls:1,tts:1,gpu:1,saves:1});assert.equal(f.pool.state.fileReservations.size,1);
  assert.equal(f.pool.state.sessions.size,0);assert.deepEqual(await readdir(f.directory),[]);
  const trace=f.pool.trace;
  assert.ok(trace.indexOf('insert_file_reservation')<trace.indexOf('update_request'));
  assert.equal(trace.filter(v=>v==='file_reservations').length,3);
  const replay=createGeneratedSpeechService({...f.config,reserveMicroUsd:undefined,dailyBudgetMicroUsd:undefined},{provider:f.provider,journal:f.journal,artifacts:f.artifacts,journalRequired:true});
  assert.deepEqual(await replay.generate(input()),first);assert.equal(f.counts().calls,1);
  const id=first.packageId.slice('generated-'.length),media=await replay.media({id,kind:'audio',owner:input().owner});
  assert.equal(digest(media.bytes),first.audio.sha256);assert.equal(f.pool.state.fileReservations.size,1);
});

test('shared fullfile rechecks the paid window after awaited authorization and stops a delayed second POST',async t=>{
  const f=await sharedFixture(t,{providerGenerate:async(value,state)=>{
    await value.beforeCostly();state.tts();
    state.setTime(state.getTime()+720000-FULLFILE_ADMISSION_REMAINING_MS+1);
    await value.beforeCostly();state.gpu();return result(value.text);
  }});
  await assert.rejects(f.service.generate(input()),{code:'generated_speech_fullfile_reservation_expired'});
  assert.deepEqual(f.counts(),{calls:1,tts:1,gpu:0,saves:0});
  assert.equal([...f.pool.state.requests.values()][0].state,'submission_uncertain');assert.equal(f.pool.state.fileReservations.size,1);
  const restarted=createGeneratedSpeechService(f.config,{provider:f.provider,journal:f.journal,artifacts:f.artifacts,journalRequired:true});
  await assert.rejects(restarted.generate(input()),{code:'generated_speech_request_already_attempted'});assert.equal(f.counts().calls,1);
  const blocked=await sharedFixture(t);let authCalls=0;
  await assert.rejects(blocked.service.generate(input({beforeCostly:async()=>{if(++authCalls===2)blocked.setTime(blocked.getTime()+240001);}})),{code:'generated_speech_fullfile_reservation_expired'});
  assert.equal(blocked.counts().tts,0);assert.equal(blocked.counts().gpu,0);
});

test('shared cancelled/lost acknowledgements keep the monetary tombstone and do not retry or leak failures',async t=>{
  const abort=new AbortController();
  const f=await sharedFixture(t,{providerGenerate:async(value,state)=>{await value.beforeCostly();state.tts();abort.abort();throw Object.assign(new Error('private-provider-url-token'),{code:'generated_speech_cancelled',statusCode:499});}});
  await assert.rejects(f.service.generate(input({signal:abort.signal})),error=>error.code==='generated_speech_cancelled'&&error.message===error.code);
  await assert.rejects(f.service.generate(input()),{code:'generated_speech_request_already_attempted'});
  assert.equal(f.pool.state.fileReservations.size,1);assert.equal(f.counts().calls,1);assert.equal(f.counts().saves,0);
  assert.doesNotMatch(JSON.stringify([...f.pool.state.requests.values()]),/private-provider-url-token/);
  const lost=await sharedFixture(t);lost.pool.failNext('insert_file_reservation');
  await assert.rejects(lost.service.generate(input()),{code:'generated_speech_journal_unavailable'});
  assert.equal(lost.counts().calls,0);assert.equal(lost.pool.state.requests.size,0);assert.equal(lost.pool.state.fileReservations.size,0);
});
