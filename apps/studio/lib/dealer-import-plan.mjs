// Import preparation only: no registry, network, upload, publication or deletion writes.
import { createHash } from 'node:crypto';
import { dealerImportCatalog, filenameDealerImportRows, finishDealerImportRows, validateDealerImportInput } from './dealer-import-catalog.mjs';
import { DEFAULT_FROZEN_IMPORT_SOURCE_ALIAS, FROZEN_IMPORT_SOURCE_ALIASES, frozenImportPlacement, frozenImportRuntime, frozenImportSource } from './dealer-import-sources.mjs';
import { validateVideoMetadata } from '../../../packages/presentation/contracts/video-intake.mjs';
import { DEFAULT_DEALER_COMPOSITING } from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import { recordedSpeechForVideo } from '../../../packages/presentation/contracts/recorded-speech.mjs';
import { canonicalStudioJson } from '../../../packages/studio-registry/server/document-contract.mjs';
import { cloneStudioJson } from '../../../packages/studio-registry/server/storage-contract.mjs';

export const DEALER_IMPORT_PLAN_VERSION = 1;
const hash = value => createHash('sha256').update(value).digest('hex');
// A whole plan or inventory export is far larger than a saved document; it
// gets the same canonical form with wider limits, never the document cap.
const largeHash = value => hash(JSON.stringify(cloneStudioJson(value, { maxNodes: 2_000_000, maxBytes: 256 * 1024 * 1024, maxDepth: 24 })));
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = code => { throw Object.assign(Error(code), { code }); };
// The Dragan source stays the default for existing callers; every other
// source is chosen by its explicit alias (the Kevin dealer id).
export function frozenKevinImportSource(alias = DEFAULT_FROZEN_IMPORT_SOURCE_ALIAS) { return frozenImportSource(alias); }

// File SHA-256 is never inferred from a Git object ID. This accepts bytes supplied
// locally by the caller; the CLI neither downloads nor rewrites their source.
export function verifyImportSourceBytes(entry, bytes) {
  if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(entry?.size) || entry.size !== bytes.length
    || !/^[a-f0-9]{40}$/.test(entry?.gitBlobSha ?? '')) fail('import_source_bytes_mismatch');
  const gitBlobSha = createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
  if (gitBlobSha !== entry.gitBlobSha) fail('import_source_bytes_mismatch');
  const digest = hash(bytes);
  // A source that declares its SHA-256 must agree with the bytes it froze.
  if (sha256(entry.sha256) && entry.sha256 !== digest) fail('import_source_bytes_mismatch');
  return { gitBlobSha, size: bytes.length, sha256: digest };
}
const videoType = path => path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.png') ? 'image/png' : path.endsWith('.jpg') ? 'image/jpeg' : 'application/json';

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

function targetInventoryCoverage(inventory) {
  if (inventory === undefined) return 'not-read';
  if (!inventory || !Array.isArray(inventory.videos)) fail('import_invalid_inventory');
  // Existing exports use { videos }; loadVideoRegistry puts read failures in
  // summary. Explicit failure/partial signals must override apparently valid rows.
  const states = new Set(), scopes = [inventory];
  if (inventory.summary !== undefined) {
    if (!inventory.summary || typeof inventory.summary !== 'object' || Array.isArray(inventory.summary)) fail('import_invalid_inventory');
    scopes.push(inventory.summary);
  }
  if (inventory.coverage && typeof inventory.coverage === 'object' && !Array.isArray(inventory.coverage)) {
    scopes.push(inventory.coverage);
    if (!['readable', 'snapshotReadable', 'complete', 'partial', 'status', 'error'].some(key => Object.hasOwn(inventory.coverage, key))) states.add('unverified');
  }
  for (const scope of scopes) {
    for (const [key, unsafe, state] of [['readable', false, 'unreadable'], ['snapshotReadable', false, 'unreadable'],
      ['complete', false, 'partial'], ['partial', true, 'partial']]) {
      if (!Object.hasOwn(scope, key)) continue;
      if (typeof scope[key] !== 'boolean') states.add('unverified');
      else if (scope[key] === unsafe) states.add(state);
    }
    if (scope.error) states.add('error');
    for (const key of ['status', 'coverage']) {
      if (!Object.hasOwn(scope, key) || (scope === inventory && key === 'coverage' && scopes.includes(scope.coverage))) continue;
      const value = scope[key];
      if (['ok', 'readable', 'complete', 'supplied-inventory'].includes(value)) continue;
      states.add(['error', 'unreadable', 'partial', 'not-read'].includes(value) ? value : 'unverified');
    }
  }
  return ['error', 'unreadable', 'partial', 'not-read', 'unverified'].find(state => states.has(state)) ?? 'supplied-inventory';
}

export function createFrozenKevinImportPlan({ project, dealerId, sourceAlias, inventory, verifiedFiles = {} } = {}) {
  const catalog = dealerImportCatalog(project);
  if (!catalog.dealers.some(d => d.id === dealerId)) fail('import_registered_dealer_required');
  if (!FROZEN_IMPORT_SOURCE_ALIASES.includes(sourceAlias)) fail('import_explicit_source_alias_required');
  const source = frozenImportSource(sourceAlias), runtime = frozenImportRuntime(source);
  if (dealerId !== source.targetDealerId) fail('import_source_dealer_mismatch');
  const targetCoverage = targetInventoryCoverage(inventory);
  const inventoryBlocker = targetCoverage === 'supplied-inventory' ? null : 'target-inventory-' + targetCoverage;
  const files = source.files, videos = inventoryBlocker ? [] : inventory.videos;
  for (const [path, proof] of Object.entries(verifiedFiles)) {
    const entry = files.find(f => f.path === path);
    if (!entry || !sha256(proof?.sha256) || proof.gitBlobSha !== entry.gitBlobSha || proof.size !== entry.size) fail('import_invalid_content_proof');
    if (sha256(entry.sha256) && proof.sha256 !== entry.sha256) fail('import_source_bytes_mismatch');
  }
  const rows = files.map(entry => {
    const placement = frozenImportPlacement(source, entry, catalog);
    const contentSha256 = verifiedFiles[entry.path]?.sha256 ?? null;
    if (placement.speech) placement.speech.videoSha256 = contentSha256;
    const classification = metadataFor(placement, entry, catalog, dealerId);
    const { k05, clipList, sha256: declaredSha256, ...identity } = entry;
    const row = { key: hash(canonicalStudioJson({ version: 1, repository: source.repository, ref: source.ref, path: entry.path, dealerId })),
      provenance: { repository: source.repository, ref: source.ref, ...identity, ...(sha256(declaredSha256) ? { declaredSha256 } : {}) },
      sha256: contentSha256,
      sourceByteAliases: files.filter(file => file.path !== entry.path && file.gitBlobSha === entry.gitBlobSha).map(file => file.path),
      placement, classification, ...(k05 ? { k05 } : {}), ...(clipList ? { kevinClipList: clipList } : {}),
      decision: 'review', mediaId: null, candidateMediaIds: [], reasons: [], applyAllowed: false };
    if (!placement.runtimeUses.length) { row.decision = 'excluded'; row.reasons.push(placement.exclusion ?? 'not-referenced-by-frozen-runtime'); return row; }
    if (['source-metadata', 'portrait', 'pose-reference'].includes(placement.category)) {
      row.decision = 'reference-only'; row.reasons.push('not-supported-by-video-import'); return row;
    }
    if (!placement.slotId || !classification) row.reasons.push('manual-placement-required');
    if (!contentSha256) row.reasons.push('source-sha256-not-verified');
    if (inventoryBlocker) row.reasons.push(inventoryBlocker);
    const profileClip = runtime.profile?.takes.find(c => c.repositoryPath === entry.path && c.sha256 === contentSha256) ?? null;
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
  const language = source.languages[0], speechRows = rows.filter(row => row.placement.speech?.language === language);
  const plan = { schemaVersion: DEALER_IMPORT_PLAN_VERSION, mode: 'plan', dealerId,
    source: { id: source.id, repository: source.repository, ref: source.ref, branch: source.branch, sourceAlias, languages: [...source.languages],
      ...(source.additionalLanguages ? { additionalLanguages: [...source.additionalLanguages] } : {}), ...(source.k05 ? { k05: structuredClone(source.k05) } : {}),
      filmedProfile: runtime.profile?.id ?? null },
    targetCoverage,
    targetProjectSha256: hash(canonicalStudioJson(project)),
    targetInventorySha256: inventory === undefined ? null : largeHash(inventory),
    counts: { catalogSpeechPerLanguage: speechRows.length,
      manifestSpeechIds: speechRows.filter(row => row.placement.runtimeUses.includes('manifest')).length,
      playbackOrFallbackSpeechIds: speechRows.filter(row => row.placement.runtimeUses.some(use => ['playback', 'fallback'].includes(use))).length,
      additionalWorkerPreloadSpeechIds: speechRows.filter(row => row.placement.runtimeUses.includes('worker-preload')).length,
      posePaths: rows.filter(row => row.placement.category === 'pose-version').length },
    dynamicSpeech: { textSource: 'openclaw', separateFromRecordedSpeech: true, bank: 'external-unverified',
      sourceAvatar: runtime.lipsyncAvatar, applyAllowed: false },
    applyAllowed: false, blockers: ['plan-only-no-apply', 'publication-and-audiovisual-acceptance-not-implied', ...(inventoryBlocker ? [inventoryBlocker] : [])], rows };
  return { ...plan, planId: largeHash(plan) };
}
