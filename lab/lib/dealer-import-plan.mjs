// Import preparation only: no registry, network, upload, publication or deletion writes.
import { createHash } from 'node:crypto';
import source from './dealer-import-kevin-source.json' with { type: 'json' };
import { dealerImportCatalog, filenameDealerImportRows, finishDealerImportRows, validateDealerImportInput } from './dealer-import-catalog.mjs';
import { validateVideoMetadata } from './video-intake.mjs';
import { DEFAULT_DEALER_COMPOSITING } from '../../web/public/dealer-compositing.mjs';
import { recordedSpeechForVideo } from '../../web/public/recorded-speech.mjs';
import { DRAGAN_KEVIN_PROFILE } from '../../web/public/card-presentation/profiles/kevin-dragan-f15b2af1.mjs';
import { canonicalStudioJson } from '../../web/storage/studio-contract.mjs';

export const DEALER_IMPORT_PLAN_VERSION = 1;
const hash = value => createHash('sha256').update(value).digest('hex');
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = code => { throw Object.assign(Error(code), { code }); };
export function frozenKevinImportSource() { return structuredClone(source); }

// File SHA-256 is never inferred from a Git object ID. This accepts bytes supplied
// locally by the caller; the CLI neither downloads nor rewrites their source.
export function verifyImportSourceBytes(entry, bytes) {
  if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(entry?.size) || entry.size !== bytes.length
    || !/^[a-f0-9]{40}$/.test(entry?.gitBlobSha ?? '')) fail('import_source_bytes_mismatch');
  const gitBlobSha = createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
  if (gitBlobSha !== entry.gitBlobSha) fail('import_source_bytes_mismatch');
  return { gitBlobSha, size: bytes.length, sha256: hash(bytes) };
}

const manifestLines = ['goodluck_1', 'sidebet_2', 'insurance_1', 'double_1', 'bust_1', 'blackjack_1',
  'dealerblackjack_1', 'dealerbust_1', 'win_1', 'push_1', 'lose_1'];
const playedLines = new Set([...manifestLines, ...['bust', 'blackjack', 'twentyone'].flatMap(e => Array.from({ length: 7 }, (_, n) => e + '_' + (n + 1))),
  'win_2', 'win_3', ...['placebets', 'chatter1', 'chatter2'].flatMap(e => [1, 2, 3].map(n => e + '_' + n)),
  'banter_1', 'remark_hit17_1', 'remark_hit17_2', 'remark_hit20_1', 'remark_stand11_1', 'table_cash_1', 'table_trust_1',
  ...['axel', 'emil', 'fredrik', 'guest', 'ian', 'jakob', 'john', 'kevin'].map(n => 'greet_' + n)]);
const warmedLines = new Set(['goodluck_2', 'goodluck_3']);
const videoType = path => path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.png') ? 'image/png' : path.endsWith('.jpg') ? 'image/jpeg' : 'application/json';

function placementFor(entry, catalog, dealerId) {
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
        runtimeProfile: DRAGAN_KEVIN_PROFILE.id } };
  }
  if (relative === 'v2/vila.png') return { ...base, category: 'pose-reference', slotId: 'pose/vila',
    selection: 'base-pose', pose: { entry: 'VILA', exit: 'VILA', version: 'vila' }, runtimeUses: ['playback', 'external-worker'] };
  if (relative.endsWith('/faces/dragge.jpg')) return { ...base, category: 'portrait', runtimeUses: ['dealer-picker'] };
  if (/^idle-v2\/(breath|glance|smile)\.mp4$/.test(relative)) return { ...base, category: 'idle', slotId: 'idle.ready/',
    selection: 'optional-variation', pose: { entry: 'VILA', exit: 'VILA', version: 'idle-v2' }, audioPolicy: 'silent',
    runtimeUses: ['playback'] };
  const speech = /^repliker\/(sv|en)\/([a-z0-9_]+)\.mp4$/.exec(relative);
  if (speech) {
    const [, language, takeId] = speech, lineId = takeId.replace(/_\d+$/, '');
    const eventId = ['goodluck', 'insurance', 'double'].includes(lineId) ? 'speak.' + lineId : 'speak.other';
    const slotId = eventId + '/' + lineId;
    return { ...base, category: 'recorded-speech', slotId: catalog.slots.some(s => s.id === slotId) ? slotId : null,
      proposedSlotId: slotId, selection: 'recorded-take', audioPolicy: 'preserve-recorded-audio',
      speech: { language, lineId, takeId, exactText: source.texts[language]?.[takeId] ?? null, videoSha256: null, audioSha256: null, indexSha256: null },
      runtimeUses: playedLines.has(takeId) ? ['playback', ...(manifestLines.includes(takeId) ? ['manifest', 'preload'] : [])]
        : warmedLines.has(takeId) ? ['worker-preload'] : [] };
  }
  if (relative === 'v2/meta.json' || /^repliker\/(sv|en)\/texter\.json$/.test(relative)) return { ...base, category: 'source-metadata', runtimeUses: ['server-metadata'] };
  return base;
}

// Used by the normal assistant's contract, never an alternative filename parser.
// Explicit aliases belong to the frozen source; arbitrary uploaded names get no
// special exemption from the registered-dealer/conflicting-slot checks.
export function reviewDealerImportFilenames({ project, dealerId, files, context = '' }) {
  const catalog = dealerImportCatalog(project);
  const input = validateDealerImportInput({ dealerId, files, context }, catalog);
  return finishDealerImportRows(filenameDealerImportRows(input, catalog), input, catalog);
}

function metadataFor(placement, entry, catalog, dealerId) {
  const slot = catalog.slots.find(s => s.id === placement.slotId);
  if (!slot || slot.kind === 'pose' || videoType(entry.path) !== 'video/mp4') return null;
  return validateVideoMetadata({ dealerId, eventId: slot.eventId, situation: slot.situation, kind: slot.kind,
    role: 'alternative', playback: 'once', label: entry.path.split('/').at(-1), notes: 'Importplan: ingen visuell acceptans eller standardbindning.',
    compositing: { ...DEFAULT_DEALER_COMPOSITING } }, { forWrite: true });
}

function protectedMedia(video) {
  return Boolean(video.deletion || video.retainedBank || video.classification?.archived || video.archived || video.available === false);
}
function compatible(video, row, dealerId) {
  const metadata = video.classification;
  if (typeof video.id !== 'string' || !video.id || video.available !== true || !metadata || metadata.dealerId !== dealerId || metadata.eventId !== row.classification?.eventId
    || metadata.situation !== row.classification?.situation || metadata.kind !== row.classification?.kind || metadata.mediaType) return false;
  try { validateVideoMetadata(metadata, { forWrite: true }); } catch { return false; }
  if (row.placement.speech) {
    const speech = row.placement.speech;
    const checked = recordedSpeechForVideo(video, { dealerId, lineId: speech.lineId, takeId: speech.takeId, language: speech.language, requireApproved: false });
    return Boolean(checked && checked.exactText === speech.exactText);
  }
  return true;
}

export function createFrozenKevinImportPlan({ project, dealerId, sourceAlias, inventory, verifiedFiles = {} } = {}) {
  const catalog = dealerImportCatalog(project);
  if (!catalog.dealers.some(d => d.id === dealerId)) fail('import_registered_dealer_required');
  if (sourceAlias !== source.sourceDealerId) fail('import_explicit_source_alias_required');
  if (dealerId !== source.targetDealerId) fail('import_source_dealer_mismatch');
  if (inventory !== undefined && (!inventory || !Array.isArray(inventory.videos))) fail('import_invalid_inventory');
  const files = source.files, videos = inventory?.videos ?? [];
  for (const [path, proof] of Object.entries(verifiedFiles)) {
    const entry = files.find(f => f.path === path);
    if (!entry || !sha256(proof?.sha256) || proof.gitBlobSha !== entry.gitBlobSha || proof.size !== entry.size) fail('import_invalid_content_proof');
  }
  const rows = files.map(entry => {
    const placement = placementFor(entry, catalog, dealerId);
    const contentSha256 = verifiedFiles[entry.path]?.sha256 ?? null;
    if (placement.speech) placement.speech.videoSha256 = contentSha256;
    const classification = metadataFor(placement, entry, catalog, dealerId);
    const row = { key: hash(canonicalStudioJson({ version: 1, repository: source.repository, ref: source.ref, path: entry.path, dealerId })),
      provenance: { repository: source.repository, ref: source.ref, ...entry }, sha256: contentSha256,
      sourceByteAliases: files.filter(file => file.path !== entry.path && file.gitBlobSha === entry.gitBlobSha).map(file => file.path),
      placement, classification, decision: 'review', mediaId: null, candidateMediaIds: [], reasons: [], applyAllowed: false };
    if (!placement.runtimeUses.length) { row.decision = 'excluded'; row.reasons.push('not-referenced-by-frozen-runtime'); return row; }
    if (['source-metadata', 'portrait', 'pose-reference'].includes(placement.category)) {
      row.decision = 'reference-only'; row.reasons.push('not-supported-by-video-import'); return row;
    }
    if (!placement.slotId || !classification) row.reasons.push('manual-placement-required');
    if (!contentSha256) row.reasons.push('source-sha256-not-verified');
    if (inventory === undefined) row.reasons.push('target-inventory-not-read');
    const profileClip = DRAGAN_KEVIN_PROFILE.takes.find(c => c.repositoryPath === entry.path && c.sha256 === contentSha256);
    if (placement.category === 'pose-version' && !profileClip) row.reasons.push('pose-calibration-not-bound-to-verified-bytes');
    if (placement.speech) row.reasons.push('recorded-audio-index-calibration-required');
    const sameBytes = contentSha256 ? videos.filter(v => v.sha256 === contentSha256) : [];
    const owned = sameBytes.filter(v => (v.classification?.dealerId ?? v.dealer) === dealerId);
    row.candidateMediaIds = owned.map(v => v.id).filter(Boolean).sort();
    const matches = owned.filter(v => !protectedMedia(v) && compatible(v, row, dealerId));
    if (matches.length === 1 && classification && (placement.category !== 'pose-version' || profileClip)) {
      row.decision = 'reuse'; row.mediaId = matches[0].id;
      row.classification = structuredClone(matches[0].classification);
      if (placement.speech) {
        const speech = matches[0].classification.recordedSpeech ?? matches[0].recordedSpeech;
        row.placement.speech.audioSha256 = speech.audioSha256; row.placement.speech.indexSha256 = speech.indexSha256;
        row.reasons = row.reasons.filter(r => r !== 'recorded-audio-index-calibration-required');
      }
      row.reasons.push('existing-identity-and-use-match');
    } else if (matches.length > 1) row.reasons.push('multiple-existing-identities-require-review');
    else if (owned.some(protectedMedia)) { row.decision = 'keep-protected'; row.reasons.push('existing-protected-media'); }
    else if (owned.length) { row.decision = 'correct-binding'; row.reasons.push('same-bytes-different-or-unverified-classification'); }
    else if (sameBytes.length) { row.decision = 'keep-protected'; row.reasons.push('same-bytes-owned-by-another-dealer'); }
    else if (!row.reasons.length) row.decision = 'import';
    return row;
  });
  const plan = { schemaVersion: DEALER_IMPORT_PLAN_VERSION, mode: 'plan', dealerId,
    source: { id: source.id, repository: source.repository, ref: source.ref, branch: source.branch, sourceAlias, languages: [...source.languages] },
    targetCoverage: inventory === undefined ? 'not-read' : 'supplied-inventory',
    targetProjectSha256: hash(canonicalStudioJson(project)),
    targetInventorySha256: inventory === undefined ? null : hash(canonicalStudioJson(inventory)),
    counts: { catalogSpeechPerLanguage: 81, manifestSpeechIds: 11, playbackOrFallbackSpeechIds: playedLines.size,
      additionalWorkerPreloadSpeechIds: 2, posePaths: 56 },
    dynamicSpeech: { textSource: 'openclaw', separateFromRecordedSpeech: true, bank: 'external-unverified',
      sourceAvatar: 'dragan_vila2x', applyAllowed: false },
    applyAllowed: false, blockers: ['plan-only-no-apply', 'publication-and-audiovisual-acceptance-not-implied'], rows };
  return { ...plan, planId: hash(canonicalStudioJson(plan)) };
}
