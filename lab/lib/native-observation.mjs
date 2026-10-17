import { sanitizeObservation } from './partner-trace.mjs';
import { SPEECH_POSE_STAGES } from '../../packages/presentation/runtime/speech-pose-gate.mjs';
import { CHAT_STAGES } from '../../packages/presentation/contracts/chat-response.mjs';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const MAX_BYTES = 256 * 1024;
// The popup, configured origin and per-launch channel must all match. This is
// observation only: messages never reach the game-command API.
export function acceptNativeObservation(message, expected) {
  if (!expected?.source || message.source !== expected.source || message.origin !== expected.origin) return null;
  const data = message.data;
  if (!object(data) || data.type !== 'croupier-native-observation' || data.version !== 1 || data.channel !== expected.channel
    || !Number.isSafeInteger(data.sequence) || data.sequence < 1 || (data.sequence <= (expected.lastSequence ?? 0) && !(data.kind === 'status' && data.payload?.state === 'attached'))
    || !['command', 'playback', 'chat', 'status'].includes(data.kind) || !object(data.payload)
    || typeof data.at !== 'string' || !Number.isFinite(Date.parse(data.at))) return null;
  let payload;
  try {
    if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_BYTES) return null;
    payload = sanitizeObservation(data.payload);
  } catch { return null; }
  const common = { id: `native:${data.channel}:${data.sequence}`, time: data.at, source: 'native', nativeSequence: data.sequence,
    channel: 'configured-partner', actualPlaybackCaptured: data.kind === 'playback' && ['start', 'end', 'presented', 'landed'].includes(payload.state) };
  if (data.kind === 'command') {
    if (typeof payload.requestId !== 'string' || payload.requestId.length > 200 || typeof payload.op !== 'string'
      || !object(payload.view) || !Number.isSafeInteger(payload.view.version) || payload.view.version < 0
      || !Array.isArray(payload.presentation) || payload.presentation.length > 256) return null;
    return { ...common, kind: payload.presentation.length ? 'round' : 'state', data: { type: 'round',
      requestId: payload.requestId, version: payload.view.version, op: payload.op, action: payload.action,
      phase: payload.view.round?.phase ?? null, events: payload.presentation,
      view: payload.view, previousView: payload.previousView, dealerId: payload.dealer } };
  }
  if (data.kind === 'status') {
    if (payload.state === 'attached') return { ...common, kind: 'status', data: { ...payload, gap: false } };
    if(payload.state==='probe'){
      if(!['decision','played','failed'].includes(payload.stage) || typeof payload.requestId!=='string' || payload.requestId.length>100)return null;
      return {...common,kind:'status',data:{...payload,gap:false}};
    }
    if (['chat-progress', 'chat-failed'].includes(payload.state)) {
      if (typeof payload.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(payload.requestId)) return null;
      if (payload.state === 'chat-progress') {
        if (!Object.hasOwn(CHAT_STAGES, payload.stage) || !Number.isSafeInteger(payload.elapsedMs) || payload.elapsedMs < 0) return null;
        return { ...common, kind: 'status', data: { state: payload.state, requestId: payload.requestId, stage: payload.stage, elapsedMs: payload.elapsedMs, gap: false } };
      }
      if (typeof payload.reason !== 'string' || payload.reason.length > 200) return null;
      return { ...common, kind: 'status', data: { state: payload.state, requestId: payload.requestId, reason: payload.reason, gap: false } };
    }
    // Pose traces share the native transport sequence. Retain this bounded
    // diagnostic so the next command is not mistaken for a missing message.
    // In particular, speech-completed is not a media playback receipt.
    if (payload.state !== 'chat-pose' || !SPEECH_POSE_STAGES.includes(payload.stage)
      || typeof payload.jobId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(payload.jobId)
      || !Number.isSafeInteger(payload.at) || payload.at < 0) return null;
    return { ...common, kind: 'status', data: { state: 'chat-pose', jobId: payload.jobId,
      stage: payload.stage, at: payload.at, gap: false } };
  }
  return { ...common, kind: data.kind, data: payload };
}
