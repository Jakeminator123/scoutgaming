#!/usr/bin/env node
// O02 receipt builder — READ-ONLY skeleton (Scoutgaming migration, activity O02).
//
// Produces o02-receipt.json from (1) the frozen candidate SHA, (2) the sanitised receipts in
// Git at --receipts-ref (default origin/main), (3) the O02 records outside Git (freeze, restore replay, Jakob's eyes),
// (4) read-only HTTP GETs against isolated staging and (5) read-only Neon SELECTs.
// It never logs in, never POSTs, never writes SQL and never touches production.
// Human acceptance (AV, lip sync, card contact, mobile, layout) is only *recorded*
// from Jakob's signed manifest; the script never infers it.
//
// Usage (PowerShell or bash), from the repository root after `git fetch origin`:
//   node tools/o02-receipt.mjs --candidate <40-hex main SHA> --inputs <O02 folder outside Git> \
//     [--repo <checkout, default: this repository>] [--out o02-receipt.json] [--github]
//     [--neon --neon-url-file <file holding the croupier_staging_app connection string>] [--reviewer <agent-id>]
//     [--receipts-ref <ref, default origin/main>] [--expect-config <room-config-…>] [--expect-package <n>]
// The reruns on the candidate are merged as documentation after the freeze, so they never exist at
// the candidate SHA. Receipts are therefore read at --receipts-ref, which must descend from the
// candidate without any runtime change (RUNTIME_PREFIXES); otherwise F8 fails with the file list.
// D1 and C1 expect the room's config head and package revision from the newest K06 receipt's
// neon.finalState unless --expect-config/--expect-package override them; the source is recorded.
// Receipt contracts:
//   in Git at --receipts-ref (newest per family, see RECEIPT_FAMILIES in tools/o02-freeze-check.mjs):
//     docs/<date>-K04-BROWSER-RERUN-<n>-ACCEPTANCE.json   (RERUN-3 today; RERUN-4 on the frozen candidate)
//     docs/<date>-K06-STAGING-RERUN[-<n>]-ACCEPTANCE.json  (o02ContractChecks[], twoConsecutiveGames)
//     docs/<date>-K07-STAGING-RERUN[-<n>]-ACCEPTANCE.json  (checks[], candidate)
//   in --inputs (outside Git; never committed raw):
//     o02/frozen-candidate.json            from tools/o02-freeze-check.mjs, completed by hand (F3/F4/F6/F7)
//     o02/restore-replay/receipt.json      docs/plans/O02-RESTORE-REPLAY.md R10
//     o02/jakob-eyes/manifest.json         O02-PLAN.md §4 (V1–V7)
//     o02/negative/receipt.json            O02-PLAN.md §5: {candidate, cases:[{id, result:'pass'|'booked', note}]}, exactly NEGATIVE_CASE_IDS
// The connection string file is read, never printed. Without --neon-url-file the Neon criterion
// stays "missing". --github uses the already-authenticated `gh` CLI (read-only API calls only).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPO, RUNTIME_PREFIXES, CI_WORKFLOW, CONTAINER_WORKFLOW, latestReceipts, receiptSha, openRuntimePrs, pickRun, touchesRuntime } from './o02-freeze-check.mjs';

// ---------- fixed isolated targets (production is refused) ----------
// The expected config head and package revision are not fixed here: every K06 rerun publishes
// new ones, so they come from the newest K06 receipt (expectedStagingHead) or the flags.
const STAGING = Object.freeze({
  origin: 'https://croupier-k06-k07-staging.vercel.app',
  backend: 'https://croupier-k06-k07-staging.onrender.com',
  renderService: 'srv-dbf61l0m7kps73ft7mk0',
  neon: { project: 'red-violet-36066351', branch: 'br-plain-voice-b9yu49xi', database: 'croupier_staging', role: 'croupier_staging_app' },
  operatorA: 'qa-k06k07-9dd2d3a4-a', operatorB: 'qa-k06k07-9dd2d3a4-b',
  room: 'room-33b37ff3-ec79-ff2d-5567-b14a9d3efe5e', neighborRoom: 'room-cb4c4696-f671-c546-eb15-6fb67d09feea',
});
const ALLOWED_HOSTS = new Set([new URL(STAGING.origin).host, new URL(STAGING.backend).host]);
// Production identities that no test fixture may name (K4b). Hostnames are reported separately:
// they appear as inert string data in URL-builder tests and need a human look, not a fail.
const PRODUCTION_IDS = ['wandering-hill-60561912', 'br-flat-fog-b161a6r8', 'ep-fragrant-meadow', 'room-76640ca1', 'johns-bet', 'store_AqwvebTbBHarOjvG', 'srv-dbd6nfon74is73aiblf0'];
const PRODUCTION_HOSTS = ['www.scoutgaming.tech', 'croupier-v3.onrender.com'];
const FIXTURE_PATHS = ['test/**', '**/test/**', '*.test.*', 'tools/*qa*'];
// MASTERPLAN.md line references (O02 checklist) as of 2026-10-28.
const MP = { sqlite: 'MASTERPLAN.md:9', freeze: 'MASTERPLAN.md:70', chain: 'MASTERPLAN.md:71', negative: 'MASTERPLAN.md:72', retired: 'MASTERPLAN.md:73', reviewer: 'MASTERPLAN.md:74', done: 'MASTERPLAN.md:76' };

// ---------- rules (exported for test/o02-receipt.mjs) ----------
// o02/negative/receipt.json must hold exactly these cases (O02-PLAN.md §5.1 and the leaks in §5.2).
export const NEGATIVE_CASE_IDS = Object.freeze(['K3a', 'K3b', 'K3c', 'K3d', 'K3e', 'K3f', 'K3g', 'K4', 'K4b', 'K6', 'K8', 'L1', 'L2', 'L3', 'L4', 'L5']);
// Shared-table checks S1 needs, named as in docs/2026-10-28-K07-STAGING-RERUN-ACCEPTANCE.json:
// g1 seat release after the round, g2a room left without owners, g2 no due ticks in a silent room.
export const SHARED_CHECK_IDS = Object.freeze(['K07-g1', 'K07-g2', 'K07-g2a']);

// Receipts are read at ref. That counts only if the candidate is an ancestor of ref and the two
// trees agree on every runtime path, so ref adds documentation and nothing that runs.
export function checkReceiptsRef(git, candidate, ref) {
  const result = { ref, sha: null, candidateIsAncestor: null, runtimeDiff: null, ok: false, reason: null };
  try { result.sha = git('rev-parse', '--verify', `${ref}^{commit}`); } catch { result.reason = `okänd ref ${ref}`; return result; }
  try { git('merge-base', '--is-ancestor', candidate, result.sha); result.candidateIsAncestor = true; } catch { result.candidateIsAncestor = false; }
  if (!result.candidateIsAncestor) { result.reason = `kandidaten är inte förfader till ${ref}`; return result; }
  result.runtimeDiff = git('diff', '--no-renames', '--name-only', candidate, result.sha).split('\n').filter(Boolean).filter(touchesRuntime);
  result.ok = result.runtimeDiff.length === 0;
  if (!result.ok) result.reason = `${ref} ändrar runtime efter kandidaten: ${result.runtimeDiff.join(', ')}`;
  return result;
}

// D1/C1 expectations: the flags win, otherwise the K06 receipt's final published state.
export function expectedStagingHead(k06, { config = null, packageRevision = null, k06Path = null } = {}) {
  const final = k06?.neon?.finalState ?? k06?.finalState ?? null;
  const fromConfig = typeof final?.head === 'string' && final.head ? final.head : null;
  const fromPackage = Number.isInteger(final?.packageRevision) ? final.packageRevision : null;
  const at = `${k06Path ?? 'K06-kvittot'}#neon.finalState`;
  return {
    publishedConfig: config ?? fromConfig, packageRevision: packageRevision ?? fromPackage,
    source: { publishedConfig: config ? '--expect-config' : fromConfig ? at + '.head' : null,
      packageRevision: packageRevision !== null ? '--expect-package' : fromPackage !== null ? at + '.packageRevision' : null },
  };
}

// Exactly NEGATIVE_CASE_IDS, each once, result pass or booked, with a non-empty note.
export function evaluateNegativeCases(neg, candidate) {
  const cases = Array.isArray(neg?.cases) ? neg.cases : [];
  const ids = cases.map(c => c?.id ?? null);
  const missing = NEGATIVE_CASE_IDS.filter(id => !ids.includes(id));
  const extra = ids.filter(id => !NEGATIVE_CASE_IDS.includes(id)).map(String);
  const duplicates = NEGATIVE_CASE_IDS.filter(id => ids.filter(x => x === id).length > 1);
  const invalid = cases.filter(c => NEGATIVE_CASE_IDS.includes(c?.id)).flatMap(c => [
    ...(['pass', 'booked'].includes(c.result) ? [] : [`${c.id}: result ${c.result ?? 'saknas'}`]),
    ...(typeof c.note === 'string' && c.note.trim() ? [] : [`${c.id}: note saknas`]),
  ]);
  const candidateMatch = neg?.candidate === candidate;
  return { present: Boolean(neg), candidateMatch, missing, extra, duplicates, invalid,
    ok: Boolean(neg) && candidateMatch && !missing.length && !extra.length && !duplicates.length && !invalid.length };
}

// K07 checks as {id, result}; S1 needs SHARED_CHECK_IDS present and every check pass.
export const k07ChecksOf = json => (json?.checks ?? []).map(c => ({ id: c.id, result: c.result ?? (c.pass === true ? 'pass' : c.pass === false ? 'fail' : null) }));
export function evaluateSharedChecks(checks) {
  const missing = SHARED_CHECK_IDS.filter(id => !checks.some(c => c.id === id));
  const notPass = checks.filter(c => c.result !== 'pass').map(c => c.id);
  return { required: SHARED_CHECK_IDS, missing, notPass, ok: checks.length > 0 && !missing.length && !notPass.length };
}

// D1 from the read-only Neon rows: null (missing) without rows or without an expectation.
export function evaluateDatabase(neon, expected, role) {
  if (!neon || expected.publishedConfig === null || expected.packageRevision === null) return null;
  return neon.who?.role === role && neon.sharedTables === 15 && neon.ledgerMismatch === 0 && neon.negativeBalances === 0 && neon.duplicateSourceKeys === 0
    && neon.configHead?.version === expected.publishedConfig && neon.packageHead === expected.packageRevision;
}

async function main() {
  // ---------- args ----------
  const argv = process.argv.slice(2);
  const arg = (name, fallback = null) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback; };
  const flag = name => argv.includes('--' + name);
  const candidate = arg('candidate');
  if (!/^[a-f0-9]{40}$/.test(candidate ?? '')) throw Error('--candidate must be a full 40-hex SHA');
  const repo = resolve(arg('repo', resolve(dirname(fileURLToPath(import.meta.url)), '..')));
  const neonUrlFile = arg('neon-url-file');
  const reviewerId = arg('reviewer');
  const inputs = resolve(arg('inputs', '.'));
  const out = resolve(arg('out', 'o02-receipt.json'));
  const receiptsRefName = arg('receipts-ref', 'origin/main');
  const expectConfig = arg('expect-config');
  const expectPackageRaw = arg('expect-package');
  if (expectPackageRaw !== null && !/^\d+$/.test(expectPackageRaw)) throw Error('--expect-package must be a non-negative integer');
  const expectPackage = expectPackageRaw === null ? null : Number(expectPackageRaw);

  // ---------- helpers ----------
  const sha256 = buf => createHash('sha256').update(buf).digest('hex');
  const canonical = v => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
  const gh = (...a) => JSON.parse(execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 << 20 }));
  const at = () => new Date().toISOString();
  const log = [];

  function readInput(rel) {
    const p = join(inputs, rel);
    if (!existsSync(p)) return { path: rel, present: false };
    const buf = readFileSync(p);
    let json = null; try { json = JSON.parse(buf.toString('utf8')); } catch { /* not JSON */ }
    return { path: rel, present: true, bytes: buf.length, sha256: sha256(buf), json };
  }
  // Receipts in Git are read at --receipts-ref (checkReceiptsRef); code is still grepped at the candidate.
  const receiptsRef = checkReceiptsRef(git, candidate, receiptsRefName);
  function readRepoAtRef(rel) {
    if (!rel || !receiptsRef.sha) return { path: rel ?? null, present: false };
    try { const text = git('show', `${receiptsRef.sha}:${rel}`); return { path: `${rel}@${receiptsRef.sha.slice(0, 8)}`, present: true, sha256: sha256(text), json: JSON.parse(text) }; }
    catch { return { path: rel, present: false }; }
  }
  const get = (obj, path) => path.split('.').reduce((v, k) => v == null ? undefined : v[k], obj);
  // git grep at the candidate; exit 1 means no match.
  function grepAtCandidate(pattern, paths) {
    try { return git('grep', '-I', '-n', '-E', pattern, candidate, '--', ...paths).split('\n').filter(Boolean).map(l => l.slice(candidate.length + 1)); }
    catch (e) { if (e.status === 1) return []; throw e; }
  }

  async function httpGet(url, { expect, name, method = 'GET' } = {}) {
    const u = new URL(url);
    if (!ALLOWED_HOSTS.has(u.host)) throw Error('refused non-staging host ' + u.host);
    if (!['GET', 'HEAD'].includes(method)) throw Error('read-only: GET/HEAD only');
    const t0 = Date.now(); const entry = { name, at: at(), method, url: u.pathname + u.search, expected: expect ?? null };
    try {
      const res = await fetch(u, { method, redirect: 'manual', cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      const text = method === 'HEAD' ? '' : await res.text();
      let json = null; try { json = JSON.parse(text); } catch { /* html/text */ }
      Object.assign(entry, { status: res.status, ms: Date.now() - t0, location: res.headers.get('location'), vercelId: res.headers.get('x-vercel-id'), rndrId: res.headers.get('rndr-id'),
        pass: expect === undefined ? null : (Array.isArray(expect) ? expect.includes(res.status) : res.status === expect) });
      log.push(entry); return { status: res.status, json, text, entry };
    } catch (e) { Object.assign(entry, { transport: 'failed:' + (e.cause?.code ?? e.name), pass: false }); log.push(entry); return { status: 0, json: null, entry }; }
  }

  // ---------- criteria registry ----------
  // status: pass | fail | missing (proof absent) | manual (needs Jakob's signed manifest) | n/a
  const criteria = [];
  const crit = (id, source, text) => { const c = { id, source, criterion: text, status: 'missing', evidence: [], notes: [] }; criteria.push(c); return c; };
  const ev = (c, ref, detail) => c.evidence.push({ ref, detail });
  const decide = (c, ok, note) => { c.status = ok === null ? 'missing' : ok ? 'pass' : 'fail'; if (note) c.notes.push(note); };

  // ---------- 1. inputs ----------
  const latest = latestReceipts(receiptsRef.sha ? git('ls-tree', '-r', '--name-only', receiptsRef.sha, 'docs/').split('\n') : []);
  const docs = {
    j08: readRepoAtRef('docs/2026-10-27-J08-STAGING-ACCEPTANCE.json'),
    isolated: readRepoAtRef('docs/2026-10-27-ISOLATED-ACCEPTANCE.json'),
    k04Staging: readRepoAtRef('docs/2026-10-27-K04-STAGING-ACCEPTANCE.json'),
    status: readRepoAtRef('migrering/status.json'),
    k04: readRepoAtRef(latest.k04),
    k06: readRepoAtRef(latest.k06),
    k07: readRepoAtRef(latest.k07),
  };
  const records = {
    frozen: readInput('o02/frozen-candidate.json'),
    restoreReplay: readInput('o02/restore-replay/receipt.json'),
    jakobEyes: readInput('o02/jakob-eyes/manifest.json'),
    negative: readInput('o02/negative/receipt.json'),
  };
  // F8: each receipt counts for the candidate only if its code SHA is runtime-equivalent.
  const equivalence = Object.fromEntries(['k04', 'k06', 'k07'].map(family => {
    const sha = receiptSha(docs[family].json);
    let diff = null; if (sha) try { diff = git('diff', '--name-only', sha, candidate, '--', ...RUNTIME_PREFIXES).split('\n').filter(Boolean); } catch { /* unknown SHA */ }
    return [family, { path: docs[family].path, sha, runtimeDiffCount: diff?.length ?? null, equivalent: diff?.length === 0 }];
  }));
  const onCandidate = family => receiptsRef.ok && equivalence[family].equivalent === true;
  const expected = expectedStagingHead(docs.k06.json, { config: expectConfig, packageRevision: expectPackage, k06Path: latest.k06 });

  // ---------- 2. frozen candidate (F1, F2, F3, F5) ----------
  const cFreeze = crit('F1', `${MP.freeze}; O02-PLAN.md §1`, 'Fryst integrerad kandidat: main-SHA, full CI grön, containerkontroll, inga öppna icke-draft-PR:er på runtime');
  const freeze = { candidate, onMain: null, ciRun: null, containerRun: null, openRuntimePrs: null, mainHead: null };
  try { git('merge-base', '--is-ancestor', candidate, 'origin/main'); freeze.onMain = true; } catch { freeze.onMain = false; }
  try { freeze.mainHead = git('rev-parse', 'origin/main'); } catch { /* offline */ }
  if (flag('github')) {
    const runs = gh('api', `repos/${REPO}/actions/runs?head_sha=${candidate}&per_page=100`).workflow_runs ?? [];
    freeze.ciRun = pickRun(runs, CI_WORKFLOW);
    freeze.containerRun = pickRun(runs, CONTAINER_WORKFLOW, ['workflow_dispatch', 'push', 'pull_request']);
    freeze.openRuntimePrs = openRuntimePrs(gh('pr', 'list', '-R', REPO, '--state', 'open', '--limit', '100', '--json', 'number,isDraft,author,headRefOid,files'));
  }
  ev(cFreeze, 'git+gh', freeze);
  decide(cFreeze, !flag('github') ? null : freeze.onMain && freeze.ciRun?.conclusion === 'success' && freeze.containerRun?.conclusion === 'success'
    && freeze.openRuntimePrs.every(p => p.draft), 'Draft-PR:er räknas inte som öppna runtimeändringar men listas; containerkörningen kräver workflow_dispatch om sökvägsfiltret inte träffade.');

  const cRerun = crit('F8', 'O02-PLAN.md §1 (F8)', 'K04-, K06- och K07-kvittona i Git är tagna på kandidaten eller en runtime-ekvivalent SHA');
  ev(cRerun, `--receipts-ref ${receiptsRefName}: kandidaten är förfader och git diff --name-only <kandidat> <ref> rör inget RUNTIME_PREFIXES`, receiptsRef);
  ev(cRerun, 'git diff --name-only <kvittots SHA> <kandidat> -- RUNTIME_PREFIXES', equivalence);
  decide(cRerun, ['k04', 'k06', 'k07'].every(onCandidate), receiptsRef.ok ? null : receiptsRef.reason);
  cRerun.notes.push('Kvitto som inte är ekvivalent tas om på kandidaten (K04 RERUN-4, K06/K07 ny RERUN) och läggs i Git före granskningen.');

  // ---------- 3. live staging versions (read-only) ----------
  const cEnv = crit('E1', `${MP.freeze}; RENDER-V3.md`, 'Webb, motor, schema och media verifieras separat; driftsversion = kandidat eller runtime-ekvivalent');
  const health = await httpGet(STAGING.backend + '/__cloud/health', { expect: 200, name: 'render health' });
  const version = await httpGet(STAGING.backend + '/__cloud/version', { expect: 200, name: 'render version' });
  const deployed = version.json?.commitSha ?? null;
  let runtimeDiff = null;
  if (deployed && /^[a-f0-9]{40}$/.test(deployed)) {
    try { runtimeDiff = git('diff', '--name-only', deployed, candidate, '--', ...RUNTIME_PREFIXES).split('\n').filter(Boolean); } catch { runtimeDiff = ['<diff unavailable>']; }
  }
  const fz = records.frozen.json;
  const vercelSha = fz?.manual?.F6?.vercel?.sha ?? fz?.vercel?.sha ?? null; // read from the Vercel API by the operator (HTTP does not expose it)
  ev(cEnv, 'GET /__cloud/health,/__cloud/version', { health: health.status, deployed, runtimeDiffFromCandidate: runtimeDiff, vercelSha });
  decide(cEnv, vercelSha === null ? null : health.status === 200 && deployed !== null && runtimeDiff?.length === 0 && vercelSha === candidate,
    'Vercel-SHA måste registreras i frozen-candidate.json (manual.F6.vercel.sha) från Vercel-API:t; HTTP visar den inte.');

  // ---------- 4. negative cases (live anonymous GET + receipts in Git) ----------
  const cNeg = crit('N1', MP.negative, 'Negativa fall: fel rum/ägare/roll, inaktuellt paket, dubbelkommando, samtidighet, avbruten presentation, fel media-ID');
  const anon = await Promise.all([
    httpGet(STAGING.origin + '/studio/api/admin/transactions', { expect: 401, name: 'anon admin transactions' }),
    httpGet(STAGING.origin + '/studio/api/admin/room-game-config?' + new URLSearchParams({ operatorId: STAGING.operatorA, roomId: STAGING.room }), { expect: 401, name: 'anon admin config' }),
    httpGet(STAGING.origin + '/api/table', { expect: [401, 405], name: 'anon table' }),
  ]);
  const j08 = docs.j08.json;
  const k06Contract = ['wrong-role', 'bad-media-id', 'interrupted-presentation'].map(id => {
    const row = (docs.k06.json?.o02ContractChecks ?? []).find(c => c.id === id);
    return { id, result: row ? (/^pass\b/.test(String(row.result)) ? 'pass' : String(row.result)) : null, note: row?.note ?? null };
  });
  const k07Checks = k07ChecksOf(docs.k07.json);
  ev(cNeg, 'live anon GET', anon.map(a => a.entry));
  ev(cNeg, `${docs.k06.path}#o02ContractChecks`, k06Contract);
  ev(cNeg, `${docs.k07.path}#checks`, k07Checks);
  ev(cNeg, 'docs/2026-10-27-J08-STAGING-ACCEPTANCE.json#j08.negative.checks', (get(j08, 'j08.negative.checks') ?? []).map(c => [c.name, c.pass]));
  const neg = records.negative.json;
  ev(cNeg, `expected o02/negative/receipt.json (O02-PLAN.md §5: ${NEGATIVE_CASE_IDS.join(', ')})`, neg ? { candidate: neg.candidate, cases: neg.cases } : null);
  // "booked" = a known deviation Jakob accepted for O03 (e.g. a leak left open); it does not block but is listed.
  const negCases = evaluateNegativeCases(neg, candidate);
  ev(cNeg, 'o02/negative/receipt.json mot NEGATIVE_CASE_IDS', negCases);
  const negCasesOk = negCases.ok;
  const negOk = anon.every(a => a.entry.pass) && k06Contract.every(n => n.result === 'pass') && k07Checks.length > 0 && k07Checks.every(c => c.result === 'pass');
  decide(cNeg, k06Contract.some(n => n.result === null) || !k07Checks.length || !neg ? null
    : negOk && negCasesOk && onCandidate('k06') && onCandidate('k07') ? true : negOk && neg.candidate !== candidate ? null : false,
    'Partnerrollen i wrong-role är ersatt av CI-prov (Jakobs scopebeslut 2026-10-28). Kvittona räknas bara när F8 är ekvivalent.');
  if (neg && !negCases.ok) cNeg.notes.push(['missing', 'extra', 'duplicates', 'invalid'].filter(k => negCases[k].length).map(k => `${k}: ${negCases[k].join(', ')}`)
    .concat(negCases.candidateMatch ? [] : ['candidate skiljer sig från --candidate']).join('; '));

  // ---------- 5. retired surfaces + SQLite + fixtures (R1, T1) ----------
  const cRetired = crit('R1', `${MP.retired}; ${MP.sqlite}; AGENTS.md`, 'Borttagna ytor kan inte starta alternativ produkt; ingen SQLite i någon kod');
  const retired = await Promise.all([
    httpGet(STAGING.origin + '/control', { expect: [307, 308, 404], name: '/control' }),
    httpGet(STAGING.origin + '/lab', { expect: [307, 308, 404], name: '/lab' }),
    httpGet(STAGING.origin + '/bo', { expect: 404, name: '/bo' }),
    httpGet(STAGING.backend + '/studio', { expect: 307, name: 'render /studio redirect' }),
  ]);
  const redirectsToAdminOnly = retired.slice(0, 2).every(r => r.status === 404 || /\/admin(\b|\/|$)/.test(r.entry.location ?? ''));
  // Flat ban: the same pattern and documentation exemption as tools/check-no-sqlite.mjs, applied to the candidate tree.
  const { SQLITE_PATTERN } = await import(pathToFileURL(join(repo, 'tools/check-no-sqlite.mjs')).href);
  const { isDocumentationPath } = await import(pathToFileURL(join(repo, 'tools/documentation-paths.mjs')).href);
  const sqliteFiles = [...new Set(grepAtCandidate(SQLITE_PATTERN, ['.']).map(l => l.split(':')[0]))];
  const sqliteViolations = sqliteFiles.filter(p => !isDocumentationPath(p));
  ev(cRetired, 'live GET', retired.map(r => r.entry));
  ev(cRetired, `tools/check-no-sqlite.mjs pattern @${candidate.slice(0, 8)}`, { documentationMentions: sqliteFiles.length - sqliteViolations.length, violations: sqliteViolations });
  decide(cRetired, retired.every(r => r.entry.pass) && redirectsToAdminOnly && sqliteViolations.length === 0);

  const cFixtures = crit('T1', MP.retired, 'Testfixturer och QA-verktyg använder aldrig produktionens identiteter eller riktiga användardata (K4b)');
  const idHits = grepAtCandidate(PRODUCTION_IDS.map(s => s.replace(/[.]/g, '\\.')).join('|'), FIXTURE_PATHS);
  const hostHits = grepAtCandidate(PRODUCTION_HOSTS.map(s => s.replace(/[.]/g, '\\.')).join('|'), FIXTURE_PATHS);
  ev(cFixtures, `git grep @${candidate.slice(0, 8)} ${FIXTURE_PATHS.join(' ')}`, { productionIds: idHits.map(l => l.slice(0, 160)), productionHosts: hostHits.map(l => l.slice(0, 160)) });
  decide(cFixtures, idHits.length ? false : null, 'Värdnamnsträffar granskas manuellt (strängdata i URL-byggarprov är tillåtet; nätverksanrop eller skrivmål är det inte). Staging-SELECT av syntetiska konton: O02-PLAN.md §5 K4b.');

  // ---------- 6. Admin chain + lobby (read-only) ----------
  const cChain = crit('C1', MP.chain, 'Admin spara → publicera → lobby → auktoriserad launch → spel → återanslutning → omstart → återläsning (två följande spel)');
  const lobbyA = await httpGet(STAGING.origin + `/api/operators/${STAGING.operatorA}/rooms`, { expect: 200, name: 'lobby A' });
  const lobbyB = await httpGet(STAGING.origin + `/api/operators/${STAGING.operatorB}/rooms`, { expect: 200, name: 'lobby B' });
  // Lobby shape (verified 2026-10-27): {schemaVersion, operator, packageRevision, rooms:[{id,...}]}
  const roomsOf = j => (j?.rooms ?? []).map(r => ({ id: r.id, packageRevision: j.packageRevision ?? null }));
  const inA = roomsOf(lobbyA.json).find(r => r.id === STAGING.room) ?? null; const inB = roomsOf(lobbyB.json).some(r => r.id === STAGING.room);
  ev(cChain, 'live lobby GET', { inA, inB, expectedPackageRevision: expected.packageRevision, source: expected.source.packageRevision });
  ev(cChain, 'docs/2026-10-27-J08-STAGING-ACCEPTANCE.json#j08.positive', get(j08, 'j08.positive.published'));
  const twoGames = docs.k06.json?.twoConsecutiveGames ?? null;
  ev(cChain, `${docs.k06.path}#twoConsecutiveGames`, twoGames);
  decide(cChain, expected.packageRevision !== null && inA?.packageRevision === expected.packageRevision && !inB && twoGames?.pass === true && onCandidate('k06') ? true : twoGames?.pass === false ? false : null,
    'Förväntad paketrevision ur K06-kvittots neon.finalState eller --expect-package (publiceras något efter K06-omprovet anges den med flaggan efter läsning av operator_packages).');

  // ---------- 7. Neon read-only ----------
  const cDb = crit('D1', `${MP.freeze} (schema); exakt en ekonomisk effekt`, 'Schema/ledger: migreringar, publicerad config-huvud, ledger = saldo per spelare, inga dubbla idempotensnycklar');
  let neon = null;
  if (flag('neon') && neonUrlFile) {
    const { Client } = createRequire(join(repo, 'services/game/package.json'))('pg');
    const client = new Client({ connectionString: readFileSync(neonUrlFile, 'utf8').trim(), ssl: { rejectUnauthorized: true } });
    await client.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const q = async (sql, params = []) => (await client.query(sql, params)).rows;
      neon = {
        who: (await q('SELECT current_database() AS db, current_user AS role'))[0],
        studioMigrations: await q('SELECT version, checksum FROM croupier_studio.storage_migrations ORDER BY version'),
        gameMigrations: await q('SELECT version, checksum FROM croupier_game.storage_migrations ORDER BY version'),
        sharedTables: (await q("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='croupier_game' AND c.relname LIKE 'shared\\_%' AND c.relkind='r'"))[0].n,
        configHead: (await q('SELECT h.version, sha256(convert_to(c.body,\'UTF8\'))::text AS body_sha FROM croupier_game.shared_table_config_heads h JOIN croupier_game.shared_table_configs c USING (room_id,version) WHERE h.room_id=$1', [STAGING.room]))[0] ?? null,
        packageHead: (await q('SELECT max(package_revision)::int AS revision FROM croupier_studio.operator_packages WHERE operator_id=$1', [STAGING.operatorA]))[0]?.revision ?? null,
        // Economy invariant for every player: opening balance + Σ ledger == balance (text compare avoids NUMERIC 1247.00/1247 trap).
        ledgerMismatch: (await q(`SELECT count(*)::int n FROM croupier_game.players p
          WHERE p.balance <> (SELECT COALESCE(sum(t.amount),0) FROM croupier_game.transactions t WHERE t.player_id=p.id)`))[0].n,
        negativeBalances: (await q('SELECT count(*)::int n FROM croupier_game.players WHERE balance < 0'))[0].n,
        duplicateSourceKeys: (await q('SELECT count(*)::int n FROM (SELECT source_key FROM croupier_game.transactions WHERE source_key IS NOT NULL GROUP BY source_key HAVING count(*)>1) d'))[0].n,
        ledgerSha256: (await q(`SELECT count(*)::int n, encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb)::text,'UTF8')),'hex') AS sha FROM croupier_game.transactions t`))[0],
      };
    } finally { await client.query('ROLLBACK').catch(() => {}); await client.end(); }
  }
  ev(cDb, 'Neon SELECT (BEGIN READ ONLY) croupier_staging_app', neon);
  ev(cDb, 'förväntat config-huvud och paketrevision (källa per fält)', expected);
  decide(cDb, evaluateDatabase(neon, expected, STAGING.neon.role),
    'ledgerMismatch förutsätter att öppningsbeloppet är en "open"-rad (som i K07-kvittot); avvikelse utreds, ändras inte.');

  // ---------- 8. restore + authenticated replay (O02-PLAN.md §3, docs/plans/O02-RESTORE-REPLAY.md) ----------
  const cRestore = crit('B1', 'status.json[O02]; MASTERPLAN O03 (restore med migrerat schema)', 'Färsk dump → restore → motor mot restore → autentiserad HTTP-replay → ledgerhashar lika');
  const rr = records.restoreReplay.json;
  ev(cRestore, 'docs/2026-10-27-ISOLATED-ACCEPTANCE.json#j10 (äldre 10-25-dump, 16/16)', get(docs.isolated.json, 'j10'));
  ev(cRestore, 'expected o02/restore-replay/receipt.json', rr ? { dumpSha256: rr.dump?.sha256, sourceParity: rr.parity?.equal, replay: rr.replay?.summary, ledger: rr.ledger, sourceUntouched: rr.sourceUntouched, candidate: rr.candidate } : null);
  decide(cRestore, rr ? rr.candidate === candidate && rr.parity?.equal === true && rr.replay?.storedResponsesIdentical === true && rr.replay?.newLedgerRowsForReplays === 0
    && rr.ledger?.httpEqualsSql === true && rr.sourceUntouched?.equal === true : null);

  // ---------- 9. media, shared table, CI regression ----------
  const cMedia = crit('M1', 'K04/K05 (exakt godkänd media)', 'Exakt godkänd media: tio repliker godkända, alla utlösta i spel, giv/hål/reveal visuellt godkända');
  const speak = get(j08, 'k04.speakEvidence') ?? {};
  const allLines = ['placebets', 'goodluck', 'insurance', 'blackjack', 'dealerblackjack', 'double', 'dealerbust', 'win', 'push', 'lose'];
  // Every {line} object anywhere in a receipt (the K04 staging receipt nests them per check).
  const linesIn = json => { const found = []; JSON.stringify(json ?? null, (_, v) => { if (v && typeof v === 'object' && allLines.includes(v.line)) found.push(v.line); return v; }); return found; };
  const seenLines = new Set([...(speak.beforeProcessReplacement?.speak ?? []), ...(speak.afterProcessReplacement?.speak ?? [])].map(s => s.line)
    .concat(linesIn(docs.k04Staging.json), linesIn(docs.k04.json)));
  ev(cMedia, 'J08 json#k04.speakEvidence + K04-STAGING 2026-10-27 + senaste K04-omprovet', { triggered: [...seenLines], missing: allLines.filter(l => !seenLines.has(l)) });
  ev(cMedia, 'docs/2026-10-28-K04-BROWSER-RERUN-2-ACCEPTANCE.json#visualApproval', 'Jakob godkände 35 giv/hål/reveal-klipp 2026-10-28 01:55Z (registret kan inte lagra statusen)');
  decide(cMedia, allLines.every(l => seenLines.has(l)) ? null : false, 'Även med alla repliker utlösta krävs Jakobs manifest (V1–V2) för pass; K04-stagingkvittot är taget på e7a4e251, inte på kandidaten.');

  const cShared = crit('S1', 'K07 (delat bord)', 'Delat bord: g1 platsfrigivning, g2 dueTicks, flera spelare vid samma bord (flagga på i staging)');
  const shared = evaluateSharedChecks(k07Checks);
  ev(cShared, `${docs.k07.path}#checks`, k07Checks);
  ev(cShared, `krävda id:n ${SHARED_CHECK_IDS.join(', ')}`, shared);
  decide(cShared, k07Checks.length ? shared.ok && onCandidate('k07') : null, 'Pass kräver K07-g1, K07-g2 och K07-g2a, alla kontroller pass och att K07-kvittot är runtime-ekvivalent med kandidaten (F8).');

  const cCi = crit('Q1', 'croupier.yml (push → scope full + migration readiness)', 'Full CI (scope full + migration readiness) på exakt kandidat');
  ev(cCi, 'gh actions run', freeze.ciRun);
  decide(cCi, flag('github') ? freeze.ciRun?.conclusion === 'success' : null);

  // ---------- 10. human acceptance (recorded, never inferred) ----------
  const eyes = records.jakobEyes.json;
  for (const [id, text] of [
    ['V1', 'Kortkontakt i giv/hål/reveal vid bordet (PAOW)'], ['V2', 'Tal/läppsynk för alla tio repliker'],
    ['V3', 'Mobil 320/390 px + desktop + fysisk telefon'], ['V4', 'Trelagerslayout och rummets fält via roomOverrides (dealerval, idle, marker, utseende)'],
    ['V5', 'Två följande spel i samma rum utan glapp; idle mellan händer'], ['V6', 'Aktiv hand behåller material vid publicering (delat bord)'],
    ['V7', 'Avbruten presentation: inget dubbeldrag, handen fortsätter'],
  ]) {
    const c = crit(id, 'O02-PLAN.md §4', text); c.status = 'manual';
    const v = eyes?.items?.find?.(x => x.id === id);
    if (v) { ev(c, 'o02/jakob-eyes/manifest.json', { verdict: v.verdict, by: v.by, at: v.at, candidate: v.candidate, screenshots: v.screenshots }); c.status = v.verdict === 'approved' && v.candidate === candidate && v.by === 'Jakob' ? 'pass' : 'fail'; }
  }

  // ---------- 11. reviewer independence ----------
  const cInd = crit('I1', MP.reviewer, 'Granskaren är oberoende; tidigare agentkvitton tillskrivs sina författare');
  ev(cInd, 'argv --reviewer', { reviewerId: reviewerId ?? null, producedReceiptsBy: ['Claude-orkestratorn och dess underagenter (J08, K04-omproven, K06/K07-omproven, K05)', 'Codex/Cloud (J10, isolated)'] });
  decide(cInd, reviewerId && !/root|orkestrator/i.test(reviewerId) ? true : null, 'Ange --reviewer med granskarens agent-ID; orkestratorn räknas inte.');

  // ---------- receipt ----------
  const counts = criteria.reduce((m, c) => (m[c.status] = (m[c.status] ?? 0) + 1, m), {});
  const receipt = {
    kind: 'o02-independent-review/v2', generatedAt: at(), candidate, mainHead: freeze.mainHead,
    receiptsRef: { ref: receiptsRef.ref, sha: receiptsRef.sha, candidateIsAncestor: receiptsRef.candidateIsAncestor, runtimeDiff: receiptsRef.runtimeDiff, ok: receiptsRef.ok },
    environment: { origin: STAGING.origin, backend: STAGING.backend, renderService: STAGING.renderService, neon: STAGING.neon,
      publishedConfig: expected.publishedConfig, packageRevision: expected.packageRevision, expectationSource: expected.source },
    inputs: Object.fromEntries(Object.entries({ ...docs, ...records }).map(([k, v]) => [k, { path: v.path, present: v.present, sha256: v.sha256 ?? null }])),
    criteria, summary: { ...counts, blocking: criteria.filter(c => c.status !== 'pass').map(c => c.id) },
    verdict: criteria.every(c => c.status === 'pass') ? 'O02-pass' : 'O02-not-yet',
    requests: log, mutations: { http: 0, sql: 0, ddl: 0, production: 0 }, secretsExported: false,
    receiptSha256: null,
  };
  receipt.receiptSha256 = sha256(canonical({ ...receipt, receiptSha256: null }));
  writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`${receipt.verdict} candidate=${candidate.slice(0, 8)} ` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ') + ` -> ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
