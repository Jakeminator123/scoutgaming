#!/usr/bin/env node
// Standalone: Node + Git only. Metadata is private; Git remains authoritative.
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const statuses = ['active', 'paused', 'done'];
const keys = ['version', 'task', 'repo', 'commonDir', 'worktree', 'branch', 'head', 'owner', 'previousOwner', 'status', 'goal', 'scope', 'verified', 'next', 'recordedAt'];
const fail = message => { throw new Error(message); };
const samePath = (a, b) => process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
const taskName = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const absolute = value => text(value) && isAbsolute(value) && !/[\r\n\t]/.test(value);
const scopePath = value => text(value) && value.length <= 512 && !isAbsolute(value) && !/[:\r\n\t]/.test(value) && value.split(/[\\/]/).every(part => part && part !== '.' && part !== '..');

function git(repo, args, allowed = [0]) {
  try {
    return execFileSync('git', ['--no-optional-locks', '-C', repo, ...args], {
      encoding: 'utf8', shell: false, windowsHide: true, timeout: 15000,
      maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (allowed.includes(error.status)) return null;
    fail(`Git kunde inte läsa ${args[0]} i ${repo}.`);
  }
}

function worktrees(repo) {
  return git(repo, ['worktree', 'list', '--porcelain', '-z']).split('\0\0').filter(Boolean).map(block => {
    const fields = Object.fromEntries(block.split('\0').filter(Boolean).map(line => {
      const split = line.indexOf(' ');
      return split < 0 ? [line, true] : [line.slice(0, split), line.slice(split + 1)];
    }));
    return { path: fields.worktree, head: fields.HEAD, branch: fields.branch?.replace(/^refs\/heads\//, '') ?? null };
  });
}

function repository(input) {
  if (!absolute(input)) fail('--repo måste vara en absolut sökväg till repots huvudsakliga checkout.');
  const repo = realpathSync(input);
  if (!samePath(repo, git(repo, ['rev-parse', '--show-toplevel']).trim())) fail('--repo måste ange repots rot.');
  const trees = worktrees(repo);
  if (!samePath(repo, trees[0].path)) fail(`Använd huvudsaklig checkout som --repo: ${trees[0].path}`);
  return { repo, trees, commonDir: realpathSync(git(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()) };
}

function optionalStat(path) {
  try { return lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function metadataDirectory(repo, create = false) {
  let path = repo;
  for (const part of ['.worktrees', '.handoffs']) {
    path = join(path, part);
    const stat = optionalStat(path);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) fail('Metadata får inte ligga bakom en länk eller junction.');
    if (!stat && create) mkdirSync(path);
  }
  return path;
}

function validate(record) {
  if (!record || Array.isArray(record) || Object.keys(record).sort().join() !== [...keys].sort().join()
    || record.version !== 1 || !taskName(record.task)
    || !['repo', 'commonDir', 'worktree'].every(key => absolute(record[key]))
    || !(record.branch === null || text(record.branch)) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(record.head)
    || !statuses.includes(record.status) || !['owner', 'goal', 'verified', 'next'].every(key => text(record[key]))
    || !(record.previousOwner === null || text(record.previousOwner))
    || !Array.isArray(record.scope) || record.scope.length < 1 || record.scope.length > 64 || !record.scope.every(scopePath)
    || !text(record.recordedAt) || !Number.isFinite(Date.parse(record.recordedAt))) fail('Okänt eller ogiltigt överlämningsformat.');
}

function readRecord(context, task, optional = false) {
  if (!taskName(task)) fail('Uppdragsnamnet måste innehålla små bokstäver, siffror, bindestreck eller understreck.');
  const file = join(metadataDirectory(context.repo), `${task}.json`);
  const stat = optionalStat(file);
  if (!stat && optional) return null;
  if (!stat) fail(`Ingen överlämning för ${task}. Kör list för att se uppdragsnamn.`);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32768) fail('Överlämningen måste vara en vanlig fil på högst 32 KiB, utan länkar.');
  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { fail('Överlämningen är inte giltig JSON.'); }
  validate(record);
  if (record.task !== task || !samePath(record.repo, context.repo) || !samePath(record.commonDir, context.commonDir)) fail('Överlämningen tillhör ett annat repo eller uppdrag.');
  return record;
}

function liveState(context, input) {
  if (!absolute(input)) fail('--worktree måste vara en absolut sökväg.');
  // Check membership before inspecting a path supplied by metadata.
  if (!context.trees.some(tree => samePath(tree.path, input))) fail('Worktreen är inte registrerad i detta repo.');
  const worktree = realpathSync(input);
  if (!samePath(worktree, git(worktree, ['rev-parse', '--show-toplevel']).trim())
    || !samePath(context.commonDir, realpathSync(git(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()))) fail('Worktreen hör inte längre till detta repo.');
  const head = git(worktree, ['rev-parse', 'HEAD']).trim();
  const branch = git(worktree, ['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1])?.trim() ?? null;
  const entries = git(worktree, ['status', '--porcelain=v1', '-z', '--untracked-files=normal']).split('\0').filter(Boolean);
  const changes = [];
  for (let i = 0; i < entries.length; i++) {
    const code = entries[i].slice(0, 2), path = entries[i].slice(3);
    changes.push({ code, path, ...(/[RC]/.test(code) ? { from: entries[++i] } : {}) });
  }
  return { worktree, head, branch, dirty: changes.length > 0, changes };
}

export function run(argv) {
  const [command, ...args] = argv;
  if (command === '--help') return { usage: [
    'list --repo <absolute main checkout>',
    'resume --repo <repo> --task <name>',
    'record --repo <repo> --task <name> --worktree <absolute path> --owner <owner> --status active|paused|done --goal <goal> --scope <relative path> --verified <latest checks> --next <next step>',
  ], note: 'Repeat --scope for more paths. Only record writes private metadata; resume never changes Git or starts an IDE. Exit: 0 success, 1 invalid input, 2 warnings (record has saved).' };
  const allowed = command === 'record' ? ['repo', 'task', 'worktree', 'owner', 'status', 'goal', 'scope', 'verified', 'next']
    : command === 'resume' ? ['repo', 'task'] : command === 'list' ? ['repo'] : [];
  if (!allowed.length) fail('Använd list, record eller resume. Se START-HERE.md#byta-ide-eller-återuppta-arbete.');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !allowed.includes(key) || !args[i + 1] || args[i + 1].startsWith('--') || (key !== 'scope' && key in options)) fail(`Ogiltigt eller dubblerat argument: ${args[i]}`);
    if (key === 'scope') (options.scope ??= []).push(args[i + 1]); else options[key] = args[i + 1];
  }
  if (allowed.some(key => !(key in options))) fail(`Obligatoriska argument: ${allowed.map(key => `--${key}`).join(' ')}`);
  const context = repository(options.repo);
  if (command === 'list') {
    const directory = metadataDirectory(context.repo);
    const tasks = optionalStat(directory) ? readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.json') && taskName(entry.name.slice(0, -5))).map(entry => entry.name.slice(0, -5)).sort() : [];
    return { repo: context.repo, tasks, worktrees: context.trees };
  }
  const previous = readRecord(context, options.task, command === 'record');
  if (command === 'resume') {
    const warnings = [];
    if (previous.status === 'active') warnings.push(`Aktiv ägare: ${previous.owner}. Samordna innan arbete tas över; statusen är ingen låsning eller behörighet.`);
    if (previous.status === 'done') warnings.push('Uppdraget är markerat klart. Kontrollera det nya uppdraget innan fortsatt arbete.');
    let current = null;
    try { current = liveState(context, previous.worktree); } catch (error) { warnings.push(error.message); }
    if (current && current.head !== previous.head) warnings.push('HEAD har ändrats sedan överlämningen. Läs den aktuella diffen och verifiera nästa steg.');
    if (current && current.branch !== previous.branch) warnings.push('Branchen har ändrats sedan överlämningen.');
    if (current && current.branch === null) warnings.push('Worktreen har detached HEAD.');
    return { handoff: previous, current, warnings };
  }
  const warnings = previous?.status === 'active' && previous.owner !== options.owner
    ? [`Överlämningens aktiva ägare ändras från ${previous.owner} till ${options.owner} genom uttrycklig record. Föregående ägare bevaras; samordna det faktiska arbetet.`] : [];
  const current = liveState(context, options.worktree);
  const record = { version: 1, task: options.task, repo: context.repo, commonDir: context.commonDir, worktree: current.worktree,
    branch: current.branch, head: current.head, owner: options.owner,
    previousOwner: previous && previous.owner !== options.owner ? previous.owner : previous?.previousOwner ?? null,
    status: options.status, goal: options.goal,
    scope: options.scope, verified: options.verified, next: options.next, recordedAt: new Date().toISOString() };
  validate(record);
  const content = `${JSON.stringify(record, null, 2)}\n`;
  if (Buffer.byteLength(content) > 32768) fail('Överlämningen får vara högst 32 KiB.');
  const relativeFile = `.worktrees/.handoffs/${options.task}.json`;
  if (git(context.repo, ['check-ignore', '-q', '--', relativeFile], [0, 1]) === null) fail('Ignorera /.worktrees/ i repots .gitignore innan en privat överlämning sparas.');
  const directory = metadataDirectory(context.repo, true);
  const temporary = join(directory, `.${options.task}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, join(directory, `${options.task}.json`));
  } finally { if (optionalStat(temporary)) unlinkSync(temporary); }
  return { handoff: record, current, warnings };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = run(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (result.warnings?.length) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
