import test from 'node:test';
import assert from 'node:assert/strict';
import { createAstridWakeWord } from '../web/public/astrid-wake-word.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const navigatorRestores = new WeakSet();

function harness(t, { availability = async () => 'available', install = async () => true, local = true,
  autoStart = true, canWake = () => true, gesture = false, onWake } = {}) {
  if (!navigatorRestores.has(t)) {
    const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    t.after(() => { if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator); else delete globalThis.navigator; });
    navigatorRestores.add(t);
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userActivation: { isActive: gesture } } });
  const instances = [], checks = [], installs = [], statuses = [], errors = [], wakes = [];
  class Recognition {
    constructor() { if (local) this.processLocally = false; this.starts = 0; this.aborts = 0; instances.push(this); }
    static available(options) { checks.push(options); return availability(options); }
    static install(options) { installs.push(options); return install(options); }
    start() { assert.equal(this.processLocally, true, 'Every actual start must explicitly be local.'); this.starts++; if (autoStart) this.onstart?.(); }
    abort() { this.aborts++; this.onend?.(); }
    result(transcripts, resultIndex = 0) { this.onresult?.({ resultIndex, results: transcripts.map(transcript => [{ transcript }]) }); }
    end() { this.onend?.(); }
    error(error) { this.onerror?.({ error }); }
  }
  const control = createAstridWakeWord({ RecognitionClass: Recognition, canWake,
    onStatus: value => statuses.push(value), onError: value => errors.push(value),
    onWake: () => { assert.equal(control.active, false); assert.ok(instances.at(-1).aborts); wakes.push(true); return onWake?.(); },
  });
  t.after(() => control.stop());
  return { control, Recognition, instances, checks, installs, statuses, errors, wakes };
}

test('unsupported and remote-only recognizers never start or silently use a cloud fallback', async t => {
  const errors = [];
  const unsupported = createAstridWakeWord({ RecognitionClass: null, onError: error => errors.push(error) });
  assert.equal(await unsupported.start(), false); assert.equal(unsupported.active, false);
  assert.equal(errors[0].code, 'unsupported');
  const h = harness(t, { local: false });
  assert.equal(await h.control.start(), false);
  assert.equal(h.instances[0].starts, 0); assert.equal(h.checks.length, 0);
  assert.equal(h.errors[0].code, 'unsupported');
  delete h.Recognition.install;
  assert.equal(await h.control.start(), false);
  assert.equal(h.instances.length, 1, 'Missing static local-pack APIs fail before construction.');
});

test('working status and active wait for actual recognition start; only local availability is requested', async t => {
  const h = harness(t, { autoStart: false });
  const ready = h.control.start();
  await tick();
  assert.equal(h.control.active, false);
  assert.deepEqual(h.statuses.map(row => row.state), ['checking', 'starting']);
  assert.deepEqual(h.checks, [{ langs: ['en-US'], processLocally: true }]);
  const instance = h.instances[0];
  assert.equal(instance.continuous, true); assert.equal(instance.interimResults, true); assert.equal(instance.lang, 'en-US');
  instance.onstart();
  assert.equal(await ready, true); assert.equal(h.control.active, true);
  assert.equal(h.statuses.at(-1).state, 'listening');
  assert.equal(await h.control.start(), true); assert.equal(h.instances.length, 1);
});

test('wake requires the complete word, aborts first and dispatches once despite late events', async t => {
  const h = harness(t);
  await h.control.start();
  const instance = h.instances[0], lateResult = instance.onresult, lateEnd = instance.onend;
  for (const value of ['astride', 'Astrids', 'myAstrid', 'ÅAstrid', 'Astrid2', 'Astrid_', 'Astrid\u0301']) instance.result([value]);
  assert.equal(h.wakes.length, 0);
  instance.result(['Hej, ASTRID!']);
  assert.equal(h.wakes.length, 1); assert.equal(h.control.active, false);
  lateResult({ resultIndex: 0, results: [[{ transcript: 'Astrid' }]] }); lateEnd();
  assert.equal(h.wakes.length, 1); assert.equal(h.instances.length, 1);
  assert.equal(h.statuses.at(-1).state, 'wake');
  assert.equal(JSON.stringify(h.statuses).includes('Hej,'), false, 'Callbacks never receive recognition transcripts.');
});

test('busy speech cannot wake later when its interim result becomes final', async t => {
  let allowed = true;
  const h = harness(t, { canWake: () => allowed });
  await h.control.start();
  const instance = h.instances[0];
  allowed = false; instance.result(['Astrid']);
  allowed = true; instance.result(['Astrid']);
  assert.equal(h.wakes.length, 0);
  instance.result(['Astrid', 'Hey Astrid'], 1);
  assert.equal(h.wakes.length, 1);
});

test('mic preparation and busy playback do not leave a wanted listener silently stopped', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ready = false;
  const h = harness(t, { canWake: () => ready });
  assert.equal(await h.control.start(), true);
  h.instances[0].result(['Astrid']); assert.equal(h.wakes.length, 0);
  h.instances[0].end(); t.mock.timers.tick(300);
  assert.equal(h.control.active, true);
  h.instances[1].result(['Astrid']); assert.equal(h.wakes.length, 0);
  ready = true;
  h.instances[1].result(['Astrid', 'Astrid'], 1);
  assert.equal(h.wakes.length, 1);
});

test('stop during availability ignores late resolutions and settles pending start immediately', async t => {
  const available = deferred();
  const h = harness(t, { availability: () => available.promise });
  const ready = h.control.start();
  h.control.stop();
  assert.equal(await ready, false);
  available.resolve('available'); await tick();
  assert.equal(h.instances[0].starts, 0); assert.equal(h.wakes.length, 0); assert.equal(h.errors.length, 0);
  assert.equal(h.statuses.at(-1).state, 'stopped');
});

test('a cancelled start cannot affect a later successfully started recognizer', async t => {
  const first = deferred(); let checks = 0;
  const h = harness(t, { availability: () => ++checks === 1 ? first.promise : Promise.resolve('available') });
  const old = h.control.start(); h.control.stop();
  assert.equal(await old, false); assert.equal(await h.control.start(), true);
  first.resolve('available'); await tick();
  assert.equal(h.instances[0].starts, 0); assert.equal(h.instances[1].starts, 1);
  assert.equal(h.control.active, true); assert.equal(h.errors.length, 0);
});

test('a downloadable pack requires a user gesture and is verified again after installation', async t => {
  const absent = harness(t, { availability: async () => 'downloadable' });
  assert.equal(await absent.control.start(), false); assert.equal(absent.installs.length, 0);
  assert.equal(absent.errors[0].code, 'gesture-required');
  let checked = 0;
  const allowed = harness(t, { gesture: true, availability: async () => ++checked === 1 ? 'downloadable' : 'available' });
  assert.equal(await allowed.control.start(), true);
  assert.deepEqual(allowed.installs, [{ langs: ['en-US'], processLocally: true }]);
  assert.equal(allowed.checks.length, 2);
  assert.ok(allowed.statuses.some(row => row.state === 'installing' && row.active === false));
});

test('install failure and unavailable local language never start recognition', async t => {
  for (const [availability, install, code] of [
    [async () => 'downloadable', async () => false, 'install-failed'],
    [async () => 'downloadable', async () => { throw new Error('failed'); }, 'install-failed'],
    [async () => 'unavailable', async () => true, 'local-unavailable'],
    [async () => 'downloading', async () => true, 'language-downloading'],
    [async () => { throw new Error('policy denied'); }, async () => true, 'availability-failed'],
  ]) {
    const h = harness(t, { availability, install, gesture: true });
    assert.equal(await h.control.start(), false); assert.equal(h.control.active, false);
    assert.equal(h.instances[0].starts, 0); assert.equal(h.errors[0].code, code);
  }
});

test('stop during install and a stale microphone grant cannot restart a stopped recognizer', async t => {
  const install = deferred();
  const h = harness(t, { gesture: true, availability: async () => 'downloadable', install: () => install.promise });
  const ready = h.control.start(); await tick();
  h.control.stop(); assert.equal(await ready, false);
  install.resolve(true); await tick();
  assert.equal(h.instances[0].starts, 0); assert.equal(h.checks.length, 1); assert.equal(h.errors.length, 0);
  const waiting = harness(t, { autoStart: false });
  const start = waiting.control.start(); await tick();
  const instance = waiting.instances[0], lateStart = instance.onstart;
  waiting.control.stop(); assert.equal(await start, false);
  const previousAborts = instance.aborts;
  lateStart();
  assert.ok(instance.aborts > previousAborts); assert.equal(waiting.control.active, false);
});

test('normal ends rearm locally within a bounded budget; errors never rearm', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(t);
  await h.control.start();
  for (let i = 0; i < 3; i++) {
    h.instances.at(-1).end();
    assert.equal(h.control.active, false);
    const duplicate = h.control.start();
    t.mock.timers.tick(300);
    assert.equal(await duplicate, true);
    assert.equal(h.control.active, true);
  }
  h.instances.at(-1).end();
  assert.equal(h.errors.length, 1); assert.equal(h.errors[0].code, 'restart-limit');
  t.mock.timers.tick(60000); assert.equal(h.instances.length, 4);
  assert.equal(await h.control.start(), true);
  const current = h.instances.at(-1), lateEnd = current.onend;
  current.error('not-allowed'); lateEnd(); t.mock.timers.tick(60000);
  assert.equal(h.instances.length, 5); assert.equal(h.errors.at(-1).code, 'not-allowed');
});

test('stopping a scheduled rearm cancels it and a missing onstart times out once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(t);
  await h.control.start(); h.instances[0].end(); h.control.stop();
  t.mock.timers.tick(1000); assert.equal(h.instances.length, 1);
  const waiting = harness(t, { autoStart: false });
  const ready = waiting.control.start(); await tick();
  t.mock.timers.tick(10000);
  assert.equal(await ready, false); assert.equal(waiting.errors[0].code, 'start-timeout');
  assert.equal(waiting.control.active, false);
});
