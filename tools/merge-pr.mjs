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
// --dry-run prints the decisions and merges nothing.
// Exit code 0 when merged (or a dry run passes), 1 when refused, 2 on usage errors.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CI_WORKFLOW, REPO, touchesRuntime } from './o02-freeze-check.mjs';
import { featurePatterns, matchesBranchPattern } from './check-push-target.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REQUIRED_CHECK = 'CI';
export const PR_FIELDS = 'number,author,isCrossRepository,headRefName,headRefOid,isDraft,baseRefName,state,mergeable,statusCheckRollup,files,changedFiles';
// Other people's branches stay theirs even when the PR was opened from Jakob's account. The policy
// file lists kevin*, codex/kevin-*, john* and emil*; the codex/<name>-* forms for John and Emil are
// not in it yet, so they are fixed here and every person in people.json adds <branch>* and codex/<branch>-*.
export const BASELINE_FOREIGN_BRANCHES = Object.freeze(['kevin*', 'codex/kevin-*', 'john*', 'codex/john-*', 'emil*', 'codex/emil-*']);
const CI_PATHS = ['.github/workflows/', '.github/actions/'];
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
export function securityVerdict(result) {
  if (!result || result.status !== 0) return { ok: false, reason: `security-status kunde inte läsas (status ${result?.status ?? 'okänd'})` };
  let report;
  try { report = JSON.parse(result.stdout); } catch { return { ok: false, reason: 'security-status gav oläsbart svar' }; }
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
  jakobLogin, featureBranches, foreignPatterns, security }) {
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
  if (freeze) {
    const runtime = (paths ?? []).filter(touchesRuntime);
    check('freeze', complete && freezeOnMain === true && runtime.length === 0, freezeOnMain !== true
      ? `frysningen ${freeze.slice(0, 12)} ingår inte i origin/main`
      : runtime.length ? `${runtime.length} runtimesökvägar under frysningen ${freeze.slice(0, 12)}, t.ex. ${runtime[0]}` : `inga runtimefiler (frysning ${freeze.slice(0, 12)})`);
  }
  const sec = securityVerdict(security);
  check('security', sec.ok, sec.reason);
  return { ok: checks.every(entry => entry.ok), checks };
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

function readTrustedJson(git, path) {
  const result = git(['show', `origin/main:${path}`]);
  if (result.error || result.status !== 0) throw Error(`Kan inte läsa ${path} från origin/main; kör git fetch origin main`);
  return JSON.parse(result.stdout);
}

export function main({ args = process.argv.slice(2), gh = runner('gh'), git = runner('git'),
  security = () => runner(process.execPath)(['tools/security-status.mjs'], { timeout: 180000 }), log = console.log } = {}) {
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
  const verdict = evaluateMerge({ pr, files, head: options.head, freeze: options.freeze, freezeOnMain,
    allowWorkflowChange: options.allowWorkflowChange, jakobLogin, featureBranches: featurePatterns(policy),
    foreignPatterns: foreignBranchPatterns({ policy, people }), security: pr ? security() : null });
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
