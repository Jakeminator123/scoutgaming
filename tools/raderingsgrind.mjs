// Usage: node tools/raderingsgrind.mjs <base> [--staged] [--strict] [--json <file>]
// Integration gate for deletions (ORKESTRERING §6): every file removed between <base>
// and HEAD (or the index with --staged) is checked in that same snapshot for
//   IMPORT   relative import/require/new URL specifiers in code that resolve to it;
//   MENTION  tracked text files that name its full path or its last two path segments;
//   REGISTRY media/layout.json or media/blob-index.json rows that still point at it.
// A MENTION on a generic two-segment suffix (for example streams/index.json) can be a
// different, live file: read the line before acting. --strict exits 1 for IMPORT
// or REGISTRY findings, never MENTION alone. Exit 2 for unreadable mandatory sources.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';

const args = process.argv.slice(2);
const base = args.shift();
let staged = false, strict = false, out = null;
const seenFlags = new Set();
function usage() {
  console.error('Usage: node tools/raderingsgrind.mjs <base> [--staged] [--strict] [--json <file>]');
  process.exit(2);
}
if (!base || base.startsWith('-')) usage();
while (args.length) {
  const flag = args.shift();
  if (seenFlags.has(flag)) usage();
  seenFlags.add(flag);
  if (flag === '--staged') staged = true;
  else if (flag === '--strict') strict = true;
  else if (flag === '--json') { out = args.shift(); if (!out || out.startsWith('--')) usage(); }
  else usage();
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
let baseSha, head, deleted, tracked;
try {
  baseSha = git('rev-parse', '--verify', '--end-of-options', `${base}^{commit}`).trim();
  head = git('rev-parse', '--verify', 'HEAD').trim();
  if (staged && git('ls-files', '--unmerged', '-z')) throw Error('unmerged index');
  tracked = (staged ? git('ls-files', '--cached', '-z') : git('ls-tree', '-r', '--name-only', '-z', head)).split('\0').filter(Boolean);
  const surviving = new Set(tracked);
  const changes = git('diff', '--name-status', '-z', '--find-renames', ...(staged ? ['--cached', baseSha] : [baseSha, head]), '--').split('\0');
  deleted = [];
  for (let i = 0; i < changes.length && changes[i];) {
    const status = changes[i++], oldPath = changes[i++];
    if (/^[RC]/.test(status)) i += 1;
    if ((status === 'D' || status.startsWith('R')) && !surviving.has(oldPath)) deleted.push(oldPath);
  }
} catch (error) {
  console.error('git comparison could not be read');
  process.exit(2);
}
function readSnapshot(file) {
  try { return git('show', `${staged ? '' : head}:${file}`); }
  catch (error) {
    const code = typeof error?.code === 'string' && /^E[A-Z0-9_]{1,31}$/.test(error.code) ? error.code : 'UNKNOWN';
    console.error(`source could not be read: ${JSON.stringify(file)} (${code})`);
    process.exit(2);
  }
}
const deletedSet = new Set(deleted);
const registryFiles = ['media/layout.json', 'media/blob-index.json'];
const add = (map, key, value) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
};

const codeFile = /\.(mjs|cjs|js|jsx|ts|tsx|mts|cts|html)$/;
const specifier = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|new URL\s*\(\s*|import\s+)['"`](\.{1,2}\/[^'"`\s]+)['"`]/g;
const imports = new Map();
for (const file of tracked) {
  if (!deleted.length || !codeFile.test(file) || file.startsWith('ordning/') || file.startsWith('random-stuff-jakob/')) continue;
  const text = readSnapshot(file);
  for (const match of text.matchAll(specifier)) {
    const target = posix.normalize(posix.join(posix.dirname(file), match[1].split(/[?#]/)[0]));
    for (const candidate of [target, `${target}.mjs`, `${target}.js`, `${target}.ts`, `${target}.tsx`, `${target}/index.mjs`, `${target}/index.js`]) {
      if (deletedSet.has(candidate)) add(imports, candidate, file);
    }
  }
}

const needles = new Map();
for (const file of deleted) {
  add(needles, file, file);
  const parts = file.split('/');
  if (parts.length > 2) add(needles, parts.slice(-2).join('/'), file);
}
const mentions = new Map();
if (deleted.length) {
  const patternDir = mkdtempSync(join(tmpdir(), 'raderingsgrind-'));
  const patternFile = join(patternDir, 'patterns.txt');
  let grep;
  try {
    writeFileSync(patternFile, `${[...needles.keys()].join('\n')}\n`);
    grep = spawnSync('git', ['grep', '--no-color', '--no-line-number', '-I', '-o', '-F', '-f', patternFile,
      ...(staged ? ['--cached'] : [head]), '--', '.', ':(exclude)ordning/**', ':(exclude)random-stuff-jakob/**', ...registryFiles.map(file => `:(exclude)${file}`)], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  } finally {
    unlinkSync(patternFile);
    rmdirSync(patternDir);
  }
  if (grep.error || grep.signal || grep.status === null || grep.status > 1) {
    console.error('mentions could not be read');
    process.exit(2);
  }
  for (const value of grep.stdout.split('\n').filter(Boolean)) {
    const line = !staged && value.startsWith(`${head}:`) ? value.slice(head.length + 1) : value;
    const colon = line.indexOf(':');
    for (const target of needles.get(line.slice(colon + 1)) ?? []) add(mentions, line.slice(0, colon), target);
  }
}

const registry = new Map();
for (const file of registryFiles) {
  const text = readSnapshot(file);
  let rows;
  try { rows = JSON.parse(text).files; if (!Array.isArray(rows)) throw Error('invalid registry'); }
  catch { console.error(`registry could not be parsed: ${JSON.stringify(file)}`); process.exit(2); }
  for (const row of rows) {
    for (const value of [row.path, row.legacyPath, row.canonicalPath]) {
      if (typeof value !== 'string') continue;
      for (const candidate of [value, `media/${value}`]) if (deletedSet.has(candidate)) add(registry, file, candidate);
    }
  }
}

console.log(`head ${head.slice(0, 8)}, deleted ${deleted.length}: imports ${imports.size}, mentioning files ${mentions.size}, registries with rows ${registry.size}`);
console.log(`comparison ${baseSha} -> ${staged ? 'index' : `HEAD ${head}`} (sources ${staged ? 'index' : 'HEAD'})`);
for (const [target, files] of [...imports].sort()) console.log(`IMPORT ${target} <- ${[...files].sort().join(', ')}`);
for (const [file, targets] of [...mentions].sort()) {
  const list = [...targets].sort();
  console.log(`MENTION ${file}: ${list.length} (${list.slice(0, 3).join(', ')}${list.length > 3 ? ', ...' : ''})`);
}
for (const [file, targets] of registry) console.log(`REGISTRY ${file}: ${targets.size} deleted files`);
if (out) {
  const plain = map => Object.fromEntries([...map].map(([key, value]) => [key, [...value].sort()]));
  writeFileSync(out, `${JSON.stringify({ base, head, comparison: { base: baseSha, target: staged ? 'index' : head, staged }, strict,
    deleted: deleted.length, imports: plain(imports), mentions: plain(mentions), registry: plain(registry) }, null, 2)}\n`);
}
if (strict && (imports.size || registry.size)) process.exitCode = 1;
