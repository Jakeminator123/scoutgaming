import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { prepareMovingSpeechPlan } from '../web/moving-speech-plan.mjs';
import { createMovingSpeechFrameLayer } from '../packages/presentation/runtime/moving-speech-frame-layer.mjs';
import { createChatPlaybackDiagnostic } from '../web/public/chat-playback-diagnostic.mjs';
import { validateMovingSpeechStream, playMovingSpeech, loadMovingSpeechRest, movingSpeechSocketURL } from '../packages/presentation/runtime/moving-speech-player.mjs';

const hash = value => createHash('sha256').update(value).digest('hex'), h = 'a'.repeat(64);
const text = 'Hej Jakob.', id = 'b'.repeat(32), requestId = 'chat-1';
function descriptor() {
  const expiresAt = Date.now() + 55000, attemptId = 'attempt-1', nonce = 'nonce-1';
  const ticket = Buffer.from(JSON.stringify({ sessionId: id, exp: expiresAt, attemptId, nonce })).toString('base64url') + '.' + 'a'.repeat(43);
  return { schemaVersion: 1, kind: 'moving-speech-stream', id, requestId, dealerId: 'dragan', exactText: text,
    textSha256: hash(text), reviewStatus: 'pending', url: '/moving-speech-stream', ticket, expiresAt,
    profileRevision: h, avatarSha256: h, attemptId, nonce, compositing: null };
}
const options = { exactText: text, dealerId: 'dragan', requestId };
function messages(speech = descriptor(), samples = 30000) {
  const pcm = new Uint8Array(samples * 2), frames = Math.floor((samples + 18000) / 1000);
  const plan = prepareMovingSpeechPlan({ binding: { dealerId: speech.dealerId, workerAvatar: 'dragan', sessionId: id,
    talkId: requestId, revision: 1, profileRevision: h, textSha256: hash(text), audioSha256: hash(pcm), avatarSha256: h },
    clips: [{ dealerId: 'dragan', take: 'vila', sha256: h, fps: 24, frameCount: 1, kind: 'still' }],
    frames: Array.from({ length: frames }, () => ({ take: 'vila', frame: 0 })) });
  const ready = { t: 'ready', protocol: 1, id, attemptId: speech.attemptId, nonce: speech.nonce,
    plan: JSON.parse(JSON.stringify(plan)), rest: { videoId: '12345678-1234-1234-1234-123456789abc', sha256: h,
      sourceFrame: 7, fps: 24, frameCount: 12, width: 320, height: 240, bytes: 100, url: `/api/moving-speech/${id}/rest` },
    audio: { format: 's16le', sampleRate: 24000, channels: 1, byteLength: pcm.byteLength } };
  return { ready, pcm, plan, chunk: (from = 0, n = 12) => ({ t: 'lapp', id: plan.start.id, del: from / 12, fran: from,
    rutor: Array.from({ length: n }, () => ({ tagning: 'vila', ruta: 0, rect: [10, 20, 40, 60] })) }) };
}
// WebCrypto completes on another thread: a fixed number of immediate turns can
// expire before its result reaches the event loop, especially on Linux CI.
async function until(check, state) {
  const deadline = performance.now() + 1000;
  while (!check()) {
    assert.ok(performance.now() < deadline, `fixture did not reach ${state} within 1000 ms`);
    await delay(5);
  }
}
function fixture({ samples = 30000, overrides = {}, dependencies = {}, bodyCount=0 } = {}) {
  const speech = descriptor(), m = messages(speech, samples), sent = [], receipts = [], observations = [], decoded = [], rafs = new Map();
  if(bodyCount){
    const videoId='98765432-1234-1234-1234-123456789abc',take='clip-'+videoId;
    const sequence={version:7,frames:Array.from({length:bodyCount},(_,frame)=>({take,frame,sourceSha256:h})),
      sources:[{videoId,take,sha256:h,fps:24,frameCount:bodyCount,width:320,height:240,bytes:100,url:'/api/presentation/registered-video/fixture/source'}],
      steps:[{first:0,end:bodyCount,video:{id:videoId,sha256:h,filmedTake:{profileId:'fixture',takeKey:'4:iv'}},event:{type:'deal',to:'box',box:3,shoeDraw:1}}]};
    speech.presentationVersion=7;speech.sequenceSha256=hash(JSON.stringify(sequence));m.ready.sequence=sequence;
    m.plan=prepareMovingSpeechPlan({binding:m.plan.binding,clips:[{dealerId:'dragan',take,sha256:h,fps:24,frameCount:bodyCount,kind:'video'},
      {dealerId:'dragan',take:'vila',sha256:h,fps:24,frameCount:1,kind:'still'}],
      frames:m.plan.timeline.map((_,k)=>k<bodyCount?{take,frame:k}:{take:'vila',frame:0})});
    m.ready.plan=JSON.parse(JSON.stringify(m.plan));
    m.chunk=(from=0,n=12)=>({t:'lapp',id:m.plan.start.id,del:from/12,fran:from,rutor:m.plan.timeline.slice(from,from+n).map(r=>({tagning:r.take,ruta:r.frame,rect:[10,20,40,60]}))});
  }
  let socket, activeLayer, n = 0, current = true, ended = false, result;
  const audio = { currentTime: 0, paused: true, muted: false, plays: 0,
    async play() { this.plays++; this.paused = false; }, pause() { this.paused = true; }, removeAttribute() {}, load() {} };
  const doc = { createElement(tag) {
    if (tag === 'audio') return audio;
    const context = { clearRect() {}, drawImage() {}, putImageData() {}, getImageData() { return { data: new Uint8ClampedArray(256 * 256 * 4) }; } };
    return { width: 320, height: 240, videoWidth: 320, videoHeight: 240, getContext: () => context };
  } };
  const promise = playMovingSpeech(speech, { ...options, prepareRendering: async () => {},
    assertCurrent: () => { if (!current) throw Error('stale_pose'); },
    renderFrame: (base, shown) => { observations.push(shown); if (shown&&(shown.speechFrame===undefined||shown.speechFrame<m.plan.timeline.length)) assert.notEqual(activeLayer.paint(base, shown), base); return true; },
    onSequenceReady:async()=>{},onSequenceFrame:()=>{},onSequenceEnd:()=>{},
    setMovingSpeechLayer: layer => { activeLayer = layer; }, onReceipt: receipt => receipts.push(receipt), ...overrides }, {
    document: doc, connect: (url, protocols) => {
      assert.equal(url, '/moving-speech-stream'); assert.deepEqual(protocols, ['moving-v1', `ticket.${speech.ticket}`]);
      socket = { readyState: 1, send: text => sent.push(JSON.parse(text)), close() { this.readyState = 3; } }; return socket;
    }, loadRest: async rest => { assert.equal(rest.sourceFrame, 7); return doc.createElement('canvas'); },
    createSourceFrames:()=>({async prefetch(){},get:()=>doc.createElement('canvas'),close(){}}),
    makeLayer: args => createMovingSpeechFrameLayer({ ...args, decode: async bytes => Array.from({ length: bytes[0] }, () => {
      const frame = { displayWidth: 256, displayHeight: 512, closed: 0, close() { this.closed++; } }; decoded.push(frame); return frame;
    }) }), createURL: () => 'blob:verified-pcm', revokeURL: () => {},
    requestAnimationFrame: fn => { rafs.set(++n, fn); return n; }, cancelAnimationFrame: key => rafs.delete(key), ...dependencies,
  });
  promise.then(value => { ended = true; result = value; }, error => { ended = true; result = error; });
  const send = data => socket.onmessage({ data: data instanceof Uint8Array ? data.slice().buffer : JSON.stringify(data) });
  return { speech, m, audio, sent, receipts, observations, decoded, promise, get socket() { return socket; }, get layer() { return activeLayer; },
    get ended() { return ended; }, get result() { return result; }, send, stale() { current = false; },
    async ready() { await until(() => socket, 'socket connection'); send(m.ready); await until(() => activeLayer, 'verified rest layer'); },
    async pcm() { send({ t: 'pcm', id, byteLength: m.pcm.byteLength }); send(m.pcm); await until(() => sent.length, 'PCM credit'); },
    async chunk(from = 0, n = 12, mutate) { const meta = m.chunk(from, n); mutate?.(meta); send(meta); send(Uint8Array.of(n)); await turn(); await turn(); },
    async tick(time) { audio.currentTime = time; const [key, callback] = rafs.entries().next().value ?? []; rafs.delete(key); callback?.(); await turn(); },
  };
}

test('descriptor binds exact text, dealer, ticket attempt/nonce and same-origin endpoint before connecting', async () => {
  assert.equal((await validateMovingSpeechStream(descriptor(), options)).dealerId, 'dragan');
  for (const change of [d => d.dealerId = 'astrid', d => d.requestId = 'other', d => d.nonce = 'other', d => d.attemptId = 'other',
    d => d.exactText = 'Other text', d => d.textSha256 = h, d => d.url = 'https://other.example/moving-speech-stream',
    d => d.reviewStatus = 'approved', d => d.extra = true, d => d.compositing = { mode: 'none' }]) {
    const d = descriptor(); change(d); await assert.rejects(validateMovingSpeechStream(d, options), /moving_speech/);
  }
});

test('tickets use only secure same-origin sockets, with explicit localhost support for isolated fixtures', () => {
  assert.equal(movingSpeechSocketURL('/moving-speech-stream', 'https://www.scoutgaming.tech'), 'wss://www.scoutgaming.tech/moving-speech-stream');
  assert.equal(movingSpeechSocketURL('/moving-speech-stream', 'http://127.0.0.1:4200'), 'ws://127.0.0.1:4200/moving-speech-stream');
  for (const origin of ['http://elsewhere.example', 'file:///C:/test']) assert.throws(() => movingSpeechSocketURL('/moving-speech-stream', origin));
  assert.throws(() => movingSpeechSocketURL('https://elsewhere.example/moving-speech-stream', 'https://www.scoutgaming.tech'));
});

test('verified rest, PCM and first24 decoded frames gate audio; credits follow audio clock and completion removes mouth', async t => {
  const status = { dataset: {} }, diagnostic = createChatPlaybackDiagnostic(() => status), receipts = [];
  diagnostic.begin(requestId);
  const readReceipt = () => JSON.parse(status.dataset.playbackReceipt);
  const f = fixture({ overrides: { onReceipt: receipt => { receipts.push(receipt); diagnostic.stream(requestId, receipt); } } });
  t.after(() => f.socket?.onclose?.());
  await f.ready(); assert.equal(f.audio.plays, 0); assert.equal(readReceipt().state, 'pending');
  await f.pcm(); assert.deepEqual(f.sent, [{ t: 'credit', id: f.m.plan.start.id, frames: 24 }]);
  await f.chunk(0); assert.equal(f.audio.plays, 0);
  await f.chunk(12); await until(() => receipts.length > 0, 'audio playback receipt');
  assert.equal(f.audio.plays, 1);
  assert.equal(receipts[0].state, 'start'); assert.equal(readReceipt().state, 'playing');
  assert.equal(readReceipt().completed, false); assert.equal(f.observations.at(-1).frame, 0);
  assert.equal(f.observations.at(-1).sourceSha256, h); assert.equal(f.layer.bufferedFrames, 19);
  await f.tick(.5); await f.chunk(24); await f.tick(.8); await f.chunk(36);
  f.send({ t: 'done', id: f.m.plan.start.id, frames: 48 }); await turn();
  assert.equal(f.ended, false); f.audio.onended(); await f.promise;
  assert.equal(f.audio.paused, true); assert.equal(f.layer, null); assert.equal(f.observations.at(-1), undefined);
  assert.equal(receipts.at(-1).state, 'end'); assert.ok(f.decoded.every(frame => frame.closed === 1));
  assert.equal(readReceipt().state, 'ended'); assert.equal(readReceipt().completed, true);
  diagnostic.finish(requestId, 'unverified');
  assert.equal(readReceipt().completed, true); assert.equal(readReceipt().reviewStatus, 'pending');
  assert.doesNotMatch(status.dataset.playbackReceipt, /ticket|exactText|planSha256/);
  assert.ok(f.sent.filter(x => x.t === 'credit').every(x => x.frames <= 24));
});

test('trailing worker padding drains after audio ended without replaying audio or holding its mouth frame', async () => {
  const f = fixture(); await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12); await f.tick(.5); await f.chunk(24);
  f.audio.currentTime = 1.25; f.audio.onended(); await f.chunk(36);
  assert.equal(f.ended, false); assert.equal(f.observations.at(-1), undefined); assert.equal(f.audio.plays, 1);
  f.send({ t: 'done', id: f.m.plan.start.id, frames: 48 }); await f.promise;
});

test('pose changes and missing exact next frames silence the audio and close the session', async () => {
  for (const reason of ['pose', 'underrun']) {
    const f = fixture(); await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12);
    if (reason === 'pose') f.stale(); await f.tick(reason === 'pose' ? .1 : 1);
    await assert.rejects(f.promise, reason === 'pose' ? /stale_pose/ : /frame_unavailable/);
    assert.equal(f.audio.paused, true); assert.equal(f.audio.muted, true); assert.equal(f.socket.readyState, 3);
    assert.equal(f.receipts.at(-1).state, 'interrupted'); assert.equal(f.sent.at(-1).t, 'abort');
  }
});
test('lost ownership socket after worker done silences the remaining long body immediately',async()=>{
  const f=fixture({samples:18000,bodyCount:183});await f.ready();await f.pcm();await f.chunk(0);await f.chunk(12);
  await until(()=>f.audio.plays===1,'audio playback');await f.tick(.5);await f.chunk(24);
  f.send({t:'done',id:f.m.plan.start.id,frames:36});await turn();await turn();f.socket.onclose();
  await assert.rejects(f.promise,/socket_closed/);assert.equal(f.audio.muted,true);assert.equal(f.audio.paused,true);
  assert.equal(f.sent.some(x=>x.t==='played'),false);
});

test('wrong nonce, plan binding, original rest, PCM hash and unmatched chunk never start audio', async () => {
  for (const change of [r => r.nonce = 'stale', r => r.plan.binding.dealerId = 'astrid', r => r.plan.binding.audioSha256 = h,
    r => r.rest.sha256 = 'c'.repeat(64), r => r.rest.url = '//elsewhere/rest', r => r.rest.sourceFrame = 99,
    r => r.plan.timeline[0].frame = 1, r => r.audio.byteLength -= 24000]) {
    const f = fixture(); await until(() => f.socket, 'socket connection'); change(f.m.ready); f.send(f.m.ready);
    await assert.rejects(f.promise, /moving_speech/); assert.equal(f.audio.plays, 0);
  }
  const f = fixture(); await f.ready(); f.send({ t: 'pcm', id, byteLength: f.m.pcm.byteLength }); const bad = f.m.pcm.slice(); bad[0] = 1; f.send(bad);
  await assert.rejects(f.promise, /pcm_hash_mismatch/); assert.equal(f.sent.some(x => x.t === 'credit'), false); assert.equal(f.audio.plays, 0);
});

test('out-of-order, over-credit, missing-patch and metadata-without-binary messages fail closed', async () => {
  for (const send of [
    f => f.send(Uint8Array.of(12)), f => f.send(f.m.chunk(12)),
    f => { const meta = f.m.chunk(); meta.rutor[0] = {}; f.send(meta); },
    f => { f.send(f.m.chunk()); f.send(f.m.chunk(12)); },
    f => { const meta = f.m.chunk(); meta.rutor[0].rect[2] = 1000; f.send(meta); },
  ]) {
    const f = fixture(); await f.ready(); await f.pcm(); send(f); await assert.rejects(f.promise, /moving_speech/); assert.equal(f.audio.plays, 0);
  }
  const f = fixture(); await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12); f.send(f.m.chunk(24));
  await assert.rejects(f.promise, /invalid_moving_speech_chunk/); assert.equal(f.audio.paused, true);
});

test('abort interrupts pending pre-start ownership checks, including before any socket exists', async () => {
  const controller = new AbortController(); let entered = false;
  const f = fixture({ overrides: { signal: controller.signal, beforeStart: () => { entered = true; return new Promise(() => {}); } } });
  await until(() => entered, 'pre-start ownership check'); controller.abort(); await assert.rejects(f.promise, { name: 'AbortError' }); assert.equal(f.socket, undefined);
});

test('bounded encoded queue rejects a producer flood while the rest original is still loading', async () => {
  let release;
  const f = fixture({ dependencies: { loadRest: () => new Promise(resolve => { release = resolve; }) } });
  await until(() => f.socket, 'socket connection'); f.send(f.m.ready); await until(() => release, 'pending rest load');
  for (let n = 0; n < 9 && f.socket.onmessage; n++) f.send({ t: 'pcm', id, byteLength: f.m.pcm.byteLength });
  await assert.rejects(f.promise, /queue_full/); assert.equal(f.audio.plays, 0); release({ width: 320, height: 240 });
});

test('rest original fetch is bounded and hash verified before any video decoder is created', async () => {
  const rest = messages().ready.rest;
  for (const body of [new Uint8Array(101), new Uint8Array(100)]) {
    await assert.rejects(loadMovingSpeechRest(rest, { document: { createElement: () => assert.fail('unverified original') },
      fetchImpl: async (url, init) => { assert.equal(url, rest.url); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'same-origin');
        return new Response(body, { headers: { 'content-type': 'video/mp4' } }); } }), /rest_size|rest_hash_mismatch/);
  }
});

test('committed body uses PCM clock from frame0, preserves220ms lead, and finishes short/long speech without looping',async()=>{
  for(const [samples,bodyCount]of [[18000,60],[42000,24]]){
    let blob,closed=false;const seen=[],ends=[];
    const f=fixture({samples,bodyCount,overrides:{onSequenceFrame:(s,k)=>seen.push([k,s.frames[k].frame]),onSequenceEnd:s=>ends.push(s.version)},
      dependencies:{createURL:value=>{blob=value;return 'blob:pcm';},createSourceFrames:()=>({async prefetch(){},
        get:()=>({videoWidth:320,videoHeight:240}),close(){closed=true;}})}});
    await f.ready();await f.pcm();await f.chunk(0);await f.chunk(12);await until(()=>f.audio.plays===1,'body clock');
    assert.equal(f.observations.find(Boolean).speechFrame,0);assert.equal(f.observations.find(Boolean).audioTimeSeconds,-.22);
    const length=Math.max(bodyCount,f.m.plan.timeline.length);assert.equal(blob.size,44+length*2000);
    let next=24;
    for(let k=1;k<length;k++){
      const available=f.sent.filter(v=>v.t==='credit').reduce((n,v)=>n+v.frames,0);
      while(next<f.m.plan.timeline.length&&available-next>=Math.min(12,f.m.plan.timeline.length-next)){
        const count=Math.min(12,f.m.plan.timeline.length-next);await f.chunk(next,count);next+=count;
      }
      await f.tick((k+.001)/24);
      if(f.ended)throw f.result;
    }
    assert.equal(next,f.m.plan.timeline.length);
    f.send({t:'done',id:f.m.plan.start.id,frames:next});await turn();f.audio.onended();await f.promise;
    assert.deepEqual([...new Map(seen.map(row=>[row[0],row])).values()],Array.from({length:bodyCount},(_,k)=>[k,k]));
    assert.ok(ends.length);assert.equal(closed,true);assert.equal(f.audio.plays,1);
    assert.equal(f.sent.at(-1).t,'played');assert.ok(f.sent.filter(x=>x.t==='credit').every(x=>x.frames<=24));
    assert.ok(f.observations.filter(Boolean).slice(bodyCount).every(f=>f.take==='vila'&&f.frame===0));
  }
});

test('changed body plan or missing exact source frame stops before unbound audio/body is shown',async()=>{
  const changed=fixture({bodyCount:48});changed.m.ready.sequence.frames[0].frame=1;
  await until(()=>changed.socket,'socket');changed.send(changed.m.ready);await assert.rejects(changed.promise,/sequence/);assert.equal(changed.audio.plays,0);
  const f=fixture({bodyCount:48,dependencies:{createSourceFrames:()=>({async prefetch(){},get(){throw Error('moving_source_frame_unavailable');},close(){}})}});
  await f.ready();await f.pcm();await f.chunk(0);await f.chunk(12);await assert.rejects(f.promise,/moving_source_frame_unavailable/);
  assert.equal(f.audio.plays,0);
  assert.equal(f.audio.muted,true);assert.equal(f.audio.paused,true);assert.equal(f.sent.at(-1).t,'abort');
});

// Full browser adapter with synthetic media: exact MP4 source-frame selection,
// PCM audio clock, WebSocket credit, WebCodecs and compositor. No provider calls
// or visual acceptance of a dealer's speech is implied by these colour checks.
for(const moving of [false,true])test(`real browser plays hash-bound PCM over ${moving?'an exact moving source sequence':'the exact bank rest'} and bounded WebCodecs chunks`, {
  skip: !process.env.CROUPIER_BROWSER_FIXTURE_MODULE && 'Supply the installed Playwright module for real browser verification.', timeout: 60000,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moving-speech-player-'));
  let server, browser, wss;
  try {
    const bodyCount=moving?183:24, sourceCount=moving?66:24;
    const originalPath = join(dir, 'rest.mp4'), patchPath = join(dir, 'mouth.h264');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
      "color=c=blue:s=320x240:r=24,drawbox=x=0:y=0:w=320:h=240:color=green:t=fill:enable='eq(n,7)'",
      '-frames:v', String(sourceCount), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', originalPath], { stdio: 'pipe' });
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
      'color=c=red:s=256x512:r=24,drawbox=x=0:y=256:w=256:h=256:color=white:t=fill',
      '-frames:v', '12', '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p',
      '-x264-params', 'aud=1:keyint=12:bframes=0', '-f', 'h264', patchPath], { stdio: 'pipe' });
    const original = await readFile(originalPath), encoded = await readFile(patchPath), speech = descriptor(), m = messages(speech, 18000), sourceBytes=new Map();
    // This explicit rest is frame7, not the superficially similar first frame.
    m.ready.rest = { ...m.ready.rest, bytes: original.byteLength, sha256: hash(original), frameCount: sourceCount };
    m.ready.plan = JSON.parse(JSON.stringify(prepareMovingSpeechPlan({ binding: m.plan.binding,
      clips: [{ dealerId: 'dragan', take: 'vila', sha256: hash(original), fps: 24, frameCount: 1, kind: 'still' }],
      frames: Array.from({ length: 36 }, () => ({ take: 'vila', frame: 0 })) })));
    if(moving){
      const shortPath=join(dir,'short.mp4');
      execFileSync('ffmpeg',['-v','error','-i',originalPath,'-frames:v','39','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',shortPath],{stdio:'pipe'});
      const short=await readFile(shortPath),sequence={version:7,frames:[],sources:[],steps:[]};
      for(const [i,count]of [66,39,39,39].entries()){
        const videoId=`98765432-1234-1234-1234-123456789ab${i}`,take='clip-'+videoId,bytes=i?short:original,url='/api/presentation/registered-video/fixture/body'+i;
        const first=sequence.frames.length;
        sourceBytes.set(url,bytes);
        sequence.sources.push({videoId,take,sha256:hash(bytes),fps:24,frameCount:count,width:320,height:240,bytes:bytes.length,url});
        sequence.frames.push(...Array.from({length:count},(_,frame)=>({take,frame,sourceSha256:hash(bytes)})));
        sequence.steps.push({first,end:sequence.frames.length,video:{id:videoId,sha256:hash(bytes),filmedTake:{profileId:'fixture',takeKey:['4:i','dealer:base','4:base','hole:base'][i]}},event:{type:'deal',to:i%2?'dealer':'box',box:3,faceDown:i===3,shoeDraw:i+1}});
      }
      speech.presentationVersion=7;speech.sequenceSha256=hash(JSON.stringify(sequence));m.ready.sequence=sequence;
      m.ready.plan=JSON.parse(JSON.stringify(prepareMovingSpeechPlan({binding:m.plan.binding,
        clips:[...sequence.sources.map(s=>({...s,dealerId:'dragan',kind:'video'})),
          {dealerId:'dragan',take:'vila',sha256:hash(original),fps:24,frameCount:1,kind:'still'}],
        frames:sequence.frames.slice(0,36).map(({take,frame})=>({take,frame}))})));
    }
    const require = createRequire(new URL('../lab/package.json', import.meta.url));
    const { outputFiles } = await require('esbuild').build({ entryPoints: [new URL('./fixtures/moving-speech-player.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')], bundle: true, write: false, format: 'esm', external: ['/composition-runtime/compositor.js'] });
    server = createServer((req, res) => {
      if (req.url === m.ready.rest.url||sourceBytes.has(req.url)) {const bytes=sourceBytes.get(req.url)??original;res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length }); return res.end(bytes); }
      res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
      res.end(req.url === '/fixture.js' ? outputFiles[0].contents : '<script type="module">import {run} from "/fixture.js"; window.run=run;</script>');
    });
    const { WebSocketServer } = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
    wss = new WebSocketServer({ server, path: '/moving-speech-stream', handleProtocols: protocols => protocols.has('moving-v1') ? 'moving-v1' : false });
    const credits = [];
    wss.on('connection', socket => {
      let credit = 0, from = 0;
      socket.send(JSON.stringify(m.ready)); socket.send(JSON.stringify({ t: 'pcm', id, byteLength: m.pcm.byteLength })); socket.send(m.pcm);
      socket.on('message', data => {
        const message = JSON.parse(data.toString());
        if (message.t !== 'credit') return;
        credits.push(message.frames); credit += message.frames;
        while (credit >= 12 && from < 36) {
          const meta = m.chunk(from); meta.id = m.ready.plan.start.id;
          if(moving)meta.rutor=m.ready.plan.timeline.slice(from,from+12).map(row=>({tagning:row.take,ruta:row.frame,rect:[10,20,40,60]}));
          socket.send(JSON.stringify(meta)); socket.send(encoded); from += 12; credit -= 12;
        }
        if (from === 36) { socket.send(JSON.stringify({ t: 'done', id: m.ready.plan.start.id, frames: 36 })); from++; }
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { chromium } = await import(pathToFileURL(process.env.CROUPIER_BROWSER_FIXTURE_MODULE).href);
    browser = await chromium.launch({ headless: true, channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL || undefined,
      args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    if(moving)await page.addInitScript(()=>{
      // A queued presentation callback can arrive after the playing video's
      // pixels advance. Frame7 alone is green; frame8 must never pass as rest.
      const request=HTMLVideoElement.prototype.requestVideoFrameCallback;
      HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback){
        return request.call(this,(now,metadata)=>setTimeout(()=>callback(now,metadata),180));
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(() => window.run);
    const result = await page.evaluate(speech => window.run(speech), speech);
    assert.equal(result.first, 1); assert.equal(result.closed, true); assert.deepEqual(result.receipts.map(r => r.state), ['start', 'end']);
    const patched = result.frames.filter(f => f.patched); assert.ok(patched.length >= 2); assert.ok(patched.some(f => f.time > .3));
    for (const f of result.frames.filter(f=>!moving||f.take)) {
      if(moving&&f.take!=='vila'&&f.sourceFrame!==7)assert.ok(f.body[2]>200&&f.body[1]<30,'every source frame except exact frame7 must be blue');
      else assert.ok(f.body[1] > 100 && f.body[0] < 30 && f.body[2] < 30, 'body must be exact green source frame7');
    }
    if(moving){assert.equal(result.bodyFrames[0],0);assert.equal(result.bodyFrames.at(-1),bodyCount-1);assert.ok(result.bodyFrames.length>=bodyCount-4);}
    for (const f of patched) assert.ok(f.mouth[0] > 230 && f.mouth[1] < 30, 'decoded patch must be red');
    assert.equal(result.frames.at(-1).patched, false); assert.equal(credits[0], 24); assert.equal(credits.reduce((a, b) => a + b, 0), 36);
  } finally {
    await browser?.close(); for (const socket of wss?.clients ?? []) socket.terminate();
    if (wss) await new Promise(resolve => wss.close(resolve));
    if (server) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true });
  }
});
