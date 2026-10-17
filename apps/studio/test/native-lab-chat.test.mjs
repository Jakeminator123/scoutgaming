import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeLabChat } from '../lib/native-lab-chat.mjs';
import { createLiveIdleController } from '../lib/live-idle.mjs';

const flush = async () => { for (let n = 0; n < 16; n++) await Promise.resolve(); };
function fixture({ handshake = true, scene = {}, failPlayback = false, onStatus = () => {} } = {}) {
  const messages = [], statuses = [], receipts = [], plays = [], completed = [], cancelled = [], submissions = [], timers = new Map();
  let options, controller, timerId = 0, requestId = 0, attaches = 0, settles = 0, closes = 0;
  const media = { audio: new ArrayBuffer(8), video: new ArrayBuffer(16) };
  const client = createNativeLabChat({ binding: { source: {}, origin: 'http://localhost:4198', channel: 'fixture-channel-12345' },
    initialScene: { connected: true, active: true, visible: true, dealerId: 'astrid', roundVersion: 1,
      boundary: '0', actionBusy: false, idleReady: false, ...scene },
    makeId: () => `request.${++requestId}`,
    schedule(fn, ms) { assert.equal(ms, 500); const id = ++timerId; timers.set(id, fn); return id; }, clear: id => timers.delete(id),
    onMessage: message => messages.push(message), onStatus: value => { statuses.push(value); onStatus(value); }, onReceipt: value => receipts.push(value), onSettled: () => settles++,
    playGenerated(decision, value) {
      return new Promise((resolve, reject) => {
        plays.push({ decision, ...value, resolve, reject });
        value.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true });
        if (failPlayback) reject(Error('media failure'));
      });
    },
    bridgeFactory(value) {
      options = value;
      return { attach() { attaches++; if (handshake) options.onStatus({ state: 'attached' }); },
        submit(value) { submissions.push(value); controller = new AbortController(); return true; },
        cancel(id) { cancelled.push(id); controller?.abort(); }, complete(id) { completed.push(id); controller?.abort(); },
        accept: event => event, close() { closes++; controller?.abort(); } };
    },
  });
  const decision = extra => ({ requestId: submissions.at(-1)?.requestId, kind: 'generatedText', dealerId: 'astrid',
    sessionRevision: 'session.1', roundRevision: '1', exactText: 'Dina synliga kort är fem och åtta.', speechPackage: { packageId: 'fixture' }, ...extra });
  const ready = extra => options.onReady({ decision: decision(extra), media, signal: controller.signal });
  return { client, ready, decision, messages, statuses, receipts, plays, completed, cancelled, submissions, timers, media,
    get attaches() { return attaches; }, get settles() { return settles; }, get closes() { return closes; },
    status: value => options.onStatus(value), abort: () => controller.abort(),
    fireTimer() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); } };
}

test('linked chat prepares during an action but both text and speech wait for actual idle proof', async () => {
  const f = fixture({ scene: { actionBusy: true } });
  assert.equal(f.client.submit(' Vilka kort har jag? '), true);
  assert.equal(f.messages.length, 1); assert.equal(f.messages[0].role, 'user');
  f.ready(); await flush(); assert.equal(f.plays.length, 0); assert.equal(f.messages.length, 1);
  f.client.updateScene({ idleReady: true }); await flush(); assert.equal(f.plays.length, 0);
  f.client.updateScene({ actionBusy: false }); await flush();
  assert.equal(f.messages.length, 2); assert.equal(f.plays.length, 1);
  assert.equal(f.plays[0].decision.exactText, 'Dina synliga kort är fem och åtta.');
  assert.equal(f.plays[0].media, f.media);
  assert.deepEqual(f.completed, []);
  f.plays[0].resolve(); await flush();
  assert.deepEqual(f.completed, ['request.1']); assert.equal(f.settles, 1);
  f.client.close();
});

test('a new action interrupts active speech, never waits on it and never marks it completed', async () => {
  const f = fixture({ scene: { idleReady: true } }); f.client.submit('Hej'); f.ready(); await flush();
  assert.equal(f.plays.length, 0); f.client.updateScene({ idleReady: true }); await flush();
  assert.equal(f.plays.length, 1);
  f.client.updateScene({ actionBusy: true, idleReady: false }); await flush();
  assert.equal(f.plays[0].signal.aborted, true); assert.deepEqual(f.cancelled, ['request.1']);
  assert.deepEqual(f.completed, []); assert.equal(f.settles, 1);
  f.plays[0].resolve(); await flush(); assert.deepEqual(f.completed, []);
  f.client.close();
});

test('dealer, round, observation, disconnect, view and visibility changes discard pending or playing replies', async () => {
  for (const patch of [{ dealerId: 'vera' }, { roundVersion: 2 }, { boundary: '1' }, { connected: false }, { active: false }, { visible: false }]) {
    for (const playing of [false, true]) {
      const f = fixture({ scene: { idleReady: playing } }); f.client.submit('Hej'); f.ready();
      if (playing) f.client.updateScene({ idleReady: true }); await flush();
      f.client.updateScene(patch); await flush();
      assert.deepEqual(f.cancelled, ['request.1']); assert.deepEqual(f.completed, []);
      if (playing) assert.equal(f.plays[0].signal.aborted, true);
      else assert.equal(f.messages.length, 1);
      f.client.close();
    }
  }
});

test('native abort, user stop and unmount propagate cancellation and release exactly once', async () => {
  for (const action of [f => f.abort(), f => f.client.cancel(), f => f.client.close()]) {
    const f = fixture({ scene: { idleReady: true } }); f.client.submit('Hej'); f.ready(); f.client.updateScene({ idleReady: true }); await flush();
    action(f); await flush(); assert.equal(f.plays[0].signal.aborted, true);
    assert.equal(f.settles, 1); assert.deepEqual(f.completed, []);
    f.client.close(); assert.equal(f.closes, 1);
  }
});

test('duplicates and a second submit cannot create double speech; stale prepared revisions cannot display', async () => {
  const f = fixture({ scene: { idleReady: true } }); assert.equal(f.client.submit('Hej'), true);
  assert.equal(f.client.submit('Igen'), false); f.ready(); f.ready(); f.client.updateScene({ idleReady: true }); await flush();
  assert.equal(f.plays.length, 1); assert.equal(f.messages.length, 2);
  f.client.cancel(); await flush(); f.client.close();
  for (const change of [{ dealerId: 'vera' }, { roundRevision: '2' }]) {
    const stale = fixture({ scene: { idleReady: true } }); stale.client.submit('Hej'); stale.ready(change); await flush();
    assert.equal(stale.plays.length, 0); assert.equal(stale.messages.length, 1);
    assert.deepEqual(stale.cancelled, ['request.1']); stale.client.close();
  }
});

test('text and silence work without synthetic audio; recorded lines never borrow another clip', async () => {
  for (const kind of ['generatedText', 'recordedLine', 'silence']) {
    const f = fixture({ scene: { idleReady: true } }); f.client.submit('Hej');
    f.ready({ kind, speechPackage: undefined, ...(kind === 'recordedLine' ? { familyId: 'astrid.speak.goodluck', lineId: 'goodluck', variantId: null } : {}) });
    f.client.updateScene({ idleReady: true });
    await flush(); assert.equal(f.plays.length, 0); assert.deepEqual(f.receipts, []);
    assert.equal(f.messages.length, kind === 'silence' ? 1 : 2); assert.deepEqual(f.completed, ['request.1']);
    if (kind === 'recordedLine') assert.match(f.statuses.at(-1).detail, /Exakt inspelad replik saknas/);
    f.client.close();
  }
});

test('silence completes immediately without pose priority and leaves the current AI idlevariant uninterrupted', async () => {
  const base = '11111111-1111-4111-8111-111111111111', reaction = '22222222-2222-4222-8222-222222222222', familyId = 'astrid/idle.ready/ready';
  const idle = createLiveIdleController({ now: () => 0, initialScene: { active: true },
    policy: { schemaVersion: 1, familyId, base: [{ videoId: base, weight: 100, durationMs: 1000 }],
      variants: [{ videoId: reaction, durationMs: 1000, use: 'openclaw', automatic: null }] },
    inventory: { families: [{ id: familyId, dealerId: 'astrid', playbackType: 'idle-pool', standardIds: [base], variantIds: [reaction] }],
      videos: [{ id: base, familyId, role: 'standard', available: true }, { id: reaction, familyId, role: 'variant', available: true }] } });
  const basePlay = idle.snapshot().clip.playId;
  idle.started(basePlay); assert.equal(idle.offerVariant({ videoId: reaction, requestId: 'idle.advice.1', expiresAt: 10000 }), true);
  const variant = idle.completed(basePlay).clip; idle.started(variant.playId);
  const f = fixture({ scene: { idleReady: false }, onStatus(value) {
    idle.updateScene({ speechReady: ['held', 'playing'].includes(value.state), speechPlaying: value.state === 'playing' });
  } });
  f.client.submit('Hej'); f.ready({ kind: 'silence', exactText: undefined, speechPackage: undefined });
  assert.deepEqual(f.completed, ['request.1'], 'no frame, timer or gate completion is needed');
  await flush();
  assert.equal(idle.snapshot().clip.playId, variant.playId); assert.equal(idle.snapshot().clip.videoId, reaction);
  assert.ok(f.statuses.every(value => !['held', 'playing'].includes(value.state)));
  assert.equal(f.statuses.at(-1).pending, false); assert.match(f.statuses.at(-1).detail, /valde att inte svara/);
  assert.equal(f.messages.length, 1); assert.deepEqual(f.plays, []); assert.deepEqual(f.receipts, []); assert.deepEqual(f.cancelled, []);
  assert.equal(f.client.submit('Nästa fråga'), true, 'silence releases the slot exactly once');
  f.client.close(); idle.close();
});

test('silence also releases during a deal without waiting for its completion or a standard pose', () => {
  const f = fixture({ scene: { actionBusy: true, idleReady: false } });
  f.client.submit('Hej'); f.ready({ kind: 'silence', exactText: undefined, speechPackage: undefined });
  assert.deepEqual(f.completed, ['request.1']); assert.equal(f.settles, 1);
  assert.equal(f.statuses.some(value => value.state === 'held'), false); assert.equal(f.messages.length, 1); f.client.close();
});

test('media failure cancels without an automatic retry, fallback clip or false completed receipt', async () => {
  const f = fixture({ scene: { idleReady: true }, failPlayback: true }); f.client.submit('Hej'); f.ready(); f.client.updateScene({ idleReady: true }); await flush();
  assert.deepEqual(f.cancelled, ['request.1']); assert.deepEqual(f.completed, []);
  assert.equal(f.plays.length, 1); assert.equal(f.submissions.length, 1);
  assert.equal(f.statuses.at(-1).state, 'failed'); f.client.close();
});

test('attach retries are bounded at twenty, stop after attachment and never retry a chat request', () => {
  const f = fixture({ handshake: false });
  assert.equal(f.client.submit('Hej'), false);
  for (let i = 0; i < 20; i++) f.fireTimer();
  assert.equal(f.attaches, 20); assert.equal(f.timers.size, 0); assert.equal(f.submissions.length, 0);
  assert.equal(f.statuses.at(-1).state, 'unavailable'); f.client.close();
  const ready = fixture({ handshake: false }); ready.fireTimer(); ready.status({ state: 'attached' });
  assert.equal(ready.timers.size, 0); assert.equal(ready.client.submit('Hej'), true); ready.client.close();
});

test('unbound, hidden, inactive or unknown tables cannot submit or supply client game data', () => {
  for (const scene of [{ connected: false }, { active: false }, { visible: false }, { roundVersion: null }]) {
    const f = fixture({ scene }); assert.equal(f.client.submit('Hej'), false); assert.deepEqual(f.submissions, []); f.client.close();
  }
  const f = fixture(); assert.equal(f.client.submit('x'.repeat(501)), false); assert.equal(f.client.submit(' '), false);
  assert.equal(f.client.submit('Hej'), true); assert.deepEqual(Object.keys(f.submissions[0]).sort(), ['requestId', 'text']); f.client.close();
});
