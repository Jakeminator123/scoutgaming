// Kevin 28 Oct: the maintenance banner follows RunPod (server/runpod-notice.mjs), not a hand-set flag
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlerts } from '../server/alerts.mjs';
import { createRunpodNotice, DEFAULT_TEXT } from '../server/runpod-notice.mjs';

const quiet = () => {};
const make = (over = {}) => {
  let t = 1_000_000; const now = () => t; const tick = ms => { t += ms; };
  const alerts = createAlerts({ url: undefined, log: quiet, now });
  const logs = [];
  const notice = createRunpodNotice({ alerts, env: {}, now, log: m => logs.push(m), pollMs: 0, ...over });
  return { alerts, notice, tick, logs };
};

test('nothing open: no banner, and the tracking says so once', () => {
  const { notice, logs } = make();
  assert.equal(notice.text(null), '');
  assert.equal(notice.text('paow'), '');
  notice.track(); notice.track();
  assert.deepEqual(logs, ['underhåll: meddelandet dolt (RunPod grönt)']);
});

test('a failed order (ENDPOINT_PAUSED) shows the banner for that dealer and for the lobby, not for another dealer; gone when it is ok again', () => {
  const { alerts, notice, logs } = make();
  alerts.fail('bestallning', 'paow', 'RunPod: {"status":409,"code":"ENDPOINT_PAUSED"}');
  assert.equal(notice.text('paow'), DEFAULT_TEXT);
  assert.equal(notice.text(null), DEFAULT_TEXT, 'the lobby shows any dealer\'s trouble');
  assert.equal(notice.text('dragge'), '', 'Dragan\'s table is not Paow\'s');
  const r = notice.state('paow').reasons;
  assert.equal(r.length, 1); assert.equal(r[0].typ, 'bestallning'); assert.equal(r[0].dealer, 'paow'); assert.match(r[0].fel, /ENDPOINT_PAUSED/);
  notice.track();
  assert.equal(logs.at(-1), 'underhåll: meddelandet visas (bestallning(paow))');
  alerts.ok('bestallning', 'paow');
  assert.equal(notice.text('paow'), '');
  notice.track();
  assert.equal(logs.at(-1), 'underhåll: meddelandet dolt igen (RunPod grönt)');
});

test('a callback error, a worker that never comes and a worker down all show it; a voice-only alert does not', () => {
  const { alerts, notice } = make();
  for (const typ of ['callback_fel', 'session_uteblir', 'worker_nere', 'worker_for_langsam']) {
    alerts.fail(typ, 'dragge', 'x');
    assert.equal(notice.text('dragge'), DEFAULT_TEXT, typ);
    alerts.ok(typ, 'dragge');
    assert.equal(notice.text('dragge'), '', `${typ} cleared`);
  }
  alerts.fail('chatt_utan_rost', 'dragge', 'svaret kom bara som text');
  assert.equal(notice.text('dragge'), '', 'the chat voice is not RunPod');
});

test('lines falling back to the still count only after the grace (a serverless worker takes a minute)', () => {
  const { alerts, notice, tick } = make({ orderGraceMs: 120_000 });
  alerts.fail('stillbild', 'paow', 'repliker faller tillbaka till stillbild');
  assert.equal(notice.text('paow'), '', 'just ordered: no banner yet');
  tick(119_000);
  assert.equal(notice.text('paow'), '');
  tick(2_000);
  assert.equal(notice.text('paow'), DEFAULT_TEXT, 'still no worker after 2 min');
});

test('no worker ready for the dealer at the table, ordered more than the grace ago: the banner, until a worker is ready', () => {
  let ready = false, asked = 30;
  const rorlig = { dealers: ['paow', 'dragge'], ready: () => ready, status: () => ({ paow: { asked }, dragge: { asked: null } }) };
  const { notice } = make({ rorlig: () => rorlig, rorligOn: () => true });
  assert.equal(notice.text('paow'), '', '30 s after the order: the worker may be on its way');
  asked = 130;
  assert.equal(notice.text('paow'), DEFAULT_TEXT);
  assert.equal(notice.state('paow').reasons[0].typ, 'ingen_worker');
  assert.equal(notice.text('dragge'), '', 'nobody ordered for Dragan');
  assert.equal(notice.text('astrid'), '', 'not a moving dealer');
  ready = true;
  assert.equal(notice.text('paow'), '');
});

test('a low RunPod balance shows it (as the alert lagt_saldo), a healthy one clears it; a failed query is noted, not shown', async () => {
  const answers = [];
  const fetchImpl = async () => { const a = answers.shift(); if (a instanceof Error) throw a; return { ok: true, json: async () => ({ data: { myself: { clientBalance: a } } }) }; };
  const { alerts, notice } = make({ apiKey: 'k', fetchImpl, env: { RUNPOD_LOW_BALANCE_USD: '10' } });
  answers.push(4.2);
  await notice.pollBalance();
  assert.equal(notice.text(null), DEFAULT_TEXT);
  assert.equal(notice.text('dragge'), DEFAULT_TEXT, 'the balance is everyone\'s');
  assert.deepEqual(alerts.open(), ['lagt_saldo:']);
  assert.match(notice.state(null).reasons[0].fel, /4\.20 \$ under 10 \$/);
  assert.equal(notice.state(null).balance.usd, 4.2);
  answers.push(197.5);
  await notice.pollBalance();
  assert.equal(notice.text(null), '');
  assert.deepEqual(alerts.open(), []);
  answers.push(new Error('fetch failed'));
  await notice.pollBalance();
  assert.equal(notice.text(null), '', 'an unreadable balance is not an outage');
  assert.equal(notice.state(null).balance.fel, 'fetch failed');
  assert.equal(notice.state(null).balance.usd, 197.5, 'the last read value stays');
});

test('MAINTENANCE_NOTICE=1 still forces the banner by hand, with MAINTENANCE_TEXT', () => {
  const { notice } = make({ env: { MAINTENANCE_NOTICE: '1', MAINTENANCE_TEXT: ' Back soon. ' } });
  assert.equal(notice.text('paow'), 'Back soon.');
  assert.equal(notice.state(null).reasons[0].typ, 'manuell');
});
