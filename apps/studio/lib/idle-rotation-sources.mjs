// Frozen idle sequences per dealer: Kevin's selection at an exact ref, each clip
// bound to its original bytes (SHA-256 and size). Names are display-only. This is
// read-only data: nothing here uploads, registers, approves or publishes media.
import paow from './idle-rotation-sources/paow-de31659c.json' with { type: 'json' };
import dragan from './idle-rotation-sources/dragan-de31659c.json' with { type: 'json' };
import { isActiveDealerId } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { validateIdlePolicy, MAX_IDLE_VARIANTS } from '../../../packages/presentation/runtime/idle-policy.mjs';

const SOURCE_FIELDS = ['schemaVersion', 'repository', 'branch', 'ref', 'dealerId', 'sourceDealerId', 'selectionPath', 'baseline', 'clips'];
const CLIP_FIELDS = ['id', 'path', 'gitBlobSha', 'sha256', 'bytes', 'frames', 'fps', 'durationMs', 'phase', 'from', 'to', 'weight', 'head', 'calm'];
const exact = (value, fields) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const text = (value, pattern) => typeof value === 'string' && pattern.test(value);
const placeholder = index => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

function rotationPolicy(source, familyId, rows) {
  const baseline = rows.find(row => row.take.id === source.baseline);
  return { schemaVersion: 1, familyId,
    base: [{ videoId: baseline.videoId, durationMs: baseline.take.durationMs, weight: 100 }],
    variants: rows.filter(row => row !== baseline).map(({ take, videoId }) => ({ videoId, durationMs: take.durationMs,
      use: 'rotation', automatic: null, description: take.id })),
    rotation: { clips: rows.map(({ take, videoId }) => ({ videoId, phase: take.phase, from: take.from, to: take.to,
      weight: take.weight, head: take.head, calm: take.calm })) } };
}

// The file shape, unique ids and bytes, and the whole selection as a valid pose
// graph with the baseline first. A source that fails here never loads.
export function validateIdleRotationSource(source) {
  const fail = () => { throw Error('Ogiltig vilokälla.'); };
  if (!exact(source, SOURCE_FIELDS) || source.schemaVersion !== 1 || !text(source.repository, /^[\w.-]+\/[\w.-]+$/)
    || !text(source.branch, /^[\w./-]{1,80}$/) || !text(source.ref, /^[a-f0-9]{40}$/) || !isActiveDealerId(source.dealerId)
    || !text(source.sourceDealerId, /^[a-z][a-z0-9-]{0,39}$/) || !text(source.selectionPath, /^[\w./-]{1,200}$/)
    || !Array.isArray(source.clips) || source.clips.length < 1 || source.clips.length > MAX_IDLE_VARIANTS + 1) fail();
  const ids = new Set(), hashes = new Set();
  for (const take of source.clips) {
    if (!exact(take, CLIP_FIELDS) || !text(take.id, /^[a-z][a-z0-9]{0,39}$/) || ids.has(take.id)
      || !text(take.path, /^[\w./-]{1,240}$/) || !take.path.endsWith('/' + take.id + '.mp4')
      || !text(take.gitBlobSha, /^[a-f0-9]{40}$/) || !text(take.sha256, /^[a-f0-9]{64}$/) || hashes.has(take.sha256)
      || !Number.isSafeInteger(take.bytes) || take.bytes < 1 || !Number.isSafeInteger(take.frames) || take.frames < 1
      || !Number.isSafeInteger(take.fps) || take.fps < 1 || take.durationMs !== Math.round(take.frames * 1000 / take.fps)) fail();
    ids.add(take.id); hashes.add(take.sha256);
  }
  if (!ids.has(source.baseline)) fail();
  try {
    validateIdlePolicy(rotationPolicy(source, source.dealerId + '/idle.ready/ready',
      source.clips.map((take, index) => ({ take, videoId: placeholder(index) }))));
  } catch { fail(); }
  return source;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}
const SOURCES = new Map();
for (const source of [paow, dragan]) {
  validateIdleRotationSource(source);
  if (SOURCES.has(source.dealerId)) throw Error('Ogiltig vilokälla.');
  SOURCES.set(source.dealerId, deepFreeze(structuredClone(source)));
}
export const IDLE_ROTATION_DEALERS = Object.freeze([...SOURCES.keys()]);
export function idleRotationSource(dealerId) {
  return SOURCES.has(dealerId) ? structuredClone(SOURCES.get(dealerId)) : null;
}

// Only the registered owner's exact original counts: same dealer, idle
// classification, available, not rejected and not on its way to the trash.
function ownOriginal(video, take, dealerId, familyId) {
  return video?.dealer === dealerId && video.available === true && video.verdict !== 'no' && !video.deletion
    && video.sha256 === take.sha256 && video.bytes === take.bytes && video.classification?.dealerId === dealerId
    && video.classification.kind === 'idle' && video.classification.eventId === 'idle.ready'
    && (video.classification.playback ?? 'once') === 'once' && video.familyId === familyId;
}
const names = rows => rows.slice(0, 6).map(row => row.id).join(', ') + (rows.length > 6 ? ` och ${rows.length - 6} till` : '');

// Binds a subset of the dealer's frozen source (default: all of it) to the
// registered originals. The result lists every source clip with its status, so
// missing media is named instead of silently dropped. `policy` is null until
// every selected clip has exactly one original and the pose graph is valid.
export function prepareIdleRotation(policy, inventory, { selection = null } = {}) {
  const dealerId = typeof policy?.familyId === 'string' ? policy.familyId.split('/')[0] : '';
  const source = SOURCES.get(dealerId);
  if (!source || policy.familyId !== dealerId + '/idle.ready/ready') return null;
  const videos = Array.isArray(inventory?.videos) ? inventory.videos : [];
  const known = new Set(source.clips.map(take => take.id)), chosen = new Set(selection ?? known);
  const clips = source.clips.map(take => {
    const rows = videos.filter(video => ownOriginal(video, take, dealerId, policy.familyId));
    return { id: take.id, phase: take.phase, from: take.from, to: take.to, head: take.head, calm: take.calm,
      baseline: take.id === source.baseline, selected: chosen.has(take.id),
      status: rows.length === 1 ? 'registered' : rows.length ? 'ambiguous' : 'missing', videoId: rows.length === 1 ? rows[0].id : null };
  });
  const result = (next, error) => ({ dealerId, ref: source.ref, baseline: source.baseline, total: clips.length,
    matched: clips.filter(row => row.status === 'registered').length, selected: clips.filter(row => row.selected).length,
    clips, policy: next, error });
  if (selection !== null && (!Array.isArray(selection) || selection.some(id => !known.has(id))))
    return result(null, 'Urvalet innehåller ett klipp som inte finns i dealerns vilokälla.');
  if (!chosen.has(source.baseline)) return result(null, `Basklippet ${source.baseline} ingår alltid i vilosekvensen.`);
  const picked = clips.filter(row => row.selected);
  const ambiguous = picked.filter(row => row.status === 'ambiguous');
  if (ambiguous.length) return result(null, `Flera original matchar ${names(ambiguous)}. Välj rätt original innan sekvensen kopplas.`);
  const missing = picked.filter(row => row.status === 'missing');
  if (missing.length) return result(null, missing.length === 1
    ? `Originalet ${missing[0].id} saknas i biblioteket eller har ändrats. Ladda upp det eller välj bort klippet.`
    : `${missing.length} valda original saknas i biblioteket eller har ändrats: ${names(missing)}. Ladda upp dem eller välj bort klippen.`);
  const baseline = picked.find(row => row.baseline);
  if (policy.base?.[0]?.videoId !== baseline.videoId) return result(null, `Välj ${source.baseline} som basklipp före inkopplingen.`);
  const clasped = picked.some(row => row.from === 'clasped' || row.to === 'clasped');
  if (clasped && (!picked.some(row => row.from === 'rest' && row.to === 'clasped') || !picked.some(row => row.from === 'clasped' && row.to === 'rest')))
    return result(null, 'Knäppta händer kräver minst ett klipp in i posen och ett tillbaka till vila.');
  try {
    const rows = picked.map(row => ({ take: source.clips.find(take => take.id === row.id), videoId: row.videoId }));
    return result(validateIdlePolicy(rotationPolicy(source, policy.familyId, rows)), null);
  } catch (error) { return result(null, error instanceof Error ? error.message : 'Vilosekvensen är ogiltig.'); }
}

// Which source clips a saved sequence contains, and how many saved clips fall
// outside the source (another ref's selection, or an original that changed).
export function savedIdleRotationSelection(prepared, policy) {
  const saved = new Set(policy?.rotation?.clips.map(row => row.videoId) ?? []);
  const bound = new Set(prepared.clips.map(row => row.videoId).filter(Boolean));
  return { ids: prepared.clips.filter(row => row.videoId && saved.has(row.videoId)).map(row => row.id),
    outside: [...saved].filter(id => !bound.has(id)).length };
}
