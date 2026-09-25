import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechPoseGate, SPEECH_POSE_STAGES } from '../web/public/speech-pose-gate.mjs';

const identity = (dealerId = 'astrid', roundRevision = 3) => ({ dealerId, sessionRevision: 2, roundRevision });
const actionState = dealerId => ({ ...identity(dealerId), dealerPose: 'deal-action', actionOwner: 'deal', speechOwner: 'none', idlePresented: null, visible: true, muted: false });
const proof = dealerId => ({ ...identity(dealerId), presentationId: `${dealerId}.idle.frame-42` });
const job = dealerId => ({ jobId: `${dealerId}.chat.request-1`, ...identity(dealerId), requestFingerprint: `${dealerId}.message.hash-1` });

function manualHarness(dealerId = 'astrid') {
  const queued = []; const output = [];
  const gate = createSpeechPoseGate({
    initialState: actionState(dealerId),
    enqueue(run) { queued.push(run); },
    onDisplay(reply) { output.push(`display:${reply.exactText}`); },
    async onSpeech(reply) { output.push(`speech:${reply.exactText}`); },
  });
  return { gate, queued, output };
}

test('reply stays outside speech queue and emits no output until an actual standard-idle proof', async () => {
  const { gate, queued, output } = manualHarness();
  const accepted = gate.receive(job('astrid'));
  gate.responseReady(job('astrid').jobId, { kind: 'generatedText', exactText: 'Hej.' });
  assert.equal(queued.length, 0);
  assert.deepEqual(output, []);

  gate.updateRendererState({ actionOwner: 'none' }, 'deal-finished');
  assert.equal(queued.length, 0);
  gate.presentStandardIdle(proof('astrid'));
  assert.equal(queued.length, 1);
  assert.deepEqual(output, []);

  await queued.shift()(new AbortController().signal);
  const receipt = await accepted.completion;
  assert.equal(receipt.status, 'completed');
  assert.deepEqual(output, ['display:Hej.', 'speech:Hej.']);
  assert.deepEqual(receipt.stages.map(entry => entry.stage), SPEECH_POSE_STAGES);
});

test('pending reply cannot deadlock an action that waits for the existing queue', () => {
  const { gate, queued } = manualHarness();
  gate.receive(job('astrid'));
  gate.responseReady(job('astrid').jobId, { kind: 'recordedLine', lineId: 'goodluck' });
  assert.equal(queued.length, 0, 'held reply is not inserted into the speech queue');
  gate.updateRendererState({ actionOwner: 'none' }, 'action-return-completed');
  assert.equal(queued.length, 0, 'action completion alone is not a presented idle frame');
});

test('initial deal, hit, double and dealer draw all require a presented action return', async () => {
  for (const [index, actionOwner] of ['initial-deal', 'hit', 'double', 'dealer-draw'].entries()) {
    const queued = []; const output = [];
    const gate = createSpeechPoseGate({
      initialState: { ...actionState('astrid'), actionOwner },
      enqueue(run) { queued.push(run); },
      onDisplay() { output.push('display'); },
      async onSpeech() { output.push('speech'); },
    });
    const currentJob = { ...job('astrid'), jobId: `astrid.action.${index}` };
    const accepted = gate.receive(currentJob);
    gate.responseReady(currentJob.jobId, { kind: 'generatedText', exactText: actionOwner });
    assert.equal(queued.length, 0);
    gate.updateRendererState({ actionOwner: 'none', dealerPose: 'action-return' }, `${actionOwner}-completed`);
    assert.equal(queued.length, 0, `${actionOwner}: action completion is not pose evidence`);
    gate.presentStandardIdle({ ...proof('astrid'), presentationId: `astrid.${actionOwner}.idle` });
    assert.equal(queued.length, 1);
    await queued[0](new AbortController().signal);
    assert.equal((await accepted.completion).status, 'completed');
    assert.deepEqual(output, ['display', 'speech']);
  }
});

test('duplicate response, idle proof and request promote and deliver exactly once', async () => {
  const { gate, queued, output } = manualHarness();
  const first = gate.receive(job('astrid'));
  assert.equal(gate.receive(job('astrid')).duplicate, true);
  const reply = { kind: 'generatedText', exactText: 'En gång.' };
  gate.responseReady(job('astrid').jobId, reply);
  assert.equal(gate.responseReady(job('astrid').jobId, reply).duplicate, true);
  gate.updateRendererState({ actionOwner: 'none' });
  gate.presentStandardIdle(proof('astrid'));
  gate.presentStandardIdle(proof('astrid'));
  assert.equal(queued.length, 1);
  await queued[0](new AbortController().signal);
  assert.equal((await first.completion).status, 'completed');
  assert.deepEqual(output, ['display:En gång.', 'speech:En gång.']);
  assert.equal(gate.trace.filter(entry => entry.stage === 'chat-displayed').length, 1);
  assert.throws(() => gate.responseReady(job('astrid').jobId, { ...reply, exactText: 'Andra ord.' }), { code: 'pose_response_changed' });
});

test('dealer/session/round changes, mute, hidden tab and explicit navigation cancel stale work without output', async () => {
  const cases = [
    { change: { roundRevision: 4 }, reason: 'round-changed' },
    { change: { sessionRevision: 9 }, reason: 'session-changed' },
    { change: { dealerId: 'vera' }, reason: 'dealer-changed' },
    { change: { muted: true }, reason: 'mute' },
    { change: { visible: false }, reason: 'hidden' },
  ];
  for (const [index, scenario] of cases.entries()) {
    const { gate, queued, output } = manualHarness();
    const currentJob = { ...job('astrid'), jobId: `astrid.cancel.${index}` };
    const accepted = gate.receive(currentJob);
    gate.responseReady(currentJob.jobId, { kind: 'generatedText', exactText: 'Sent.' });
    gate.updateRendererState(scenario.change, scenario.reason);
    assert.equal((await accepted.completion).status, 'cancelled');
    assert.equal(queued.length, 0); assert.deepEqual(output, []);
    assert.equal(gate.receive(currentJob).duplicate, true, 'retry gets the terminal receipt instead of another delivery');
  }
  const { gate } = manualHarness();
  const currentJob = { ...job('astrid'), jobId: 'astrid.navigation.1' };
  const accepted = gate.receive(currentJob); gate.responseReady(currentJob.jobId, { kind: 'silence' });
  assert.equal(gate.navigate(), 1);
  assert.equal((await accepted.completion).reason, 'navigation');
});

test('pose lost after promotion cancels queued callback before display or speech', async () => {
  const { gate, queued, output } = manualHarness();
  const accepted = gate.receive(job('astrid'));
  gate.responseReady(job('astrid').jobId, { kind: 'generatedText', exactText: 'För sent.' });
  gate.updateRendererState({ actionOwner: 'none' }); gate.presentStandardIdle(proof('astrid'));
  gate.updateRendererState({ actionOwner: 'deal', dealerPose: 'deal-action' }, 'new-action');
  await queued[0](new AbortController().signal);
  assert.equal((await accepted.completion).status, 'cancelled');
  assert.deepEqual(output, []);
});

test('hidden tab aborts speech that already started and returns one cancelled receipt', async () => {
  const queued = []; let started; let observedAbort = false;
  const speechStarted = new Promise(resolve => { started = resolve; });
  const gate = createSpeechPoseGate({
    initialState: actionState('astrid'),
    enqueue(run) { queued.push(run); },
    onDisplay() {},
    onSpeech(_reply, { signal }) {
      started();
      return new Promise(resolve => signal.addEventListener('abort', () => { observedAbort = true; resolve(); }, { once: true }));
    },
  });
  const accepted = gate.receive(job('astrid'));
  gate.responseReady(job('astrid').jobId, { kind: 'generatedText', exactText: 'Avbryt mig.' });
  gate.updateRendererState({ actionOwner: 'none' }); gate.presentStandardIdle(proof('astrid'));
  const playback = queued[0](new AbortController().signal);
  await speechStarted;
  gate.updateRendererState({ visible: false }, 'hidden');
  await playback;
  const receipt = await accepted.completion;
  assert.equal(observedAbort, true);
  assert.equal(receipt.status, 'cancelled');
  assert.equal(receipt.reason, 'hidden');
});

test('all four dealers use the same renderer-independent held-for-pose path', async () => {
  for (const dealerId of ['astrid', 'vera', 'amira', 'mei']) {
    const { gate, queued, output } = manualHarness(dealerId);
    const accepted = gate.receive(job(dealerId));
    gate.responseReady(job(dealerId).jobId, { kind: 'generatedText', exactText: dealerId });
    gate.updateRendererState({ actionOwner: 'none' }); gate.presentStandardIdle(proof(dealerId));
    await queued[0](new AbortController().signal);
    assert.equal((await accepted.completion).status, 'completed');
    assert.deepEqual(output, [`display:${dealerId}`, `speech:${dealerId}`]);
  }
});
