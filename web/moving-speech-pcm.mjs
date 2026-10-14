import { createHash } from 'node:crypto';
import { prepareMovingSpeechPlan } from './moving-speech-plan.mjs';

const RATE = 24000;
const CHUNK_BYTES = 32768;
const MAX_BYTES = RATE * 2 * 25;
const fail = code => { throw Error(code); };

/**
 * Preparation only. Consume AFTER admission, GPU acceptance and current
 * profile checks. Audio is the final normalized mono PCM used for playback.
 * The caller owns the authenticated socket, backpressure and RunPod cleanup.
 * `end` completes PCM input; it does not cancel work or acknowledge output.
 */
export function prepareMovingSpeechPcmInput({ audio, ...planInput } = {}) {
  if (!audio || audio.sampleRate !== RATE || audio.channels !== 1 || audio.format !== 's16le'
    || !(audio.pcm instanceof Uint8Array) || !audio.pcm.byteLength
    || audio.pcm.byteLength % 2 || audio.pcm.byteLength > MAX_BYTES) fail('invalid_moving_speech_pcm');
  const plan = prepareMovingSpeechPlan(planInput);
  const pcm = Buffer.from(audio.pcm);
  const audioSha256 = createHash('sha256').update(pcm).digest('hex');
  if (audioSha256 !== plan.binding.audioSha256) fail('moving_speech_pcm_hash_mismatch');
  // Include the worker's 220 ms leading silence in the full plan, including
  // on replans: fran_ruta skips output frames, not the source PCM samples.
  if ((pcm.length / 2 + plan.audioLeadMs * RATE / 1000) * plan.fps > plan.timeline.length * RATE) {
    fail('moving_speech_pcm_exceeds_plan');
  }
  let used = false, cancelled = false;
  const cancel = () => { cancelled = true; plan.cancel(); pcm.fill(0); };
  const check = () => { if (cancelled) fail('moving_speech_pcm_cancelled'); };
  const ownedPlan = Object.freeze({ ...plan, cancel });
  return Object.freeze({
    plan: ownedPlan, audioSha256, byteLength: pcm.length, durationMs: pcm.length / 2 / RATE * 1000,
    cancel,
    playbackPcm() { check(); return Buffer.from(pcm); },
    /**
     * One iterator per transfer. Each yielded string/buffer is a separate
     * WebSocket message; await the bounded write before requesting the next.
     * Aborting/returning invalidates this plan, but does not stop a paid job.
     */
    *messages({ signal } = {}) {
      if (used) fail('moving_speech_pcm_already_consumed');
      if (signal !== undefined && !(signal instanceof AbortSignal)) fail('invalid_moving_speech_signal');
      used = true;
      let completed = false;
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        if (signal?.aborted) cancel();
        check();
        yield JSON.stringify(plan.start);
        for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
          check();
          yield Buffer.from(pcm.subarray(offset, offset + CHUNK_BYTES));
        }
        check();
        yield JSON.stringify(plan.end);
        check();
        completed = true;
      } finally {
        signal?.removeEventListener('abort', cancel);
        if (!completed) cancel();
      }
    },
  });
}
