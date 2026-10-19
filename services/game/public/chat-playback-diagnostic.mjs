import { chatFailureCode } from '../../../packages/presentation/contracts/chat-response.mjs';

const timingKeys = ['socket_open_ms', 'first_media_ms', 'socket_to_media_ms', 'reply_ready_ms', 'first_playing_ms', 'first_visible_frame_ms'];
const terminalStates = new Set(['ended', 'interrupted', 'failed', 'cancelled', 'text-only', 'silent', 'unverified']);

// One volatile DOM receipt for the current request. Never copy text, tickets,
// provider payloads or user data; media completion is not visual acceptance.
export function createChatPlaybackDiagnostic(element, now = () => performance.now()) {
  let current = null, requestedAt = 0;
  const publish = () => {
    const target = element();
    if (target) target.dataset.playbackReceipt = JSON.stringify(current);
  };
  const matches = requestId => current?.requestId === requestId;
  return {
    begin(requestId) {
      if (typeof requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(requestId)) return;
      requestedAt = now();
      current = { requestId, state: 'pending', completed: false };
      publish();
    },
    stream(requestId, receipt) {
      if (!matches(requestId) || receipt?.requestId !== requestId || terminalStates.has(current.state)
        || receipt.reviewStatus !== 'pending' || !/^[a-f0-9]{32}$/.test(receipt.streamId ?? '')
        || (current.streamId && current.streamId !== receipt.streamId)) return;
      if (receipt.state === 'start' && receipt.evidence === 'media-playing') current.state = 'playing';
      else if (receipt.state === 'end' && receipt.evidence === 'media-lifecycle' && receipt.started === true && current.state === 'playing') {
        current.state = 'ended'; current.completed = true;
      } else if (receipt.state === 'interrupted' && receipt.evidence === 'media-lifecycle') current.state = 'interrupted';
      else return;
      current.source = 'generated-lipsync-stream'; current.streamId = receipt.streamId; current.reviewStatus = 'pending';
      if (typeof receipt.started === 'boolean') current.started = receipt.started;
      if (typeof receipt.firstFrame === 'boolean') current.firstFrame = receipt.firstFrame;
      if (receipt.failureCode !== undefined) current.failureCode = chatFailureCode(receipt.failureCode);
      if (receipt.frameCounts && ['received', 'released', 'total'].every(key => Number.isSafeInteger(receipt.frameCounts[key])
        && receipt.frameCounts[key] >= 0 && receipt.frameCounts[key] <= 1000)) {
        current.frameCounts = Object.fromEntries(['received', 'released', 'total'].map(key => [key, receipt.frameCounts[key]]));
      }
      current.elapsedMs = Math.max(0, Math.round(now() - requestedAt));
      current.timings = {};
      for (const key of timingKeys) {
        const value = receipt.timings?.[key];
        if (Number.isSafeInteger(value) && value >= 0 && value <= 600000) current.timings[key] = value;
      }
      publish();
    },
    finish(requestId, state, reason) {
      if (!matches(requestId) || !terminalStates.has(state) || state === 'ended') return;
      // A normal gate completion cannot manufacture an audible stream receipt.
      if (state === 'unverified' && terminalStates.has(current.state)) return;
      // Keep the bounded stream evidence when the outer pose gate reports the
      // same failure. It must not erase whether audio/frames actually started.
      current = { ...current, state, completed: false, elapsedMs: Math.max(0, Math.round(now() - requestedAt)) };
      if (reason !== undefined) {
        const code = chatFailureCode(reason);
        if (code !== 'chat_failed' || !current.failureCode) current.failureCode = code;
      }
      publish();
    },
  };
}
