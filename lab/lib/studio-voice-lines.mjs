import {createRuntimeMetadataBytesReader} from '../../tools/runtime-media-catalog.mjs';
import {readRuntimeCatalog} from '../../packages/studio-registry/server/runtime-catalog.mjs';
import { createHash } from 'node:crypto';
import { repositoryRoot as defaultRoot, resolvePublicMedia } from '../../tools/media-layout.mjs';
import { verifiedMediaBlobStorage } from './media-blob-index.mjs';
import { canonicalStudioJson, StudioStorageError } from '../../web/storage/studio-contract.mjs';
import { SPEECH_LINES } from '../../packages/presentation/contracts/speech-lines.mjs';

const roster = Object.freeze({ astrid: 'Astrid' });
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = () => { throw new StudioStorageError('studio_voice_registry_unavailable'); };
const lineKey = /^[a-z][a-z0-9_-]{0,99}$/;

export function studioVoiceIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = ['audioSha256', 'videoSha256', 'previewSha256', 'textSha256', 'indexSha256', 'audioDelayMs'];
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || keys.slice(0, 5).some(key => !/^[a-f0-9]{64}$/.test(value[key]))
    || !Number.isFinite(value.audioDelayMs) || value.audioDelayMs < 0 || value.audioDelayMs > 60_000) return null;
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}
export function voiceReviewMatches(record, identity) {
  return Boolean(studioVoiceIdentity(identity) && record && typeof record === 'object' && !Array.isArray(record)
    && ['approved', 'rejected'].includes(record.verdict) && typeof record.by === 'string' && record.by.trim()
    && typeof record.at === 'string' && Number.isFinite(Date.parse(record.at))
    && studioVoiceIdentity(record.identity)
    && canonicalStudioJson(record.identity) === canonicalStudioJson(identity));
}

// Scoped Neon metadata only. Never enumerate uploads, old review files,
// media bytes or BO disk config. Presence/hash proves identity, not visual sync.
export function createRegisteredVoiceLines({ env = process.env, repositoryRoot = defaultRoot, repository, runtimeCatalog } = {}) {
  const baseOptions = { repositoryRoot, env: Object.freeze({ ...env }) };
  return async () => {
    if (baseOptions.env.CROUPIER_MEDIA_STORAGE !== 'blob' || !baseOptions.env.BLOB_READ_WRITE_TOKEN) fail();
    try {
      const options = { ...baseOptions, runtimeCatalog: runtimeCatalog ?? await readRuntimeCatalog(repository) };
      const readMetadataBytes = createRuntimeMetadataBytesReader(repositoryRoot, options);
      async function registeredJson(url) {
        const row = resolvePublicMedia(url, options);
        if (!row || row.size < 2 || row.size > 4 * 1024 * 1024) fail();
        const bytes = await readMetadataBytes(row.file);
        if (!bytes || bytes.length !== row.size || sha(bytes) !== row.sha256) fail();
        return JSON.parse(bytes.toString('utf8'));
      }
      function media(url, contentType) {
        const row = resolvePublicMedia(url, options); if (!row) return null;
        const pointer = verifiedMediaBlobStorage(row.logicalPath, { access: 'public', sha256: row.sha256, size: row.size, contentType }, options);
        return pointer ? { url, sha256: row.sha256 } : null;
      }
      const dealers = [];
      for (const [dealer, name] of Object.entries(roster)) {
        const base = `dealers/${dealer}`;
        const bankUrl = `/${base}/audio/en/bank.json`, indexUrl = `/${base}/streams/index.json`;
        // The indexed speech bank is gone. A dealer with neither register is an
        // empty list, not a storage failure. A partial or corrupt register still
        // fails closed.
        if (!resolvePublicMedia(bankUrl, options) && !resolvePublicMedia(indexUrl, options)) {
          dealers.push({ dealer, name, lines: [] });
          continue;
        }
        const [bank, index] = await Promise.all([registeredJson(bankUrl), registeredJson(indexUrl)]);
        if (!bank || Array.isArray(bank) || !index?.clips || Array.isArray(index.clips)) fail();
        const ids = new Set([...Object.keys(bank), ...Object.keys(index.clips).filter(key => /^idle-1\/speak\/[a-z][a-z0-9_-]{0,99}$/.test(key)).map(key => key.split('/').at(-1))]);
        if (ids.size > 200 || [...ids].some(key => !lineKey.test(key))) fail();
        const lines = [];
        for (const key of [...ids].sort()) {
          const text = bank[key]?.text ?? SPEECH_LINES[key];
          if (typeof text !== 'string' || !text.trim() || text.length > 2000) fail();
          const clip = index.clips[`idle-1/speak/${key}`];
          const audio = media(`/${base}/audio/en/${key}.mp3`, 'audio/mpeg');
          const preview = media(`/${base}/preview/${key}.mp4`, 'video/mp4');
          const safeClip = clip && typeof clip.file === 'string' && /^[a-zA-Z0-9_.-]+\.h264$/.test(clip.file);
          const video = safeClip ? media(`/${base}/streams/${clip.file}`, 'application/octet-stream') : null;
          const identity = audio && preview && video ? studioVoiceIdentity({ audioSha256: audio.sha256, videoSha256: video.sha256,
            previewSha256: preview.sha256, textSha256: sha(text), indexSha256: sha(canonicalStudioJson(clip)), audioDelayMs: clip.audioDelayMs }) : null;
          lines.push({ key, text, clip: Boolean(video), delay: clip?.audioDelayMs ?? null,
            audio: audio?.url ?? null, preview: preview?.url ?? null, identity, reviewable: Boolean(identity),
            source: 'registered-indexed-speech', productionApproved: false });
        }
        dealers.push({ dealer, name, lines });
      }
      return { dealers, source: 'registered-indexed-speech', automaticVisualApproval: false };
    } catch { fail(); }
  };
}
