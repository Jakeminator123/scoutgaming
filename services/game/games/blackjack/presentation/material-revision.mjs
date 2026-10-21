// K04: planning/material revision for an exact (dealer, language, media set) (O01 2.10, MASTERPLAN
// "leadMs/cardMs är K04:s serverägda planering"; review 6328762858). Produces the two numbers C's
// plan uses (coordinator.mjs present(): endAt = startAt + leadMs + draws * cardMs) and a revision
// identity over exactly the media and timing inputs they came from. J08 (root) binds the result to
// the package registry identities and refuses publication without it (assertPublishable). There is
// no default, no fixture and no fallback: a missing or mismatched input refuses.
//
// Identity scope, stated plainly: the media identities are K04's catalogue rows (k04-media.tsv =
// K01 TSV, path + bytes + sha256 of Kevin 5aa7ed10 files). They are NOT Neon ids or Blob
// identities yet (K05); `observed` is whatever the binder verified (e.g. a local hash pass or,
// later, the registry), and the revision changes if any of those hashes or timing inputs change.
//
// Timing rule (an upper bound, not a calibration). Kevin lays a plan from per-take lengths
// (server/shared-table.mjs @ 5aa7ed10): lead 700/1000/1500 ms before the first take (:150, 1500
// when the plan opens on the flip), each take's own length, 80 ms between takes that do not join
// (:132), ready dealers' lengths from meta.json frames at 24 fps by run variant (:114-135,
// readyTimeline), Astrid classic from manifest.json deal[].dur (:170-172). C has only lead + draws
// x card and does not count the flip as a draw (coordinator.mjs engine(): draws = shoe draws). So:
//   cardMs = ceil(longest deal take of the set, any track 1-7/dealer/hole, any variant) + 80
//   leadMs = 1500 + ceil(longest flip take) + 80
// which never ends a plan before Kevin's filmed deal/reveal takes for the same steps would. It is
// deliberately conservative and is not a general reduction: the existing per-take Dragan
// calibration (one dealer, measured per take) is not used here and is no approved general rule. Not in the bound:
// recorded speech steps (C's formula has no speech term), Kevin's start after the previous plan's
// end (:150 Math.max with r.plan.endAt), and an opening `hands` take (refused if a meta has one).
import { createHash } from 'node:crypto';
import { CATALOGUE_SOURCE, LANGUAGES, activationSet } from './media-catalogue.mjs';

export const MATERIAL_REVISION_CONTRACT = 'k04-material-revision/1';
const FPS = 24, GAP_MS = 80, LEAD_MAX_MS = 1500;
const DEAL_TRACKS = ['1', '2', '3', '4', '5', '6', '7', 'dealer', 'hole'];
const RUN_VARIANTS = ['-', '-i', '-u', '-iu']; // every track has these; -v/-iv where filmed (meta)
const ASTRID_DEALS = ['deal_pos1', 'deal_pos2', 'deal_pos3', 'deal_pos4', 'deal_pos5', 'deal_pos6', 'deal_pos7', 'deal_posdealer', 'deal_hole'];
const KEYED = new Set(['dragge', 'paow', 'astrid2', 'marten']);
const LINE_SOURCES = new Set(['replik', 'replik-rot']);

export class PlanningRefused extends Error {
  constructor(refusal) { super(`K04 planning refused: ${refusal.reason}`); this.name = 'PlanningRefused'; this.code = 'planning_refused'; this.refusal = refusal; }
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const get = (map, key) => (map instanceof Map ? map.get(key) : map?.[key]);
// The single timing document per dealer: its ready meta.json, or (Astrid classic) the manifest.
export const timingSourceOf = dealer => KEYED.has(dealer) ? `media/dealers/${dealer}/v2/meta.json` : dealer === 'astrid' ? 'media/manifest.json' : null;

function timingFromMeta(meta) {
  if (Object.hasOwn(meta, 'hands')) return { reason: 'hands_take_not_modelled' };
  let card = 0, flip = 0;
  for (const track of [...DEAL_TRACKS, 'flip']) {
    const frames = meta.frames?.[track];
    if (!frames || RUN_VARIANTS.some(v => !Number.isInteger(frames[v]) || frames[v] <= 0)
      || Object.values(frames).some(n => !Number.isInteger(n) || n <= 0)) return { reason: `meta_frames_incomplete:${track}` };
    const longest = Math.max(...Object.values(frames));
    if (track === 'flip') flip = longest; else card = Math.max(card, longest);
  }
  return { field: 'meta.json frames[track][variant] (frames at 24 fps)', cardFrames: card, flipFrames: flip,
    cardTakeMs: Math.ceil(card * 1000 / FPS), flipTakeMs: Math.ceil(flip * 1000 / FPS) };
}

function timingFromManifest(manifest) {
  const dur = id => manifest.deal?.find(c => c?.id === id)?.dur;
  const all = [...ASTRID_DEALS, 'deal_flip'];
  const bad = all.find(id => !(Number.isFinite(dur(id)) && dur(id) > 0));
  if (bad) return { reason: `manifest_deal_incomplete:${bad}` };
  const card = Math.max(...ASTRID_DEALS.map(dur)), flip = dur('deal_flip');
  return { field: 'manifest.json deal[id].dur (seconds)', cardSeconds: card, flipSeconds: flip,
    cardTakeMs: Math.ceil(card * 1000), flipTakeMs: Math.ceil(flip * 1000) };
}

// -> { ok: true, contract, dealer, language, leadMs, cardMs, revision, media, timing } or
//    { ok: false, dealer, language, reason, missing?, mismatched? }. Never a default value.
// observed: Map|object path -> sha256 of the exact media set being bound (at least the required set).
// documents: Map|object path -> bytes (Buffer/Uint8Array/string) of the timing document.
export function planningRevision({ catalogue, dealer, language, observed, documents } = {}) {
  const refuse = (reason, extra = {}) => Object.freeze({ ok: false, dealer, language, reason, ...extra });
  if (!Array.isArray(catalogue) || !catalogue.length) return refuse('no_catalogue');
  if (!LANGUAGES.includes(language)) return refuse('language_outside_en_sv');
  const source = timingSourceOf(dealer);
  if (!source || !catalogue.some(r => r.dealer === dealer)) return refuse('unknown_dealer');
  // A row's language: its column, or for the data rows (texter.json) the repliker/<lang>/ folder.
  const languageOf = r => r.language || /\/repliker\/([a-z]{2})\//.exec(r.path)?.[1] || null;
  const required = activationSet(catalogue, dealer).filter(r => !languageOf(r) || languageOf(r) === language);
  if (!required.some(r => LINE_SOURCES.has(r.source) && r.language === language)) return refuse('no_recorded_lines_in_language');
  const missing = required.filter(r => get(observed, r.path) === undefined).map(r => r.path);
  const mismatched = required.filter(r => get(observed, r.path) !== undefined && get(observed, r.path) !== r.sha256).map(r => r.path);
  if (missing.length || mismatched.length) return refuse('media_set_not_verified', { missing, mismatched });
  const row = required.find(r => r.path === source), bytes = get(documents, source);
  if (!row) return refuse('timing_source_not_in_set');
  if (bytes === undefined) return refuse('timing_document_missing', { missing: [source] });
  if (sha256(bytes) !== row.sha256) return refuse('timing_document_mismatch', { mismatched: [source] });
  let parsed;
  try { parsed = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { return refuse('timing_document_unreadable'); }
  const timing = KEYED.has(dealer) ? timingFromMeta(parsed) : timingFromManifest(parsed);
  if (timing.reason) return refuse(timing.reason);
  const cardMs = timing.cardTakeMs + GAP_MS, leadMs = LEAD_MAX_MS + timing.flipTakeMs + GAP_MS;
  const media = required.map(r => [r.path, r.bytes, r.sha256]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const inputs = { source, sourceSha256: row.sha256, ...timing, fps: FPS, gapMs: GAP_MS, leadMaxMs: LEAD_MAX_MS,
    rule: 'cardMs=ceil(longest deal take)+gap; leadMs=leadMax+ceil(longest flip take)+gap' };
  const revision = sha256(JSON.stringify([MATERIAL_REVISION_CONTRACT, CATALOGUE_SOURCE.kevin, CATALOGUE_SOURCE.sha256, dealer, language, media, inputs, leadMs, cardMs]));
  return Object.freeze({ ok: true, contract: MATERIAL_REVISION_CONTRACT, dealer, language, leadMs, cardMs, revision,
    media: Object.freeze(media.map(m => Object.freeze(m))), timing: Object.freeze(inputs) });
}

export function requirePlanningRevision(args) {
  const result = planningRevision(args);
  if (!result.ok) throw new PlanningRefused(result);
  return result;
}

// J08 publication gate: a config that carries leadMs/cardMs for (dealer, language) is publishable
// only with a verified planning revision for exactly that dealer/language whose numbers it uses.
// Missing binding, a refusal, or any difference refuses; operators cannot set free values.
export function assertPublishable({ binding, dealer, language, leadMs, cardMs, revision } = {}) {
  const refuse = reason => { throw new PlanningRefused({ ok: false, dealer, language, reason }); };
  if (!binding) refuse('planning_binding_missing');
  if (binding.ok !== true || binding.contract !== MATERIAL_REVISION_CONTRACT) refuse(binding.reason ?? 'planning_binding_invalid');
  if (binding.dealer !== dealer || binding.language !== language) refuse('planning_binding_other_material');
  if (binding.leadMs !== leadMs || binding.cardMs !== cardMs) refuse('planning_timing_not_from_binding');
  if (revision !== undefined && revision !== binding.revision) refuse('planning_revision_mismatch');
  return binding.revision;
}
