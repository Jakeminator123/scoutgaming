#!/usr/bin/env node
// O02 receipt builder — READ-ONLY skeleton (Scoutgaming migration, activity O02).
//
// Produces o02-receipt.json from (1) the frozen candidate SHA, (2) existing receipts,
// (3) read-only HTTP GETs against isolated staging and (4) read-only Neon SELECTs.
// It never logs in, never POSTs, never writes SQL and never touches production.
// Human acceptance (AV, lip sync, card contact, mobile, layout) is only *recorded*
// from Jakob's signed manifest; the script never infers it.
//
// Usage (PowerShell or bash), from the repository root:
//   node tools/o02-receipt.mjs --candidate <40-hex main SHA> --inputs <folder with raw receipts> \
//     [--repo <checkout, default: this repository>] [--out o02-receipt.json] [--github]
//     [--neon --neon-url-file <file holding the croupier_staging_app connection string>] [--reviewer <agent-id>]
// The inputs folder holds the raw receipts named in docs/plans/O02-PLAN.md §4 (j08/, k04-k07/, k05/, k06/,
// k07-shared/, o02/); they are not in Git. The connection string file is read, never printed.
// Without --neon-url-file the Neon criterion stays "missing". --github uses the already-authenticated
// `gh` CLI (read-only API calls only). See docs/plans/O02-PLAN.md.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- fixed isolated targets (production is refused) ----------
const STAGING = Object.freeze({
  origin: 'https://croupier-k06-k07-staging.vercel.app',
  backend: 'https://croupier-k06-k07-staging.onrender.com',
  renderService: 'srv-dbf61l0m7kps73ft7mk0',
  neon: { project: 'red-violet-36066351', branch: 'br-plain-voice-b9yu49xi', database: 'croupier_staging', role: 'croupier_staging_app' },
  operatorA: 'qa-k06k07-9dd2d3a4-a', operatorB: 'qa-k06k07-9dd2d3a4-b',
  room: 'room-33b37ff3-ec79-ff2d-5567-b14a9d3efe5e', neighborRoom: 'room-cb4c4696-f671-c546-eb15-6fb67d09feea',
  publishedConfig: 'room-config-38b14261-cf20-4e31-bc09-042ee40f1d28', packageRevision: 7,
});
const ALLOWED_HOSTS = new Set([new URL(STAGING.origin).host, new URL(STAGING.backend).host]);
const REPO = 'Jakeminator123/scoutgaming';
// Paths whose change alters what Vercel or Render croupier-v3 runs (frozen-candidate rule).
const RUNTIME_PREFIXES = ['services/game/', 'ops/cloud/', 'ops/neon-game/', 'ops/neon-studio/', 'packages/', 'apps/studio/', 'apps/web/', 'apps/speech/', 'services/astrid-gpu-worker/gateway/'];

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
function readRepoAtCandidate(rel) {
  try { const text = git('show', `${candidate}:${rel}`); return { path: `${rel}@${candidate.slice(0, 8)}`, present: true, sha256: sha256(text), json: JSON.parse(text) }; }
  catch { return { path: rel, present: false }; }
}
const get = (obj, path) => path.split('.').reduce((v, k) => v == null ? undefined : v[k], obj);

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
const docs = {
  j08: readRepoAtCandidate('docs/2026-10-27-J08-STAGING-ACCEPTANCE.json'),
  isolated: readRepoAtCandidate('docs/2026-10-27-ISOLATED-ACCEPTANCE.json'),
  status: readRepoAtCandidate('migrering/status.json'),
};
const receipts = {
  j08Final: readInput('j08/receipt-final.json'),
  k04k07: readInput('k04-k07/receipt.json'),
  k05Prod: readInput('k05/bind-paow-takes.receipt.json'),
  k05Staging: readInput('k05-staging/receipt.json'),
  // Expected new receipts (names are the contract for the producing agents):
  k06ActiveHand: readInput('k06/receipt.json'),            // C0/P0/M0 kept, C1/P1/M1 next window
  k07Shared: readInput('k07-shared/receipt.json'),         // g1/g2 with CROUPIER_SHARED_TABLE_ENABLED=1, ≥2 players same table
  restoreReplay: readInput('o02/restore-replay/receipt.json'), // fresh dump → restore → authenticated replay
  jakobEyes: readInput('o02/jakob-eyes/manifest.json'),    // Jakob's verdicts + screenshot hashes
  frozen: readInput('o02/frozen-candidate.json'),          // freeze record (see O02-PLAN.md §2)
};

// ---------- 2. frozen candidate ----------
const cFreeze = crit('F1', 'MASTERPLAN.md:515,138; status.json:644', 'Fryst integrerad kandidat: main-SHA, full CI grön, containerkontroll, inga öppna runtime-PR:er');
const freeze = { candidate, onMain: null, ciRun: null, containerRun: null, openRuntimePrs: null, mainHead: null };
try { git('merge-base', '--is-ancestor', candidate, 'origin/main'); freeze.onMain = true; } catch { freeze.onMain = false; }
try { freeze.mainHead = git('rev-parse', 'origin/main'); } catch { /* offline */ }
if (flag('github')) {
  const runs = gh('api', `repos/${REPO}/actions/runs?head_sha=${candidate}&per_page=50`).workflow_runs ?? [];
  const ci = runs.find(r => r.name === 'Croupier GitHub checks' && ['push', 'workflow_dispatch'].includes(r.event));
  const box = runs.find(r => r.name === 'Render v3 container check');
  freeze.ciRun = ci ? { id: ci.id, event: ci.event, conclusion: ci.conclusion, url: ci.html_url } : null;
  freeze.containerRun = box ? { id: box.id, event: box.event, conclusion: box.conclusion, url: box.html_url } : null;
  const prs = gh('pr', 'list', '-R', REPO, '--state', 'open', '--limit', '100', '--json', 'number,isDraft,author,headRefOid,files');
  freeze.openRuntimePrs = prs.map(p => ({ number: p.number, draft: p.isDraft, author: p.author?.login, head: p.headRefOid,
    runtimeFiles: (p.files ?? []).map(f => f.path).filter(f => RUNTIME_PREFIXES.some(x => f.startsWith(x))) })).filter(p => p.runtimeFiles.length);
}
ev(cFreeze, 'git+gh', freeze);
decide(cFreeze, !flag('github') ? null : freeze.onMain && freeze.ciRun?.conclusion === 'success' && freeze.containerRun?.conclusion === 'success'
  && freeze.openRuntimePrs.every(p => p.draft), 'Draft-PR:er räknas inte som öppna runtimeändringar men listas; containerkörningen kräver workflow_dispatch om sökvägsfiltret inte träffade.');

// ---------- 3. live staging versions (read-only) ----------
const cEnv = crit('E1', 'MASTERPLAN.md:138,515; RENDER-V3.md:119-129', 'Webb, motor, schema och media verifieras separat; driftsversion = kandidat eller runtime-ekvivalent');
const health = await httpGet(STAGING.backend + '/__cloud/health', { expect: 200, name: 'render health' });
const version = await httpGet(STAGING.backend + '/__cloud/version', { expect: 200, name: 'render version' });
const deployed = version.json?.commitSha ?? null;
let runtimeDiff = null;
if (deployed && /^[a-f0-9]{40}$/.test(deployed)) {
  try { runtimeDiff = git('diff', '--name-only', deployed, candidate, '--', ...RUNTIME_PREFIXES).split('\n').filter(Boolean); } catch { runtimeDiff = ['<diff unavailable>']; }
}
const vercelSha = receipts.frozen.json?.vercel?.sha ?? null; // Vercel SHA is read from the Vercel API by the operator and recorded in frozen-candidate.json
ev(cEnv, 'GET /__cloud/health,/__cloud/version', { health: health.status, deployed, runtimeDiffFromCandidate: runtimeDiff, vercelSha });
decide(cEnv, vercelSha === null ? null : health.status === 200 && deployed !== null && runtimeDiff?.length === 0 && vercelSha === candidate,
  'Vercel-SHA måste registreras i frozen-candidate.json från Vercel-API:t; HTTP visar den inte.');

// ---------- 4. anonymous negative + retired surfaces (read-only GET) ----------
const cNeg = crit('N1', 'MASTERPLAN.md:517,114', 'Negativa fall: anonym, fel operatör/rum, inaktuellt paket, dubbelkommando, samtidighet, avbruten presentation, fel media-ID');
const anon = await Promise.all([
  httpGet(STAGING.origin + '/studio/api/admin/transactions', { expect: 401, name: 'anon admin transactions' }),
  httpGet(STAGING.origin + '/studio/api/admin/room-game-config?' + new URLSearchParams({ operatorId: STAGING.operatorA, roomId: STAGING.room }), { expect: 401, name: 'anon admin config' }),
  httpGet(STAGING.origin + '/api/table', { expect: [401, 405], name: 'anon table' }),
]);
const k07 = receipts.k04k07.json; const j08 = docs.j08.json;
const negIds = ['K04-d1', 'K04-d2', 'K04-d3', 'K04-d4', 'K04-d5', 'K07-e0', 'K07-e1r', 'K07-h2', 'K07-h3', 'K07-h4', 'K07-j1', 'K07-j2', 'K07-j3'];
const negFromReceipt = negIds.map(id => ({ id, result: (k07?.checks ?? []).find(c => c.id === id)?.result ?? null }));
ev(cNeg, 'live anon GET', anon.map(a => a.entry));
ev(cNeg, 'inputs/k04-k07/receipt.json#checks', negFromReceipt);
ev(cNeg, 'docs/2026-10-27-J08-STAGING-ACCEPTANCE.json#j08.negative.checks', (get(j08, 'j08.negative.checks') ?? []).map(c => [c.name, c.pass]));
const wrongRole = receipts.k06ActiveHand.json?.checks?.find?.(c => c.id === 'wrong-role')?.result ?? null; // MISSING today (operatorBScope note)
const badMediaId = receipts.k06ActiveHand.json?.checks?.find?.(c => c.id === 'bad-media-id')?.result ?? null;
const interrupted = receipts.k06ActiveHand.json?.checks?.find?.(c => c.id === 'interrupted-presentation')?.result ?? null;
ev(cNeg, 'expected in k06/receipt.json', { wrongRole, badMediaId, interrupted });
decide(cNeg, anon.every(a => a.entry.pass) && negFromReceipt.every(n => n.result === 'pass') && [wrongRole, badMediaId, interrupted].every(x => x === 'pass') ? true
  : [wrongRole, badMediaId, interrupted].some(x => x === null) ? null : false);

const cRetired = crit('R1', 'MASTERPLAN.md:518,11; AGENTS.md:63', 'Borttagna ytor kan inte starta alternativ produkt; ingen SQLite i produktvägen');
const retired = await Promise.all([
  httpGet(STAGING.origin + '/control', { expect: [307, 308, 404], name: '/control' }),
  httpGet(STAGING.origin + '/lab', { expect: [307, 308, 404], name: '/lab' }),
  httpGet(STAGING.origin + '/bo', { expect: 404, name: '/bo' }),
  httpGet(STAGING.backend + '/studio', { expect: 307, name: 'render /studio redirect' }),
]);
const redirectsToAdminOnly = retired.slice(0, 2).every(r => r.status === 404 || /\/admin(\b|\/|$)/.test(r.entry.location ?? ''));
let allowlist = null; try { allowlist = JSON.parse(git('show', `${candidate}:tools/no-sqlite-allowlist.json`)); } catch { /* absent */ }
const sqliteRuntime = (allowlist ?? []).filter(e => RUNTIME_PREFIXES.some(p => e.path.startsWith(p)) || e.path.startsWith('services/openclaw/'));
ev(cRetired, 'live GET', retired.map(r => r.entry));
ev(cRetired, `tools/no-sqlite-allowlist.json@${candidate.slice(0, 8)}`, { total: allowlist?.length ?? null, runtimeOrOpenClaw: sqliteRuntime.map(e => `${e.path} (${e.removeBy})`) });
decide(cRetired, retired.every(r => r.entry.pass) && redirectsToAdminOnly ? (sqliteRuntime.length === 0 ? true : null) : false,
  sqliteRuntime.length ? 'Kvarvarande allowlist (PR-7b/7c) är ett känt gap mot "SQLite lämnar main helt"; O02 redovisar, O03 stänger.' : undefined);

// ---------- 5. Admin chain + lobby (read-only) ----------
const cChain = crit('C1', 'MASTERPLAN.md:516,114,138', 'Admin spara → publicera → lobby → auktoriserad launch → spel → återanslutning → omstart → återläsning (två följande spel)');
const lobbyA = await httpGet(STAGING.origin + `/api/operators/${STAGING.operatorA}/rooms`, { expect: 200, name: 'lobby A' });
const lobbyB = await httpGet(STAGING.origin + `/api/operators/${STAGING.operatorB}/rooms`, { expect: 200, name: 'lobby B' });
// Lobby shape (verified 2026-10-27): {schemaVersion, operator, packageRevision, rooms:[{id,...}]}
const roomsOf = j => (j?.rooms ?? []).map(r => ({ id: r.id, packageRevision: j.packageRevision ?? null }));
const inA = roomsOf(lobbyA.json).find(r => r.id === STAGING.room) ?? null; const inB = roomsOf(lobbyB.json).some(r => r.id === STAGING.room);
ev(cChain, 'live lobby GET', { inA, inB });
ev(cChain, 'docs/2026-10-27-J08-STAGING-ACCEPTANCE.json#j08.positive', get(j08, 'j08.positive.published'));
ev(cChain, 'docs/2026-10-27-J08-STAGING-ACCEPTANCE.json#j08.afterProcessReplacement', get(j08, 'j08.afterProcessReplacement.checks'));
const twoGames = receipts.k06ActiveHand.json?.twoConsecutiveGames ?? null; // must be on the frozen candidate
ev(cChain, 'expected k06/receipt.json#twoConsecutiveGames', twoGames);
decide(cChain, inA?.packageRevision === STAGING.packageRevision && !inB && twoGames?.pass === true && twoGames?.candidate === candidate ? true : twoGames ? false : null);

// ---------- 6. Neon read-only ----------
const cDb = crit('D1', 'MASTERPLAN.md:114 (exakt en ekonomisk effekt), 515 (schema)', 'Schema/ledger: migreringar, publicerad config-huvud, ledger = saldo per spelare, inga dubbla idempotensnycklar');
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
decide(cDb, neon ? neon.who.role === STAGING.neon.role && neon.sharedTables === 15 && neon.ledgerMismatch === 0 && neon.negativeBalances === 0 && neon.duplicateSourceKeys === 0
  && neon.configHead !== null : null, 'ledgerMismatch förutsätter att öppningsbeloppet är en "open"-rad (som i K07-kvittot); avvikelse utreds, ändras inte.');

// ---------- 7. restore + authenticated replay (designed in O02-PLAN.md §3.3) ----------
const cRestore = crit('B1', 'status.json:644; MASTERPLAN.md:114 (fungerande kompatibel restore)', 'Färsk dump → restore → motor mot restore → autentiserad HTTP-replay → ledgerhashar lika');
const rr = receipts.restoreReplay.json;
ev(cRestore, 'docs/2026-10-27-ISOLATED-ACCEPTANCE.json#j10 (äldre 10-25-dump, 16/16)', get(docs.isolated.json, 'j10'));
ev(cRestore, 'expected o02/restore-replay/receipt.json', rr ? { dumpSha256: rr.dump?.sha256, sourceParity: rr.parity?.equal, replay: rr.replay?.summary, ledger: rr.ledger, sourceUntouched: rr.sourceUntouched, candidate: rr.candidate } : null);
decide(cRestore, rr ? rr.candidate === candidate && rr.parity?.equal === true && rr.replay?.storedResponsesIdentical === true && rr.replay?.newLedgerRowsForReplays === 0
  && rr.ledger?.httpEqualsSql === true && rr.sourceUntouched?.equal === true : null);

// ---------- 8. media, shared table, CI regression ----------
const cMedia = crit('M1', 'MASTERPLAN.md:114,126; status.json:421,504', 'Exakt godkänd media: tio repliker godkända, alla utlösta i spel, giv/hål/reveal visuellt godkända');
const speak = get(j08, 'k04.speakEvidence') ?? {};
const seenLines = new Set([...(speak.beforeProcessReplacement?.speak ?? []), ...(speak.afterProcessReplacement?.speak ?? []), ...(receipts.k06ActiveHand.json?.speak ?? [])].map(s => s.line));
const allLines = ['placebets', 'goodluck', 'insurance', 'blackjack', 'dealerblackjack', 'double', 'dealerbust', 'win', 'push', 'lose'];
ev(cMedia, 'J08 json#k04.speakEvidence (+k06 receipt)', { triggered: [...seenLines], missing: allLines.filter(l => !seenLines.has(l)) });
decide(cMedia, allLines.every(l => seenLines.has(l)) ? null : false, 'Även med alla repliker utlösta krävs Jakobs manifest (V1–V4) för pass.');

const cShared = crit('S1', 'status.json:589; MASTERPLAN.md:106,108', 'Delat bord: g1 platsfrigivning, g2 dueTicks, flera spelare vid samma bord (flagga på i staging)');
ev(cShared, 'expected k07-shared/receipt.json', receipts.k07Shared.json?.checks ?? null);
decide(cShared, receipts.k07Shared.json ? (receipts.k07Shared.json.checks ?? []).every(c => c.result === 'pass') && receipts.k07Shared.json.candidate === candidate : null);

const cCi = crit('Q1', 'MASTERPLAN.md:114 (obligatorisk regression); croupier.yml:259-293', 'Full CI (scope full + migration readiness) på exakt kandidat');
ev(cCi, 'gh actions run', freeze.ciRun);
decide(cCi, flag('github') ? freeze.ciRun?.conclusion === 'success' : null);

// ---------- 9. human acceptance (recorded, never inferred) ----------
const eyes = receipts.jakobEyes.json;
for (const [id, text] of [
  ['V1', 'Kortkontakt i giv/hål/reveal (PAOW, Johns Bet-layout)'], ['V2', 'Tal/läppsynk för alla tio repliker'],
  ['V3', 'Mobil 320/390 px + desktop + fysisk Safari (iOS)'], ['V4', 'Trelagerslayout bakgrund/dealer/bord och fält 5 bord/bakgrund/färg'],
  ['V5', 'Två följande spel i samma rum utan glapp; idle/återgång till talpose'], ['V6', 'Aktiv hand behåller material vid publicering (visuellt)'],
]) {
  const c = crit(id, 'MASTERPLAN.md:93,107,108,114', text); c.status = 'manual';
  const v = eyes?.items?.find?.(x => x.id === id);
  if (v) { ev(c, 'o02/jakob-eyes/manifest.json', { verdict: v.verdict, by: v.by, at: v.at, candidate: v.candidate, screenshots: v.screenshots }); c.status = v.verdict === 'approved' && v.candidate === candidate && v.by === 'Jakob' ? 'pass' : 'fail'; }
}

// ---------- 10. reviewer independence ----------
const cInd = crit('I1', 'MASTERPLAN.md:519,280', 'Granskaren är oberoende; tidigare agentkvitton tillskrivs sina författare');
ev(cInd, 'argv --reviewer', { reviewerId: reviewerId ?? null, producedReceiptsBy: ['root/Claude-orkestratorn (j08, k04-k07, k05)', 'Codex/Cloud (j10, isolated)'] });
decide(cInd, reviewerId && !/root|orkestrator/i.test(reviewerId) ? true : null, 'Ange --reviewer med granskarens agent-ID; root räknas inte.');

// ---------- receipt ----------
const counts = criteria.reduce((m, c) => (m[c.status] = (m[c.status] ?? 0) + 1, m), {});
const receipt = {
  kind: 'o02-independent-review/v1', generatedAt: at(), candidate, mainHead: freeze.mainHead,
  environment: { origin: STAGING.origin, backend: STAGING.backend, renderService: STAGING.renderService, neon: STAGING.neon },
  inputs: Object.fromEntries(Object.entries({ ...docs, ...receipts }).map(([k, v]) => [k, { path: v.path, present: v.present, sha256: v.sha256 ?? null }])),
  criteria, summary: { ...counts, blocking: criteria.filter(c => c.status !== 'pass').map(c => c.id) },
  verdict: criteria.every(c => c.status === 'pass') ? 'O02-pass' : 'O02-not-yet',
  requests: log, mutations: { http: 0, sql: 0, ddl: 0, production: 0 }, secretsExported: false,
  receiptSha256: null,
};
receipt.receiptSha256 = sha256(canonical({ ...receipt, receiptSha256: null }));
writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n');
console.log(`${receipt.verdict} candidate=${candidate.slice(0, 8)} ` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ') + ` -> ${out}`);
