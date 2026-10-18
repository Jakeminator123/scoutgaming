import test from 'node:test';
import assert from 'node:assert/strict';
import { displayChatDecision, cancelChatDecision, playChatDecision } from '../services/game/public/chat-decision-player.mjs';

function provisionalRow(text = 'Good evening.') {
  const classes = new Set(['pending']);
  return { text, isConnected: true, removed: false,
    classList: { remove: name => classes.delete(name), contains: name => classes.has(name) },
    remove() { this.removed = true; this.isConnected = false; } };
}

function playbackFixture(dealerId = 'astrid', studioPreview = null) {
  const events = [], tts = [], videos = [], poses = [], statuses = [], captions = [], states = [], logs = [], pending = { controller: new AbortController() };
  const identity = { dealerId, sessionRevision: 1, roundRevision: 2 };
  const job = { ...identity, status: 'speaking' };
  const context = { studioPreview, dealer: { key: dealerId, name: dealerId === 'astrid' ? 'Astrid' : dealerId },
    pendingChatReplies: new Map([['reply-1', pending]]), chatHistory: [],
    chatPlaybackDiagnostic: {
      finish: (requestId, state) => { pending.diagnostic = { requestId, state }; },
      stream: (requestId, receipt) => { pending.diagnostic = { requestId, receipt }; },
    },
    localPresentation: { state: value => states.push(value) },
    updatePoseState: value => { poses.push(value); Object.assign(context.poseGate.state, value); }, speaking: false,
    playNeutralTts: async text => tts.push(text),
    playGeneratedSpeech: async media => videos.push(media),
    chatStatus: null, setChatStatus: text => statuses.push(text), showCaption: text => captions.push(text),
    nativeObservation: { emit: (type, data) => events.push({ type, ...data }) },
    chatLog: (role, text) => logs.push({ role, text }), localPresentationEnabled: true,
    hideCaption: () => { context.captionHidden = true; }, now: () => 123,
    poseGate: { state: { visible: true, muted: false, actionOwner: 'none' }, get: () => job },
    poseIdentity: () => identity, scene: {}, tableVersion: 4,
  };
  const play = (decision, signal = pending.controller.signal) => playChatDecision(context, decision, signal, 'reply-1');
  return { play, events, tts, videos, poses, statuses, captions, states, logs, pending, context, job, identity };
}

const generated = { kind: 'generatedText', exactText: 'Good evening.', requestId: 'reply-1' };
const streamDecision = () => ({ ...generated, visualMode: 'generated-lipsync-stream-preview', speechStream: { fixture: 'stream' } });

test('registered dealers without exact generated media remain text-only without borrowing a voice', async () => {
  for (const dealerId of ['astrid', 'vera', 'mei', 'paow', 'johanna', 'new-dealer']) {
    const f = playbackFixture(dealerId);
    await f.play(generated);
    assert.deepEqual(f.tts, []); assert.deepEqual(f.videos, []);
    assert.equal(f.pending.voiceUnavailable, true);
    assert.deepEqual(f.pending.diagnostic, { requestId: 'reply-1', state: 'text-only' });
    assert.equal(f.events.at(-1).reason, 'dealer-generated-media-unavailable');
    assert.equal(f.events.at(-1).renderer, 'text-only');
    assert.equal(f.context.speaking, false); assert.equal(f.poses.at(-1).speechOwner, 'none');
  }
});

test('an exact generated package or stream uses the shared media player for the selected dealer', async () => {
  for (const [visualMode, key] of [
    ['generated-lipsync-preview', 'speechPackage'], ['generated-lipsync-stream-preview', 'speechStream'],
  ]) {
    const f = playbackFixture(), media = { fixture: key };
    let options;
    f.context.playGeneratedSpeech = async (value, config) => { f.videos.push(value); options = config; };
    await f.play({ ...generated, visualMode, [key]: media });
    assert.equal(f.videos[0], media); assert.equal(options.dealerId, 'astrid');
    assert.equal(options.mount, f.context.scene); assert.deepEqual(f.tts, []);
    assert.equal(f.pending.voiceUnavailable, undefined);
  }
});

test('preparation does not show a spoken caption until the media player reports actual start', async () => {
  for (const [visualMode, key] of [
    ['generated-lipsync-preview', 'speechPackage'], ['generated-lipsync-stream-preview', 'speechStream'],
  ]) {
    const f = playbackFixture();
    let callbacks, finish;
    f.context.playGeneratedSpeech = (_media, options) => { callbacks = options; return new Promise(resolve => { finish = resolve; }); };
    const playing = f.play({ ...generated, visualMode, [key]: {} });
    await Promise.resolve();
    assert.equal(f.statuses.at(-1), 'Förbereder röst och läppsynk…');
    assert.deepEqual(f.captions, []); assert.equal(f.context.speaking, true);
    callbacks.onStart(generated.exactText);
    assert.equal(f.statuses.at(-1), 'Astrid svarar');
    assert.deepEqual(f.captions, [generated.exactText]);
    finish(); await playing;
    assert.equal(f.context.speaking, false); assert.equal(f.context.captionHidden, true);
  }
});

test('Studio preview refuses generated speech before any player, caption, status or pose effect', async () => {
  for (const dealerId of ['astrid', 'vera', 'amira', 'mei']) {
    for (const media of [{}, { visualMode: 'generated-lipsync-preview', speechPackage: {} }, streamDecision()]) {
      const f = playbackFixture(dealerId, { sessionId: 'preview-fixture' });
      await assert.rejects(f.play({ ...generated, ...media }), /Genererat tal är avstängt i provspel/);
      for (const effects of [f.tts, f.videos, f.poses, f.statuses, f.captions, f.events, f.states]) assert.deepEqual(effects, []);
      assert.equal(f.pending.voiceUnavailable, undefined); assert.equal(f.context.speaking, false);
    }
  }
});

test('silence produces no output and an unverified recorded response stays text-only', async () => {
  const quiet = playbackFixture();
  await quiet.play({ kind: 'silence' });
  for (const effects of [quiet.tts, quiet.videos, quiet.poses, quiet.captions, quiet.events, quiet.states]) assert.deepEqual(effects, []);
  const recorded = playbackFixture();
  await recorded.play({ kind: 'recorded', exactText: 'Different text.' });
  assert.deepEqual(recorded.videos, []); assert.deepEqual(recorded.tts, []);
  assert.equal(recorded.events.at(-1).reason, 'recorded-chat-exact-text-unverified');
  assert.deepEqual(recorded.pending.diagnostic, { requestId: 'reply-1', state: 'text-only' });
});

test('mixed, incomplete and mismatched stream decisions fail before invoking the player', async () => {
  for (const changes of [{ requestId: 'another-reply' }, { speechPackage: {} }, { speechStream: null }, { visualMode: 'other' }]) {
    const f = playbackFixture();
    await assert.rejects(f.play({ ...streamDecision(), ...changes }), /invalid_speech_stream_decision/);
    assert.deepEqual(f.videos, []); assert.deepEqual(f.captions, []);
    assert.equal(f.context.speaking, false); assert.equal(f.poses.at(-1).speechOwner, 'none');
  }
});

test('stream admission rechecks live dealer, session, round, mute, visibility and abort state', async () => {
  for (const invalidate of [
    f => { f.identity.dealerId = 'other'; },
    f => { f.identity.sessionRevision++; },
    f => { f.identity.roundRevision++; },
    f => { f.context.poseGate.state.muted = true; },
    f => { f.context.poseGate.state.visible = false; },
    f => f.pending.controller.abort(),
  ]) {
    const f = playbackFixture();
    f.pending.beforeStart = () => invalidate(f);
    f.context.playGeneratedSpeech = async (_media, options) => { await options.beforeStart(); f.videos.push('started'); };
    await assert.rejects(f.play(streamDecision()), /stale_speech_stream_pose/);
    assert.deepEqual(f.videos, []); assert.deepEqual(f.captions, []);
    assert.equal(f.context.speaking, false); assert.equal(f.context.captionHidden, true);
  }
});

test('moving-deal ownership and presentation version stay live across asynchronous admission', async () => {
  for (const invalidate of [
    f => { f.context.activeDealSpeech = {}; },
    f => { f.context.tableVersion++; },
  ]) {
    const f = playbackFixture(), sequenceOwner = { version: 'bound-version' };
    f.pending.dealSpeech = sequenceOwner; f.context.activeDealSpeech = sequenceOwner;
    f.context.poseGate.state.actionOwner = 'deal-chat-reply-1';
    f.pending.beforeStart = () => invalidate(f);
    f.context.playGeneratedSpeech = async (_media, options) => { await options.beforeStart(); f.videos.push('started'); };
    await assert.rejects(f.play({ ...streamDecision(), speechStream: { presentationVersion: 4 } }), /stale_speech_stream_pose/);
    assert.deepEqual(f.videos, []); assert.equal(f.poses.at(-1).speechOwner, 'none');
  }
});

test('render callbacks read the current composition and receipts keep the same request binding', async () => {
  const f = playbackFixture();
  f.pending.requestedAt = 100; f.context.chatStatus = { dataset: {} };
  let callbacks;
  f.context.playGeneratedSpeech = async (_media, options) => {
    callbacks = options; await options.beforeStart();
    f.context.layerComposition = { renderFrame: () => 'current-frame' };
    assert.equal(options.renderFrame({}, {}), 'current-frame');
    options.onStart(generated.exactText); options.onFirstFrame();
    options.onReceipt({ state: 'ended', completed: true });
  };
  await f.play(streamDecision());
  assert.equal(f.context.chatStatus.dataset.playbackMs, '23');
  assert.equal(f.context.chatStatus.dataset.firstFrameMs, '23');
  assert.equal(f.pending.playbackReceipt.completed, true);
  assert.equal(f.pending.diagnostic.requestId, 'reply-1');
  assert.equal(f.events.at(-1).requestId, 'reply-1');
  assert.equal(typeof callbacks.assertCurrent, 'function');
});

test('a player failure releases speech ownership, caption and local presentation state', async () => {
  const f = playbackFixture();
  f.context.playGeneratedSpeech = async () => { throw Error('decoder_failed'); };
  await assert.rejects(f.play({ ...generated, visualMode: 'generated-lipsync-preview', speechPackage: {} }), /decoder_failed/);
  assert.equal(f.context.speaking, false); assert.equal(f.context.captionHidden, true);
  assert.equal(f.poses.at(-1).speechOwner, 'none');
  assert.deepEqual(f.states.at(-1), { speech: false, ready: false });
});

test('display promotes the same provisional text and records only the committed reply', async () => {
  const f = playbackFixture(), row = provisionalRow();
  f.pending.previewRow = row; f.pending.previewText = generated.exactText;
  await displayChatDecision(f.context, generated, { jobId: 'reply-1' });
  assert.equal(row.classList.contains('pending'), false); assert.deepEqual(f.logs, []);
  assert.deepEqual(f.context.chatHistory, [{ role: 'assistant', text: generated.exactText }]);
  assert.equal(f.events.at(-1).speechKind, 'generatedText');
});

test('revised text replaces the displayed reply while probe and synthetic replies do not enter history', async () => {
  for (const flags of [{}, { probe: true }, { synthetic: true }]) {
    const f = playbackFixture();
    Object.assign(f.pending, flags, { previewRow: provisionalRow('Old text'), previewText: 'Old text' });
    await displayChatDecision(f.context, generated, { jobId: 'reply-1' });
    assert.deepEqual(f.logs, [{ role: 'vera', text: generated.exactText }]);
    assert.equal(f.context.chatHistory.length, flags.probe || flags.synthetic ? 0 : 1);
  }
});

test('cancellation during beforeDisplay removes the provisional row and prevents late history or output', async () => {
  const f = playbackFixture(), row = provisionalRow();
  f.pending.previewRow = row;
  let release;
  f.pending.beforeDisplay = () => new Promise(resolve => { release = resolve; });
  const showing = displayChatDecision(f.context, generated, { jobId: 'reply-1' });
  cancelChatDecision(f.context, { jobId: 'reply-1' }, 'dealer-changed');
  release(); await showing;
  assert.equal(row.removed, true); assert.equal(f.pending.controller.signal.reason, 'dealer-changed');
  assert.deepEqual(f.logs, []); assert.deepEqual(f.context.chatHistory, []);
  assert.equal(f.events.length, 1); assert.equal(f.events[0].state, 'cancelled');
  assert.deepEqual(f.pending.diagnostic, { requestId: 'reply-1', state: 'cancelled' });
});

test('silence and unknown jobs never commit a displayed reply', async () => {
  const f = playbackFixture();
  await displayChatDecision(f.context, { kind: 'silence' }, { jobId: 'reply-1' });
  await displayChatDecision(f.context, generated, { jobId: 'unknown' });
  assert.deepEqual(f.logs, []); assert.deepEqual(f.context.chatHistory, []); assert.deepEqual(f.events, []);
});
