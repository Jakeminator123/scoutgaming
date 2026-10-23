// Frozen Kevin import sources shared by the offline plan and the Studio import
// assistant: exact repository refs, Git blob identities, declared texts, pose
// metadata and each source's runtime selection. Read-only data: nothing here
// registers a dealer, uploads, publishes or approves content.
import dragge from './dealer-import-kevin-source.json' with { type: 'json' };
import paow from './dealer-import-kevin-source-paow.json' with { type: 'json' };
import { DRAGAN_KEVIN_PROFILE } from '../../../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';

const SOURCES = Object.freeze({ [dragge.sourceDealerId]: dragge, [paow.sourceDealerId]: paow });
export const FROZEN_IMPORT_SOURCE_ALIASES = Object.freeze(Object.keys(SOURCES));
export const DEFAULT_FROZEN_IMPORT_SOURCE_ALIAS = dragge.sourceDealerId;
const fail = code => { throw Object.assign(Error(code), { code }); };

export function frozenImportSource(alias) {
  if (!Object.hasOwn(SOURCES, alias)) fail('unknown_source_alias');
  return structuredClone(SOURCES[alias]);
}
export function frozenImportSourceForDealer(dealerId) {
  return Object.values(SOURCES).find(source => source.targetDealerId === dealerId) ?? null;
}
// Small projection for the catalogue response: no file lists or texts.
export function frozenImportSourcesSummary() {
  return Object.values(SOURCES).map(source => ({ id: source.id, sourceDealerId: source.sourceDealerId, targetDealerId: source.targetDealerId,
    branch: source.branch, ref: source.ref, files: source.files.length, languages: [...source.languages],
    ...(source.additionalLanguages ? { additionalLanguages: [...source.additionalLanguages] } : {}) }));
}

// Dragan's frozen runtime at 31f50618 played these recorded lines. That source
// predates the K05 matrix, so its selection stays in code. Paow's selection is
// the root-reviewed K05 matrix carried on every file entry.
const DRAGAN_MANIFEST_LINES = ['goodluck_1', 'sidebet_2', 'insurance_1', 'double_1', 'bust_1', 'blackjack_1',
  'dealerblackjack_1', 'dealerbust_1', 'win_1', 'push_1', 'lose_1'];
const DRAGAN_PLAYED_LINES = new Set([...DRAGAN_MANIFEST_LINES, ...['bust', 'blackjack', 'twentyone'].flatMap(e => Array.from({ length: 7 }, (_, n) => e + '_' + (n + 1))),
  'win_2', 'win_3', ...['placebets', 'chatter1', 'chatter2'].flatMap(e => [1, 2, 3].map(n => e + '_' + n)),
  'banter_1', 'remark_hit17_1', 'remark_hit17_2', 'remark_hit20_1', 'remark_stand11_1', 'table_cash_1', 'table_trust_1',
  ...['axel', 'emil', 'fredrik', 'guest', 'ian', 'jakob', 'john', 'kevin'].map(n => 'greet_' + n)]);
const DRAGAN_WARMED_LINES = new Set(['goodluck_2', 'goodluck_3']);
function k05SpeechSelection(source, entry, language) {
  const selection = entry.k05?.selection ?? null;
  if (selection === 'vald') return { runtimeUses: ['playback'] };
  if (!source.languages.includes(language)) return { runtimeUses: [], exclusion: 'language-outside-k05-selection' };
  if (selection?.startsWith('uppskjuten')) return { runtimeUses: [], exclusion: 'deferred-by-k05-review-6329902583' };
  return { runtimeUses: [], exclusion: selection ? 'not-selected-in-k05-matrix' : 'not-in-k05-activation-set' };
}
const RUNTIME = Object.freeze({
  [dragge.id]: Object.freeze({ profile: DRAGAN_KEVIN_PROFILE, lipsyncAvatar: 'dragan_vila2x',
    idle: relative => /^idle-v2\/(breath|glance|smile)\.mp4$/.test(relative) ? { version: 'idle-v2', calm: null, weight: null } : null,
    speech: ({ takeId }) => DRAGAN_PLAYED_LINES.has(takeId) ? { runtimeUses: ['playback', ...(DRAGAN_MANIFEST_LINES.includes(takeId) ? ['manifest', 'preload'] : [])] }
      : DRAGAN_WARMED_LINES.has(takeId) ? { runtimeUses: ['worker-preload'] } : { runtimeUses: [], exclusion: 'not-referenced-by-frozen-runtime' } }),
  [paow.id]: Object.freeze({ profile: null, lipsyncAvatar: paow.runtime.lipsyncAvatar,
    idle: relative => { const take = paow.runtime.idles.find(row => row.path === paow.sourceRoot + relative); return take ? { version: 'h3-v2', calm: take.calm, weight: take.weight } : null; },
    speech: ({ entry, language }) => k05SpeechSelection(paow, entry, language) }),
});
export function frozenImportRuntime(source) {
  const runtime = RUNTIME[source.id];
  if (!runtime) fail('unknown_source_runtime');
  return runtime;
}

// Where a frozen file belongs in the saved catalogue. A slot is only proposed
// when the saved project has it; the proposed slot stays visible otherwise.
export function frozenImportPlacement(source, entry, catalog) {
  const runtime = frozenImportRuntime(source);
  const relative = entry.path.startsWith(source.sourceRoot) ? entry.path.slice(source.sourceRoot.length) : entry.path;
  const base = { category: 'unreferenced', runtimeUses: [], slotId: null, selection: 'unassigned', audioPolicy: 'preserve-source',
    pose: null, speech: null, calibration: null };
  const match = /^v2\/(pos([1-7]|dealer)|hole|flip)(?:-(i|u|iu|v|iv))?\.mp4$/.exec(relative);
  if (match) {
    const target = match[2] ?? match[1], version = match[3] ?? '';
    const slotId = /^[1-7]$/.test(target)
      ? 'deal.player.' + (Number(target) <= 2 ? 'left' : Number(target) <= 5 ? 'centre' : 'right') + '/box' + (Number(target) - 1)
      : target === 'dealer' ? 'deal.dealer/dealer-up' : target === 'hole' ? 'deal.dealer/dealer-hole' : 'reveal.dealer/dealer-hole';
    const pose = { entry: target === 'flip' || version.includes('i') ? 'VILA' : 'REDO',
      exit: ['hole', 'flip'].includes(target) || /[uv]/.test(version) ? 'VILA' : 'REDO', version: version || 'base' };
    // Normal server plans replace u/iu with v/iv for numbered/dealer draws.
    // All four original variants are still referenced by client preloading/fallback.
    const normal = ['hole', 'flip'].includes(target) ? !/[uv]/.test(version) && (target !== 'flip' || !version) : !version.includes('u');
    return { ...base, category: 'pose-version', slotId, selection: 'required-pose-version', pose, audioPolicy: 'game-action',
      runtimeUses: normal ? ['playback', ...(/v/.test(version) ? [] : ['preload'])] : ['preload', 'fallback'],
      calibration: { sourceRef: source.ref, metadataPath: source.sourceRoot + 'v2/meta.json',
        frameCount: source.poseMetadata.frames[target]?.['-' + version] ?? null, fps: 24,
        runtimeProfile: runtime.profile?.id ?? null } };
  }
  if (relative === 'v2/vila.png') return { ...base, category: 'pose-reference', slotId: 'pose/vila',
    selection: 'base-pose', pose: { entry: 'VILA', exit: 'VILA', version: 'vila' }, runtimeUses: ['playback', 'external-worker'] };
  if (/\/faces\/[a-z0-9-]+\.jpe?g$/.test(relative)) return { ...base, category: 'portrait', runtimeUses: ['dealer-picker'] };
  const idle = runtime.idle(relative);
  if (idle) return { ...base, category: 'idle', slotId: 'idle.ready/', selection: 'optional-variation',
    pose: { entry: 'VILA', exit: 'VILA', version: idle.version }, audioPolicy: 'silent', runtimeUses: ['playback'],
    ...(idle.weight === null ? {} : { idle: { calm: idle.calm, weight: idle.weight } }) };
  const speech = /^repliker\/([a-z]{2,3})\/([a-z0-9_]+)\.mp4$/.exec(relative);
  if (speech) {
    const [, language, takeId] = speech, lineId = takeId.replace(/_\d+$/, '');
    const eventId = ['goodluck', 'insurance', 'double'].includes(lineId) ? 'speak.' + lineId : 'speak.other';
    const slotId = eventId + '/' + lineId;
    const use = runtime.speech({ entry, takeId, language });
    return { ...base, category: 'recorded-speech', slotId: catalog.slots.some(s => s.id === slotId) ? slotId : null,
      proposedSlotId: slotId, selection: 'recorded-take', audioPolicy: 'preserve-recorded-audio',
      speech: { language, lineId, takeId, exactText: source.texts[language]?.[takeId] ?? null, videoSha256: null, audioSha256: null, indexSha256: null },
      runtimeUses: use.runtimeUses, ...(use.exclusion ? { exclusion: use.exclusion } : {}) };
  }
  if (relative === 'v2/meta.json' || /^repliker\/[a-z]{2,3}\/texter\.json$/.test(relative)) return { ...base, category: 'source-metadata', runtimeUses: ['server-metadata'] };
  return base;
}

// An uploaded descriptor (name, size) that equals a frozen file of the dealer's
// source. Several entries may share bytes (hole/flip variants); they must agree
// on the placement, otherwise the file stays with the ordinary filename rules.
export function frozenImportFileMatch(dealerId, file, catalog) {
  const source = frozenImportSourceForDealer(dealerId);
  if (!source || !file || typeof file.name !== 'string' || !Number.isSafeInteger(file.size)) return null;
  const name = file.name.normalize('NFC');
  const entries = source.files.filter(entry => entry.size === file.size && entry.path.slice(entry.path.lastIndexOf('/') + 1) === name);
  if (!entries.length) return null;
  const placements = entries.map(entry => frozenImportPlacement(source, entry, catalog));
  const key = placement => JSON.stringify([placement.category, placement.slotId, placement.proposedSlotId ?? null, placement.pose,
    placement.speech?.language ?? null, placement.speech?.takeId ?? null]);
  if (new Set(placements.map(key)).size !== 1) return null;
  const [entry] = entries, [placement] = placements;
  return { source: { id: source.id, ref: source.ref, branch: source.branch, sourceDealerId: source.sourceDealerId, targetDealerId: source.targetDealerId },
    path: entry.path, relativePath: entry.path.startsWith(source.sourceRoot) ? entry.path.slice(source.sourceRoot.length) : entry.path,
    sha256: entry.sha256 ?? null, byteAliases: entries.slice(1).map(row => row.path), placement, k05: entry.k05 ?? null, clipList: entry.clipList ?? null };
}

// Advisory row for the assistant: the exact slot, chain, language and take the
// frozen source declares. It is still a proposal that a person reviews and saves.
export function frozenImportProposal(match, catalog) {
  const { placement } = match;
  const where = `${match.source.sourceDealerId}/${match.relativePath}`, label = `Kevins frysta källa ${match.source.id} (${match.source.branch})`;
  const evidence = { source: match.source.id, ref: match.source.ref, path: match.path, sha256: match.sha256,
    k05: match.k05?.selection ?? null, kevinClipStatus: match.clipList?.status ?? null };
  if (!placement.slotId && !placement.proposedSlotId) return { slotId: null, confidence: 'low', evidence,
    reason: `Känd fil i ${label}: ${where}. Kevins runtime på den frysta versionen använder den inte; välj fack själv om den ändå ska sparas.` };
  const slotId = placement.slotId && catalog.slots.some(slot => slot.id === placement.slotId) ? placement.slotId : null;
  const poses = placement.category === 'pose-version' ? { start: placement.pose.entry, end: placement.pose.exit } : null;
  const take = placement.speech ? Number(/_(\d+)$/.exec(placement.speech.takeId)?.[1]) : null;
  const parts = ['Fack', ...(poses ? ['poskedja'] : []), ...(placement.speech ? ['språk och tagning'] : [])].join(', ');
  return { slotId, confidence: slotId ? 'high' : 'low', evidence,
    reason: slotId ? `Känd tagning i ${label}: ${where}. ${parts} följer källan. Innehållet är inte visuellt verifierat.`
      : `Känd tagning i ${label}: ${where}, men klippkartan saknar facket ${placement.proposedSlotId ?? placement.slotId}. Lägg till facket i klippkartan eller välj ett fack manuellt.`,
    ...(poses ? { poses } : {}), ...(placement.speech ? { language: placement.speech.language, take: Number.isInteger(take) ? take : null } : {}) };
}
export function frozenImportWarnings(match) {
  const warnings = [], selection = match.k05?.selection ?? null;
  if (['pose-version', 'idle', 'recorded-speech'].includes(match.placement.category) && selection !== 'vald') {
    warnings.push(`Utanför K05-urvalet (${selection ?? 'ej i K05-matrisen'}): sparas bara som alternativ, utan standard- eller runtimebindning.`);
  }
  if (match.clipList?.status === 'ej-godkand') warnings.push('Kevins klipplista 2026-10-22: ingen talgranskning gjord. Manus, ljud och läppsynk granskas separat under Tal-klipp & ljud.');
  if (match.placement.category === 'pose-version' && !match.placement.calibration?.runtimeProfile) {
    warnings.push('Ingen filmprofil (kortspår och kontaktruta) är bunden för dealern i main. Utdelningen spelas utan kortöverläggning tills K04 binder tagningen.');
  }
  return warnings;
}
