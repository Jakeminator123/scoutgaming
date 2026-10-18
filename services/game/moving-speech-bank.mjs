import { createHash } from 'node:crypto';
import { isSpeechReferenceVideo } from '../../packages/presentation/contracts/dealer-speech-profile.mjs';
import { prepareMovingSpeechPcmInput } from './moving-speech-pcm.mjs';

const SHA = /^[a-f0-9]{64}$/, UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const fail = code => { throw Error(code); };
export const movingSpeechHash = bytes => createHash('sha256').update(bytes).digest('hex');
const int = n => Number.isSafeInteger(n) && n >= 0;
const exact = (v, keys) => v && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Versioned authoring evidence, not a second runtime registry or approval.
 * Stable take names are based on media IDs, never labels, paths or duration.
 * Rest is explicit: it is not the last frame of an alphabetically first file.
 */
export function createMovingSpeechSourceSet({ dealerId, workerAvatar = dealerId, clips, rest } = {}) {
  if (!ID.test(dealerId ?? '') || !ID.test(workerAvatar ?? '')
    || !Array.isArray(clips) || !clips.length || clips.length > 128
    || !exact(rest, ['videoId', 'frame']) || !int(rest.frame)) fail('moving_bank_invalid_sources');
  const seen = new Set();
  const sources = clips.map(c => {
    if (!c || !UUID.test(c.videoId ?? '') || seen.has(c.videoId) || !SHA.test(c.sha256 ?? '')
      || !int(c.bytes) || c.bytes < 1 || c.bytes > 256 * 1024 * 1024
      || c.fps !== 24 || !int(c.frameCount) || !c.frameCount || c.frameCount > 600
      || c.width !== 1080 || c.height !== 1920) fail('moving_bank_invalid_source');
    seen.add(c.videoId);
    return { videoId: c.videoId, take: 'clip-' + c.videoId, sha256: c.sha256, bytes: c.bytes,
      fps: 24, frameCount: c.frameCount, width: c.width, height: c.height };
  }).sort((a, b) => a.videoId.localeCompare(b.videoId));
  const resting = sources.find(c => c.videoId === rest.videoId);
  if (!resting || rest.frame >= resting.frameCount) fail('moving_bank_invalid_rest');
  const manifest = { schemaVersion: 1, dealerId, workerAvatar, clips: sources,
    rest: { videoId: rest.videoId, frame: rest.frame } };
  return freeze({ ...manifest, sourceSetSha256: movingSpeechHash(JSON.stringify(manifest)) });
}

export function validateMovingSpeechSourceSet(value) {
  if (!exact(value, ['schemaVersion', 'dealerId', 'workerAvatar', 'clips', 'rest', 'sourceSetSha256'])
    || value.schemaVersion !== 1) fail('moving_bank_invalid_sources');
  const checked = createMovingSpeechSourceSet(value);
  if (checked.sourceSetSha256 !== value.sourceSetSha256
    || JSON.stringify(checked.clips) !== JSON.stringify(value.clips)) fail('moving_bank_sources_changed');
  return checked;
}

export function assertMovingSpeechSource(video, dealerId, expected) {
  if (!isSpeechReferenceVideo(video, dealerId) || video.classification?.dealerId !== dealerId
    || video.deletion || video.contentType !== 'video/mp4' || video.storage !== 'private-blob'
    || !['action', 'idle'].includes(video.classification?.kind)
    || video.classification?.recordedSpeech
    || !UUID.test(video.id) || video.bytes > 256 * 1024 * 1024
    || expected && (video.id !== expected.videoId || video.sha256 !== expected.sha256 || video.bytes !== expected.bytes)) {
    fail('moving_bank_source_unavailable');
  }
  return video;
}

/** Server-only adapter, after ordinary owner/profile/budget admission.
 * frozenContext is returned by createFrozenDealerPresentationContext.resolve;
 * readRegistry and verifyBank must be trusted services, never request fields.
 * verifyBank verifies the archive bytes AND the loaded worker bank identity;
 * a control-plane image receipt alone does not attest the bank.
 */
export function createRegisteredMovingSpeech({ readRegistry, verifyBank } = {}) {
  if (typeof readRegistry !== 'function' || typeof verifyBank !== 'function') fail('moving_bank_configuration');
  return Object.freeze({
    async prepare({ sourceSet, avatarSha256, frozenContext, binding, frames, audio, fromFrame = 0, signal } = {}) {
      const sources = validateMovingSpeechSourceSet(sourceSet);
      frozenContext = structuredClone(frozenContext);
      binding = structuredClone(binding);
      audio = audio && { ...audio, pcm: audio.pcm instanceof Uint8Array ? Buffer.from(audio.pcm) : audio.pcm };
      const context = frozenContext?.context;
      if (!SHA.test(avatarSha256 ?? '') || context?.dealerId !== sources.dealerId
        || frozenContext?.dealer?.id !== sources.dealerId || frozenContext.schemaVersion !== 3
        || !Array.isArray(frozenContext.records) || !Array.isArray(frames) || !frames.length
        || frames.length > 600) fail('moving_bank_publication_mismatch');
      signal?.throwIfAborted();
      const clips = new Map(sources.clips.map(c => [c.videoId, c]));
      const required = new Set();
      const timeline = frames.map(frame => {
        const c = clips.get(frame?.videoId);
        if (!c || !int(frame.frame) || frame.frame >= c.frameCount
          || frame.still !== undefined && frame.still !== true) fail('moving_bank_frame_unavailable');
        required.add(c.videoId);
        if (frame.still === true) {
          if (frame.videoId !== sources.rest.videoId || frame.frame !== sources.rest.frame) fail('moving_bank_invalid_rest');
          return { take: 'vila', frame: 0 };
        }
        return { take: c.take, frame: frame.frame };
      });
      async function checkSources() {
        const registry = await readRegistry();
        signal?.throwIfAborted();
        for (const id of required) {
          const expected = clips.get(id);
          const current = registry?.videos?.filter(row => row.id === id);
          if (current?.length !== 1) fail('moving_bank_source_unavailable');
          assertMovingSpeechSource(current[0], sources.dealerId, expected);
          const published = frozenContext.records.filter(row => row.id === id);
          if (published.length !== 1 || published[0].sha256 !== expected.sha256
            || published[0].size !== expected.bytes || published[0].contentType !== 'video/mp4'
            || published[0].classification?.dealerId !== sources.dealerId
            || published[0].classification?.archived || published[0].deletion
            || !['action', 'idle'].includes(published[0].classification?.kind)
            || published[0].classification?.recordedSpeech) fail('moving_bank_publication_mismatch');
        }
      }
      await checkSources();
      const receipt = await verifyBank({ dealerId: sources.dealerId, workerAvatar: sources.workerAvatar,
        sourceSetSha256: sources.sourceSetSha256, avatarSha256, signal });
      signal?.throwIfAborted();
      if (!receipt || receipt.dealerId !== sources.dealerId || receipt.workerAvatar !== sources.workerAvatar
        || receipt.sourceSetSha256 !== sources.sourceSetSha256 || receipt.avatarSha256 !== avatarSha256) {
        fail('moving_bank_unverified');
      }
      await checkSources();
      const planClips = [...required].map(id => ({ ...clips.get(id), dealerId: sources.dealerId, kind: 'video' }));
      if (timeline.some(f => f.take === 'vila')) planClips.push({ dealerId: sources.dealerId, take: 'vila',
        sha256: clips.get(sources.rest.videoId).sha256, fps: 24, frameCount: 1, kind: 'still' });
      return prepareMovingSpeechPcmInput({ audio, frames: timeline, fromFrame, clips: planClips,
        binding: { ...binding, dealerId: sources.dealerId, workerAvatar: sources.workerAvatar, avatarSha256 } });
    },
  });
}
