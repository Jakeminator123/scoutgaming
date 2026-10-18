import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../services/game/public/app.mjs', import.meta.url), 'utf8');

test('product chat is wired to one existing speech queue through the pose gate', () => {
  assert.equal((source.match(/createSpeechQueue\s*\(/g) ?? []).length, 1);
  assert.match(source, /createSpeechPoseGate\s*\(\{/);
  assert.match(source, /enqueue:\s*rawSpeechTurn/);
  assert.match(source, /speechPoseGate\.receive\(/);
  assert.match(source, /speechPoseGate\.responseReady\(/);
  assert.doesNotMatch(source, /<i>thinking/);
  assert.match(source, /onPlaybackEnable:\s*\(\) => setMuted\(false\)/);
});

test('chat previews model text provisionally and commits it only inside the gated callback', () => {
  assert.match(source, /sessionRevision:\s*identity\.sessionRevision/);
  assert.match(source, /roundRevision:\s*identity\.roundRevision/);
  const displayBlock = source.slice(source.indexOf('onDisplay: async'), source.indexOf('onSpeech: async'));
  assert.match(displayBlock, /chatLog\('vera', text\)/);
  assert.match(displayBlock, /previewRow\.classList\.remove\('pending'\)/);
  const sendBlock = source.slice(source.indexOf('async function sendChat'), source.indexOf("$('#gate-enter')"));
  assert.match(sendBlock, /chatLog\('vera', exactText, true\)/);
  assert.match(sendBlock, /previewRow\.remove\(\)/);
  assert.doesNotMatch(sendBlock, /chatHistory\.push\(\{ role: 'assistant'/);
});

test('generated text keeps neutral idle instead of a recorded mouth clip', () => {
  const playback = source.match(/async function playChatDecision[\s\S]*?\n\}/)[0];
  assert.match(playback, /decision\.kind === 'generatedText'/);
  assert.match(playback, /pending\.voiceUnavailable = true/);
  assert.doesNotMatch(playback, /playNeutralTts/);
  assert.doesNotMatch(playback, /playRecorded\([^\n]*generatedText/);
  assert.doesNotMatch(source, /function speakFor\(/);
});

function playbackFixture(dealerId, studioPreview = null) {
  const events = [], tts = [], videos = [], poses = [], statuses = [], captions = [], pending = {};
  const context = { studioPreview,
    DEALER: { key: dealerId, name: dealerId === 'astrid' ? 'Astrid' : dealerId }, pendingChatReplies: new Map([['reply-1', pending]]),
    chatPlaybackDiagnostic: { finish: (requestId, state) => { pending.diagnostic = { requestId, state }; } },
    localPresentation: { state() {} }, updatePoseState: value => poses.push(value), speaking: false,
    playNeutralTts: async text => tts.push(text),
    playGeneratedSpeech: async media => videos.push(media),
    chatStatus: null, setChatStatus: text => statuses.push(text), showCaption: text => captions.push(text),
    nativeObservation: { emit: (type, data) => events.push({ type, ...data }) },
    $: () => ({ classList: { remove() {} } }), greenActor: false,
    engine: { presentedClip: 'other' }, CLIP: { idle: 'idle' },
  };
  const playback = source.match(/async function playChatDecision[\s\S]*?\n\}/)[0];
  const play = runInNewContext(`${playback}\nplayChatDecision`, context);
  return { play, events, tts, videos, poses, statuses, captions, pending, context };
}

test('Astrid without generated media stays text-only and never calls a substitute voice', async () => {
  const f = playbackFixture('astrid');
  await f.play({ kind: 'generatedText', exactText: 'Good evening.' }, new AbortController().signal, 'reply-1');
  assert.equal(f.tts.length, 0);
  assert.equal(f.videos.length, 0);
  assert.equal(f.pending.voiceUnavailable, true);
  assert.deepEqual(f.pending.diagnostic, { requestId: 'reply-1', state: 'text-only' });
  assert.equal(f.events.at(-1).reason, 'dealer-generated-media-unavailable');
  assert.equal(f.events.at(-1).renderer, 'text-only');
  assert.equal(f.context.speaking, false);
  assert.equal(f.poses.at(-1).speechOwner, 'none');
});

test('Astrid still plays a generated package or stream through the shared video player', async () => {
  for (const [visualMode, key] of [
    ['generated-lipsync-preview', 'speechPackage'],
    ['generated-lipsync-stream-preview', 'speechStream'],
  ]) {
    const f = playbackFixture('astrid'), media = { fixture: key };
    await f.play({ kind: 'generatedText', exactText: 'Good evening.', requestId: 'reply-1', visualMode, [key]: media },
      new AbortController().signal, 'reply-1');
    assert.equal(f.videos[0], media);
    assert.equal(f.tts.length, 0);
    assert.equal(f.pending.voiceUnavailable, undefined);
  }
});

test('generated media preparation replaces the table wait status until actual media start', async () => {
  for (const [visualMode, key] of [
    ['generated-lipsync-preview', 'speechPackage'],
    ['generated-lipsync-stream-preview', 'speechStream'],
  ]) {
    const f = playbackFixture('astrid');
    let callbacks, finish;
    f.statuses.push('Svar klart · väntar på ledigt bord');
    f.context.playGeneratedSpeech = (_media, options) => {
      callbacks = options;
      return new Promise(resolve => { finish = resolve; });
    };
    const playing = f.play({ kind: 'generatedText', exactText: 'Good evening.', requestId: 'reply-1', visualMode, [key]: {} },
      new AbortController().signal, 'reply-1');
    await Promise.resolve();
    assert.equal(f.statuses.at(-1), 'Förbereder röst och läppsynk…');
    assert.equal(f.statuses.includes('Astrid svarar'), false);
    assert.equal(f.captions.length, 0);
    callbacks.onStart('Good evening.');
    assert.equal(f.statuses.at(-1), 'Astrid svarar');
    assert.deepEqual(f.captions, ['Good evening.']);
    finish();
    await playing;
  }
});

test('every registered dealer requires exact generated media and never borrows a voice', async () => {
  for (const dealerId of ['vera', 'mei', 'paow']) {
    const f = playbackFixture(dealerId);
    await f.play({ kind: 'generatedText', exactText: 'Good evening.' }, new AbortController().signal, 'reply-1');
    assert.deepEqual(f.tts, []);
    assert.equal(f.pending.voiceUnavailable, true);
  }
});

test('renderer evidence, not busy or phase, supplies standard-idle proof', () => {
  assert.match(source, /onIdle: \(\) => presentStandardIdle\('local-primary-frame'\)/);
  assert.match(source, /speechPoseGate\.presentStandardIdle\(/);
  const proofFunction = source.match(/function presentStandardIdle[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(proofFunction, /\bbusy\b|round\.phase|duration/);
});

test('Studio preview rejects generated speech before every dealer voice or player side effect', async () => {
  for (const dealerId of ['astrid', 'vera', 'amira', 'mei']) {
    for (const media of [
      {},
      { visualMode: 'generated-lipsync-preview', speechPackage: { fixture: 'package' } },
      { visualMode: 'generated-lipsync-stream-preview', speechStream: { fixture: 'stream' } },
    ]) {
      const f = playbackFixture(dealerId, { sessionId: 'preview-fixture' });
      await assert.rejects(f.play({ kind: 'generatedText', exactText: 'Good evening.', ...media },
        new AbortController().signal, 'reply-1'), /Genererat tal är avstängt i provspel/);
      for (const effects of [f.tts, f.videos, f.poses, f.statuses, f.captions, f.events]) assert.deepEqual(effects, []);
      assert.deepEqual(f.pending, {});
      assert.equal(f.context.speaking, false);
    }
  }
});

test('registered dealers without generated media never inherit a browser voice or Astrid video',async()=>{
  for(const dealerId of ['paow','johanna','new-dealer']){
    const f=playbackFixture(dealerId);
    await f.play({kind:'generatedText',exactText:'Hej.'},new AbortController().signal,'reply-1');
    assert.equal(f.tts.length,0);assert.equal(f.videos.length,0);
    assert.equal(f.pending.voiceUnavailable,true);
    assert.equal(f.events.at(-1).reason,'dealer-generated-media-unavailable');
    assert.equal(f.poses.at(-1).speechOwner,'none');
  }
});
