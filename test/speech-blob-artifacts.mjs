import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpeechBlobArtifacts } from '../web/speech-blob-artifacts.mjs';
import { validatePrivateMedia } from '../lab/lib/cloud-media-store.mjs';
import { ASTRID_VOICE_PROFILE } from '../web/public/astrid-voice-profile.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const env = { CROUPIER_MEDIA_STORAGE:'blob', BLOB_READ_WRITE_TOKEN:'fixture-private-storage-token' };
function input() {
  const artifactId = randomBytes(16).toString('hex'), text = 'Hej, dina kort är ess och nio.';
  const audio = { bytes:Buffer.from('exact-provider-WAV-fixture:'+text), contentType:'audio/wav' };
  const video = { bytes:Buffer.from('exact-provider-MP4-fixture:'+text), contentType:'video/mp4' };
  audio.sha256 = digest(audio.bytes); video.sha256 = digest(video.bytes);
  const speechPackage = { schemaVersion:2, packageId:`generated-${artifactId}`, revision:`generated-${digest(text+audio.sha256+video.sha256)}`,
    dealerId:'astrid', exactText:text, source:{kind:'generatedText',voiceId:ASTRID_VOICE_PROFILE.voiceId},
    audio:{url:`/api/generated-speech/${artifactId}/audio`,sha256:audio.sha256,durationMs:2000},
    video:{videoId:`generated-${artifactId}.video`,url:`/api/generated-speech/${artifactId}/video`,sha256:video.sha256,fps:24,frameCount:48,presentation:'lipsync'},
    audioDelayMs:0, entryPose:'standard-idle', exitPose:'standard-idle', calibrationRevision:'unreviewed-fixed-24fps', reviewStatus:'pending',
    generation:{requestId:'fixture-request',provider:ASTRID_VOICE_PROFILE.provider,modelId:ASTRID_VOICE_PROFILE.modelId,
      avatarId:'astrid_spel2x',profileRevision:ASTRID_VOICE_PROFILE.profileRevision,textSha256:digest(text),audioSha256:audio.sha256} };
  return { artifactId, ownerHash:digest('fixture-current-owner'), speechPackage, audio, video };
}
async function fixture(t, behavior = {}) {
  const objects = new Map(), calls = [], cacheDirs = new Set();
  const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith('croupier-speech-blob-')));
  const privateBlob = (pathname, record) => ({ pathname,url:`https://fixture.private.blob.vercel-storage.com/${pathname}`,
    size:record.bytes.length,contentType:record.contentType });
  const blobClient = {
    async put(pathname, body, options) {
      calls.push({ method:'put',pathname,options });
      assert.equal(options.access,'private'); assert.equal(options.addRandomSuffix,false); assert.equal(options.allowOverwrite,false);
      assert.equal(options.token,env.BLOB_READ_WRITE_TOKEN);
      await behavior.beforePut?.({pathname,body,options});
      if (objects.has(pathname)) throw Error('Immutable object already exists');
      if (behavior.failPut?.(pathname)) throw Object.assign(Error('PRIVATE PROVIDER BODY Bearer fixture-secret'),{code:'generated_speech_fake_secret_error'});
      const record = { bytes:Buffer.from(body),contentType:options.contentType }; objects.set(pathname,record);
      return behavior.publicResult ? { ...privateBlob(pathname,record),url:`https://fixture.public.blob.vercel-storage.com/${pathname}` } : privateBlob(pathname,record);
    },
    async get(pathname, options) {
      calls.push({ method:'get',pathname,options });
      assert.equal(options.access,'private'); assert.equal(options.useCache,false);
      for (const name of await readdir(tmpdir())) if (name.startsWith('croupier-speech-blob-')&&!before.has(name)) cacheDirs.add(join(tmpdir(),name));
      if (behavior.failGet) throw Error('PRIVATE DOWNLOAD https://provider/?token=fixture-secret');
      const record = objects.get(pathname); if (!record) return null;
      let bytes = record.bytes;
      if (behavior.corruptDownload) { bytes = Buffer.from(bytes); bytes[0] ^= 0xff; }
      return { statusCode:200,stream:new Response(bytes).body,blob:privateBlob(pathname,record) };
    },
    async del(pathname) { calls.push({method:'del',pathname}); objects.delete(pathname); },
  };
  t.after(async () => { for (const path of cacheDirs) await assert.rejects(access(path),error=>error.code==='ENOENT'); });
  return { adapter:createSpeechBlobArtifacts({env,blobClient}),blobClient,objects,calls,behavior,cacheDirs };
}

test('exact audio and video upload privately with immutable deterministic paths and readback before metadata', async t => {
  const f = await fixture(t), request = input(), metadata = await f.adapter.save(request);
  assert.deepEqual(metadata.speechPackage,request.speechPackage); assert.equal(metadata.speechPackage.reviewStatus,'pending');
  assert.deepEqual(Object.keys(metadata).sort(),['artifacts','speechPackage']);
  assert.equal(metadata.artifacts.artifactId,request.artifactId); assert.equal(metadata.artifacts.ownerHash,request.ownerHash);
  assert.deepEqual(f.calls.map(call=>call.method),['put','get','put','get']);
  for (const kind of ['audio','video']) {
    const record = metadata.artifacts[kind]; assert.deepEqual(validatePrivateMedia(record),record);
    assert.match(record.pathname,new RegExp(`^croupier/media/dealers/astrid/runtime/generated/${request.ownerHash}/`));
    assert.ok(record.pathname.endsWith(`${request[kind].sha256}.${kind==='audio'?'wav':'mp4'}`));
    assert.deepEqual(f.objects.get(record.pathname).bytes,request[kind].bytes);
    assert.equal(record.size,request[kind].bytes.length);
  }
  assert.doesNotMatch(JSON.stringify(metadata),/blob\.vercel-storage\.com|fixture-private-storage-token/);
  assert.equal(f.cacheDirs.size,1);
});

test('get uses only owner-bound completed metadata, exact bytes and fresh readback after reconstruction', async t => {
  const f = await fixture(t), request = input(), completedPackage = await f.adapter.save(request);
  const restarted = createSpeechBlobArtifacts({env,blobClient:f.blobClient});
  for (const kind of ['audio','video']) {
    const result = await restarted.get({...request,kind,completedPackage});
    assert.deepEqual(result,{bytes:request[kind].bytes,contentType:request[kind].contentType});
  }
  assert.equal(f.calls.filter(call=>call.method==='get').length,4,'each read uses fresh private storage, without persistent-cache fallback');
  assert.equal(f.cacheDirs.size,3);
});

test('a duplicate immutable save cannot overwrite or delete the original completed objects', async t => {
  const f = await fixture(t), request = input(), completedPackage = await f.adapter.save(request);
  const existing = new Map(f.objects);
  await assert.rejects(f.adapter.save(request),error=>error.code==='generated_speech_blob_unavailable'&&!/exists|PRIVATE/.test(error.message));
  assert.deepEqual(f.objects,existing); assert.equal(f.calls.filter(call=>call.method==='del').length,0);
  assert.deepEqual((await f.adapter.get({...request,kind:'audio',completedPackage})).bytes,request.audio.bytes);
});

test('partial save failure removes only its newly created private object and exposes no provider body', async t => {
  const f = await fixture(t,{failPut:path=>path.endsWith('.mp4')}), request = input();
  f.objects.set('preexisting-protected-object',{bytes:Buffer.from('preserve'),contentType:'video/mp4'});
  await assert.rejects(f.adapter.save(request),error=>error.code==='generated_speech_blob_unavailable'&&!/PRIVATE|Bearer|fixture-secret/.test(error.message));
  assert.deepEqual([...f.objects.keys()],['preexisting-protected-object']);
  assert.equal(f.calls.filter(call=>call.method==='del').length,1);
});

test('public response pointers and failed or changed readback cannot publish package metadata', async t => {
  for (const behavior of [{publicResult:true},{corruptDownload:true},{failGet:true}]) {
    const f = await fixture(t,behavior);
    await assert.rejects(f.adapter.save(input()),error=>error.code==='generated_speech_blob_unavailable');
    assert.equal(f.objects.size,0);
  }
});

test('invalid owner, ID, package tuple, hash, MIME and byte bounds reject before any storage call', async t => {
  const f = await fixture(t);
  for (const modify of [
    value=>{value.artifactId='../escape';},value=>{value.ownerHash='arbitrary-current-user';},
    value=>{value.speechPackage.reviewStatus='approved';},value=>{value.speechPackage.exactText='Changed text.';},
    value=>{value.audio.sha256='0'.repeat(64);},value=>{value.video.bytes[0]^=0xff;},
    value=>{value.audio.contentType='video/mp4';},value=>{value.audio.bytes=Buffer.alloc(0);},
    value=>{value.audio.bytes=Buffer.alloc(44+24000*2*25+1);},
  ]) {
    const request = input(); modify(request); await assert.rejects(f.adapter.save(request));
  }
  assert.equal(f.calls.length,0);
});

test('buffers and package tuple are snapshotted before an asynchronous upload can mutate callers', async t => {
  const request = input(), expectedVideo = Buffer.from(request.video.bytes), expectedPackage = structuredClone(request.speechPackage);
  const f = await fixture(t,{beforePut:()=>{request.video.bytes[0]^=0xff;request.speechPackage.exactText='Caller mutated draft.';}});
  const completedPackage = await f.adapter.save(request);
  assert.deepEqual(completedPackage.speechPackage,expectedPackage);
  assert.deepEqual(f.objects.get(completedPackage.artifacts.video.pathname).bytes,expectedVideo);
});

test('a different owner or package ID and arbitrary/private URLs in metadata cannot cause a Blob read', async t => {
  const f = await fixture(t), request = input(), saved = await f.adapter.save(request); f.calls.length=0;
  await assert.rejects(f.adapter.get({...request,ownerHash:digest('other-current-owner'),kind:'audio',completedPackage:saved}),error=>error.statusCode===404);
  for (const mutate of [
    value=>{value.artifacts.artifactId='0'.repeat(32);},value=>{value.artifacts.audio.pathname='https://provider.invalid/arbitrary.wav';},
    value=>{value.artifacts.audio.url='https://fixture.private.blob.vercel-storage.com/file';},
    value=>{value.artifacts.video.sha256='0'.repeat(64);},value=>{value.artifacts.audio.size=0;},
    value=>{value.artifacts.ownerHash=digest('other-owner');},value=>{value.artifacts.schemaVersion=2;},
    value=>{value.speechPackage.packageId='generated-'+'0'.repeat(32);},value=>{value.untrustedURL='https://secret.invalid';},
  ]) {
    const completedPackage = structuredClone(saved); mutate(completedPackage);
    await assert.rejects(f.adapter.get({...request,kind:'audio',completedPackage}));
  }
  await assert.rejects(f.adapter.get({...request,kind:'metadata',completedPackage:saved}));
  await assert.rejects(f.adapter.get({...request,kind:'audio',completedPackage:saved,request:new Request('https://game.example.invalid/media',{method:'POST'})}));
  assert.equal(f.calls.length,0);
});

test('unavailable, missing or changed authoritative objects fail with no old-cache or disk fallback', async t => {
  const f = await fixture(t), request = input(), completedPackage = await f.adapter.save(request);
  await f.adapter.get({...request,kind:'video',completedPackage});
  const path = completedPackage.artifacts.video.pathname, original = f.objects.get(path);
  f.objects.delete(path);
  await assert.rejects(f.adapter.get({...request,kind:'video',completedPackage}),error=>error.code==='generated_speech_blob_unavailable');
  f.objects.set(path,{...original,bytes:Buffer.alloc(original.bytes.length,3)});
  await assert.rejects(f.adapter.get({...request,kind:'video',completedPackage}),error=>error.code==='generated_speech_blob_unavailable');
});

test('cross-site media is denied and client ranges or conditionals cannot skip complete hash proof', async t => {
  const f = await fixture(t), request = input(), completedPackage = await f.adapter.save(request); f.calls.length=0;
  const crossSite = new Request('https://game.example.invalid/media',{headers:{origin:'https://evil.example.invalid','sec-fetch-site':'cross-site'}});
  await assert.rejects(f.adapter.get({...request,kind:'video',completedPackage,request:crossSite}),error=>error.statusCode===404);
  assert.equal(f.calls.length,0);
  const conditional = new Request('https://game.example.invalid/media',{headers:{range:'bytes=0-1','if-none-match':`"sha256-${request.video.sha256}"`}});
  assert.deepEqual((await f.adapter.get({...request,kind:'video',completedPackage,request:conditional})).bytes,request.video.bytes);
});

test('storage configuration never exposes credentials and cannot fall back to a product directory', async t => {
  const f = await fixture(t), request = input();
  const adapter = createSpeechBlobArtifacts({env:{CROUPIER_MEDIA_STORAGE:'disk',BLOB_READ_WRITE_TOKEN:'PRIVATE',CROUPIER_GENERATED_SPEECH_DIR:'C:/Users/example/persisted'},blobClient:f.blobClient});
  await assert.rejects(adapter.save(request),error=>error.code==='generated_speech_blob_unavailable'&&!/PRIVATE|persisted/.test(error.message));
  await assert.rejects(adapter.get({...request,kind:'audio',completedPackage:{}}),error=>error.code==='generated_speech_blob_unavailable');
  assert.equal(f.calls.length,0);
});
