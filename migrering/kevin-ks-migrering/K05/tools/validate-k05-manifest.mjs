// K05: validate an explicit identity manifest against K05-matris.tsv. Pure Node, no network,
// no registry/Blob reads, no writes. The manifest has the shape of root's J08 identityMap
// (packages/presentation/server/room-game-material.mjs on codex/admin-room-config-j08):
//   {operatorId, packageRevision, roomId, presentationLaneId, dealerId, sourceDealer,
//    entries: [{source:{dealer,path,source,slot,variant,language,bytes,sha256}, logicalPath, mediaId, speech}]}
// Identity is only the exact matrix row (path + bytes + sha256 + Kevin's source/slot/variant/language).
// No name, file-name or length matching: an unknown path is rejected even when its bytes or name
// look like a known one. V1 rows (deleted in c4818f51) are always rejected.
// sourceDealer must be a Kevin dealer with selected rows in the matrix ('shared', registered names
// such as 'dragan' and unknown names are refused). Deferred rows (G13, Table Studio) and the six JS
// source files (version-bound source evidence, not runtime identities) are never entries.
// Stills (still, keyed-still: PNG) bind through the catalogue only: mediaId null, like documents.
//
// Modes:
//   bind  every entry must already have its registry identity
//         (media row: Neon media ID + catalogue logicalPath; document/still row: catalogue logicalPath).
//   plan  rows with an existing Neon ID must reuse it; planned rows must carry mediaId null.
// Usage:
//   node validate-k05-manifest.mjs --matrix ../K05-matris.tsv --manifest m.json [--mode plan|bind] [--language en|sv]
//   node validate-k05-manifest.mjs --selftest [--matrix ../K05-matris.tsv]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HEADER = ['kalla_sokvag', 'kalla_gitblob', 'bytes', 'sha256', 'k04_lika', 'kevin_dealer', 'k04_kalla', 'main_fack',
  'kevin_variant', 'sprak', 'replik', 'urval', 'registrerad_dealer', 'neon_media_id', 'neon_fack', 'fack_overens',
  'katalog_logicalPath', 'blob_identitet', 'paket', 'projekt', 'status', 'acceptans', 'anmarkning'];
const STATUS = new Set(['befintlig-identitet', 'ny-post-planerad', 'ej-vald', 'v1-avvisad', 'andrad-hash', 'uppskjuten', 'kallbevis']);
const HASH = /^[a-f0-9]{64}$/, UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SOURCE_KEYS = ['dealer', 'path', 'source', 'slot', 'variant', 'language', 'bytes', 'sha256'];
const MAP_KEYS = ['operatorId', 'packageRevision', 'roomId', 'presentationLaneId', 'dealerId', 'sourceDealer', 'entries'];
const SPEECH = new Set(['replik', 'replik-rot']), STILL = new Set(['still', 'keyed-still']);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function parseMatrix(text) {
  const [head, ...lines] = String(text).split('\n').filter(Boolean);
  if (head !== HEADER.join('\t')) throw new Error('Unexpected K05 matrix header');
  const rows = new Map();
  for (const line of lines) {
    const cells = line.split('\t');
    if (cells.length !== HEADER.length) throw new Error('Malformed K05 matrix row');
    const row = Object.fromEntries(HEADER.map((key, i) => [key, cells[i]]));
    row.bytes = Number(row.bytes);
    if (!HASH.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes <= 0 || !STATUS.has(row.status)) throw new Error(`Invalid K05 matrix row ${row.kalla_sokvag}`);
    if (rows.has(row.kalla_sokvag)) throw new Error(`Duplicate K05 matrix path ${row.kalla_sokvag}`);
    rows.set(row.kalla_sokvag, Object.freeze(row));
  }
  return rows;
}

const languageOf = row => row.sprak || /\/repliker\/([a-z]{2})\//.exec(row.kalla_sokvag)?.[1] || '';
const neonId = row => (UUID.test(row.neon_media_id) ? row.neon_media_id : null);
const catalogPath = row => (['saknas', 'planerad', '-'].includes(row.katalog_logicalPath) ? null : row.katalog_logicalPath);
const registered = row => (['planerad', '-'].includes(row.registrerad_dealer) ? null : row.registrerad_dealer);
// Kevin dealers with selected rows; 'shared' is never a source dealer.
export const sourceDealers = matrix => new Set([...matrix.values()].filter(r => r.urval === 'vald' && r.kevin_dealer !== 'shared').map(r => r.kevin_dealer));
// The complete selected en/sv set for one Kevin dealer: its own rows plus the shared documents.
const inSet = (row, dealer, language) => row.urval === 'vald'
  && (row.kevin_dealer === dealer || (row.kevin_dealer === 'shared' && row.k04_kalla === 'data-beroende'))
  && ['', language].includes(languageOf(row));

// -> { ok, mode, entries, errors: [{ index, path, code }] }. Never fills a missing identity.
export function validateManifest(matrix, manifest, { mode = 'plan', language } = {}) {
  const errors = [], err = (index, path, code) => errors.push({ index, path, code });
  if (!['plan', 'bind'].includes(mode)) throw new Error('mode must be plan or bind');
  if (!exact(manifest, MAP_KEYS) || !Array.isArray(manifest.entries) || !manifest.entries.length
    || typeof manifest.dealerId !== 'string' || !manifest.dealerId || typeof manifest.sourceDealer !== 'string' || !manifest.sourceDealer
    || !Number.isSafeInteger(manifest.packageRevision) || manifest.packageRevision < 1) {
    return { ok: false, mode, entries: 0, errors: [{ index: null, path: null, code: 'manifest_shape' }] };
  }
  if (!sourceDealers(matrix).has(manifest.sourceDealer)) {
    return { ok: false, mode, entries: manifest.entries.length, errors: [{ index: null, path: null, code: 'unknown_source_dealer' }] };
  }
  const seen = new Set(), logical = new Map();
  manifest.entries.forEach((entry, i) => {
    const path = entry?.source?.path ?? null;
    if (!exact(entry, ['source', 'logicalPath', 'mediaId', 'speech']) || !exact(entry.source, SOURCE_KEYS)) return err(i, path, 'entry_shape');
    if (seen.has(path)) return err(i, path, 'duplicate_entry');
    seen.add(path);
    const row = matrix.get(path);
    if (!row) return err(i, path, 'unknown_path');
    if (row.status === 'v1-avvisad') return err(i, path, 'v1_reference');
    if (row.status === 'andrad-hash') return err(i, path, 'changed_hash');
    if (row.status === 'uppskjuten') return err(i, path, 'deferred');
    if (row.status === 'kallbevis') return err(i, path, 'source_evidence_not_runtime');
    if (entry.source.sha256 !== row.sha256) return err(i, path, 'hash_mismatch');
    if (entry.source.bytes !== row.bytes) return err(i, path, 'bytes_mismatch');
    if (entry.source.dealer !== row.kevin_dealer || entry.source.source !== row.k04_kalla || entry.source.slot !== row.main_fack
      || entry.source.variant !== row.kevin_variant || entry.source.language !== row.sprak) return err(i, path, 'source_identity_mismatch');
    if (row.urval !== 'vald') return err(i, path, 'not_selected');
    if (![manifest.sourceDealer, 'shared'].includes(row.kevin_dealer)) return err(i, path, 'source_dealer_mismatch');
    if (typeof entry.logicalPath !== 'string' || !entry.logicalPath) return err(i, path, 'logical_path_missing');
    const other = logical.get(entry.logicalPath);
    if (other && other !== row.sha256) return err(i, path, 'logical_path_conflict');
    logical.set(entry.logicalPath, row.sha256);
    const known = catalogPath(row);
    if (known && entry.logicalPath !== known) return err(i, path, 'logical_path_mismatch');
    if (row.k04_kalla === 'data-beroende') {
      if (entry.mediaId !== null || entry.speech !== null) return err(i, path, 'document_with_media_id');
      if (mode === 'bind' && !known) return err(i, path, 'catalog_entry_missing');
      return;
    }
    if (STILL.has(row.k04_kalla)) {
      if (entry.mediaId !== null || entry.speech !== null) return err(i, path, 'still_with_media_id');
      if (mode === 'bind' && !known) return err(i, path, 'catalog_entry_missing');
      return;
    }
    const id = neonId(row), owner = registered(row);
    if (owner && owner !== manifest.dealerId) return err(i, path, 'registered_dealer_mismatch');
    if (id ? entry.mediaId !== id : entry.mediaId !== null) return err(i, path, id ? 'media_id_mismatch' : 'media_id_unregistered');
    if (SPEECH.has(row.k04_kalla)) {
      const take = row.replik, line = take.replace(/_\d+$/, '');
      if (!exact(entry.speech, ['lineId', 'takeId']) || entry.speech.takeId !== take || entry.speech.lineId !== line) return err(i, path, 'speech_identity_mismatch');
    } else if (entry.speech !== null) return err(i, path, 'speech_identity_mismatch');
    if (mode === 'bind' && !id) return err(i, path, 'identity_missing');
    if (mode === 'bind' && !known) return err(i, path, 'catalog_entry_missing');
  });
  if (language !== undefined) {
    if (!['en', 'sv'].includes(language)) errors.push({ index: null, path: null, code: 'language_outside_en_sv' });
    else {
      const missing = [...matrix.values()].filter(row => inSet(row, manifest.sourceDealer, language) && !seen.has(row.kalla_sokvag));
      if (missing.length) errors.push({ index: null, path: missing[0].kalla_sokvag, code: 'incomplete_set', missing: missing.length });
    }
  }
  return { ok: errors.length === 0, mode, entries: manifest.entries.length, errors };
}

// A manifest built from the matrix for one Kevin dealer and language, exactly as planned:
// existing Neon IDs reused, planned rows null, logicalPath = existing or a placeholder.
export function plannedManifest(matrix, { sourceDealer, dealerId, language, operatorId = 'planned', packageRevision = 1,
  roomId = 'planned', presentationLaneId = 'planned' }) {
  const entries = [...matrix.values()].filter(row => inSet(row, sourceDealer, language)).map(row => ({
    source: { dealer: row.kevin_dealer, path: row.kalla_sokvag, source: row.k04_kalla, slot: row.main_fack,
      variant: row.kevin_variant, language: row.sprak, bytes: row.bytes, sha256: row.sha256 },
    logicalPath: catalogPath(row) ?? `planned/${row.sha256}`,
    mediaId: row.k04_kalla === 'data-beroende' || STILL.has(row.k04_kalla) ? null : neonId(row),
    speech: SPEECH.has(row.k04_kalla) ? { lineId: row.replik.replace(/_\d+$/, ''), takeId: row.replik } : null,
  }));
  return { operatorId, packageRevision, roomId, presentationLaneId, dealerId, sourceDealer, entries };
}

export function selftest(matrix) {
  const clone = value => structuredClone(value);
  const base = plannedManifest(matrix, { sourceDealer: 'dragge', dealerId: 'dragan', language: 'sv' });
  const at = (m, path) => m.entries.findIndex(e => e.source.path === path);
  const row = path => matrix.get(path);
  const neonOther = [...matrix.values()].find(r => r.kalla_sokvag === 'media/dealers/dragge/v2/pos1-v.mp4').neon_media_id;
  const v1 = [...matrix.values()].find(r => r.status === 'v1-avvisad');
  // An entry for a matrix row exactly as recorded (only to build negative cases).
  const entryOf = (r, extra = {}) => ({ source: { dealer: r.kevin_dealer, path: r.kalla_sokvag, source: r.k04_kalla, slot: r.main_fack,
    variant: r.kevin_variant, language: r.sprak, bytes: r.bytes, sha256: r.sha256 }, logicalPath: `planned/${r.sha256}`, mediaId: null, speech: null, ...extra });
  const sharedThree = ['media/manifest.json', 'public/dealers.js', 'public/idle-chain.js'].map(p => entryOf(row(p)));
  const onlyShared = (dealer, entries) => () => ({ ...clone(base), dealerId: 'planned', sourceDealer: dealer, entries: clone(entries) });
  const cases = [
    ['positive: plan dragge/sv complete', m => m, { mode: 'plan', language: 'sv' }, []],
    ['positive: plan paow/en complete', () => plannedManifest(matrix, { sourceDealer: 'paow', dealerId: 'paow-kevin', language: 'en' }), { mode: 'plan', language: 'en' }, []],
    ['negative: sha256 changed', m => { m.entries[at(m, 'media/dealers/dragge/v2/pos1.mp4')].source.sha256 = 'a'.repeat(64); return m; }, {}, ['hash_mismatch']],
    ['negative: bytes changed', m => { m.entries[at(m, 'media/dealers/dragge/v2/pos1.mp4')].source.bytes += 1; return m; }, {}, ['bytes_mismatch']],
    ['negative: -u take bound with pose alias v', m => { m.entries[at(m, 'media/dealers/dragge/v2/pos1-u.mp4')].source.variant = 'v'; return m; }, {}, ['source_identity_mismatch']],
    ['negative: -u path carrying -v bytes', m => { const r = row('media/dealers/dragge/v2/pos1-v.mp4'), e = m.entries[at(m, 'media/dealers/dragge/v2/pos1-u.mp4')].source; e.sha256 = r.sha256; e.bytes = r.bytes; return m; }, {}, ['hash_mismatch']],
    ['negative: V1 reference', m => { m.entries.push({ source: { dealer: 'dragge', path: v1.kalla_sokvag, source: 'v1-raderad', slot: '', variant: '', language: '', bytes: v1.bytes, sha256: v1.sha256 }, logicalPath: 'planned/v1', mediaId: null, speech: null }); return m; }, {}, ['v1_reference']],
    ['negative: name-alike path, same bytes', m => { const e = clone(m.entries[at(m, 'media/dealers/dragge/v2/pos1.mp4')]); e.source.path = 'media/dealers/dragan/v2/pos1.mp4'; m.entries.push(e); return m; }, {}, ['unknown_path']],
    ['negative: language outside urval (pt)', m => { const r = row('media/dealers/dragge/repliker/pt/goodluck_1.mp4'); m.entries.push({ source: { dealer: 'dragge', path: r.kalla_sokvag, source: r.k04_kalla, slot: r.main_fack, variant: r.kevin_variant, language: r.sprak, bytes: r.bytes, sha256: r.sha256 }, logicalPath: 'planned/pt', mediaId: null, speech: { lineId: 'goodluck', takeId: 'goodluck_1' } }); return m; }, {}, ['not_selected']],
    ['negative: existing Neon ID omitted', m => { m.entries[at(m, 'media/dealers/dragge/v2/pos1.mp4')].mediaId = null; return m; }, {}, ['media_id_mismatch']],
    ['negative: another record\'s Neon ID', m => { m.entries[at(m, 'media/dealers/dragge/v2/pos1.mp4')].mediaId = neonOther; return m; }, {}, ['media_id_mismatch']],
    ['negative: planned row with invented ID', m => { m.entries[at(m, 'media/dealers/dragge/v2/pos1-u.mp4')].mediaId = '00000000-0000-4000-8000-000000000000'; return m; }, {}, ['media_id_unregistered']],
    ['negative: older Neon win_1 bound to changed Kevin bytes', m => { m.entries[at(m, 'media/dealers/dragge/repliker/sv/win_1.mp4')].mediaId = 'efd551ec-a27c-4cb1-aff3-3848109df8fa'; return m; }, {}, ['media_id_unregistered']],
    ['negative: duplicate entry', m => { m.entries.push(clone(m.entries[0])); return m; }, {}, ['duplicate_entry']],
    ['negative: speech take changed', m => { m.entries[at(m, 'media/dealers/dragge/repliker/sv/goodluck_1.mp4')].speech.takeId = 'goodluck_2'; return m; }, {}, ['speech_identity_mismatch']],
    ['negative: speech missing', m => { m.entries[at(m, 'media/dealers/dragge/repliker/sv/goodluck_1.mp4')].speech = null; return m; }, {}, ['speech_identity_mismatch']],
    ['negative: timing document with media ID', m => { m.entries[at(m, 'media/dealers/dragge/v2/meta.json')].mediaId = neonOther; return m; }, {}, ['document_with_media_id']],
    ['negative: incomplete set', m => { m.entries.splice(at(m, 'media/dealers/dragge/v2/meta.json'), 1); return m; }, { language: 'sv' }, ['incomplete_set']],
    ['negative: wrong registered dealer', m => { m.dealerId = 'astrid'; return m; }, {}, ['registered_dealer_mismatch']],
    ['negative: other Kevin dealer\'s row', m => { const r = row('media/dealers/paow/v2/pos1-u.mp4'); m.entries.push({ source: { dealer: 'paow', path: r.kalla_sokvag, source: r.k04_kalla, slot: r.main_fack, variant: r.kevin_variant, language: r.sprak, bytes: r.bytes, sha256: r.sha256 }, logicalPath: 'planned/paow', mediaId: null, speech: null }); return m; }, {}, ['source_dealer_mismatch']],
    ['negative: logicalPath reused for other bytes', m => { m.entries[1].logicalPath = m.entries[0].logicalPath; return m; }, {}, ['logical_path_conflict']],
    ['negative: manifest extra key', m => { m.extra = true; return m; }, {}, ['manifest_shape']],
    ['negative: completeness asked for pt', m => m, { language: 'pt' }, ['language_outside_en_sv']],
    ['negative: unknown sourceDealer with only the three shared documents', onlyShared('nobody', sharedThree), { language: 'sv' }, ['unknown_source_dealer']],
    ['negative: unknown sourceDealer with only manifest.json', onlyShared('nobody', sharedThree.slice(0, 1)), { language: 'en' }, ['unknown_source_dealer']],
    ['negative: sourceDealer \'shared\'', onlyShared('shared', sharedThree.slice(0, 1)), { language: 'sv' }, ['unknown_source_dealer']],
    ['negative: registered name as sourceDealer (dragan)', m => { m.sourceDealer = 'dragan'; return m; }, { language: 'sv' }, ['unknown_source_dealer']],
    ['negative: known dealer with only manifest.json', onlyShared('dragge', sharedThree.slice(0, 1)), { language: 'sv' }, ['incomplete_set']],
    ['negative: JS source files as entries', onlyShared('dragge', sharedThree.slice(1).concat(entryOf(row('public/dealer-card-tracks-dragge.js')))), {}, ['source_evidence_not_runtime']],
    ['negative: deferred G13 line', m => { m.entries.push(entryOf(row('media/dealers/dragge/repliker/sv/twentyone_1.mp4'), { speech: { lineId: 'twentyone', takeId: 'twentyone_1' } })); return m; }, {}, ['deferred']],
    ['negative: deferred Table Studio greeting', () => { const m = plannedManifest(matrix, { sourceDealer: 'astrid', dealerId: 'planned', language: 'en' }); m.entries.push(entryOf(row('media/repliker/greeting_1.mp4'))); return m; }, { language: 'en' }, ['deferred']],
    ['negative: keyed still with a media ID', m => { m.entries[at(m, 'media/dealers/dragge/v2/vila.png')].mediaId = neonOther; return m; }, {}, ['still_with_media_id']],
    ['positive: plan astrid/en complete (startbild via catalogue)', () => plannedManifest(matrix, { sourceDealer: 'astrid', dealerId: 'planned', language: 'en' }), { mode: 'plan', language: 'en' }, []],
    ['real state: bind dragge/sv today', m => m, { mode: 'bind', language: 'sv' }, null],
    ['real state: bind dragge/sv existing IDs only', m => { m.entries = m.entries.filter(e => e.mediaId); return m; }, { mode: 'bind' }, null],
  ];
  // Synthetic fixture only (not registry data): the same rows with every identity filled, to show
  // that bind mode accepts a complete binding. Fixture IDs/paths never appear in the real matrix.
  const fixture = new Map([...matrix].map(([path, r]) => [path, r.urval === 'vald' ? Object.freeze({ ...r,
    neon_media_id: neonId(r) ?? `f0000000-0000-4000-8000-${r.sha256.slice(0, 12)}`, registrerad_dealer: registered(r) ?? 'dragan',
    katalog_logicalPath: catalogPath(r) ?? `fixture/${r.sha256}` }) : r]));
  const synthetic = plannedManifest(fixture, { sourceDealer: 'dragge', dealerId: 'dragan', language: 'sv' });
  cases.unshift(['positive (synthetic fixture): bind accepts a complete identity', () => synthetic, { mode: 'bind', language: 'sv', matrix: fixture }, []]);
  return cases.map(([name, mutate, { matrix: m = matrix, ...options }, expect]) => {
    const result = validateManifest(m, mutate(clone(base)), { mode: 'plan', ...options });
    const codes = [...new Set(result.errors.map(e => e.code))].sort();
    const counts = Object.fromEntries(codes.map(c => [c, result.errors.filter(e => e.code === c).length]));
    const pass = expect === null ? !result.ok : JSON.stringify(codes) === JSON.stringify([...expect].sort());
    return { name, pass, ok: result.ok, entries: result.entries, codes: counts };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const matrix = parseMatrix(readFileSync(arg('--matrix') ?? new URL('../K05-matris.tsv', import.meta.url), 'utf8'));
  if (process.argv.includes('--selftest')) {
    const results = selftest(matrix);
    for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ok=${r.ok} entries=${r.entries} ${JSON.stringify(r.codes)}`);
    const failed = results.filter(r => !r.pass).length;
    console.log(`${results.length - failed}/${results.length} cases as expected`);
    process.exitCode = failed ? 1 : 0;
  } else {
    const manifest = JSON.parse(readFileSync(arg('--manifest'), 'utf8'));
    const result = validateManifest(matrix, manifest, { mode: arg('--mode') ?? 'plan', language: arg('--language') });
    console.log(JSON.stringify(result, null, 1));
    process.exitCode = result.ok ? 0 : 1;
  }
}
