import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { webcrypto } from 'node:crypto';
import { createSeedProject } from '../lib/studio-model.mjs';
import { createPartnerTrace, appendPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';
import { acceptNativeObservation } from '../lib/native-observation.mjs';
import { SPEECH_POSE_STAGES } from '../../web/public/speech-pose-gate.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const source = readFileSync(new URL('../components/game-stream.tsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { filename: 'game-stream.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
const Stage = () => null, Sequence = () => null, Reference = () => null, Idle = () => null, Chat = () => null, Reactions = () => null;
const record = (events, version = 1, requestId = `command.${version}`) => ({ id: `observation:${version}`, source: 'partner', time: '2026-09-21T12:00:00Z', data: { type: 'round', requestId, version, events } });
const tick = () => new Promise(resolve => setImmediate(resolve));
const outcome = promise => promise.then(() => ({ completed: true }), error => ({ error }));

// This harness commits state/effects and invokes real GameStream handlers. Media
// and the network remain explicit deferred boundaries; no live commands or media.
function setup(records = [record([{ type: 'idle' }, { type: 'speak', line: 'goodluck' }])]) {
  const hooks = []; let cursor = 0, dirty = false, tree; const effects = [], requests = [], activity = [];
  let clock = 0;
  const documentListeners = new Map(), document = { hidden: false, addEventListener: (key, fn) => documentListeners.set(key, fn), removeEventListener: key => documentListeners.delete(key) };
  const project = createSeedProject();
  let props = { trace: { records, bytes: 0, limited: false }, project, videos: { videos: [] }, dealerId: 'astrid', active: true, onActivity: entry => activity.push(entry), onOpenEvent() {} };
  const same = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const react = { ...React,
    useState(initial) { const index = cursor++; hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [hooks[index].value, value => { const next = typeof value === 'function' ? value(hooks[index].value) : value; if (!Object.is(next, hooks[index].value)) { hooks[index].value = next; dirty = true; } }]; },
    useRef(initial) { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
    useMemo(factory, deps) { const index = cursor++; if (!hooks[index] || !same(hooks[index].deps, deps)) hooks[index] = { deps, value: factory() }; return hooks[index].value; },
    useCallback(callback, deps) { const index = cursor++; if (!hooks[index] || !same(hooks[index].deps, deps)) hooks[index] = { deps, value: callback }; return hooks[index].value; },
    useContext() { return { binding: null, connected: false }; },
    useEffect(effect, deps) { const index = cursor++; if (!hooks[index] || !same(hooks[index].deps, deps)) { const previous = hooks[index]; hooks[index] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); hooks[index].cleanup = effect(); }); } },
  };
  const mocks = {
    '../lib/presentation-sequence.mjs': require('../lib/presentation-sequence.mjs'),
    '../lib/video-intake.mjs': require('../lib/video-intake.mjs'),
    './test-context': { neutralContext: {} },
    './studio-types': { requestJson: (url, init) => new Promise((resolve, reject) => {
      const body = JSON.parse(init.body); const entry = { url, body, signal: init.signal, resolve, reject }; requests.push(entry);
      init.signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
    }) },
    './stage': { Stage }, './presentation-sequence': { PresentationSequence: Sequence }, './reference-capture': { ReferenceCapture: Reference }, './presentation-frame': { PresentationFrame: () => null },
    './lab-idle-surface': { LabIdleSurface: Idle }, './native-lab-chat': { NativeLabChat: Chat },
    './idle-reactions': { IdleReactions: Reactions },
    './native-speech-context': { NativeSpeechContext: {} },
    '../lib/live-idle.mjs': { ...require('../lib/live-idle.mjs'), createLiveIdleController: options => require('../lib/live-idle.mjs').createLiveIdleController({ ...options, now: () => clock }) },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, AbortController, Error, Promise, document, crypto: webcrypto,
    require: name => name === 'react' ? react : name.endsWith('.module.css') ? { __esModule: true, default: {} } : mocks[name] ?? require(name) });
  function flush() {
    for (let count = 0; count < 20; count++) {
      dirty = false; cursor = 0; tree = module.exports.GameStream(props);
      for (const effect of effects.splice(0)) effect();
      if (!dirty) return;
    }
    throw new Error('Render did not settle');
  }
  function nodes(node, found = []) { if (Array.isArray(node)) node.forEach(child => nodes(child, found)); else if (node?.props) { found.push(node); nodes(node.props.children, found); } return found; }
  const find = type => nodes(tree).find(node => node.type === type)?.props;
  function button(label) { return nodes(tree).find(node => node.type === 'button' && node.props.children === label)?.props; }
  function update(next) { props = { ...props, ...next }; flush(); }
  function append(next) { update({ trace: { ...props.trace, records: [...props.trace.records, next] } }); }
  function resolve(index = requests.length - 1) {
    const request = requests[index]; const line = project.lines.find(line => line.dealerId === 'astrid' && line.eventId === request.body.eventId);
    const variant = line.variants.find(variant => variant.id === line.baselineVariantId);
    request.resolve({ variant, asset: project.assets.find(asset => asset.id === variant.assetId), videoGenerationId: null,
      decision: { sourceEvent: request.body.sourceEvent, simulated: false } });
  }
  function play(index = 0) { const seq = find(Sequence); const controller = new AbortController(); const result = outcome(seq.onPlay(seq.sequence.steps[index], { signal: controller.signal, mode: 'replay' })); flush(); return { result, controller }; }
  flush(); return { flush, find, button, update, append, resolve, play, requests, activity, project,
    mode(value) { find('select').onChange({ target: { value } }); flush(); },
    advance(ms) { clock += ms; }, hide(value = true) { document.hidden = value; documentListeners.get('visibilitychange')?.(); flush(); },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); } };
}

test('replay from the original view waits for the matching player completion and preserves exact source data', async () => {
  const ui = setup(); assert.equal(ui.requests.length, 0);
  const run = ui.play(1); assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, '/api/presentation/decision');
  assert.equal(ui.requests[0].body.sourceRef.requestId, 'command.1');
  assert.equal(ui.requests[0].body.sourceRef.presentationIndex, 1);
  assert.match(ui.requests[0].body.requestId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(ui.requests[0].body.sourceEvent, { type: 'speak', line: 'goodluck' });
  ui.resolve(); await tick(); ui.flush();
  assert.equal(ui.find(Stage).playing, true);
  let complete = false; run.result.then(() => { complete = true; }); await tick(); assert.equal(complete, false);
  ui.find(Stage).onPlaybackEvent({ phase: 'started', medium: '2d' }); await tick(); assert.equal(complete, false);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' });
  assert.deepEqual(await run.result, { completed: true }); ui.flush(); assert.equal(ui.find(Stage).playing, false);
});

test('missing registered video fails replay without completing the instruction as 2D', async () => {
  const ui = setup();
  const run = ui.play(1); ui.resolve(); await tick(); ui.flush();
  const stage = ui.find(Stage);
  assert.equal(stage.videoUrl, undefined);
  assert.equal(stage.allow2dFallback, false);
  stage.onPlaybackEvent({ playId: stage.playId, phase: 'failed', medium: 'video', reason: 'Ingen spelbar video för den exakta situationen.' });
  const result = await run.result; ui.flush();
  assert.match(result.error.message, /Ingen spelbar video/);
  assert.equal(result.completed, undefined);
  assert.equal(ui.find(Stage).playing, false);
  assert.equal(ui.activity.some(entry => entry.stage === 'playback' && entry.status === 'completed'), false);
  ui.unmount();
});

test('cancelled model requests cannot start playback after a late response', async () => {
  const ui = setup(); const run = ui.play();
  run.controller.abort(); ui.resolve(); await tick(); ui.flush();
  assert.equal(ui.requests[0].signal.aborted, true);
  assert.ok((await run.result).error);
  assert.equal(ui.find(Stage).playing, false);
  assert.equal(ui.find(Stage).busy, false);
  assert.equal(ui.activity.filter(entry => entry.stage === 'decision').length, 0);
});

test('an old player receipt cannot complete or stop a later playback generation', async () => {
  const ui = setup(); const first = ui.play(); ui.resolve(); await tick(); ui.flush();
  const oldReceipt = ui.find(Stage).onPlaybackEvent;
  const second = ui.play(1); ui.resolve(); await tick(); ui.flush();
  assert.ok((await first.result).error);
  let completed = false; second.result.then(() => { completed = true; });
  oldReceipt({ phase: 'completed', medium: '2d' }); await tick(); ui.flush();
  assert.equal(completed, false); assert.equal(ui.find(Stage).playing, true);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' });
  assert.deepEqual(await second.result, { completed: true });
});

test('a conflicting receipt stops active playback and old selected objects cannot bypass the conflict', async () => {
  const ui = setup([record([{ type: 'idle' }])]); const stale = ui.find(Sequence).sequence.steps[0];
  const run = ui.play(); ui.resolve(); await tick(); ui.flush();
  ui.append(record([{ type: 'speak', line: 'double' }])); await tick(); ui.flush();
  assert.ok((await run.result).error); assert.equal(ui.find(Stage).playing, false);
  assert.equal(ui.find(Sequence).sequence.steps[0].blocked, true);
  const attempt = outcome(ui.find(Sequence).onPlay(stale, { signal: new AbortController().signal, mode: 'replay' }));
  assert.ok((await attempt).error); assert.equal(ui.requests.length, 1);
});

test('navigation during playback rejects the queue wait and late completion is ignored', async () => {
  const ui = setup(); const run = ui.play(); ui.resolve(); await tick(); ui.flush();
  const receipt = ui.find(Stage).onPlaybackEvent; const count = ui.activity.length;
  ui.update({ active: false }); await tick();
  assert.ok((await run.result).error);
  receipt({ phase: 'completed', medium: '2d' }); ui.flush();
  assert.equal(ui.find(Stage).playing, false); assert.equal(ui.activity.length, count);
});

test('live follow ignores past instructions and drains new instructions only after each actual completion', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.button('Följ nya instruktioner').onClick(); ui.flush(); assert.equal(ui.requests.length, 0);
  ui.append(record([{ type: 'speak', line: 'goodluck' }, { type: 'idle' }], 2)); assert.equal(ui.requests.length, 1);
  ui.resolve(); await tick(); ui.flush(); assert.equal(ui.requests.length, 1);
  ui.append(record([{ type: 'speak', line: 'double' }], 3)); assert.equal(ui.requests.length, 1);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush(); assert.equal(ui.requests.length, 2);
  ui.resolve(); await tick(); ui.flush(); ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush(); assert.equal(ui.requests.length, 3);
  ui.resolve(); await tick(); ui.flush(); ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush();
  assert.deepEqual(ui.requests.map(request => request.body.sourceEvent), [{ type: 'speak', line: 'goodluck' }, { type: 'idle' }, { type: 'speak', line: 'double' }]);
  ui.button('Pausa labbet').onClick(); ui.flush();
});

test('new connection gaps stop live follow instead of replaying a partial continuation', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.button('Följ nya instruktioner').onClick(); ui.flush();
  ui.append(record([{ type: 'speak', line: 'double' }, { type: 'idle' }], 2));
  ui.resolve(); await tick(); ui.flush();
  ui.append({ kind: 'status', data: { state: 'disconnected', gap: true, reason: 'transport-error' } }); await tick(); ui.flush();
  assert.ok(ui.button('Följ nya instruktioner')); assert.equal(ui.find(Stage).playing, false); assert.equal(ui.requests.length, 1);
});

test('model failure releases busy state and stops follow without playing a later event', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.button('Följ nya instruktioner').onClick(); ui.flush();
  ui.append(record([{ type: 'speak', line: 'goodluck' }, { type: 'idle' }], 2));
  ui.requests[0].reject(new Error('Model request failed')); await tick(); ui.flush();
  assert.ok(ui.button('Följ nya instruktioner')); assert.equal(ui.find(Stage).busy, false); assert.equal(ui.find(Stage).playing, false);
  assert.equal(ui.requests.length, 1);
});

test('unmount aborts outstanding work and a stopped prior signal cannot cancel a newer run', async () => {
  const ui = setup(); const first = ui.play(); ui.resolve(); await tick(); ui.flush();
  const second = ui.play(1); ui.resolve(); await tick(); ui.flush();
  assert.ok((await first.result).error);
  first.controller.abort(); ui.flush(); assert.equal(ui.find(Stage).playing, true);
  ui.unmount(); assert.ok((await second.result).error); assert.equal(ui.requests[1].signal.aborted, true);
});

test('connection arms follow automatically, keeps original visible and does not replay earlier rounds', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.update({ autoFollow: true, followFromRecord: 1 });
  assert.ok(ui.find(Reference)); assert.ok(ui.button('Pausa labbet'));
  assert.equal(ui.requests.length, 0);
  ui.append(record([{ type: 'speak', line: 'goodluck' }], 2));
  assert.equal(ui.requests.length, 1);
  ui.resolve(); await tick(); ui.flush();
  assert.ok(ui.find(Reference)); assert.equal(ui.find(Stage).playing, true);
  ui.update({ autoFollow: false }); await tick(); ui.flush();
  assert.equal(ui.find(Stage).playing, false);
});

test('first round arriving in the same render as connected is not dropped', async () => {
  const ui = setup([]);
  ui.update({ autoFollow: true, followFromRecord: 0, trace: { records: [record([{ type: 'idle' }])], bytes: 0, limited: false } });
  assert.equal(ui.requests.length, 1);
  ui.unmount(); await tick();
});

test('the selected physical idle base runs before events and only its presented frame unlocks linked chat', async () => {
  const ui = setup([]), baseId = '11111111-1111-4111-8111-111111111111', familyId = 'astrid/idle.ready/ready';
  ui.project.idlePolicy = { schemaVersion: 1, familyId, base: [{ videoId: baseId, weight: 100, durationMs: 1000 }], variants: [] };
  ui.update({ autoFollow: true, followFromRecord: 0, videos: {
    families: [{ id: familyId, dealerId: 'astrid', playbackType: 'idle-pool', standardIds: [baseId], variantIds: [] }],
    videos: [{ id: baseId, familyId, role: 'standard', available: true, previewUrl: '/api/videos/base' }],
  } });
  assert.equal(ui.find(Idle).url, '/api/videos/base'); assert.equal(ui.find(Chat).idleReady, false);
  assert.equal(ui.requests.length, 0); assert.equal(ui.find(Sequence).sequence.steps.length, 0);
  ui.find(Idle).onReceipt({ phase: 'presented', videoId: baseId, kind: 'base' }); ui.flush(); assert.equal(ui.find(Chat).idleReady, true);
  ui.append(record([{ type: 'speak', line: 'goodluck' }]));
  assert.equal(ui.find(Chat).actionBusy, true); assert.equal(ui.find(Chat).idleReady, false);
  ui.resolve(); await tick(); ui.flush(); assert.equal(ui.find(Idle), undefined);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush();
  assert.ok(ui.find(Idle)); assert.equal(ui.find(Chat).idleReady, false);
  ui.find(Idle).onReceipt({ phase: 'presented', videoId: baseId, kind: 'base' }); ui.flush(); assert.equal(ui.find(Chat).idleReady, true);
  ui.find(Chat).onStatusChange({ state: 'held', pending: true }); ui.flush(); assert.equal(ui.find(Chat).idleReady, false);
  ui.find(Chat).onSettled(); ui.flush(); assert.equal(ui.find(Chat).idleReady, false);
  assert.equal(ui.requests.length, 1); ui.unmount(); await tick();
});

test('a missing base, another family or a folder variant never provides an idle speech proof', () => {
  for (const patch of [{ available: false }, { familyId: 'astrid/speak.goodluck/goodluck' }, { role: 'variant' }]) {
    const ui = setup([]), familyId = 'astrid/idle.ready/ready';
    const baseId = '11111111-1111-4111-8111-111111111111';
    ui.project.idlePolicy = { schemaVersion: 1, familyId, base: [{ videoId: baseId, weight: 100, durationMs: 1000 }], variants: [] };
    ui.update({ videos: { families: [{ id: familyId, dealerId: 'astrid', playbackType: 'idle-pool', standardIds: [baseId], variantIds: [] }],
      videos: [{ id: baseId, familyId, role: 'standard', available: true, previewUrl: '/base', ...patch }] } });
    assert.equal(ui.find(Idle), undefined); assert.equal(ui.find(Chat).idleReady, false); ui.unmount();
  }
});

function scheduledIdleUi() {
  const ui = setup([]), base = '11111111-1111-4111-8111-111111111111', blink = '22222222-2222-4222-8222-222222222222';
  const familyId = 'astrid/idle.ready/ready';
  ui.project.idlePolicy = { schemaVersion: 1, familyId, base: [{ videoId: base, weight: 100, durationMs: 1000 }],
    variants: [{ videoId: blink, durationMs: 1000, use: 'automatic', automatic: { averageEveryMs: 5000, jitterMs: 0, cooldownMs: 30000, maxPerMinute: 2 } }] };
  const videos = { families: [{ id: familyId, dealerId: 'astrid', playbackType: 'idle-pool', standardIds: [base], variantIds: [blink] }],
    videos: [{ id: base, familyId, role: 'standard', available: true, previewUrl: '/base' }, { id: blink, familyId, role: 'variant', available: true, previewUrl: '/blink' }] };
  ui.update({ autoFollow: true, followFromRecord: 0, videos });
  const emit = (phase, surface = ui.find(Idle)) => { surface.onReceipt({ phase, kind: surface.kind, videoId: surface.videoId }); ui.flush(); };
  return { ui, base, blink, videos, emit };
}

test('automatic idle follows saved policy while generating; ready speech replaces variants and needs a fresh primary frame', () => {
  const { ui, base, blink, emit } = scheduledIdleUi();
  emit('presented'); const oldBase = ui.find(Idle);
  ui.find(Chat).onStatusChange({ state: 'preparing', pending: true }); ui.flush();
  assert.equal(ui.find(Idle).videoId, base); assert.equal(ui.find(Idle).repeat, false);
  ui.advance(5000); emit('completed'); assert.equal(ui.find(Idle).videoId, blink);
  const variant = ui.find(Idle); emit('presented');
  variant.onReady(true); ui.flush(); assert.equal(ui.find(Chat).idleReady, false);
  assert.equal(ui.requests.length, 0); assert.equal(ui.find(Sequence).sequence.steps.length, 0);
  ui.find(Chat).onStatusChange({ state: 'held', pending: true }); ui.flush();
  assert.equal(ui.find(Idle).videoId, base); assert.equal(ui.find(Idle).repeat, true); assert.equal(ui.find(Chat).idleReady, false);
  emit('presented', oldBase); emit('completed', variant); assert.equal(ui.find(Chat).idleReady, false);
  emit('presented'); assert.equal(ui.find(Chat).idleReady, true);
  ui.find(Chat).onStatusChange({ state: 'playing', pending: true }); ui.flush();
  assert.equal(ui.find(Idle), undefined); assert.equal(ui.find(Chat).idleReady, false);
  ui.find(Chat).onSettled(); ui.flush();
  assert.equal(ui.find(Idle).kind, 'base'); assert.equal(ui.find(Idle).repeat, false); assert.equal(ui.find(Chat).idleReady, false);
  assert.equal(ui.requests.length, 0); ui.unmount();
});

test('deal interrupts an idle variant immediately and does not erase its real-start cooldown', async () => {
  const { ui, base, blink, emit } = scheduledIdleUi();
  emit('started'); ui.advance(5000); emit('completed'); assert.equal(ui.find(Idle).videoId, blink);
  emit('started'); const oldVariant = ui.find(Idle);
  ui.append(record([{ type: 'speak', line: 'goodluck' }], 1));
  assert.equal(ui.find(Idle), undefined); assert.equal(ui.find(Chat).actionBusy, true); assert.equal(ui.requests.length, 1);
  emit('completed', oldVariant); assert.equal(ui.requests.length, 1);
  ui.advance(1000); ui.resolve(); await tick(); ui.flush();
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush();
  assert.equal(ui.find(Idle).videoId, base); emit('started'); ui.advance(5000); emit('completed');
  assert.equal(ui.find(Idle).videoId, base, 'blink cooldown survives a short deal and new table version');
  assert.equal(ui.find(Sequence).sequence.steps.length, 1);
  ui.update({ observationRevision: 1 }); emit('started'); ui.advance(5000); emit('completed');
  assert.equal(ui.find(Idle).videoId, blink, 'explicit new observation resets the idle identity');
  ui.unmount(); await tick();
});

test('hidden views stop idle media and returning never accepts a stale frame or catches up missed blinks', () => {
  const { ui, base, emit } = scheduledIdleUi(); emit('presented'); const stale = ui.find(Idle);
  ui.hide(); assert.equal(ui.find(Idle), undefined); assert.equal(ui.find(Chat).idleReady, false);
  ui.advance(60000); ui.hide(false); assert.equal(ui.find(Idle).videoId, base);
  emit('presented', stale); assert.equal(ui.find(Chat).idleReady, false);
  emit('presented'); assert.equal(ui.find(Chat).idleReady, true);
  emit('completed'); assert.equal(ui.find(Idle).kind, 'base'); ui.unmount();
});

function aiIdleUi() {
  const fixture = scheduledIdleUi(), { ui, videos } = fixture;
  const reaction = '33333333-3333-4333-8333-333333333333';
  ui.project.idlePolicy = { ...ui.project.idlePolicy, variants: [...ui.project.idlePolicy.variants,
    { videoId: reaction, durationMs: 1000, use: 'openclaw', automatic: null }] };
  const inventory = { ...videos, families: videos.families.map(item => ({ ...item, variantIds: [...item.variantIds, reaction] })),
    videos: [...videos.videos, { id: reaction, familyId: ui.project.idlePolicy.familyId, role: 'variant', available: true, previewUrl: '/reaction' }] };
  ui.update({ videos: inventory });
  ui.append({ source: 'native', kind: 'state', data: { view: { version: 0, round: null }, version: 0 } });
  ui.mode('active');
  return { ...fixture, reaction };
}

test('switching to Standard or pausing revokes an accepted pending AI offer and rejects late offers without stopping the base', () => {
  for (const stop of [ui => ui.mode('off'), ui => { ui.button('Pausa labbet').onClick(); ui.flush(); }]) {
    const { ui, reaction, base, emit } = aiIdleUi(); emit('started');
    const offer = ui.find(Reactions).onOffer, stillPlayingBase = ui.find(Idle);
    assert.equal(offer({ videoId: reaction, requestId: 'advice.1', expiresAt: 10000 }), true);
    stop(ui);
    assert.equal(offer({ videoId: reaction, requestId: 'advice.late', expiresAt: 10000 }), false);
    emit('presented', stillPlayingBase); assert.equal(ui.find(Chat).idleReady, true, 'ordinary base was not replaced');
    ui.advance(1000); emit('completed'); assert.equal(ui.find(Idle).videoId, base);
    assert.equal(ui.find(Idle).kind, 'base'); assert.equal(ui.requests.length, 0); ui.unmount();
  }
});

test('stop also revokes an AI clip selected for loading, while real-start AI quota survives pause/resume', () => {
  for (const started of [false, true]) {
    const { ui, reaction, base, emit } = aiIdleUi(); emit('started');
    assert.equal(ui.find(Reactions).onOffer({ videoId: reaction, requestId: 'advice.1', expiresAt: 10000 }), true);
    emit('completed'); const selected = ui.find(Idle); assert.equal(selected.videoId, reaction);
    if (started) emit('started');
    ui.button('Pausa labbet').onClick(); ui.flush(); assert.equal(ui.find(Idle).videoId, base);
    emit('started', selected); emit('completed', selected); assert.equal(ui.find(Idle).videoId, base);
    ui.button('Följ nya instruktioner').onClick(); ui.flush();
    assert.equal(ui.find(Reactions).onOffer({ videoId: reaction, requestId: 'advice.2', expiresAt: 10000 }), !started,
      'only the actual start spends quota; changing follow state must not reset it');
    ui.unmount();
  }
});

test('changing mode or follow state never resets automatic idle cooldown', () => {
  const { ui, blink, base, reaction, emit } = aiIdleUi(); emit('started'); ui.advance(5000); emit('completed');
  assert.equal(ui.find(Idle).videoId, blink); emit('started'); emit('completed');
  assert.equal(ui.find(Reactions).onOffer({ videoId: reaction, requestId: 'advice.1', expiresAt: 15000 }), true);
  ui.mode('off'); emit('started'); ui.advance(5000); emit('completed');
  assert.equal(ui.find(Idle).videoId, base, 'automatic cooldown is preserved after switching to Standard');
  ui.button('Pausa labbet').onClick(); ui.flush(); emit('started'); ui.advance(5000); emit('completed');
  assert.equal(ui.find(Idle).videoId, base, 'automatic cooldown is preserved after pausing'); ui.unmount();
});

test('native pose diagnostics neither pause auto-follow nor complete a pending presentation', async () => {
  const ui = setup([]);
  ui.update({ autoFollow: true, followFromRecord: 0 });
  const popup = {}, expected = { source: popup, origin: 'http://localhost:4198', channel: 'pose-fixture', lastSequence: 0 };
  const receive = (kind, payload) => {
    const entry = acceptNativeObservation({ source: popup, origin: expected.origin,
      data: { type: 'croupier-native-observation', version: 1, channel: expected.channel,
        sequence: expected.lastSequence + 1, at: '2026-09-25T12:00:00Z', kind, payload } }, expected);
    assert.ok(entry); expected.lastSequence = entry.nativeSequence; ui.append(entry);
  };
  receive('status', { state: 'attached' });
  for (const stage of SPEECH_POSE_STAGES) receive('status', { state: 'chat-pose', jobId: 'chat.1', stage, at: 1234 });
  receive('command', { requestId: 'state.0', op: 'state', view: { version: 0, round: null }, presentation: [] });
  assert.ok(ui.button('Pausa labbet'));
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.find(Sequence).sequence.steps.length, 0);
  receive('command', { requestId: 'start.1', op: 'start', view: { version: 1, round: null },
    presentation: [{ type: 'speak', line: 'goodluck' }, { type: 'idle' }] });
  assert.equal(ui.requests.length, 1);
  ui.resolve(); await tick(); ui.flush();
  receive('status', { state: 'chat-pose', jobId: 'chat.2', stage: 'speech-completed', at: 1235 });
  await tick(); ui.flush();
  assert.ok(ui.button('Pausa labbet'));
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.find(Stage).playing, true);
  assert.equal(ui.find(Sequence).sequence.steps.length, 2);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' });
  await tick(); ui.flush();
  assert.equal(ui.requests.length, 2);
  ui.unmount(); await tick();
});

test('returning to the activity view never replays the entire connected session', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.update({ autoFollow: true, followFromRecord: 1 });
  ui.update({ active: false });
  ui.append(record([{ type: 'idle' }], 2));
  ui.update({ active: true });
  assert.equal(ui.requests.length, 0);
  ui.append(record([{ type: 'idle' }], 3)); assert.equal(ui.requests.length, 1);
  ui.unmount(); await tick();
});

test('observed settlement context is used without borrowing later outcomes or invented language', async () => {
  const settle = { type: 'settle', dealerTotal: 23, dealerBlackjack: false, hands: [{ box: 3, outcome: 'win' }] };
  const ui = setup([record([settle, { type: 'speak', line: 'win' }]), record([{ ...settle, hands: [{ box: 3, outcome: 'lose' }] }], 2)]);
  const run = ui.play(1);
  assert.deepEqual(ui.requests[0].body.context.session, { recentWins: 1, recentLosses: 0 });
  assert.equal(ui.requests[0].body.context.playerHistory.preferredLanguage, null);
  assert.equal(ui.requests[0].body.context.temperament, undefined);
  run.controller.abort(); await run.result;
});

test('new observation cancels the old queue, clears limits, ignores delayed old commands and follows future steps', async () => {
  const ui = setup([]);
  ui.update({ autoFollow: true, followFromRecord: 0 });
  const old = record([{ type: 'speak', line: 'goodluck' }, { type: 'idle' }], 1);
  ui.append(old); assert.equal(ui.requests.length, 1);
  const reset = restartPartnerTrace({ ...appendPartnerTrace(createPartnerTrace(), old), limited: true });
  ui.update({ trace: reset, observationRevision: 1, followFromRecord: 1 });
  await tick(); ui.flush();
  assert.equal(ui.requests[0].signal.aborted, true);
  assert.ok(ui.find(Reference)); assert.ok(ui.button('Pausa labbet'));
  ui.append(old); assert.equal(ui.requests.length, 1);
  ui.append(record([{ type: 'speak', line: 'double' }], 2)); assert.equal(ui.requests.length, 2);
  ui.resolve(); await tick(); ui.flush();
  assert.equal(ui.find(Stage).playing, true);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' });
  await tick(); ui.flush();
  assert.equal(ui.requests.length, 2);
});
