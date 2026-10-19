// Match the pinned worker frame_contract.py: integer 24 kHz PCM, 220 ms
// leading + 530 ms trailing silence, then floor to complete 24 fps frames.
export const MOVING_SPEECH_PCM_RATE = 24000;
export const MOVING_SPEECH_FPS = 24;
export const MOVING_SPEECH_AUDIO_LEAD_MS = 220;
export const MOVING_SPEECH_AUDIO_TRAIL_MS = 530;
export const MOVING_SPEECH_MAX_FRAMES = 600;
const SAMPLES_PER_FRAME = MOVING_SPEECH_PCM_RATE / MOVING_SPEECH_FPS;
const PADDING_SAMPLES = MOVING_SPEECH_PCM_RATE
  * (MOVING_SPEECH_AUDIO_LEAD_MS + MOVING_SPEECH_AUDIO_TRAIL_MS) / 1000;
// floor((samples + padding) / samplesPerFrame) <= maxFrames. The next
// sample crosses to frame 601: 582999 samples (24.291625 s) is the limit.
export const MOVING_SPEECH_MAX_PCM_SAMPLES = (MOVING_SPEECH_MAX_FRAMES + 1)
  * SAMPLES_PER_FRAME - PADDING_SAMPLES - 1;
export const MOVING_SPEECH_MAX_PCM_BYTES = MOVING_SPEECH_MAX_PCM_SAMPLES * 2;

export function movingSpeechPcmFrameCount(byteLength) {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength % 2) {
    throw Error('invalid_moving_speech_pcm');
  }
  if (byteLength > MOVING_SPEECH_MAX_PCM_BYTES) throw Error('moving_speech_audio_limit');
  return Math.floor((byteLength / 2 + PADDING_SAMPLES) / SAMPLES_PER_FRAME);
}
