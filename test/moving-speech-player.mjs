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
import { prepareMovingSpeechPlan } from '../services/game/moving-speech-plan.mjs';
import { createMovingSpeechFrameLayer } from '../packages/presentation/runtime/moving-speech-frame-layer.mjs';
import { createChatPlaybackDiagnostic } from '../services/game/public/chat-playback-diagnostic.mjs';
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
function fakeTimeouts() {
  let elapsed = 0, next = 0;
  const pending = new Map();
  return {
    setTimeout(callback, ms) { const id = ++next; pending.set(id, { at: elapsed + ms, callback }); return id; },
    clearTimeout(id) { pending.delete(id); },
    get pending() { return pending.size; },
    advance(ms) {
      const end = elapsed + ms;
      for (;;) {
        const due = [...pending].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]); elapsed = due[1].at; due[1].callback();
      }
      elapsed = end;
    },
  };
}
function fixture({ samples = 30000, overrides = {}, dependencies = {}, bodyCount=0, idleCount=0, changeSequence, beforeDecode = async () => {} } = {}) {
  const speech = descriptor(), m = messages(speech, samples), sent = [], receipts = [], observations = [], decoded = [], rafs = new Map();
  if(bodyCount||idleCount){
    const videoId='98765432-1234-1234-1234-123456789abc',take='clip-'+videoId;
    const sourceCount=idleCount||bodyCount,sequenceCount=idleCount?Math.ceil(m.plan.timeline.length/idleCount)*idleCount:bodyCount;
    const sequence={...(idleCount?{kind:'idle'}:{version:7}),frames:Array.from({length:sequenceCount},(_,frame)=>({take,frame:frame%sourceCount,sourceSha256:h})),
      sources:[{videoId,take,sha256:h,fps:24,frameCount:sourceCount,width:320,height:240,bytes:100,url:'/api/presentation/registered-video/fixture/source'}],
      steps:[{first:0,end:sequenceCount,video:{id:videoId,sha256:h,...(idleCount?{}:{filmedTake:{profileId:'fixture',takeKey:'4:iv'}})},
        ...(idleCount?{}:{event:{type:'deal',to:'box',box:3,shoeDraw:1}})}]};
    if(idleCount)speech.sequenceKind='idle';else speech.presentationVersion=7;
    changeSequence?.(sequence);
    speech.sequenceSha256=hash(JSON.stringify(sequence));m.ready.sequence=sequence;
    m.plan=prepareMovingSpeechPlan({binding:m.plan.binding,clips:[{dealerId:'dragan',take,sha256:h,fps:24,frameCount:sourceCount,kind:'video'},
      {dealerId:'dragan',take:'vila',sha256:h,fps:24,frameCount:1,kind:'still'}],
      frames:m.plan.timeline.map((_,k)=>k<sequenceCount?{take,frame:k%sourceCount}:{take:'vila',frame:0})});
    m.ready.plan=JSON.parse(JSON.stringify(m.plan));
    m.chunk=(from=0,n=12)=>({t:'lapp',id:m.plan.start.id,del:from/12,fran:from,rutor:m.plan.timeline.slice(from,from+n).map(r=>({tagning:r.take,ruta:r.frame,rect:[10,20,40,60]}))});
  }
  let socket, activeLayer, n = 0, current = true, ended = false, result, peakDecoded = 0;
  const audio = { currentTime: 0, paused: true, ended: false, muted: false, plays: 0,
    async play() { this.plays++; this.paused = false; }, pause() { this.paused = true; }, removeAttribute() {}, load() {} };
  const doc = { createElement(tag) {
    if (tag === 'audio') return audio;
    const context = { clearRect() {}, drawImage() {}, putImageData() {}, getImageData() { return { data: new Uint8ClampedArray(256 * 256 * 4) }; } };
    return { width: 320, height: 240, videoWidth: 320, videoHeight: 240, getContext: () => context };
  } };
  const promise = playMovingSpeech(speech, { ...options, prepareRendering: async () => {},
    assertCurrent: () => { if (!current) throw Error('stale_pose'); },
    renderFrame: (base, shown) => { observations.push(shown); if (shown&&(shown.speechFrame===undefined||shown.speechFrame<m.plan.timeline.length)) assert.notEqual(activeLayer.paint(base, shown), base); return true; },
    ...(idleCount?{}:{onSequenceReady:async()=>{},onSequenceFrame:()=>{},onSequenceEnd:()=>{}}),
    setMovingSpeechLayer: layer => { activeLayer = layer; }, onReceipt: receipt => receipts.push(receipt), ...overrides }, {
    document: doc, connect: (url, protocols) => {
      assert.equal(url, '/moving-speech-stream'); assert.deepEqual(protocols, ['moving-v1', `ticket.${speech.ticket}`]);
      socket = { readyState: 1, send: text => sent.push(JSON.parse(text)), close() { this.readyState = 3; } }; return socket;
    }, loadRest: async rest => { assert.equal(rest.sourceFrame, 7); return doc.createElement('canvas'); },
    createSourceFrames:()=>({async prefetch(){},get:()=>doc.createElement('canvas'),close(){}}),
    makeLayer: args => createMovingSpeechFrameLayer({ ...args, decode: async bytes => { await beforeDecode(decoded.length); const frames = Array.from({ length: bytes[0] }, () => {
      const frame = { displayWidth: 256, displayHeight: 512, closed: 0, close() { this.closed++; } }; decoded.push(frame); return frame;
    }); peakDecoded = Math.max(peakDecoded, decoded.filter(frame => !frame.closed).length); return frames;
    } }), createURL: () => 'blob:verified-pcm', revokeURL: () => {},
    requestAnimationFrame: fn => { rafs.set(++n, fn); return n; }, cancelAnimationFrame: key => rafs.delete(key), ...dependencies,
  });
  promise.then(value => { ended = true; result = value; }, error => { ended = true; result = error; });
  const send = data => socket.onmessage({ data: data instanceof Uint8Array ? data.slice().buffer : JSON.stringify(data) });
  return { speech, m, audio, sent, receipts, observations, decoded, promise, get socket() { return socket; }, get layer() { return activeLayer; },
    get ended() { return ended; }, get result() { return result; }, get peakDecoded() { return peakDecoded; }, send, stale() { current = false; },
    async ready() { await until(() => socket, 'socket connection'); send(m.ready); await until(() => activeLayer || ended, 'verified rest layer'); if (ended) throw result; },
    async pcm() { send({ t: 'pcm', id, byteLength: m.pcm.byteLength }); send(m.pcm); await until(() => sent.length, 'PCM credit'); },
    async chunk(from = 0, n = 12, mutate) { const meta = m.chunk(from, n); mutate?.(meta); send(meta); send(Uint8Array.of(n)); await turn(); await turn(); },
    async allChunks(from = 0) { for (let k = from; k < m.plan.timeline.length; k += 12) await this.chunk(k, Math.min(12, m.plan.timeline.length - k)); },
    done() { send({ t: 'done', id: m.plan.start.id, frames: m.plan.timeline.length }); },
    async start() { await this.allChunks(); this.done(); await until(() => audio.plays === 1 || ended, 'buffered playback'); if (ended) throw result; },
    async tick(time) { audio.currentTime = time; const [key, callback] = rafs.entries().next().value ?? []; rafs.delete(key); callback?.(); await turn(); },
  };
}

test('moving timings distinguish verified PCM, full reply and audio/frame start without claiming audible or visual acceptance', async () => {
  let clock = 100, checks = 0;
  const status = { dataset: {} }, diagnostic = createChatPlaybackDiagnostic(() => status, () => clock);
  diagnostic.begin(requestId);
  const f = fixture({ dependencies: { now: () => clock }, overrides: {
    beforeStart: async () => { if (++checks === 2) clock = 240; },
    onReceipt: receipt => { f.receipts.push(receipt); diagnostic.stream(requestId, receipt); },
  } });
  await f.ready(); clock = 110; f.socket.onopen();
  clock = 140; await f.pcm(); await f.allChunks();
  assert.equal(f.audio.plays, 0);
  clock = 200; f.done(); await until(() => f.receipts.length, 'timed audio start');
  assert.deepEqual(f.receipts[0].timings, { socket_open_ms: 10, first_media_ms: 40, socket_to_media_ms: 30,
    reply_ready_ms: 100, first_playing_ms: 140 });
  assert.equal(f.receipts[0].reviewStatus, 'pending');
  clock = 1000; f.audio.onended(); await f.promise;
  const end = f.receipts.at(-1), saved = JSON.parse(status.dataset.playbackReceipt);
  assert.equal(end.timings.first_visible_frame_ms, 140);
  assert.equal(f.receipts[0].timings.first_visible_frame_ms, undefined, 'later repaint cannot rewrite start evidence');
  assert.equal(saved.timings.reply_ready_ms, 100); assert.equal(saved.timings.first_visible_frame_ms, 140);
  assert.equal(saved.reviewStatus, 'pending'); assert.equal(saved.elapsedMs, 900);
});

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

test('verified rest, PCM and complete encoded reply gate audio; bounded decode window and completion remove mouth', async t => {
  const status = { dataset: {} }, diagnostic = createChatPlaybackDiagnostic(() => status), receipts = [];
  diagnostic.begin(requestId);
  const readReceipt = () => JSON.parse(status.dataset.playbackReceipt);
  const f = fixture({ overrides: { onReceipt: receipt => { receipts.push(receipt); diagnostic.stream(requestId, receipt); } } });
  t.after(() => f.socket?.onclose?.());
  await f.ready(); assert.equal(f.audio.plays, 0); assert.equal(readReceipt().state, 'pending');
  await f.pcm(); assert.deepEqual(f.sent, [{ t: 'credit', id: f.m.plan.start.id, frames: 24 }]);
  await f.chunk(0); assert.equal(f.audio.plays, 0);
  await f.chunk(12); assert.equal(f.audio.plays, 0); assert.equal(f.decoded.length, 0);
  await f.allChunks(24); assert.equal(f.audio.plays, 0);
  f.done(); await until(() => receipts.length > 0, 'audio playback receipt');
  assert.equal(f.audio.plays, 1);
  assert.equal(receipts[0].state, 'start'); assert.equal(readReceipt().state, 'playing');
  assert.equal(readReceipt().completed, false); assert.equal(f.observations.at(-1).frame, 0);
  assert.equal(f.observations.at(-1).sourceSha256, h); assert.equal(f.layer.bufferedFrames, 43);
  const credits = f.sent.filter(x => x.t === 'credit');
  await f.tick(.5); await f.tick(.8);
  assert.deepEqual(f.sent.filter(x => x.t === 'credit'), credits);
  assert.equal(f.ended, false); f.audio.onended(); await f.promise;
  assert.equal(f.audio.paused, true); assert.equal(f.layer, null); assert.equal(f.observations.at(-1), undefined);
  assert.equal(receipts.at(-1).state, 'end'); assert.ok(f.decoded.every(frame => frame.closed === 1));
  assert.equal(readReceipt().state, 'ended'); assert.equal(readReceipt().completed, true);
  diagnostic.finish(requestId, 'unverified');
  assert.equal(readReceipt().completed, true); assert.equal(readReceipt().reviewStatus, 'pending');
  assert.doesNotMatch(status.dataset.playbackReceipt, /ticket|exactText|planSha256/);
  assert.ok(f.sent.filter(x => x.t === 'credit').every(x => x.frames <= 24));
});

test('trailing worker padding is already local when audio ends without replay or holding its mouth frame', async () => {
  const f = fixture(); await f.ready(); await f.pcm(); await f.start(); await f.tick(.5);
  f.audio.currentTime = 1.25; f.audio.onended(); await f.promise;
  assert.equal(f.observations.at(-1), undefined); assert.equal(f.audio.plays, 1);
});

test('57-frame reply produced below playback speed waits past frame24, then plays every exact body frame', { timeout: 12000 }, async () => {
  const seen = [], f = fixture({ samples: 39010, bodyCount: 57,
    overrides: { onSequenceFrame: (_, frame) => seen.push(frame) } });
  await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12);
  // The production failure started here and exhausted its 24 frames. Each next
  // 12-frame batch takes 1.8 s, much longer than its 0.5 s of playback.
  for (const from of [24, 36, 48]) {
    await delay(1800);
    assert.equal(f.audio.plays, 0); assert.equal(f.audio.paused, true);
    assert.equal(f.decoded.length, 0);
    const credit = f.sent.filter(x => x.t === 'credit').reduce((sum, x) => sum + x.frames, 0);
    assert.ok(credit - from >= Math.min(12, 57 - from)); assert.ok(credit - from <= 24);
    await f.chunk(from, Math.min(12, 57 - from));
  }
  assert.equal(f.audio.plays, 0); f.done(); await until(() => f.audio.plays === 1, 'complete reply playback');
  for (let k = 1; k < 57; k++) { await f.tick((k + .001) / 24); assert.equal(f.ended, false); }
  f.audio.onended(); await f.promise;
  assert.deepEqual(seen, Array.from({ length: 57 }, (_, k) => k));
  assert.equal(f.audio.plays, 1); assert.equal(f.sent.at(-1).t, 'played');
  assert.equal(f.receipts.at(-1).state, 'end'); assert.equal(f.peakDecoded, 48);
  assert.ok(f.decoded.every(frame => frame.closed === 1));
});

test('maximum 600-frame plan makes bounded credit progress before audio and keeps at most48 decoded frames', async () => {
  const f = fixture({ samples: 582000 }); await f.ready(); await f.pcm();
  for (let from = 0; from < 600; from += 12) {
    const credit = f.sent.filter(x => x.t === 'credit').reduce((sum, x) => sum + x.frames, 0);
    assert.ok(credit - from >= 12 && credit - from <= 24);
    await f.chunk(from); assert.equal(f.audio.plays, 0);
  }
  f.done(); await until(() => f.audio.plays === 1, 'maximum plan playback');
  for (let k = 6; k < 588; k++) { await f.tick((k + .001) / 24 - .22); if (f.ended) throw f.result; }
  f.audio.onended(); await f.promise;
  assert.equal(f.peakDecoded, 48); assert.equal(f.decoded.length, 600);
  assert.ok(f.decoded.every(frame => frame.closed === 1));
});

test('encoded reply accepts exactly4MiB and rejects one extra byte before any audio or decode', async () => {
  for (const exceed of [false, true]) {
    const f = fixture({ samples: exceed ? 30000 : 6000 }); await f.ready(); await f.pcm();
    const bytes = new Uint8Array(2 * 1024 * 1024); bytes[0] = 12;
    for (const from of [0, 12]) { f.send(f.m.chunk(from)); f.send(bytes); await turn(); await turn(); }
    assert.equal(f.audio.plays, 0); assert.equal(f.decoded.length, 0);
    if (exceed) {
      await f.chunk(24); await assert.rejects(f.promise, /queue_full/);
      assert.equal(f.audio.plays, 0); assert.equal(f.decoded.length, 0); assert.equal(f.socket.readyState, 3);
    } else {
      f.done(); await until(() => f.audio.plays === 1, 'boundary reply playback'); f.audio.onended(); await f.promise;
    }
  }
});

test('abort while the reply is only staged releases the session without playing or decoding', async () => {
  const controller = new AbortController(), f = fixture({ overrides: { signal: controller.signal } });
  await f.ready(); await f.pcm(); await f.chunk(0); await f.chunk(12); controller.abort();
  await assert.rejects(f.promise, { name: 'AbortError' });
  assert.equal(f.audio.plays, 0); assert.equal(f.decoded.length, 0); assert.equal(f.layer, null);
  assert.equal(f.audio.paused, true); assert.equal(f.socket.readyState, 3);
});

test('pose changes and missing exact next frames silence the audio and close the session', async () => {
  for (const reason of ['pose', 'underrun']) {
    let resume;
    const f = fixture({ samples: 39010, beforeDecode: count => count === 48 ? new Promise(resolve => { resume = resolve; }) : undefined });
    await f.ready(); await f.pcm(); await f.start();
    if (reason === 'pose') f.stale();
    else { await f.tick(.5); await until(() => resume, 'stalled local decoder'); }
    await f.tick(reason === 'pose' ? .1 : 1.8);
    await assert.rejects(f.promise, reason === 'pose' ? /stale_pose/ : /frame_unavailable/);
    assert.equal(f.audio.paused, true); assert.equal(f.audio.muted, true); assert.equal(f.socket.readyState, 3);
    assert.equal(f.receipts.at(-1).state, 'interrupted'); assert.equal(f.sent.at(-1).t, 'abort');
    assert.equal(f.receipts.at(-1).failureCode, reason === 'pose' ? 'chat_failed' : 'moving_speech_frame_unavailable');
    assert.equal(f.receipts.at(-1).started, true); assert.equal(f.receipts.at(-1).firstFrame, true);
    assert.deepEqual(f.receipts.at(-1).frameCounts, { received: 57, released: reason === 'pose' ? 5 : 17, total: 57 });
    resume?.(); await turn(); await turn();
    assert.ok(f.decoded.every(frame => frame.closed === 1));
  }
});
test('lost ownership socket after worker done silences the remaining long body immediately',async()=>{
  const f=fixture({samples:18000,bodyCount:183});await f.ready();await f.pcm();await f.start();
  await f.tick(.5);f.socket.onclose();
  await assert.rejects(f.promise,/socket_closed/);assert.equal(f.audio.muted,true);assert.equal(f.audio.paused,true);
  assert.equal(f.sent.some(x=>x.t==='played'),false);
  assert.equal(f.receipts.at(-1).failureCode,'moving_speech_socket_closed');
});

test('server failure is distinct from a malformed message and arbitrary errors never enter the receipt', async () => {
  const f = fixture(); await f.ready(); f.send({ t: 'error', code: 'moving_speech_unavailable' });
  await assert.rejects(f.promise, /moving_speech_unavailable/);
  assert.equal(f.receipts.at(-1).failureCode, 'moving_speech_unavailable');
  assert.equal(f.receipts.at(-1).started, false);
  const secret = 'https://provider.example/?key=fixture-private';
  const bad = fixture({ overrides: { beforeStart: () => { throw Error(secret); } } });
  await assert.rejects(bad.promise, /fixture-private/);
  assert.equal(bad.receipts.at(-1).failureCode, 'chat_failed');
  assert.doesNotMatch(JSON.stringify(bad.receipts), /fixture-private|provider.example/);
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
  const f = fixture(); await f.ready(); await f.pcm();
  const beyondCredit = f.m.chunk(0); beyondCredit.rutor.push(...f.m.chunk(0).rutor, ...f.m.chunk(0).rutor);
  f.send(beyondCredit);
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
    await f.ready();await f.pcm();await f.start();
    assert.equal(f.observations.find(Boolean).speechFrame,0);assert.equal(f.observations.find(Boolean).audioTimeSeconds,-.22);
    const length=Math.max(bodyCount,f.m.plan.timeline.length);assert.equal(blob.size,44+length*2000);
    for(let k=1;k<length;k++){
      await f.tick((k+.001)/24);
      if(f.ended)throw f.result;
    }
    f.audio.onended();await f.promise;
    assert.deepEqual([...new Map(seen.map(row=>[row[0],row])).values()],Array.from({length:bodyCount},(_,k)=>[k,k]));
    assert.ok(ends.length);assert.equal(closed,true);assert.equal(f.audio.plays,1);
    assert.equal(f.sent.at(-1).t,'played');assert.ok(f.sent.filter(x=>x.t==='credit').every(x=>x.frames<=24));
    assert.ok(f.observations.filter(Boolean).slice(bodyCount).every(f=>f.take==='vila'&&f.frame===0));
  }
});

test('idle body repeats complete original cycles on the PCM clock and acknowledges explicit silence after shared relay done',async()=>{
  for(const samples of [18000,42000]){
    let blob;
    const f=fixture({samples,idleCount:39,dependencies:{createURL:value=>{blob=value;return 'blob:idle';}}});
    await f.ready();await f.pcm();await f.start();
    assert.equal(f.socket.readyState,1);
    const count=Math.ceil(f.m.plan.timeline.length/39)*39;
    assert.equal(blob.size,44+count*2000);
    const bytes=new Uint8Array(await blob.arrayBuffer()),offset=44+5280*2;
    assert.ok(bytes.slice(44,offset).every(v=>v===0));
    assert.deepEqual(bytes.slice(offset,offset+f.m.pcm.length),f.m.pcm);
    assert.ok(bytes.slice(offset+f.m.pcm.length).every(v=>v===0));
    assert.equal(f.observations.find(Boolean).audioTimeSeconds,-.22);
    for(let k=1;k<count;k++)await f.tick((k+.001)/24);
    f.audio.onended();await f.promise;
    assert.deepEqual(f.observations.filter(Boolean).map(row=>row.frame),Array.from({length:count},(_,k)=>k%39));
    assert.ok(f.observations.filter(Boolean).every(row=>row.take.startsWith('clip-')));
    assert.deepEqual(f.sent.filter(row=>row.t==='played'),[{t:'played',id:f.m.plan.start.id}]);
    assert.equal(f.receipts.at(-1).state,'end');assert.equal(f.layer,null);
  }
});

test('maximum 1000-frame idle gets its full WAV playback budget after delayed transport', async () => {
  const clock = fakeTimeouts();
  const f = fixture({ samples: 582000, idleCount: 500, dependencies: clock });
  assert.ok(JSON.stringify(f.m.ready).length * 2 > 256 * 1024, 'full bound plans exceed the small-message ceiling');
  await f.ready(); clock.advance(30000); await f.pcm(); await f.start();
  assert.equal(f.m.ready.sequence.frames.length, 1000);
  for (let frame = 1; frame < 1000; frame++) await f.tick((frame + .001) / 24);
  clock.advance(Math.ceil(1000 / 24 * 1000));
  assert.equal(f.ended, false, '71.7s total elapsed is valid because playback has its own budget');
  f.audio.onended(); await f.promise;
  assert.deepEqual(f.sent.filter(row => row.t === 'played'), [{ t: 'played', id: f.m.plan.start.id }]);
  assert.equal(f.receipts.at(-1).state, 'end'); assert.equal(clock.pending, 0);
});

test('initial ready envelope keeps a 1MiB hard ceiling before parsing or loading media', async () => {
  const f = fixture({ idleCount: 39 }); await until(() => f.socket, 'socket');
  f.send({ t: 'ready', padding: 'x'.repeat(512 * 1024) });
  await assert.rejects(f.promise, /moving_speech_queue_full/);
  assert.equal(f.audio.plays, 0); assert.equal(f.decoded.length, 0); assert.equal(f.layer, null);
});

test('transport budget remains 45s while media or the final playback-start check is pending', async () => {
  for (const waitForStart of [false, true]) {
    const clock = fakeTimeouts(); let checks = 0;
    const f = fixture({ idleCount: 39, dependencies: clock, overrides: { beforeStart: () => {
      if (++checks === 2 && waitForStart) return new Promise(() => {});
    } } });
    await f.ready(); clock.advance(30000);
    if (waitForStart) { await f.pcm(); await f.allChunks(); f.done(); await until(() => checks === 2, 'pending audio start'); }
    clock.advance(14999); assert.equal(f.ended, false);
    clock.advance(1); await assert.rejects(f.promise, /moving_speech_timeout/);
    assert.equal(f.audio.plays, 0); assert.equal(f.audio.muted, true);
    assert.equal(f.receipts.at(-1).failureCode, 'moving_speech_timeout'); assert.equal(clock.pending, 0);
  }
});

test('stalled playback times out at the exact generated WAV duration plus 5s for rest, idle and deal', async () => {
  for (const sequence of [{}, { idleCount: 39 }, { bodyCount: 60 }]) {
    const clock = fakeTimeouts(); let blob;
    const f = fixture({ samples: 18000, ...sequence, dependencies: { ...clock, createURL: value => { blob = value; return 'blob:budget'; } } });
    await f.ready(); clock.advance(44000); await f.pcm(); await f.start();
    const playbackMs = Math.ceil((blob.size - 44) / 48000 * 1000);
    clock.advance(playbackMs + 4999); assert.equal(f.ended, false);
    clock.advance(1); await assert.rejects(f.promise, /moving_speech_timeout/);
    assert.equal(f.audio.muted, true); assert.equal(f.audio.paused, true); assert.equal(clock.pending, 0);
    assert.equal(f.sent.some(row => row.t === 'played'), false); assert.equal(f.sent.at(-1).t, 'abort');
    assert.equal(f.receipts.at(-1).failureCode, 'moving_speech_timeout');
  }
});

test('idle cannot acknowledge completion after the retained socket closes before its close callback runs', async () => {
  const f = fixture({ samples: 18000, idleCount: 39 });
  await f.ready(); await f.pcm(); await f.start();
  for (let frame = 1; frame < 39; frame++) await f.tick((frame + .001) / 24);
  f.socket.readyState = 3; f.audio.onended();
  await assert.rejects(f.promise, /moving_speech_socket_closed/);
  assert.equal(f.sent.some(row => row.t === 'played'), false);
  assert.equal(f.receipts.at(-1).state, 'interrupted');
});

test('idle authority rejects mixed descriptor kinds, forged sequence kinds, frame substitutions and truncated cycles before audio',async()=>{
  for(const change of [d=>d.sequenceKind='deal',d=>d.presentationVersion=7,d=>delete d.sequenceSha256,d=>d.sequenceSha256='bad']){
    const d={...descriptor(),sequenceKind:'idle',sequenceSha256:h};change(d);
    await assert.rejects(validateMovingSpeechStream(d,options),/moving_speech/);
  }
  for(const changeSequence of [s=>s.kind='deal',s=>s.version=7,s=>s.frames[0].frame=1,
    s=>s.steps[0].event={type:'deal',shoeDraw:1},s=>{s.frames.pop();s.steps[0].end--;},
    s=>s.sources[0].sha256='b'.repeat(64)]){
    const f=fixture({idleCount:39,changeSequence});
    await until(()=>f.socket,'socket');f.send(f.m.ready);
    await assert.rejects(f.promise,/moving_speech/);assert.equal(f.audio.plays,0);
  }
  const f=fixture({idleCount:39});f.m.ready.sequence.frames[1].frame=2;
  await until(()=>f.socket,'socket');f.send(f.m.ready);await assert.rejects(f.promise,/sequence/);
  assert.equal(f.audio.plays,0,'an unhashed replacement never reaches audio');
});

test('idle still refuses incomplete transport, local stale ownership and abort after relay completion',async()=>{
  for(const reason of ['transport','socket','stale','abort']){
    const controller=new AbortController();
    const f=fixture({idleCount:39,overrides:{signal:controller.signal}});
    await f.ready();await f.pcm();
    if(reason==='transport'){f.socket.readyState=3;f.socket.onclose();}
    else{
      await f.start();
      if(reason==='socket'){f.socket.readyState=3;f.socket.onclose();}
      else if(reason==='stale'){f.stale();await f.tick(.1);}else controller.abort();
    }
    await assert.rejects(f.promise,['transport','socket'].includes(reason)?/socket_closed/:reason==='stale'?/stale_pose/:/Speech cancelled/);
    assert.equal(f.sent.some(row=>row.t==='played'),false);
    assert.equal(f.audio.muted,true);assert.equal(f.receipts.at(-1).state,'interrupted');
  }
  const deal=fixture({bodyCount:48,overrides:{onSequenceReady:undefined,onSequenceFrame:undefined,onSequenceEnd:undefined}});
  await until(()=>deal.socket,'socket');deal.send(deal.m.ready);
  await assert.rejects(deal.promise,/sequence_owner_missing/);assert.equal(deal.audio.plays,0);
});

test('native ended state before the queued ended event finishes the 50-frame reply and 66-frame body once',async()=>{
  const seen=[];let sequenceEnds=0;
  const f=fixture({samples:32322,bodyCount:66,overrides:{onSequenceFrame:(_,k)=>seen.push(k),onSequenceEnd:()=>sequenceEnds++}});
  await f.ready();await f.pcm();await f.start();
  for(let k=1;k<66;k++)await f.tick((k+.001)/24);
  assert.equal(f.m.plan.timeline.length,50);
  const queuedEnded=f.audio.onended;
  // Native media state can update before its queued DOM ended callback runs.
  f.audio.ended=true;f.audio.paused=true;await f.tick(66/24);
  await f.promise;queuedEnded();
  assert.deepEqual(seen,Array.from({length:66},(_,k)=>k));assert.equal(sequenceEnds,1);
  assert.equal(f.sent.filter(x=>x.t==='played').length,1);assert.equal(f.sent.some(x=>x.t==='abort'),false);
  assert.equal(f.receipts.at(-1).state,'end');assert.equal(f.receipts.at(-1).failureCode,undefined);
  assert.equal(f.layer,null);assert.ok(f.decoded.every(frame=>frame.closed===1));
});

test('manual pause without native ended state still interrupts playback',async()=>{
  const f=fixture({samples:32322,bodyCount:66});await f.ready();await f.pcm();await f.start();
  f.audio.pause();assert.equal(f.audio.ended,false);await f.tick(.5);
  await assert.rejects(f.promise,/moving_speech_audio_paused/);
  assert.equal(f.sent.some(x=>x.t==='played'),false);assert.equal(f.sent.at(-1).t,'abort');
  assert.equal(f.receipts.at(-1).state,'interrupted');assert.equal(f.audio.muted,true);
});

test('native ended state retains incomplete-body, missing final source and ownership checks',async()=>{
  for(const reason of ['incomplete','missing-final-source','stale']){
    const dependencies=reason==='missing-final-source'?{createSourceFrames:()=>({async prefetch(){},get(k){
      if(k===65)throw Error('moving_source_frame_unavailable');return {videoWidth:320,videoHeight:240};},close(){}})}:{};
    const f=fixture({samples:32322,bodyCount:66,dependencies});await f.ready();await f.pcm();await f.start();
    if(reason!=='incomplete')for(let k=1;k<=64;k++)await f.tick((k+.001)/24);
    if(reason==='stale')f.stale();
    f.audio.ended=true;f.audio.paused=true;await f.tick(66/24);
    await assert.rejects(f.promise,reason==='incomplete'?/moving_speech_sequence_incomplete/:reason==='missing-final-source'?/moving_source_frame_unavailable/:/stale_pose/);
    assert.equal(f.sent.some(x=>x.t==='played'),false);assert.equal(f.sent.at(-1).t,'abort');
    assert.equal(f.receipts.at(-1).state,'interrupted');assert.equal(f.audio.muted,true);
  }
});

test('changed body plan or missing exact source frame stops before unbound audio/body is shown',async()=>{
  const changed=fixture({bodyCount:48});changed.m.ready.sequence.frames[0].frame=1;
  await until(()=>changed.socket,'socket');changed.send(changed.m.ready);await assert.rejects(changed.promise,/sequence/);assert.equal(changed.audio.plays,0);
  const f=fixture({bodyCount:48,dependencies:{createSourceFrames:()=>({async prefetch(){},get(){throw Error('moving_source_frame_unavailable');},close(){}})}});
  await f.ready();await f.pcm();await f.allChunks();f.done();await assert.rejects(f.promise,/moving_source_frame_unavailable/);
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
    const require = createRequire(new URL('../apps/studio/package.json', import.meta.url));
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
