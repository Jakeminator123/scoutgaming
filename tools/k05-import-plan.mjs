// K05 inventory dry run. Reads Kevin's frozen K05 matrix and classifies every row
// against main's identity rules (exact sha256 + bytes; never name or length).
// Optional: verifies each selected row's Git blob in a read-only clone of the
// frozen source (existence, size, streamed sha256). No network, no secrets, no
// Neon/Blob access and no media bytes written anywhere. Output is JSON only.
//
//   node tools/k05-import-plan.mjs [--matrix <tsv>] [--out <json>]
//        [--git-repo <path>] [--verify vald|alla|ingen]
//
// Without --git-repo the run is metadata-only (classification from the matrix).
// The result is a run artefact: by default it goes to the git-ignored
// arkiv/<date>/<matrix directory>/importplan.json, never into the tracked tree.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const DEFAULT_MATRIX = 'migrering/kevin-ks-migrering/K05/K05-matris.tsv';
export function defaultOutputPath(now = new Date()) {
  return `arkiv/${now.toISOString().slice(0, 10)}/migrering/kevin-ks-migrering/K05/importplan.json`;
}
export const KEVIN_HEAD = '5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc';   // kevin-merge-admin, frozen source (K05-mappning K)
export const V1_HEAD = '238d6dd681745ca87a813b969443e7edee3f820b';      // c4818f51^, the 28 deleted V1 files (K05-mappning K-V1)
export const SOURCE_PREFIX = 'kevin/croupier-scoutgg/';
export const CLASSES = Object.freeze(['befintlig', 'ny', 'uppskjuten', 'kallbevis', 'ej-vald', 'avvisad']);

// Registrations Jakob reported after the matrix was frozen (#312 comment 6340621499,
// attested by Kevin in 6345659966). Reported receipts, not a Neon readback: the row
// keeps its matrix class and only carries the reported id for the later readback.
export const REPORTED_POST_FREEZE = Object.freeze({
  'media/dealers/dragge/repliker/sv/dealerbust_1.mp4': '3a5f30df-f14c-4c60-a77a-c5945174f9dd',
  'media/dealers/dragge/repliker/en/greeting_1.mp4': '527f060c-dea4-4359-ad4b-3c56e6971315',
  'media/dealers/dragge/repliker/sv/greeting_1.mp4': '42a4ef4a-e4e2-4358-979f-77ab4abe8b95',
  'media/dealers/dragge/repliker/en/greeting_2.mp4': 'a18f912b-0c70-4826-8453-1f5fd268c354',
  'media/dealers/dragge/repliker/sv/greeting_2.mp4': '69142916-4914-4b99-b2bf-95d4cad57d71',
  'media/dealers/dragge/repliker/en/greeting_3.mp4': 'f5350c95-dde8-416e-a3e4-31fbbe766136',
  'media/dealers/dragge/repliker/sv/greeting_3.mp4': 'a55678a1-eae1-45d9-a1b9-9b04e18174f9',
  'media/dealers/dragge/repliker/sv/placebets_1.mp4': 'dbe3a415-98b9-44e9-bd05-d262862237a5',
  'media/dealers/dragge/repliker/sv/win_1.mp4': 'e248cb85-c9d7-4d46-9b02-2eb010243b88',
});

const SHA256 = /^[a-f0-9]{64}$/, GITBLOB = /^[a-f0-9]{40}$/, UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const REVIEW_UPLOADS = /^croupier\/media\/dealers\/[^/]+\/review\/uploads\//;
const REQUIRED_COLUMNS = ['kalla_sokvag', 'kalla_gitblob', 'bytes', 'sha256', 'kevin_dealer', 'k04_kalla', 'main_fack', 'kevin_variant',
  'sprak', 'replik', 'urval', 'registrerad_dealer', 'neon_media_id', 'katalog_logicalPath', 'blob_identitet', 'paket', 'projekt', 'status'];
const empty = value => value === undefined || value === '' || value === '-' || value === 'saknas' || value === 'n.a.';

export function parseMatrix(text) {
  const lines = String(text).split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error('Tom matris');
  const header = lines[0].split('\t');
  for (const column of REQUIRED_COLUMNS) if (!header.includes(column)) throw new Error(`Matrisen saknar kolumnen ${column}`);
  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split('\t');
    if (cells.length !== header.length) throw new Error(`Rad ${index + 2} har ${cells.length} kolumner, väntade ${header.length}`);
    return Object.freeze(Object.fromEntries(header.map((key, i) => [key, cells[i]])));
  });
  if (new Set(rows.map(row => row.kalla_sokvag)).size !== rows.length) throw new Error('Dubblerad källväg i matrisen');
  return rows;
}

// Matrix paths are served paths under Kevin's public/; the six JS rows are repo paths (public/...).
export function gitPathFor(kallaSokvag) {
  if (typeof kallaSokvag !== 'string' || !kallaSokvag || kallaSokvag.includes('..') || kallaSokvag.startsWith('/')) throw new Error('Ogiltig källväg');
  return SOURCE_PREFIX + (kallaSokvag.startsWith('public/') ? kallaSokvag : 'public/' + kallaSokvag);
}
export const isV1Row = row => String(row.urval ?? '').startsWith('avvisad:V1');
export const headFor = row => (isV1Row(row) ? V1_HEAD : KEVIN_HEAD);

/** Pure classification. `verification` is {gitblob,bytes,sha256} each 'ok'|'saknas'|'avviker'|'ej-kontrollerad'. */
export function classifyRow(row, verification = null) {
  const out = (klass, orsak, mal = {typ: 'ingen'}) => ({klass, orsak, mal});
  if (!row || !SHA256.test(row.sha256 ?? '') || !GITBLOB.test(row.kalla_gitblob ?? '') || !/^\d+$/.test(row.bytes ?? '') || Number(row.bytes) < 1) {
    return out('avvisad', 'ogiltig_matrisrad');
  }
  const urval = String(row.urval ?? '');
  if (urval.startsWith('avvisad:V1')) return out('avvisad', 'v1_bortvald');
  if (urval.startsWith('ej-vald')) return out('ej-vald', urval.slice('ej-vald:'.length) || 'utanfor_urval');
  if (urval.startsWith('uppskjuten')) return out('uppskjuten', urval);
  if (urval.startsWith('kallbevis')) return out('kallbevis', 'versionsbundet_kallbevis_ingen_runtimeidentitet');
  if (urval !== 'vald') return out('avvisad', 'okant_urval');
  if (verification) {
    if (verification.gitblob === 'saknas') return out('avvisad', 'kallblob_saknas');
    if (verification.gitblob === 'avviker') return out('avvisad', 'gitblob_avviker');
    if (verification.bytes === 'avviker') return out('avvisad', 'bytes_avviker');
    if (verification.sha256 === 'avviker') return out('avvisad', 'sha256_avviker');
  }
  const mediaId = row.neon_media_id, blob = row.blob_identitet, logicalPath = row.katalog_logicalPath;
  if (row.status === 'befintlig-identitet') {
    if (UUID.test(mediaId ?? '')) {
      if (empty(blob) || !blob.includes(row.sha256)) return out('avvisad', 'blobidentitet_saknar_hash');
      return out('befintlig', 'exakt_neon_media', {typ: 'neon-media', mediaId, blobPathname: blob, logicalPath: empty(logicalPath) ? null : logicalPath,
        paket: empty(row.paket) || row.paket === 'inget paket' ? null : row.paket, kraverPromotion: REVIEW_UPLOADS.test(blob)});
    }
    if (!empty(logicalPath) && !empty(blob) && blob.includes(row.sha256)) {
      return out('befintlig', 'exakt_katalogpost', {typ: 'katalog', mediaId: null, blobPathname: blob, logicalPath, paket: null, kraverPromotion: false});
    }
    return out('avvisad', 'befintlig_utan_identitet');
  }
  if (row.status === 'ny-post-planerad') {
    if (UUID.test(mediaId ?? '')) return out('avvisad', 'planerad_med_media_id');
    return out('ny', 'saknar_registerpost', {typ: 'planerad', mediaId: null, blobPathname: null, logicalPath: null, paket: null, kraverPromotion: false});
  }
  return out('avvisad', `okand_status:${row.status}`);
}

export function planRow(row, index, verification = null) {
  const {klass, orsak, mal} = classifyRow(row, verification);
  const reported = REPORTED_POST_FREEZE[row.kalla_sokvag];
  return {
    rad: index + 2, head: headFor(row), sokvag: gitPathFor(row.kalla_sokvag), kallaSokvag: row.kalla_sokvag,
    gitblob: row.kalla_gitblob, bytes: Number(row.bytes), sha256: row.sha256,
    dealer: row.kevin_dealer, registreradDealer: empty(row.registrerad_dealer) ? null : row.registrerad_dealer,
    kalla: row.k04_kalla, handelse: row.main_fack || null, variant: row.kevin_variant || null, sprak: row.sprak || null, take: row.replik || null,
    urval: row.urval, matrisStatus: row.status, klass, orsak, mal,
    verifiering: verification ?? {gitblob: 'ej-kontrollerad', bytes: 'ej-kontrollerad', sha256: 'ej-kontrollerad'},
    ...(reported ? {rapporterad: {mediaId: reported, kalla: '#312 6340621499 / 6345659966', status: 'rapporterad registrering, inte återläst i Neon av detta verktyg'}} : {}),
  };
}

export function summarize(rows) {
  const count = (list, key) => { const m = {}; for (const row of list) { const k = key(row); m[k] = (m[k] ?? 0) + 1; } return m; };
  const bytes = list => { const seen = new Set(); let total = 0; for (const row of list) if (!seen.has(row.sha256)) { seen.add(row.sha256); total += row.bytes; } return {unikaSha256: seen.size, unikaBytes: total}; };
  const perKlass = {};
  for (const klass of CLASSES) {
    const list = rows.filter(row => row.klass === klass);
    perKlass[klass] = {rader: list.length, ...bytes(list), orsaker: count(list, row => row.orsak), dealers: count(list, row => row.dealer)};
  }
  const valda = rows.filter(row => ['befintlig', 'ny'].includes(row.klass));
  const sha = count(rows, row => row.sha256);
  return {
    rader: rows.length, perKlass,
    valda: {rader: valda.length, ...bytes(valda), kraverPromotion: valda.filter(row => row.mal.kraverPromotion).length,
      perDealer: count(valda, row => `${row.dealer}->${row.registreradDealer ?? 'oregistrerad'}`), perKalla: count(valda, row => row.kalla)},
    bytedubbletter: {sha256MedFleraRader: Object.values(sha).filter(n => n > 1).length, raderSomDelarBytes: Object.values(sha).filter(n => n > 1).reduce((a, b) => a + b, 0)},
    rapporteradeEfterFrysning: rows.filter(row => row.rapporterad).length,
    verifiering: count(rows, row => `${row.verifiering.gitblob}/${row.verifiering.bytes}/${row.verifiering.sha256}`),
  };
}

// --- Git verification against a read-only clone (no checkout, no media on disk) ---
function git(repo, args, input) {
  const result = spawnSync('git', ['-C', repo, ...args], {input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (result.status !== 0) throw new Error(`git ${args[0]} misslyckades: ${result.stderr.trim()}`);
  return result.stdout;
}
export function batchCheck(repo, specs) {
  const lines = git(repo, ['cat-file', '--batch-check'], specs.join('\n') + '\n').split('\n').filter(Boolean);
  if (lines.length !== specs.length) throw new Error('git cat-file --batch-check gav fel antal rader');
  return lines.map(line => {
    const parts = line.trim().split(/\s+/);
    return parts.at(-1) === 'missing' || parts[1] !== 'blob' ? null : {oid: parts[0], size: Number(parts[2])};
  });
}
export function hashBlob(repo, oid) {
  return new Promise((done, failed) => {
    const child = spawn('git', ['-C', repo, 'cat-file', 'blob', oid], {stdio: ['ignore', 'pipe', 'pipe']});
    const hash = createHash('sha256'); let size = 0, stderr = '';
    child.stdout.on('data', chunk => { hash.update(chunk); size += chunk.length; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', failed);
    child.on('close', code => code === 0 ? done({sha256: hash.digest('hex'), size}) : failed(new Error(`git cat-file blob ${oid}: ${stderr.trim()}`)));
  });
}
export async function verifyRows(repo, rows, {mode = 'vald'} = {}) {
  const specs = rows.map(row => `${headFor(row)}:${gitPathFor(row.kalla_sokvag)}`);
  const checked = batchCheck(repo, specs);
  const results = [];
  for (const [i, row] of rows.entries()) {
    const found = checked[i];
    const verification = {gitblob: !found ? 'saknas' : found.oid === row.kalla_gitblob ? 'ok' : 'avviker',
      bytes: !found ? 'saknas' : found.size === Number(row.bytes) ? 'ok' : 'avviker', sha256: 'ej-kontrollerad'};
    const wanted = mode === 'alla' || (mode === 'vald' && row.urval === 'vald');
    if (found && wanted && verification.gitblob === 'ok') {
      const {sha256, size} = await hashBlob(repo, found.oid);
      verification.sha256 = sha256 === row.sha256 ? 'ok' : 'avviker';
      if (size !== Number(row.bytes)) verification.bytes = 'avviker';
    }
    results.push(verification);
  }
  return results;
}

export async function buildPlan({matrixPath = DEFAULT_MATRIX, gitRepo = null, verify = 'vald'} = {}) {
  const text = readFileSync(matrixPath, 'utf8');
  const rows = parseMatrix(text);
  const verifications = gitRepo ? await verifyRows(gitRepo, rows, {mode: verify}) : rows.map(() => null);
  const planned = rows.map((row, i) => planRow(row, i, verifications[i]));
  return {
    schemaVersion: 1, syfte: 'K05 inventering (torrkörning): klassning per matrisrad mot mains identitetsregler. Ingen import, ingen Neon-/Blob-åtkomst, inga mediakopior.',
    kalla: {matris: matrixPath.split('\\').join('/'), matrisSha256: createHash('sha256').update(text).digest('hex'), rader: rows.length,
      kevinHead: KEVIN_HEAD, v1Head: V1_HEAD, prefix: SOURCE_PREFIX, verifiering: gitRepo ? {lage: verify, repo: 'read-only Git-klon (sökväg utelämnad)'} : {lage: 'ingen', repo: null}},
    identitetsregler: ['exakt sha256 och bytes; aldrig namn, etikett, mapp eller längd', 'V1 (c4818f51) avvisas alltid', 'uppskjutna rader och källbevis är inte runtimeidentiteter',
      'befintlig identitet kräver exakt Neon-UUID eller katalog-logicalPath vars Blob-sökväg bär samma sha256', 'en planerad post får inte bära ett media-ID', 'Blob under review/uploads kräver auktoriserad promotion före katalogbindning'],
    sammanfattning: summarize(planned), rader: planned,
  };
}

function argValue(args, name, fallback) { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; }
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const verify = argValue(args, '--verify', 'vald');
  if (!['vald', 'alla', 'ingen'].includes(verify)) { console.error('--verify tar vald|alla|ingen'); process.exit(2); }
  const gitRepo = argValue(args, '--git-repo', null);
  const plan = await buildPlan({matrixPath: resolve(argValue(args, '--matrix', DEFAULT_MATRIX)), gitRepo: gitRepo ? resolve(gitRepo) : null, verify});
  const out = resolve(argValue(args, '--out', defaultOutputPath()));
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, JSON.stringify(plan, null, 1) + '\n');
  const s = plan.sammanfattning;
  console.log(JSON.stringify({ut: out.split('\\').join('/'), rader: s.rader, perKlass: Object.fromEntries(Object.entries(s.perKlass).map(([k, v]) => [k, v.rader])),
    valda: {rader: s.valda.rader, unikaSha256: s.valda.unikaSha256, unikaBytes: s.valda.unikaBytes, kraverPromotion: s.valda.kraverPromotion}, verifiering: s.verifiering}));
}
