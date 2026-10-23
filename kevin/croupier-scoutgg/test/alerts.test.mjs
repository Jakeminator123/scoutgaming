import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAlerts, alertEnv } from '../server/alerts.mjs';
import { RorligLipsync } from '../server/rorlig-lipsync.mjs';

// Kevin 23 Oct: "skapa en callback error med webhooks"
function rig(url = 'https://hooks.example/x') {
  const posts = [], logs = []; let t = Date.parse('2026-10-23T12:00:00Z');
  const a = createAlerts({ url, env: 'staging', now: () => t, log: s => logs.push(s), fetchImpl: async (u, o) => { posts.push({ u, body: JSON.parse(o.body) }); return { ok: true }; } });
  return { a, posts, logs, step: ms => { t += ms; } };
}

test('an alert is Slack-compatible JSON with env, dealer, typ, tid and fel, posted to ALERT_WEBHOOK_URL', async () => {
  const { a, posts } = rig();
  assert.equal(a.fail('timeout', 'dragge', 'goodluck: inget svar på 15 s från e2e'), true);
  await new Promise(r => setImmediate(r));
  assert.equal(posts.length, 1); assert.equal(posts[0].u, 'https://hooks.example/x');
  const b = posts[0].body;
  assert.match(b.text, /^:rotating_light: staging: läppsynk timeout \(dragge\): goodluck/);
  assert.deepEqual({ env: b.env, dealer: b.dealer, typ: b.typ, fel: b.fel }, { env: 'staging', dealer: 'dragge', typ: 'timeout', fel: 'goodluck: inget svar på 15 s från e2e' });
  assert.equal(b.tid, '2026-10-23T12:00:00.000Z');
});

test('at most one alert per type and dealer per 10 min; one "återställt" when it works again', async () => {
  const { a, posts, step } = rig();
  a.fail('worker_nere', 'paow', 'x'); step(60_000); a.fail('worker_nere', 'paow', 'x'); a.fail('worker_nere', 'dragge', 'x'); a.fail('stillbild', 'paow', 'y');
  step(9 * 60_000); a.fail('worker_nere', 'paow', 'x');
  step(61_000); a.fail('worker_nere', 'paow', 'x');
  await new Promise(r => setImmediate(r));
  assert.deepEqual(posts.map(p => `${p.body.typ}:${p.body.dealer}`), ['worker_nere:paow', 'worker_nere:dragge', 'stillbild:paow', 'worker_nere:paow']);
  step(60_000); assert.equal(a.ok('worker_nere', 'paow'), true); assert.equal(a.ok('worker_nere', 'paow'), false, 'only once');
  await new Promise(r => setImmediate(r));
  const back = posts.at(-1).body;
  assert.match(back.text, /^:white_check_mark: staging: läppsynk worker_nere \(paow\): återställt efter 12 min \(4 fel\)/);
  assert.equal(back.status, 'återställt'); assert.equal(back.fel, null);
  assert.equal(a.ok('timeout', 'paow'), false, 'nothing open, nothing sent');
});

test('without ALERT_WEBHOOK_URL the alerts only go to the log; env from ALERT_ENV or the service port', async () => {
  const { a, posts, logs } = rig('');
  a.fail('chatt_utan_rost', 'paow', 'svaret kom bara som text'); a.ok('chatt_utan_rost', 'paow');
  await new Promise(r => setImmediate(r));
  assert.equal(posts.length, 0);
  assert.deepEqual(logs, ['larm chatt_utan_rost (paow): svaret kom bara som text', 'larm chatt_utan_rost (paow): återställt efter 1 min (1 fel)']);
  assert.equal(alertEnv({ PORT: '8620' }), 'prod'); assert.equal(alertEnv({ PORT: '8630' }), 'staging'); assert.equal(alertEnv({ PORT: '8620', ALERT_ENV: 'x' }), 'x');
});

test('the lip sync raises them: a refused callback, a worker too slow, the last worker gone; a worker up clears them', () => {
  const got = [], alert = { fail: (t, d, f) => got.push(['fail', t, d]), ok: (t, d) => got.push(['ok', t, d]) };
  const r = new RorligLipsync({ endpointId: 'x', apiKey: 'k', publicBase: () => '', publicDir: '/tmp', dealers: ['dragge'], log: () => {}, alert, sessionWaitMs: 1000 });
  const sock = () => { const w = new EventEmitter(); w.readyState = 1; w.send = () => {}; w.close = () => w.emit('close'); return w; };
  r.adoptWorker(sock(), new URL('ws://x/lipsync-rorlig?token=fel&avatar=dragge&pod=e2e'));
  r.adoptWorker(sock(), new URL('ws://x/lipsync-rorlig?token=fel&avatar=nobody'));
  const slow = sock(); r.adoptWorker(slow, new URL(`ws://x/lipsync-rorlig?token=${r.podToken()}&avatar=dragge&pod=e2e`));
  slow.emit('message', JSON.stringify({ t: 'pong', gpu: 'old', rutor_per_s: 12 }));
  const good = sock(); r.adoptWorker(good, new URL(`ws://x/lipsync-rorlig?token=${r.podToken()}&avatar=dragge&pod=e2e`));
  good.emit('message', JSON.stringify({ t: 'pong', gpu: '4090', rutor_per_s: 70, forsta_bit_ms: 250 }));
  good.emit('close');
  assert.deepEqual(got.filter(g => g[0] === 'fail').map(g => g.slice(1)), [['callback_fel', 'dragge'], ['callback_fel', 'nobody'], ['worker_for_langsam', 'dragge'], ['worker_nere', 'dragge']]);
  assert.ok(got.some(g => g[0] === 'ok' && g[1] === 'worker_nere') && got.some(g => g[0] === 'ok' && g[1] === 'callback_fel'), 'a worker up clears them');
});

test('a flapping worker posts once per 10 min: a failure right after a recovery is logged, not posted, and gets no "återställt"', async () => {
  const { a, posts, logs, step } = rig();
  a.fail('worker_nere', 'dragge', 'gone'); step(5000); a.ok('worker_nere', 'dragge');
  step(5000); assert.equal(a.fail('worker_nere', 'dragge', 'gone again'), false); step(5000); a.ok('worker_nere', 'dragge');
  step(10 * 60_000); assert.equal(a.fail('worker_nere', 'dragge', 'gone later'), true);
  await new Promise(r => setImmediate(r));
  assert.deepEqual(posts.map(p => p.body.status ?? p.body.fel), ['gone', 'återställt', 'gone later']);
  assert.equal(logs.filter(l => /gone again/.test(l)).length, 1, 'still in the log');
});
