import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyBindingCandidate, LEGACY_DEALERS, LEGACY_ENGINE_PARTS, resolveLegacyClipPolicy } from '../../presentation-runtime/legacy-clip-policy.mjs';
import { validateContactTake, validateContinuation } from '../../web/public/performance-contact.mjs';

// Keep path arithmetic outside new URL(..., import.meta.url): Next's bundler
// otherwise interprets the directory as an asset dependency to resolve.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASES = { vera: 'dealer', astrid: 'dealers/astrid', amira: 'dealers/amira', mei: 'dealers/mei' };
const readJson = async path => { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const DEFAULTS = { idle: 'idle-1/idle/idle', headTilt: 'idle-1/idle/idle-breathe-head-tilt', deal: 'idle-1/actions/action-deal', dealWatch: 'idle-1/actions/action-deal-watch', think: 'idle-1/actions/action-think', gest: 'idle-1/actions/gesticulate1' };
const safeFile = (root, relative) => {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.startsWith('/') || relative.split('/').some(part => part === '..')) return false;
  const path = resolve(root, relative);
  return path.startsWith(resolve(root) + sep) && existsSync(path);
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

export async function loadLegacyClipInventory({ repository = repositoryRoot, publicRoot = join(repository, 'web/public'), dataDirectory = process.env.CROUPIER_DATA_DIR || join(repository, 'web/data') } = {}) {
  const clips = [];
  const nativeSpeech = await readJson(join(publicRoot, 'speech-media.json')) ?? {};
  for (const dealerId of LEGACY_DEALERS) {
    const base = BASES[dealerId];
    const [index, bank, performance] = await Promise.all([readJson(join(publicRoot, base, 'streams/index.json')), readJson(join(publicRoot, base, 'audio/en/bank.json')), readJson(join(publicRoot, base, 'performance/manifest.json'))]);
    for (const [engineKey, value] of Object.entries(index?.clips ?? {})) {
      const lineId = engineKey.includes('/speak/') ? engineKey.split('/').pop() : null;
      const preview = `${base}/preview/${engineKey.split('/').pop()}.mp4`;
      clips.push({ id: `${dealerId}:${engineKey}`, dealerId, kind: 'engine', engineKey, source: `${base}/streams/index.json`, file: `${base}/streams/${value.file}`,
        exactParts: engineParts(engineKey), lineId, text: lineId ? bank?.[lineId]?.text ?? null : null,
        available: safeFile(publicRoot, `${base}/streams/${value.file}`), previewSrc: safeFile(publicRoot, preview) ? `/${preview}` : null,
        route: `/?dealer=${dealerId}`, reviewStatus: 'registrerad, ej nytt visuellt godkännande', actualPlayback: false });
    }
    for (const take of [...(performance?.takes ?? []), ...(performance?.continuations ?? []), ...(performance?.reviewCandidates ?? []).filter(item => typeof item === 'object')]) {
      if (!take?.id || !take.media?.src || clips.some(clip => clip.dealerId === dealerId && clip.id === take.id)) continue;
      const validated = dealerId === 'astrid' && !validateContactTake(take, { approved: take.status !== 'review' }).length
        && (!take.continuation || !validateContinuation(take, performance.takes).length);
      clips.push({ id: take.id, dealerId, kind: 'performance', source: `${base}/performance/manifest.json`, file: take.media.src,
        exactParts: validated ? stagedParts(take) : [], lineId: null, text: null, available: safeFile(publicRoot, take.media.src), previewSrc: `/${take.media.src}`,
        route: `/?dealer=${dealerId}&performance=staged`, reviewStatus: take.status ?? 'unknown', actualPlayback: false });
    }
    for (const [lineId, take] of Object.entries(nativeSpeech[dealerId] ?? {})) {
      clips.push({ id: `native:${dealerId}:${lineId}`, dealerId, kind: 'recorded-speech', source: 'speech-media.json', file: take.src,
        exactParts: [], lineId, text: take.text ?? null, available: safeFile(publicRoot, take.src), previewSrc: safeFile(publicRoot, take.src) ? `/${take.src}` : null,
        route: `/?dealer=${dealerId}`, reviewStatus: take.review?.result ?? 'registrerat exakt talpar; ingen ny granskning', actualPlayback: false });
    }
    if (['astrid', 'amira'].includes(dealerId)) {
      const source = `review/${dealerId}-green-speak/speak.json`;
      const green = await readJson(join(publicRoot, source));
      for (const [lineId, take] of Object.entries(green?.lines ?? {})) {
        clips.push({ id: `green:${dealerId}:${lineId}`, dealerId, kind: 'recorded-speech', source, file: take.media?.src,
          exactParts: [], lineId, text: take.text ?? null, available: safeFile(publicRoot, take.media?.src) && safeFile(publicRoot, take.audio), previewSrc: null,
          route: `/v2/?dealer=${dealerId}`, reviewStatus: green.status ?? 'unknown', actualPlayback: false });
      }
    }
  }
  const bo = await readJson(join(dataDirectory, 'bo.json')) ?? {};
  // A review rejection remains a safety restriction even though BO can no
  // longer select a clip. It must be restored explicitly before a Lab import.
  for (const clip of clips) if (bo.neverAgain?.[clip.id]) { clip.available = false; clip.reviewStatus = 'Never again'; }
  const legacy = Object.entries(bo.clipAssignments ?? {}).flatMap(([dealerId, parts]) => Object.entries(parts).map(([part, assignment]) => {
    const binding = { dealerId, part, clipId: assignment?.clip ?? '' };
    const candidate = legacyBindingCandidate({ clips }, binding);
    return { ...binding, at: assignment?.at ?? null, active: false, importable: Boolean(candidate),
      reason: candidate ? 'exakt dealer och situation; kräver explicit import och sparning i Lab' : 'saknar säker exakt motsvarighet; endast äldre granskningsdata' };
  }));
  return { source: 'existing-media-registers', clips, legacy, defaults: DEFAULTS, actualPlayback: false };
}

export async function legacyClipControls(project, options) {
  const inventory = await loadLegacyClipInventory(options);
  return { ...inventory, runtime: resolveLegacyClipPolicy(project, inventory), editor: 'Backoffice/Lab', legacyWrites: false,
    routes: LEGACY_DEALERS.map(dealerId => ({ dealerId, engineRoute: `/?dealer=${dealerId}`, studioRoute: dealerId === 'astrid' ? '/?dealer=astrid&presentation=local' : null,
      policy: dealerId === 'astrid' ? 'mediaPolicy/idlePolicy för presentation=local; legacyClipPolicy för originalmotorn' : 'legacyClipPolicy för originalmotorn', reload: 'Ladda om spelfliken mellan händer efter sparning.' })) };
}
