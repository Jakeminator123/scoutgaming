export const SPEECH_POSE_STAGES = Object.freeze([
  'chat-received',
  'response-ready',
  'held-for-pose',
  'action-completed',
  'standard-idle-presented',
  'chat-displayed',
  'speech-started',
  'speech-completed',
]);

export class SpeechPoseGateError extends Error {
  constructor(code) { super(code); this.name = 'SpeechPoseGateError'; this.code = code; }
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value, max = 128) => typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const fail = code => { throw new SpeechPoseGateError(code); };
const revision = value => {
  if ((typeof value !== 'string' && !Number.isSafeInteger(value)) || String(value).length < 1 || String(value).length > 100) fail('invalid_pose_revision');
  return String(value);
};

function identity(value) {
  if (!object(value) || !id(value.dealerId, 64)) fail('invalid_pose_identity');
  return { dealerId: value.dealerId, sessionRevision: revision(value.sessionRevision), roundRevision: revision(value.roundRevision) };
}

function sameIdentity(left, right) {
  return left.dealerId === right.dealerId && left.sessionRevision === right.sessionRevision && left.roundRevision === right.roundRevision;
}

function normalizeProof(value) {
  if (value == null) return null;
  const proof = identity(value);
  if (!id(value.presentationId)) fail('invalid_idle_presentation_proof');
  return { ...proof, presentationId: value.presentationId };
}

function normalizeState(value) {
  const current = identity(value);
  if (!id(value.dealerPose) || !id(value.actionOwner) || !id(value.speechOwner)
    || typeof value.visible !== 'boolean' || typeof value.muted !== 'boolean') fail('invalid_renderer_state');
  return { ...current, dealerPose: value.dealerPose, actionOwner: value.actionOwner, speechOwner: value.speechOwner,
    idlePresented: normalizeProof(value.idlePresented), visible: value.visible, muted: value.muted };
}

function canonical(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  fail('non_serializable_reply');
}

function publicRecord(record) {
  return Object.freeze({ jobId: record.jobId, dealerId: record.dealerId, sessionRevision: record.sessionRevision,
    roundRevision: record.roundRevision, status: record.status, reason: record.reason, promoted: record.promoted,
    displayed: record.displayed, speechStarted: record.speechStarted, stages: record.stages.map(entry => ({ ...entry })) });
}

function defaultState() {
  return { dealerId: 'unassigned', sessionRevision: '0', roundRevision: '0', dealerPose: 'unknown',
    actionOwner: 'none', speechOwner: 'none', idlePresented: null, visible: true, muted: false };
}

// This is intentionally not a queue. It owns only request state and calls the
// supplied existing queue once, after a renderer-issued presented-idle proof.
export function createSpeechPoseGate({
  enqueue,
  onDisplay = () => {},
  onSpeech = async () => {},
  onCancel = () => {},
  onTrace = () => {},
  now = () => Date.now(),
  initialState = defaultState(),
  holdWhileHidden = false,
} = {}) {
  if (typeof enqueue !== 'function' || typeof onDisplay !== 'function' || typeof onSpeech !== 'function'
    || typeof onCancel !== 'function' || typeof onTrace !== 'function' || typeof now !== 'function') fail('invalid_pose_gate_callbacks');
  let state = normalizeState(initialState);
  const records = new Map();
  const trace = [];

  function stage(record, name) {
    if (!SPEECH_POSE_STAGES.includes(name) || record.stageNames.has(name)) return;
    record.stageNames.add(name);
    const entry = Object.freeze({ jobId: record.jobId, stage: name, at: now() });
    record.stages.push(entry); trace.push(entry); onTrace(entry, publicRecord(record));
  }

  function finish(record, status, reason = null) {
    if (['completed', 'cancelled', 'failed'].includes(record.status)) return;
    record.status = status; record.reason = reason;
    record.resolveCompletion(publicRecord(record));
  }

  function cancelRecord(record, reason) {
    if (['completed', 'cancelled', 'failed'].includes(record.status)) return false;
    record.controller.abort(reason);
    const hadOutput = record.displayed || record.speechStarted;
    finish(record, 'cancelled', reason);
    onCancel(publicRecord(record), reason, { hadOutput });
    return true;
  }

  function validIdleProof(current = state) {
    return current.idlePresented !== null && sameIdentity(current, current.idlePresented);
  }

  function poseReady(record) {
    return record.response !== undefined && sameIdentity(record, state)
      && state.dealerPose === 'standard-idle' && state.actionOwner === 'none' && state.speechOwner === 'none'
      && validIdleProof() && state.visible && !state.muted;
  }

  function noteCheckpoints(record) {
    if (record.response === undefined) return;
    if (state.actionOwner === 'none') stage(record, 'action-completed');
    if (state.dealerPose === 'standard-idle' && validIdleProof()) stage(record, 'standard-idle-presented');
  }

  function promote(record) {
    if (record.promoted || !poseReady(record) || record.status !== 'held') return false;
    record.promoted = true; record.status = 'queued';
    const queued = enqueue(async queueSignal => {
      if (queueSignal?.aborted) return cancelRecord(record, 'queue-cancelled-before-start');
      const queueAbort = () => cancelRecord(record, 'queue-cancelled');
      queueSignal?.addEventListener('abort', queueAbort, { once: true });
      try {
        if (record.status !== 'queued') return;
        // Never wait inside the speech queue for pose. Losing the proof here
        // cancels this delivery so an action that waits on queue.idle cannot deadlock.
        if (!poseReady(record)) return cancelRecord(record, 'pose-lost-before-start');
        // Consuming a presented-idle receipt is one-shot. A following pending
        // reply needs the renderer to present standard idle again.
        state = { ...state, idlePresented: null };
        record.status = 'displaying';
        await onDisplay(record.response, publicRecord(record));
        if (record.controller.signal.aborted) return;
        record.displayed = true; stage(record, 'chat-displayed');
        record.status = 'speaking'; record.speechStarted = true; stage(record, 'speech-started');
        await onSpeech(record.response, { signal: record.controller.signal, job: publicRecord(record) });
        if (record.controller.signal.aborted || record.status === 'cancelled') return cancelRecord(record, record.reason ?? 'speech-cancelled');
        stage(record, 'speech-completed'); finish(record, 'completed');
      } catch (error) {
        if (record.controller.signal.aborted) cancelRecord(record, record.reason ?? 'speech-cancelled');
        else finish(record, 'failed', error?.message || 'speech-failed');
      } finally {
        queueSignal?.removeEventListener('abort', queueAbort);
      }
    });
    Promise.resolve(queued).catch(error => {
      if (!['completed', 'cancelled', 'failed'].includes(record.status)) finish(record, 'failed', error?.message || 'queue-failed');
    });
    return true;
  }

  function evaluate() {
    if ([...records.values()].some(record => ['queued', 'displaying', 'speaking'].includes(record.status))) return;
    for (const record of records.values()) {
      if (record.status !== 'held') continue;
      noteCheckpoints(record);
      if (promote(record)) return;
    }
  }

  function receive(value) {
    if (!object(value) || !id(value.jobId) || (value.requestFingerprint !== undefined && !id(value.requestFingerprint, 256))) fail('invalid_pose_job');
    const expected = identity(value);
    const fingerprint = value.requestFingerprint ?? value.jobId;
    const existing = records.get(value.jobId);
    if (existing) {
      if (!sameIdentity(existing, expected) || existing.requestFingerprint !== fingerprint) fail('pose_job_id_reused');
      return { duplicate: true, completion: existing.completion, record: publicRecord(existing) };
    }
    let resolveCompletion;
    const completion = new Promise(resolve => { resolveCompletion = resolve; });
    const record = { jobId: value.jobId, ...expected, requestFingerprint: fingerprint, response: undefined, responseFingerprint: null,
      status: 'waiting-response', reason: null, promoted: false, displayed: false, speechStarted: false,
      controller: new AbortController(), stages: [], stageNames: new Set(), completion, resolveCompletion };
    records.set(record.jobId, record); stage(record, 'chat-received');
    if (!sameIdentity(record, state)) cancelRecord(record, 'stale-on-arrival');
    else if (!state.visible && !holdWhileHidden) cancelRecord(record, 'hidden');
    else if (state.muted) cancelRecord(record, 'muted');
    return { duplicate: false, completion, record: publicRecord(record) };
  }

  function responseReady(jobId, response) {
    const record = records.get(jobId);
    if (!record) fail('unknown_pose_job');
    const fingerprint = canonical(response);
    if (record.response !== undefined) {
      if (record.responseFingerprint !== fingerprint) fail('pose_response_changed');
      return { duplicate: true, record: publicRecord(record) };
    }
    if (['cancelled', 'failed', 'completed'].includes(record.status)) return { duplicate: true, record: publicRecord(record) };
    record.response = structuredClone(response); record.responseFingerprint = fingerprint; record.status = 'held';
    stage(record, 'response-ready'); stage(record, 'held-for-pose'); noteCheckpoints(record); evaluate();
    return { duplicate: false, record: publicRecord(record) };
  }

  function updateRendererState(next, reason = 'renderer-state-changed') {
    const previous = state;
    const merged = { ...state, ...next };
    // Any departure from the neutral, owner-free pose invalidates the old
    // presented-frame receipt. A renderer must issue a new receipt afterwards.
    if (next.idlePresented === undefined && (merged.dealerPose !== 'standard-idle'
      || merged.actionOwner !== 'none' || merged.speechOwner !== 'none'
      || !sameIdentity(previous, merged))) merged.idlePresented = null;
    state = normalizeState(merged);
    for (const record of records.values()) {
      if (['completed', 'cancelled', 'failed'].includes(record.status)) continue;
      if (!sameIdentity(record, state)) cancelRecord(record, `stale:${reason}`);
      else if (!state.visible && !(holdWhileHidden && ['waiting-response', 'held'].includes(record.status))) cancelRecord(record, 'hidden');
      else if (state.muted) cancelRecord(record, 'muted');
      else if (record.promoted && record.status !== 'speaking' && !poseReady(record)) cancelRecord(record, 'pose-lost-before-start');
    }
    evaluate();
    return Object.freeze({ ...state, idlePresented: state.idlePresented && { ...state.idlePresented } });
  }

  function presentStandardIdle(proof) {
    const normalized = normalizeProof(proof);
    if (!normalized) fail('invalid_idle_presentation_proof');
    if (!sameIdentity(state, normalized)) fail('stale_idle_presentation_proof');
    return updateRendererState({ dealerPose: 'standard-idle', idlePresented: normalized }, 'idle-presented');
  }

  function cancel(jobId, reason = 'explicit-interrupt') {
    const record = records.get(jobId);
    return record ? cancelRecord(record, reason) : false;
  }

  function cancelAll(reason = 'navigation') {
    let count = 0;
    for (const record of records.values()) if (cancelRecord(record, reason)) count++;
    return count;
  }

  return Object.freeze({
    receive, responseReady, updateRendererState, presentStandardIdle, cancel, cancelAll,
    interrupt: () => cancelAll('explicit-interrupt'),
    navigate: () => cancelAll('navigation'),
    get pendingCount() { return [...records.values()].filter(record => !['completed', 'cancelled', 'failed'].includes(record.status)).length; },
    get state() { return Object.freeze({ ...state, idlePresented: state.idlePresented && { ...state.idlePresented } }); },
    get trace() { return trace.map(entry => ({ ...entry })); },
    get(jobId) { const record = records.get(jobId); return record ? publicRecord(record) : null; },
  });
}
