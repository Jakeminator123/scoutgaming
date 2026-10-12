// Usage (repository root): node ordning/verktyg/raderingsgrind.mjs <base> [--json <file>]
// Integration gate for deletions (ORKESTRERING §6): every file removed between <base>
// and HEAD is checked at HEAD for
//   IMPORT   relative import/require/new URL specifiers in code that resolve to it;
//   MENTION  tracked text files that name its full path or its last two path segments;
//   REGISTRY media/layout.json or media/blob-index.json rows that still point at it.
// A MENTION on a generic two-segment suffix (for example streams/index.json) can be a
// different, live file: read the line before acting. Exit 2 when git cannot be read.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix } from 'node:path';

const [base, flag, out] = process.argv.slice(2);
if (!base) {
  console.error('Usage: node ordning/verktyg/raderingsgrind.mjs <base> [--json <file>]');
  process.exit(2);
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
let deleted, tracked;
try {
  deleted = git('diff', '--name-only', '--diff-filter=D', base, 'HEAD').split('\n').filter(Boolean);
  tracked = git('ls-files').split('\n').filter(Boolean);
} catch (error) {
  console.error(`git could not be read: ${error.message}`);
  process.exit(2);
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
  if (!codeFile.test(file) || file.startsWith('ordning/')) continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
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
const patternFile = posix.join(tmpdir().replace(/\\/g, '/'), 'raderingsgrind-patterns.txt');
writeFileSync(patternFile, `${[...needles.keys()].join('\n')}\n`);
const grep = spawnSync('git', ['grep', '-I', '-o', '-F', '-f', patternFile, '--', '.', ':(exclude)ordning/**', ...registryFiles.map(file => `:(exclude)${file}`)], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
if (grep.status > 1) {
  console.error(grep.stderr);
  process.exit(2);
}
const mentions = new Map();
for (const line of grep.stdout.split('\n').filter(Boolean)) {
  const colon = line.indexOf(':');
  for (const target of needles.get(line.slice(colon + 1)) ?? []) add(mentions, line.slice(0, colon), target);
}

const registry = new Map();
for (const file of registryFiles) {
  for (const row of JSON.parse(readFileSync(file, 'utf8')).files) {
    for (const value of [row.path, row.legacyPath, row.canonicalPath]) {
      if (typeof value !== 'string') continue;
      for (const candidate of [value, `media/${value}`]) if (deletedSet.has(candidate)) add(registry, file, candidate);
    }
  }
}

const head = git('rev-parse', '--short', 'HEAD').trim();
console.log(`head ${head}, deleted ${deleted.length}: imports ${imports.size}, mentioning files ${mentions.size}, registries with rows ${registry.size}`);
for (const [target, files] of [...imports].sort()) console.log(`IMPORT ${target} <- ${[...files].sort().join(', ')}`);
for (const [file, targets] of [...mentions].sort()) {
  const list = [...targets].sort();
  console.log(`MENTION ${file}: ${list.length} (${list.slice(0, 3).join(', ')}${list.length > 3 ? ', ...' : ''})`);
}
for (const [file, targets] of registry) console.log(`REGISTRY ${file}: ${targets.size} deleted files`);
if (flag === '--json' && out) {
  const plain = map => Object.fromEntries([...map].map(([key, value]) => [key, [...value].sort()]));
  writeFileSync(out, `${JSON.stringify({ base, head, deleted: deleted.length, imports: plain(imports), mentions: plain(mentions), registry: plain(registry) }, null, 2)}\n`);
}
