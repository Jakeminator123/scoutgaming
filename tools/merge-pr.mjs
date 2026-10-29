#!/usr/bin/env node
// Merge guard for the orchestrating session: the AGENTS.md "Leverans och merge" rules as code.
//
//   node tools/merge-pr.mjs <nr> --head <40-hex SHA> [--freeze <40-hex SHA>] [--allow-workflow-change] [--dry-run]
//
// It fetches origin/main, reads the owner from inbox/people.json and the branch policy from
// tools/repository-policy.json there (trusted main, never the working copy), reads the pull request
// and its complete file list fresh from GitHub, prints one line per check and merges only when
// every check passes:
//   gh pr merge <nr> --merge --match-head-commit <sha>      (never --admin, never --auto)
// --freeze <SHA> (O02) requires the SHA on origin/main and refuses any file, old or new path,
// under the runtime prefixes of tools/o02-freeze-check.mjs. A PR that changes .github/workflows/
// or .github/actions/ also changes the CI that judges it, so it needs --allow-workflow-change.
// fresh: the ruleset does not require an up-to-date branch, so green CI may have tested the merge
// into an older main. The tested base is the first parent of the merge commit the CI run checked
// out (named in the log of the run's changes job, parents from the commits API). It passes when that
// base is origin/main, or when main's changes since then share no file and no package root
// (PACKAGE_ROOTS) with the PR; otherwise, or when the base cannot be determined, it refuses.
// review: the PR body needs the author's "Buggranskning: <verktyg/modell>, <nivå>, <fynd>" line.
// --dry-run prints the decisions and merges nothing.
// Exit code 0 when merged (or a dry run passes), 1 when refused, 2 on usage errors.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CI_WORKFLOW, REPO, touchesRuntime } from './o02-freeze-check.mjs';
import { featurePatterns, matchesBranchPattern } from './check-push-target.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REQUIRED_CHECK = 'CI';
export const PR_FIELDS = 'number,author,isCrossRepository,headRefName,headRefOid,isDraft,baseRefName,state,mergeable,statusCheckRollup,files,changedFiles,body';
// Other people's branches stay theirs even when the PR was opened from Jakob's account. The policy
// file lists kevin*, codex/kevin-*, john* and emil*; the codex/<name>-* forms for John and Emil are
// not in it yet, so they are fixed here and every person in people.json adds <branch>* and codex/<branch>-*.
export const BASELINE_FOREIGN_BRANCHES = Object.freeze(['kevin*', 'codex/kevin-*', 'john*', 'codex/john-*', 'emil*', 'codex/emil-*']);
const CI_PATHS = ['.github/workflows/', '.github/actions/'];
// The CI job that checks out the PR merge commit; its log names that commit's full SHA.
export const CI_BASE_JOB = 'changes';
// Shared roots where a change on main can break a PR that only touches other files in the same root.
export const PACKAGE_ROOTS = Object.freeze(['services/game/', 'packages/<name>/', 'apps/studio/lib/', 'apps/web/']);
const fullSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function parseArgs(args) {
  const usage = 'Usage: node tools/merge-pr.mjs <nr> --head <40-hex SHA> [--freeze <40-hex SHA>] [--allow-workflow-change] [--dry-run]';
  const options = { number: null, head: null, freeze: null, allowWorkflowChange: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run' && !options.dryRun) options.dryRun = true;
    else if (arg === '--allow-workflow-change' && !options.allowWorkflowChange) options.allowWorkflowChange = true;
    else if ((arg === '--head' || arg === '--freeze') && options[arg.slice(2)] === null && fullSha(args[i + 1])) options[arg.slice(2)] = args[++i];
    else if (/^[1-9][0-9]{0,6}$/.test(arg) && options.number === null) options.number = Number(arg);
    else throw Error(usage);
  }
  if (options.number === null || options.head === null) throw Error(usage);
  return options;
}

// Glob with * as "anything, including /"; case-insensitive like the people it protects.
export function matchesGlob(name, pattern) {
  const source = String(pattern).split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${source}$`, 'i').test(String(name));
}

export function foreignBranchPatterns({ policy, people }) {
  const patterns = new Set(BASELINE_FOREIGN_BRANCHES);
  for (const pattern of policy?.protectedBranches ?? []) if (typeof pattern === 'string' && pattern) patterns.add(pattern);
  for (const [key, person] of Object.entries(people ?? {})) {
    if (key === 'jakob' || typeof person?.branch !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(person.branch) || person.branch === policy?.branch) continue;
    patterns.add(`${person.branch}*`);
    patterns.add(`codex/${person.branch}-*`);
  }
  return [...patterns];
}

// Every rollup entry named CI (CheckRun.name or StatusContext.context) must be the CI job of the
// repository workflow and green. Another workflow's job or a commit status with the same name
// would satisfy GitHub's required check before the real CI has run, so it refuses.
export function requiredCheckState(rollup, name = REQUIRED_CHECK, workflow = CI_WORKFLOW) {
  const entries = (Array.isArray(rollup) ? rollup : []).filter(entry => (entry?.name ?? entry?.context) === name);
  if (!entries.length) return { ok: false, reason: `kontrollen ${name} saknas` };
  const impostor = entries.find(entry => entry.__typename !== 'CheckRun' || entry.workflowName !== workflow);
  if (impostor) return { ok: false, reason: `${name} kommer från ${impostor.workflowName ?? impostor.__typename ?? 'okänd källa'}, inte ${workflow}` };
  const states = entries.map(entry => entry.status === 'COMPLETED' ? String(entry.conclusion ?? '') : String(entry.status ?? ''));
  return states.every(state => state === 'SUCCESS')
    ? { ok: true, reason: `${name} SUCCESS (${workflow})` }
    : { ok: false, reason: `${name} ${[...new Set(states)].join('/') || 'okänd'}` };
}

// REST rows from pulls/<nr>/files: a rename or copy also names its old path, which counts too.
export function changedPaths(files) {
  if (!Array.isArray(files)) return null;
  const paths = [];
  for (const file of files) {
    if (typeof file?.filename !== 'string' || !file.filename) return null;
    paths.push(file.filename);
    if (['renamed', 'copied'].includes(file.status)) {
      if (typeof file.previous_filename !== 'string' || !file.previous_filename) return null;
      paths.push(file.previous_filename);
    }
  }
  return paths;
}

// Only safe fields: exit status, attention codes and the open incident count. Never excerpts.
export function packageRoot(path) {
  const value = String(path);
  const pkg = /^packages\/[^/]+\//.exec(value);
  if (pkg) return pkg[0];
  return PACKAGE_ROOTS.find(root => !root.includes('<') && value.startsWith(root)) ?? null;
}

// freshness: { base, main, behind, files } from readFreshness, or { reason } when it could not be read.
export function freshnessVerdict(freshness, paths, complete) {
  const advice = 'merga origin/main in i branchen och låt CI köra om';
  if (!fullSha(freshness?.base) || !fullSha(freshness?.main)) return { ok: false, reason: `CI-basen kunde inte avgöras: ${freshness?.reason ?? 'okänd orsak'}` };
  if (freshness.base === freshness.main) return { ok: true, reason: `CI mot aktuell main ${freshness.main.slice(0, 12)}` };
  if (!complete) return { ok: false, reason: 'kan inte prövas utan fullständig fillista' };
  if (!Array.isArray(freshness.files) || !Number.isSafeInteger(freshness.behind)) return { ok: false, reason: `ändringarna på main sedan ${freshness.base.slice(0, 12)} kunde inte läsas` };
  const behind = `CI mot main ${freshness.base.slice(0, 12)}, ${freshness.behind} commits bakåt`;
  const mainFiles = new Set(freshness.files);
  const overlap = [...new Set(paths)].filter(path => mainFiles.has(path));
  if (overlap.length) return { ok: false, reason: `${behind}; main har sedan dess ändrat ${overlap.length} av PR:ens filer, t.ex. ${overlap[0]}; ${advice}` };
  const mainRoots = new Set(freshness.files.map(packageRoot).filter(Boolean));
  const shared = [...new Set(paths.map(packageRoot))].filter(root => root && mainRoots.has(root));
  if (shared.length) return { ok: false, reason: `${behind}; main och PR:en ändrar båda i ${shared.join(', ')}; ${advice}` };
  return { ok: true, reason: `${behind}, ingen överlappning (${freshness.files.length} filer ändrade på main sedan dess)` };
}

// The PR author's own bug review (AGENTS.md "Leverans och merge"): one line in the PR body that
// starts with Buggranskning:, optionally after list, quote or emphasis markdown, with content after the colon.
// HTML comments and fenced code are not read, and the unedited <placeholder> template does not count.
export const REVIEW_MISSING = "PR-beskrivningen saknar raden 'Buggranskning: <verktyg/modell>, <nivå>, <fynd>'";
export function reviewVerdict(body) {
  let fenced = false;
  for (const raw of String(body ?? '').replace(/<!--[\s\S]*?(?:-->|$)/g, '').split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(raw)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const line = raw.replace(/^\s*(?:(?:[-*+]|\d+[.)])\s+|>\s*)*/, '').trim();
    const match = /^(?:\*\*|__|\*|_)?buggranskning(?:\*\*|__|\*|_)?\s*:(.*)$/i.exec(line);
    const content = match?.[1].replace(/^(?:\*\*|__|\*|_)/, '').replace(/[\u0000-\u001f\u007f]/g, '').trim() ?? '';
    if (/[\p{L}\p{N}]/u.test(content) && !/<[^<>]+>/.test(content)) return { ok: true, reason: `Buggranskning: ${content.length > 100 ? `${content.slice(0, 97)}...` : content}` };
  }
  return { ok: false, reason: REVIEW_MISSING };
}

export function securityVerdict(result) {
  // unreadable: the command could not run or its output could not be parsed (worth one retry);
  // a readable report with attention codes refuses at once.
  if (!result || result.status !== 0) return { ok: false, unreadable: true, reason: `security-status kunde inte läsas (status ${result?.status ?? 'okänd'})` };
  let report;
  try { report = JSON.parse(result.stdout); } catch { return { ok: false, unreadable: true, reason: 'security-status gav oläsbart svar' }; }
  const attention = Array.isArray(report?.attention) ? report.attention : null;
  if (!attention || report.purpose === 'gitguardian-safe-status-unavailable') return { ok: false, reason: 'security-status otillgänglig' };
  const open = Number.isSafeInteger(report.incidentCounts?.open) ? report.incidentCounts.open : null;
  const summary = `${attention.length} anmärkningar, öppna incidenter ${open ?? 'okänt'}`;
  // A failed GitGuardian check on main or an unreadable GitHub status refuses; known open
  // incidents are reported, since they live on main and the PR cannot change them.
  const errors = ['github_security_status_unavailable', 'gitguardian_check_requires_attention'].filter(code => attention.includes(code));
  return errors.length ? { ok: false, reason: `${errors.join(', ')} (${summary})` } : { ok: true, reason: summary };
}

export function evaluateMerge({ pr, files, head, freeze = null, freezeOnMain = false, allowWorkflowChange = false,
  jakobLogin, featureBranches, foreignPatterns, security, securityRetried = false, freshness = null }) {
  const checks = [];
  const check = (name, ok, reason) => checks.push({ name, ok: Boolean(ok), reason });
  check('pr', pr?.number !== undefined, pr ? `#${pr.number}` : 'PR kunde inte läsas');
  check('state', pr?.state === 'OPEN', `state ${pr?.state ?? 'okänd'}`);
  check('draft', pr?.isDraft === false, pr?.isDraft === false ? 'inte utkast' : 'utkast eller okänt');
  check('base', pr?.baseRefName === 'main', `bas ${pr?.baseRefName ?? 'okänd'}`);
  check('source', pr?.isCrossRepository === false, pr?.isCrossRepository === false ? 'samma repo' : 'annat källrepo eller okänt');
  check('head', fullSha(head) && pr?.headRefOid === head,
    pr?.headRefOid === head ? `head ${head}` : `head ${pr?.headRefOid ?? 'okänd'} är inte ${head}`);
  const branch = String(pr?.headRefName ?? '');
  // Jakob's delivery branches only (policy featureBranches), and never someone else's on top.
  const foreign = foreignPatterns.find(pattern => matchesGlob(branch, pattern));
  const feature = (featureBranches ?? []).some(pattern => matchesBranchPattern(branch, pattern));
  check('branch', branch && feature && !foreign, foreign ? `${branch} matchar ${foreign} (någon annans branch)`
    : feature ? `branch ${branch}` : `${branch || 'okänd branch'} matchar inte ${(featureBranches ?? []).join(', ') || 'featureBranches'}`);
  const login = pr?.author?.login;
  check('author', typeof jakobLogin === 'string' && jakobLogin !== '' && login === jakobLogin,
    `författare ${login ?? 'okänd'}${login === jakobLogin ? '' : `, inte ${jakobLogin ?? 'okänd ägare'}`}`);
  const ci = requiredCheckState(pr?.statusCheckRollup);
  check('ci', ci.ok, ci.reason);
  check('mergeable', Boolean(pr) && pr.mergeable !== 'CONFLICTING', `mergeable ${pr?.mergeable ?? 'okänd'}`);
  const paths = changedPaths(files);
  const complete = paths !== null && Number.isSafeInteger(pr?.changedFiles) && files.length === pr.changedFiles;
  check('files', complete, complete ? `${files.length} filer` : `fillistan ofullständig eller oläsbar (${Array.isArray(files) ? files.length : '?'} av ${pr?.changedFiles ?? '?'})`);
  const workflow = (paths ?? []).filter(path => CI_PATHS.some(prefix => path.startsWith(prefix)));
  check('workflow', complete && (!workflow.length || allowWorkflowChange), !complete ? 'kan inte prövas utan fullständig fillista'
    : !workflow.length ? 'ingen CI-ändring'
    : allowWorkflowChange ? `${workflow.length} CI-filer, tillåtet med --allow-workflow-change` : `${workflow.length} CI-filer, t.ex. ${workflow[0]}; kräver --allow-workflow-change`);
  const fresh = freshnessVerdict(freshness, paths ?? [], complete);
  check('fresh', fresh.ok, fresh.reason);
  const review = reviewVerdict(pr?.body);
  check('review', review.ok, review.reason);
  if (freeze) {
    const runtime = (paths ?? []).filter(touchesRuntime);
    check('freeze', complete && freezeOnMain === true && runtime.length === 0, freezeOnMain !== true
      ? `frysningen ${freeze.slice(0, 12)} ingår inte i origin/main`
      : runtime.length ? `${runtime.length} runtimesökvägar under frysningen ${freeze.slice(0, 12)}, t.ex. ${runtime[0]}` : `inga runtimefiler (frysning ${freeze.slice(0, 12)})`);
  }
  const sec = securityVerdict(security);
  check('security', sec.ok, securityRetried ? `${sec.reason} (efter ett omförsök)` : sec.reason);
  return { ok: checks.every(entry => entry.ok), checks };
}

export const SECURITY_RETRY_MS = 10000;
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// One retry after ~10 s when security-status could not run or be parsed; never on attention codes.
export function readSecurity(security, { sleep = sleepSync, log = () => {} } = {}) {
  const first = security();
  const verdict = securityVerdict(first);
  if (verdict.ok || !verdict.unreadable) return { result: first, retried: false };
  log(`omförsök security: ${verdict.reason}; nytt försök om ${SECURITY_RETRY_MS / 1000} s`);
  sleep(SECURITY_RETRY_MS);
  return { result: security(), retried: true };
}

function runner(command) {
  return (args, options = {}) => spawnSync(command, args, { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 << 20, windowsHide: true, ...options });
}

// One JSON object per line from gh api --paginate --jq.
export function readPrFiles(gh, number) {
  const result = gh(['api', `repos/${REPO}/pulls/${number}/files?per_page=100`, '--paginate', '--jq', '.[] | {filename, status, previous_filename}']);
  if (result.error || result.status !== 0) return null;
  try { return result.stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); } catch { return null; }
}

// The main SHA that the green CI run tested against: the CI check names its run, the log of the run's
// changes job names the merge commit it fetched (+<sha>:refs/remotes/pull/<nr>/merge), and that
// commit's parents are [tested main, head]. The run's pull_requests[].base.sha is not used: it is the
// PR's live base, not the one the run tested, and a re-run tests the original merge commit again.
export function readCiBase(gh, { number, head, rollup }) {
  const runIds = new Set((Array.isArray(rollup) ? rollup : [])
    .filter(entry => entry?.name === REQUIRED_CHECK && entry.__typename === 'CheckRun' && entry.workflowName === CI_WORKFLOW)
    .map(entry => /\/actions\/runs\/(\d+)\/job\//.exec(String(entry.detailsUrl ?? ''))?.[1] ?? 'okänd'));
  if (runIds.size !== 1 || runIds.has('okänd')) return { reason: `CI-körningen kunde inte identifieras (${runIds.size} körningar)` };
  const [runId] = runIds;
  const jobs = gh(['api', `repos/${REPO}/actions/runs/${runId}/jobs?per_page=100`, '--paginate', '--jq', '.jobs[] | {id, name, head_sha, workflow_name}']);
  if (jobs.error || jobs.status !== 0) return { reason: `jobben i körning ${runId} kunde inte läsas` };
  let named;
  try { named = jobs.stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).filter(job => job?.name === CI_BASE_JOB); }
  catch { return { reason: `jobben i körning ${runId} gav oläsbart svar` }; }
  if (named.length !== 1 || named[0].head_sha !== head || named[0].workflow_name !== CI_WORKFLOW) {
    return { reason: `jobben ${CI_BASE_JOB} på head ${String(head).slice(0, 12)} finns inte entydigt i körning ${runId}` };
  }
  const log = gh(['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${named[0].id}/logs`]);
  if (log.error || log.status !== 0) return { reason: `loggen för ${CI_BASE_JOB} i körning ${runId} kunde inte läsas` };
  const merges = new Set([...String(log.stdout).matchAll(/\+([0-9a-f]{40}):refs\/remotes\/pull\/(\d+)\/merge\b/g)]
    .map(match => Number(match[2]) === number ? match[1] : 'annan PR'));
  if (merges.size !== 1 || merges.has('annan PR')) return { reason: `merge-commiten för PR #${number} finns inte entydigt i loggen för körning ${runId}` };
  const [merge] = merges;
  const commit = gh(['api', `repos/${REPO}/commits/${merge}`, '--jq', '[.parents[].sha]']);
  let parents = null;
  if (!commit.error && commit.status === 0) { try { parents = JSON.parse(commit.stdout); } catch { parents = null; } }
  if (!Array.isArray(parents) || parents.length !== 2 || !fullSha(parents[0]) || parents[1] !== head) {
    return { reason: `merge-commiten ${merge.slice(0, 12)} har inte föräldrarna [main, ${String(head).slice(0, 12)}]` };
  }
  return { base: parents[0], merge, runId };
}

// What main changed since the tested base, from freshly fetched origin/main.
export function readFreshness(gh, git, { number, head, rollup }) {
  const ci = readCiBase(gh, { number, head, rollup });
  if (!ci.base) return ci;
  const rev = git(['rev-parse', 'origin/main']);
  const main = !rev.error && rev.status === 0 ? String(rev.stdout).trim() : null;
  if (!fullSha(main)) return { reason: 'origin/main kunde inte läsas' };
  if (ci.base === main) return { base: ci.base, main, behind: 0, files: [] };
  if (git(['merge-base', '--is-ancestor', ci.base, 'origin/main']).status !== 0) return { reason: `CI-basen ${ci.base.slice(0, 12)} ingår inte i origin/main` };
  // -z: raw path bytes, never core.quotepath's quoted "caf\303\251" form that matches no PR path.
  const diff = git(['diff', '--name-only', '--no-renames', '-z', ci.base, 'origin/main']);
  const count = git(['rev-list', '--count', `${ci.base}..origin/main`]);
  if (diff.error || diff.status !== 0 || count.error || count.status !== 0) return { reason: `git diff mot CI-basen ${ci.base.slice(0, 12)} misslyckades` };
  return { base: ci.base, main, behind: Number(String(count.stdout).trim()), files: String(diff.stdout).split('\0').filter(Boolean) };
}

function readTrustedJson(git, path) {
  const result = git(['show', `origin/main:${path}`]);
  if (result.error || result.status !== 0) throw Error(`Kan inte läsa ${path} från origin/main; kör git fetch origin main`);
  return JSON.parse(result.stdout);
}

export function main({ args = process.argv.slice(2), gh = runner('gh'), git = runner('git'),
  security = () => runner(process.execPath)(['tools/security-status.mjs'], { timeout: 180000 }), sleep = sleepSync,
  log = console.log } = {}) {
  let options;
  try { options = parseArgs(args); } catch (error) { log(error.message); return 2; }
  const fetched = git(['fetch', '-q', 'origin', 'main']);
  if (fetched.error || fetched.status !== 0) throw Error('git fetch origin main misslyckades; ingen merge utan färsk main');
  const people = readTrustedJson(git, 'inbox/people.json');
  const policy = readTrustedJson(git, 'tools/repository-policy.json');
  const jakobLogin = people?.jakob?.github;
  const freezeOnMain = options.freeze ? git(['merge-base', '--is-ancestor', options.freeze, 'origin/main']).status === 0 : false;
  const view = gh(['pr', 'view', String(options.number), '-R', REPO, '--json', PR_FIELDS]);
  let pr = null;
  if (!view.error && view.status === 0) { try { pr = JSON.parse(view.stdout); } catch { pr = null; } }
  const files = pr ? readPrFiles(gh, options.number) : null;
  const freshness = pr ? readFreshness(gh, git, { number: options.number, head: options.head, rollup: pr.statusCheckRollup }) : null;
  const sec = pr ? readSecurity(security, { sleep, log }) : { result: null, retried: false };
  const verdict = evaluateMerge({ pr, files, head: options.head, freeze: options.freeze, freezeOnMain,
    allowWorkflowChange: options.allowWorkflowChange, jakobLogin, featureBranches: featurePatterns(policy),
    foreignPatterns: foreignBranchPatterns({ policy, people }), security: sec.result, securityRetried: sec.retried, freshness });
  for (const entry of verdict.checks) log(`${entry.ok ? 'ok ' : 'nej'} ${entry.name}: ${entry.reason}`);
  if (!verdict.ok) { log(`nekad: PR #${options.number} mergas inte`); return 1; }
  if (options.dryRun) { log(`dry-run: PR #${options.number} skulle mergas på ${options.head}`); return 0; }
  const merge = gh(['pr', 'merge', String(options.number), '-R', REPO, '--merge', '--match-head-commit', options.head]);
  if (merge.error || merge.status !== 0) { log(`nej merge: gh pr merge misslyckades (status ${merge.status ?? 'okänd'})`); return 1; }
  log(`mergad: PR #${options.number} på ${options.head}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
