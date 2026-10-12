import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_DEALERS, LEGACY_ENGINE_PARTS, resolveLegacyClipPolicy } from '../../packages/presentation/runtime/legacy-clip-policy.mjs';
import { validateContactTake, validateContinuation } from '../../web/public/performance-contact.mjs';
import { resolveMediaAbsolutePath } from '../../tools/media-layout.mjs';
import { StudioStorageError } from '../../web/storage/studio-contract.mjs';

// Keep path arithmetic outside new URL(..., import.meta.url): Next's bundler
// otherwise interprets the directory as an asset dependency to resolve.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASES = { vera: 'dealer', astrid: 'dealers/astrid', amira: 'dealers/amira', mei: 'dealers/mei' };
const indexedRegister = /(?:^|[\\/])(?:dealer|dealers[\\/](?:astrid|amira|mei))[\\/](?:streams[\\/]index\.json|audio[\\/]en[\\/]bank\.json|performance[\\/]manifest\.json)$/;
const readLocalJson = async path => { try { return JSON.parse(await readFile(resolveMediaAbsolutePath(path), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
// Only the retired indexed registers may be absent from the catalog; a missing
// catalog or any other unreadable entry still fails the whole inventory.
const readOptionalJson = async (readMetadata, path) => {
  try { return await readMetadata(path); }
  catch (error) {
    if (indexedRegister.test(String(path)) && String(error?.message || '').startsWith('Runtime metadata missing:')) return null;
    throw error;
  }
};
const DEFAULTS = { idle: 'idle-1/idle/idle', headTilt: 'idle-1/idle/idle-breathe-head-tilt', deal: 'idle-1/actions/action-deal', dealWatch: 'idle-1/actions/action-deal-watch', think: 'idle-1/actions/action-think', gest: 'idle-1/actions/gesticulate1' };
const safeFile = (root, relative) => {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.startsWith('/') || relative.split('/').some(part => part === '..')) return false;
  const path = resolve(root, relative);
  return path.startsWith(resolve(root) + sep) && existsSync(resolveMediaAbsolutePath(path));
};
function engineParts(key) {
  // Exact semantic names, not duration or a guessed neighbouring destination.
  const tail = key.split('/').pop();
  if (key.includes('/idle/') && /^idle(?:-base\d+)?$/.test(tail)) return ['idle'];
  return LEGACY_ENGINE_PARTS.filter(part => part !== 'idle' && DEFAULTS[part].split('/').pop() === tail && key.split('/')[1] === DEFAULTS[part].split('/')[1]);
}
function stagedParts(take) {
  if (take.dealer !== 'astrid') return [];
  if (Number.isInteger(take.box) && take.box >= 0 && take.box <= 6 && /^deal-(left|centre|right)$/.test(take.action)) return [`box${take.box}`];
  if (take.action === 'deal-dealer' && typeof take.faceDown === 'boolean') return [take.faceDown ? 'dealer-hole' : 'dealer-up'];
  return []; // An action direction alone never proves an exact destination.
}

export async function loadLegacyClipInventory({ repository = repositoryRoot, publicRoot = join(repository, 'web/public'), dataDirectory = process.env.CROUPIER_DATA_DIR || join(repository, 'web/data'), administration, mediaAvailable, readMetadata = readLocalJson } = {}) {
  const readJson = path => readOptionalJson(readMetadata, path);
  const clips = [];
  const native = typeof mediaAvailable === 'function';
  const available = file => native ? mediaAvailable(file) : safeFile(publicRoot,file);
  const bo = administration !== undefined ? (typeof administration === 'function' ? await administration() : administration)
    : native ? null : await readJson(join(dataDirectory, 'bo.json')) ?? {};
  if (!bo || typeof bo !== 'object' || Array.isArray(bo)) throw new StudioStorageError('studio_invalid_game_policy');
  // Native callers must supply an explicitly verified migration/read decision
  // for legacy review restrictions. Missing receipt is never an empty overlay.
  let safety;
  if (native) {
    safety = bo.legacyClipReview;
    if (!safety || !/^[a-f0-9]{64}$/.test(safety.sourceSha256) || !safety.neverAgain || typeof safety.neverAgain !== 'object' || Array.isArray(safety.neverAgain)) {
      throw new StudioStorageError('studio_legacy_review_safety_unavailable');
    }
  }
  const nativeSpeech = await readJson(join(publicRoot, 'speech-media.json')) ?? {};
  for (const dealerId of LEGACY_DEALERS) {
    const base = BASES[dealerId];
    const [index, bank, performance] = await Promise.all([readJson(join(publicRoot, base, 'streams/index.json')), readJson(join(publicRoot, base, 'audio/en/bank.json')), readJson(join(publicRoot, base, 'performance/manifest.json'))]);
    for (const [engineKey, value] of Object.entries(index?.clips ?? {})) {
      const lineId = engineKey.includes('/speak/') ? engineKey.split('/').pop() : null;
      const preview = `${base}/preview/${engineKey.split('/').pop()}.mp4`;
      clips.push({ id: `${dealerId}:${engineKey}`, dealerId, kind: 'engine', engineKey, source: `${base}/streams/index.json`, file: `${base}/streams/${value.file}`,
        exactParts: engineParts(engineKey), lineId, text: lineId ? bank?.[lineId]?.text ?? null : null,
        available: await available(`${base}/streams/${value.file}`), previewSrc: await available(preview) ? `/${preview}` : null,
        route: `/?dealer=${dealerId}`, reviewStatus: 'registrerad, ej nytt visuellt godkännande', actualPlayback: false });
    }
    for (const take of [...(performance?.takes ?? []), ...(performance?.continuations ?? []), ...(performance?.reviewCandidates ?? []).filter(item => typeof item === 'object')]) {
      if (!take?.id || !take.media?.src || clips.some(clip => clip.dealerId === dealerId && clip.id === take.id)) continue;
      const validated = dealerId === 'astrid' && !validateContactTake(take, { approved: take.status !== 'review' }).length
        && (!take.continuation || !validateContinuation(take, performance.takes).length);
      clips.push({ id: take.id, dealerId, kind: 'performance', source: `${base}/performance/manifest.json`, file: take.media.src,
        exactParts: validated ? stagedParts(take) : [], lineId: null, text: null, available: await available(take.media.src), previewSrc: `/${take.media.src}`,
        route: `/?dealer=${dealerId}&performance=staged`, reviewStatus: take.status ?? 'unknown', actualPlayback: false });
    }
    for (const [lineId, take] of Object.entries(nativeSpeech[dealerId] ?? {})) {
      clips.push({ id: `native:${dealerId}:${lineId}`, dealerId, kind: 'recorded-speech', source: 'speech-media.json', file: take.src,
        exactParts: [], lineId, text: take.text ?? null, available: await available(take.src), previewSrc: await available(take.src) ? `/${take.src}` : null,
        route: `/?dealer=${dealerId}`, reviewStatus: take.review?.result ?? 'registrerat exakt talpar; ingen ny granskning', actualPlayback: false });
    }
    if (['astrid', 'amira'].includes(dealerId)) {
      const source = `review/${dealerId}-green-speak/speak.json`;
      const green = await readJson(join(publicRoot, source));
      for (const [lineId, take] of Object.entries(green?.lines ?? {})) {
        clips.push({ id: `green:${dealerId}:${lineId}`, dealerId, kind: 'recorded-speech', source, file: take.media?.src,
          exactParts: [], lineId, text: take.text ?? null, available: await available(take.media?.src) && await available(take.audio), previewSrc: null,
          route: `/v2/?dealer=${dealerId}`, reviewStatus: green.status ?? 'unknown', actualPlayback: false });
      }
    }
  }
  const neverAgain = native ? safety.neverAgain : bo.neverAgain;
  // A review rejection remains a safety restriction even though BO can no
  // longer select a clip. It must be restored explicitly before a Lab import.
  for (const clip of clips) if (neverAgain?.[clip.id]) { clip.available = false; clip.reviewStatus = 'Never again'; }
  return { source: 'existing-media-registers', clips, defaults: DEFAULTS, actualPlayback: false,
    ...(native ? {reviewSafetyVerified:true} : {}) };
}

export async function legacyClipControls(project, options) {
  const inventory = await loadLegacyClipInventory(options);
  return { ...inventory, runtime: resolveLegacyClipPolicy(project, inventory), editor: 'Backoffice/Lab', legacyWrites: false };
}
