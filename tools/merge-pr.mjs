#!/usr/bin/env node
// Merge guard for the orchestrating session: the AGENTS.md "Leverans och merge" rules as code.
//
//   node tools/merge-pr.mjs <nr> --head <40-hex SHA> [--freeze <40-hex SHA>] [--dry-run]
//
// It reads the pull request fresh from GitHub, the owner from inbox/people.json and the branch
// policy from tools/repository-policy.json on origin/main (trusted main, never the working copy),
// prints one line per check and merges only when every check passes:
//   gh pr merge <nr> --merge --match-head-commit <sha>      (never --admin, never --auto)
// --freeze <SHA> (O02) also refuses any file under the runtime prefixes of tools/o02-freeze-check.mjs.
// --dry-run prints the decisions and merges nothing. Run `git fetch origin main` first.
// Exit code 0 when merged (or a dry run passes), 1 when refused, 2 on usage errors.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, touchesRuntime } from './o02-freeze-check.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REQUIRED_CHECK = 'CI';
export const PR_FIELDS = 'number,author,isCrossRepository,headRefName,headRefOid,isDraft,baseRefName,state,mergeable,statusCheckRollup,files,changedFiles';
// Other people's branches stay theirs even when the PR was opened from Jakob's account. The policy
// file lists kevin*, codex/kevin-*, john* and emil*; the codex/<name>-* forms for John and Emil are
// not in it yet, so they are fixed here and every person in people.json adds <branch>* and codex/<branch>-*.
export const BASELINE_FOREIGN_BRANCHES = Object.freeze(['kevin*', 'codex/kevin-*', 'john*', 'codex/john-*', 'emil*', 'codex/emil-*']);
const fullSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function parseArgs(args) {
  const usage = 'Usage: node tools/merge-pr.mjs <nr> --head <40-hex SHA> [--freeze <40-hex SHA>] [--dry-run]';
  const options = { number: null, head: null, freeze: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run' && !options.dryRun) options.dryRun = true;
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

// Rollup entries for the required check: CheckRun.name or StatusContext.context.
export function requiredCheckState(rollup, name = REQUIRED_CHECK) {
  const entries = (Array.isArray(rollup) ? rollup : []).filter(entry => (entry?.name ?? entry?.context) === name);
  if (!entries.length) return { ok: false, reason: `kontrollen ${name} saknas` };
  const states = entries.map(entry => entry.__typename === 'StatusContext' || entry.state !== undefined
    ? String(entry.state ?? '') : entry.status === 'COMPLETED' ? String(entry.conclusion ?? '') : String(entry.status ?? ''));
  return states.every(state => state === 'SUCCESS')
    ? { ok: true, reason: `${name} SUCCESS` }
    : { ok: false, reason: `${name} ${[...new Set(states)].join('/') || 'okänd'}` };
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

export function evaluateMerge({ pr, head, freeze = null, jakobLogin, foreignPatterns, security }) {
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
  const foreign = foreignPatterns.find(pattern => matchesGlob(branch, pattern));
  check('branch', branch && !foreign, foreign ? `${branch} matchar ${foreign} (någon annans branch)` : `branch ${branch || 'okänd'}`);
  const login = pr?.author?.login;
  check('author', typeof jakobLogin === 'string' && jakobLogin !== '' && login === jakobLogin,
    `författare ${login ?? 'okänd'}${login === jakobLogin ? '' : `, inte ${jakobLogin ?? 'okänd ägare'}`}`);
  const ci = requiredCheckState(pr?.statusCheckRollup);
  check('ci', ci.ok, ci.reason);
  check('mergeable', Boolean(pr) && pr.mergeable !== 'CONFLICTING', `mergeable ${pr?.mergeable ?? 'okänd'}`);
  if (freeze) {
    const files = Array.isArray(pr?.files) ? pr.files.map(file => file?.path).filter(path => typeof path === 'string') : [];
    const complete = Number.isSafeInteger(pr?.changedFiles) && files.length === pr.changedFiles;
    const runtime = files.filter(touchesRuntime);
    check('freeze', complete && runtime.length === 0, !complete
      ? `fillistan ofullständig (${files.length} av ${pr?.changedFiles ?? '?'})`
      : runtime.length ? `${runtime.length} runtimefiler under frysningen ${freeze.slice(0, 12)}, t.ex. ${runtime[0]}` : `inga runtimefiler (frysning ${freeze.slice(0, 12)})`);
  }
  const sec = securityVerdict(security);
  check('security', sec.ok, sec.reason);
  return { ok: checks.every(entry => entry.ok), checks };
}

function runner(command) {
  return (args, options = {}) => spawnSync(command, args, { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 << 20, windowsHide: true, ...options });
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
  const people = readTrustedJson(git, 'inbox/people.json');
  const policy = readTrustedJson(git, 'tools/repository-policy.json');
  const jakobLogin = people?.jakob?.github;
  const view = gh(['pr', 'view', String(options.number), '-R', REPO, '--json', PR_FIELDS]);
  let pr = null;
  if (!view.error && view.status === 0) { try { pr = JSON.parse(view.stdout); } catch { pr = null; } }
  const verdict = evaluateMerge({ pr, head: options.head, freeze: options.freeze, jakobLogin,
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
