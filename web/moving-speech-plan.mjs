import { createHash } from 'node:crypto';

// Preparation only: no provider calls, player hook, decoder or game scheduling.
// Wire fields follow kevin-staging 315cfc5543 server/rorlig-lipsync.mjs.
export const MOVING_SPEECH_FPS = 24;
export const MOVING_SPEECH_AUDIO_LEAD_MS = 220;
const MAX_FRAMES = 600;
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TAKE = /^[a-z][a-z0-9-]{0,63}$/;
const bindingKeys = ['dealerId', 'workerAvatar', 'sessionId', 'talkId', 'revision',
  'profileRevision', 'textSha256', 'audioSha256', 'avatarSha256'];
const fail = () => { throw Error('invalid_moving_speech_plan'); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function freeze(value) {
  if (object(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Called only after the existing server admission/budget/profile checks.
 * clips must come from a verified published package plus a hash-bound worker
 * avatar bank. frames is the authoritative source-frame timeline, including
 * held frames and explicit vila; never infer either from duration/filenames.
 * This validates the supplied evidence's shape, not the files' actual bytes.
 */
export function prepareMovingSpeechPlan({ binding, clips, frames, fromFrame = 0 } = {}) {
  if (!object(binding) || Object.keys(binding).length !== bindingKeys.length
    || bindingKeys.some(key => !Object.hasOwn(binding, key))) fail();
  for (const key of ['dealerId', 'workerAvatar', 'sessionId', 'talkId']) {
    if (typeof binding[key] !== 'string' || !ID.test(binding[key])) fail();
  }
  for (const key of ['profileRevision', 'textSha256', 'audioSha256', 'avatarSha256']) {
    if (typeof binding[key] !== 'string' || !HASH.test(binding[key])) fail();
  }
  if (!integer(binding.revision) || binding.revision < 1
    || !Array.isArray(clips) || !clips.length || clips.length > MAX_FRAMES
    || !Array.isArray(frames) || !frames.length || frames.length > MAX_FRAMES
    || !integer(fromFrame) || fromFrame >= frames.length) fail();

  const sources = new Map();
  for (const clip of clips) {
    if (!object(clip) || typeof clip.take !== 'string' || !TAKE.test(clip.take)
      || sources.has(clip.take) || typeof clip.sha256 !== 'string' || !HASH.test(clip.sha256)
      || clip.dealerId !== binding.dealerId || clip.fps !== MOVING_SPEECH_FPS
      || !integer(clip.frameCount) || clip.frameCount < 1
      || !['video', 'still'].includes(clip.kind)
      || (clip.take === 'vila' ? clip.kind !== 'still' || clip.frameCount !== 1 : clip.kind !== 'video')) fail();
    sources.set(clip.take, { take: clip.take, sha256: clip.sha256, frameCount: clip.frameCount, kind: clip.kind });
  }
  const timeline = frames.map(frame => {
    if (!object(frame)) fail();
    const source = sources.get(frame.take);
    if (!source || !integer(frame.frame) || frame.frame >= source.frameCount) fail();
    return { take: source.take, frame: frame.frame, sourceSha256: source.sha256 };
  });
  const karta = [];
  for (const { take, frame } of timeline) {
    const previous = karta.at(-1);
    if (previous && previous[0] === take && (take === 'vila' || previous[1] + previous[2] === frame)) previous[2]++;
    else karta.push([take, frame, 1]);
  }
  const ownedBinding = Object.fromEntries(bindingKeys.map(key => [key, binding[key]]));
  const planSha256 = hash({ binding: ownedBinding, timeline, fromFrame });
  const workerId = `${binding.talkId}#${binding.revision}#${planSha256}`;
  const start = freeze({ t: 'start', id: workerId, ljud_id: binding.talkId, rate: 24000, karta, fran_ruta: fromFrame });
  const end = freeze({ t: 'end', id: workerId });
  freeze(ownedBinding); freeze(timeline);
  let cancelled = false;

  return Object.freeze({
    binding: ownedBinding, planSha256, timeline, start, end,
    fps: MOVING_SPEECH_FPS, audioLeadMs: MOVING_SPEECH_AUDIO_LEAD_MS,
    cancel() { cancelled = true; },
    /**
     * Pair one decoded frame with authenticated relay metadata first. The
     * audio clock supplies speechFrame; presented.frame is the actual decoded
     * body frame (mediaTime), never wall time or a nearest-frame search.
     * A successful descriptor belongs inside the dealer source frame, before
     * crop/keying. It cannot render a fourth overlay above the table/cards.
     */
    matchFrame(packet, presented = {}) {
      if (!object(packet)) return null;
      const { id, speechFrame, tag } = packet;
      if (cancelled || id !== workerId || !integer(speechFrame) || speechFrame < fromFrame
        || speechFrame >= timeline.length || !object(presented) || !object(presented.binding)
        || bindingKeys.some(key => presented.binding[key] !== ownedBinding[key])
        || presented.planSha256 !== planSha256 || presented.speechFrame !== speechFrame
        || !object(tag)) return null;
      const expected = timeline[speechFrame];
      if (tag.tagning !== expected.take || tag.ruta !== expected.frame
        || presented.take !== expected.take || presented.frame !== expected.frame
        || presented.sourceSha256 !== expected.sourceSha256) return null;
      const rect = tag.rect;
      if (!Array.isArray(rect) || rect.length !== 4 || rect.some(v => !Number.isFinite(v) || v < 0 || v > 1)
        || rect[2] === 0 || rect[3] === 0 || rect[0] + rect[2] > 1 || rect[1] + rect[3] > 1) return null;
      return freeze({ layer: 'dealer', stage: 'source-before-framing-and-keying',
        planSha256, speechFrame, ...expected, rect: [...rect] });
    },
  });
}
