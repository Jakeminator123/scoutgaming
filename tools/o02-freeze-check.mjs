#!/usr/bin/env node
// O02 freeze check — READ-ONLY (Scoutgaming migration, activity O02, docs/plans/O02-PLAN.md §1).
//
// For one main SHA it checks the automatic freeze rules and writes the skeleton of
// frozen-candidate.json, which the operator completes by hand:
//   F1  the SHA is an ancestor of (or equal to) origin/main          git merge-base --is-ancestor
//   F2  push CI "Croupier GitHub checks" is green on exactly the SHA  gh api actions/runs?head_sha=
//   F5  no open non-draft PR touches a runtime prefix                 gh pr list --json files
// Prefilled for convenience, still checked by a person: F3 (container run on the SHA, if one
// exists) and F8 (runtime diff between the SHA behind each K04/K06/K07 receipt in Git and the
// candidate). F4, F6 and F7 are left null with instructions; see O02-PLAN.md §1.3.
// It never fetches, pushes, deploys, logs in or writes anything except the output file.
//
// Usage, from the repository root after `git fetch origin`:
//   node tools/o02-freeze-check.mjs --candidate <40-hex SHA> [--out frozen-candidate.json] [--offline]
// --offline skips the gh calls (F2, F3 and F5 stay null). Exit code 0 when F1, F2 and F5 pass,
// 1 when one of them fails or is unknown, 2 on usage errors.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = 'Jakeminator123/scoutgaming';
// Paths whose change alters what Vercel or Render runs (frozen-candidate rule F5/F8).
export const RUNTIME_PREFIXES = Object.freeze(['services/game/', 'ops/cloud/', 'ops/neon-game/', 'ops/neon-studio/', 'packages/',
  'apps/studio/', 'apps/web/', 'apps/speech/', 'services/openclaw/lab/', 'services/astrid-gpu-worker/gateway/']);
export const CI_WORKFLOW = 'Croupier GitHub checks';
export const CONTAINER_WORKFLOW = 'Render v3 container check';

// Receipt contracts in Git (sanitised). The newest file per family is the one O02 reads;
// a rerun on the frozen candidate adds a new dated file with the next number.
//   K04: docs/<date>-K04-BROWSER-RERUN-<n>-ACCEPTANCE.json  (RERUN-3 today, RERUN-4 next)
//   K06: docs/<date>-K06-STAGING-RERUN[-<n>]-ACCEPTANCE.json
//   K07: docs/<date>-K07-STAGING-RERUN[-<n>]-ACCEPTANCE.json
export const RECEIPT_FAMILIES = Object.freeze({
  k04: /^docs\/(\d{4}-\d{2}-\d{2})-K04-BROWSER-RERUN(?:-(\d+))?-ACCEPTANCE\.json$/,
  k06: /^docs\/(\d{4}-\d{2}-\d{2})-K06-STAGING-RERUN(?:-(\d+))?-ACCEPTANCE\.json$/,
  k07: /^docs\/(\d{4}-\d{2}-\d{2})-K07-STAGING-RERUN(?:-(\d+))?-ACCEPTANCE\.json$/,
});

// Newest receipt per family: highest rerun number, then latest date ("RERUN" without a number is 1).
export function latestReceipts(paths) {
  const result = {};
  for (const [family, pattern] of Object.entries(RECEIPT_FAMILIES)) {
    const ranked = paths.map(path => { const m = pattern.exec(path); return m && { path, date: m[1], n: Number(m[2] ?? 1) }; })
      .filter(Boolean).sort((a, b) => b.n - a.n || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    result[family] = ranked[0]?.path ?? null;
  }
  return result;
}

// The code SHA a receipt was taken on. Receipts name it differently by family.
export function receiptSha(json) {
  const value = json?.candidate ?? json?.codeShas?.allSteps ?? json?.codeSha ?? null;
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) ? value : null;
}

export const touchesRuntime = path => RUNTIME_PREFIXES.some(prefix => path.startsWith(prefix));

// gh pr list rows -> open PRs that change runtime files; drafts are listed but do not block.
export function openRuntimePrs(prs) {
  return prs.map(p => ({ number: p.number, draft: Boolean(p.isDraft), author: p.author?.login ?? null, head: p.headRefOid ?? null,
    runtimeFiles: (p.files ?? []).map(f => f.path).filter(touchesRuntime) })).filter(p => p.runtimeFiles.length);
}

// Push (or dispatched) CI run of the main workflow on exactly this SHA; the newest wins.
export function pickRun(runs, name, events = ['push', 'workflow_dispatch']) {
  const run = runs.filter(r => r.name === name && events.includes(r.event)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  return run ? { id: run.id, event: run.event, status: run.status, conclusion: run.conclusion, headSha: run.head_sha, url: run.html_url } : null;
}

export function evaluateFreeze({ onMain, ci, prs }) {
  const F1 = onMain === null ? null : onMain === true;
  const F2 = ci === undefined ? null : ci?.status === 'completed' && ci?.conclusion === 'success';
  const F5 = prs === undefined ? null : prs.every(p => p.draft);
  return { F1, F2, F5, pass: F1 === true && F2 === true && F5 === true };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = name => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
  const candidate = arg('candidate');
  if (!/^[a-f0-9]{40}$/.test(candidate ?? '')) { console.error('Usage: node tools/o02-freeze-check.mjs --candidate <40-hex SHA> [--out file] [--offline]'); process.exitCode = 2; return; }
  const offline = argv.includes('--offline');
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const out = resolve(arg('out') ?? 'frozen-candidate.json');
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
  const gh = (...a) => JSON.parse(execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 << 20 }));

  let onMain = null; let mainHead = null;
  try { mainHead = git('rev-parse', 'origin/main'); } catch { /* no remote ref */ }
  try { git('merge-base', '--is-ancestor', candidate, 'origin/main'); onMain = true; } catch (e) { onMain = mainHead ? false : null; }

  let ci, container, prs;
  if (!offline) {
    const runs = gh('api', `repos/${REPO}/actions/runs?head_sha=${candidate}&per_page=100`).workflow_runs ?? [];
    ci = pickRun(runs, CI_WORKFLOW);
    container = pickRun(runs, CONTAINER_WORKFLOW, ['workflow_dispatch', 'push', 'pull_request']);
    prs = openRuntimePrs(gh('pr', 'list', '-R', REPO, '--state', 'open', '--limit', '100', '--json', 'number,isDraft,author,headRefOid,files'));
  }

  // F8: runtime diff between each receipt's code SHA and the candidate (empty = runtime-equivalent).
  const receipts = latestReceipts(git('ls-tree', '-r', '--name-only', candidate, 'docs/').split('\n'));
  const f8 = Object.fromEntries(Object.entries(receipts).map(([family, path]) => {
    if (!path) return [family, { path: null, sha: null, runtimeDiff: null, equivalent: false }];
    let sha = null; try { sha = receiptSha(JSON.parse(git('show', `${candidate}:${path}`))); } catch { /* unreadable */ }
    let diff = null; if (sha) try { diff = git('diff', '--name-only', sha, candidate, '--', ...RUNTIME_PREFIXES).split('\n').filter(Boolean); } catch { /* unknown SHA */ }
    return [family, { path, sha, runtimeDiffCount: diff?.length ?? null, runtimeDiffSample: diff?.slice(0, 10) ?? null, equivalent: diff?.length === 0 }];
  }));

  const verdict = evaluateFreeze({ onMain, ci: offline ? undefined : ci, prs: offline ? undefined : prs });
  const record = {
    kind: 'o02-frozen-candidate/v1', candidate, mainHead, checkedAt: new Date().toISOString(), frozenAt: null, frozenBy: null,
    automatic: { F1: { pass: verdict.F1, onMain }, F2: { pass: verdict.F2, ci: ci ?? null }, F5: { pass: verdict.F5, openRuntimePrs: prs ?? null } },
    prefilled: { F3: { container: container ?? null, note: 'Kör `gh workflow run product-container-check.yml --ref main` om ingen körning finns på exakt kandidaten.' },
      F8: { receipts: f8, note: 'equivalent=false betyder att kvittot måste tas om på kandidaten (RERUN-4 för K04, ny RERUN för K06/K07).' } },
    manual: {
      F4: { gitguardian: null, how: 'node tools/security-status.mjs; skriv status och antal öppna incidenter, aldrig utdrag.' },
      F6: { vercel: { project: 'prj_7dgyvW5zakx1qJ8YaH5pueVTVi14', deployment: null, sha: null }, render: { service: 'srv-dbf61l0m7kps73ft7mk0', deploy: null, sha: null },
        how: 'Deploy med låst SHA enligt docs/plans/O02-RESTORE-REPLAY.md steg D1–D3; läs dpl_/dep- och SHA ur REST-svaren och /__cloud/version.' },
      F7: { schema: { studio: null, game: null, sharedTables: null }, how: 'node tools/o02-snapshot.mjs mot croupier_staging (S0) eller docs/plans/O02-RESTORE-REPLAY.md steg R2; registrera storage_migrations-versioner och antal shared_*-tabeller.' },
    },
    verdict: verdict.pass ? 'freeze-automatic-pass' : 'freeze-not-ready',
    mutations: { http: 0, git: 0, cloud: 0 },
  };
  writeFileSync(out, JSON.stringify(record, null, 2) + '\n');
  const show = v => v === null ? 'unknown' : v ? 'pass' : 'FAIL';
  console.log(`${record.verdict} candidate=${candidate.slice(0, 8)} F1=${show(verdict.F1)} F2=${show(verdict.F2)} F5=${show(verdict.F5)} ` +
    `F8=${Object.entries(f8).map(([k, v]) => `${k}:${v.equivalent ? 'eq' : v.runtimeDiffCount ?? '?'}`).join(',')} -> ${out}`);
  if (prs?.some(p => !p.draft)) for (const p of prs.filter(x => !x.draft)) console.log(`  open runtime PR #${p.number} (${p.author}) ${p.runtimeFiles.length} runtime files`);
  if (!verdict.pass) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
