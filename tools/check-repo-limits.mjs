#!/usr/bin/env node
// Grind mot repotillväxt. Blob lagrar media och Neon produktdata; Git lagrar kod och text.
//
// Regler:
// 1. En spårad fil får vara högst 1 MB (1 048 576 byte). Undantag står i
//    tools/repo-limits-allowlist.json som { path, maxBytes, reason }, sorterade och unika.
//    maxBytes är filens exakta storlek: växer filen stoppas den, krymper den ska maxBytes
//    sänkas, och en post för en fil som är borta eller under gränsen ska bort. Listan
//    krymper alltså. En ny post eller ett höjt maxBytes är ett uttryckligt undantag som
//    granskas i PR:en.
// 2. Ingen ny binär under media/ (bilder, video, ljud och annat Git klassar som binärt).
//    Befintliga filer får ligga kvar, flyttas eller krympa men inte växa.
// 3. Levande dokument: docs/NEXT-AGENT.md högst 150 rader, och ingen fil under docs/
//    utanför docs/history/ över 100 kB (102 400 byte).
//
// Lägen (alla läser Git-objekt, inte filsystemet):
//   node tools/check-repo-limits.mjs                     hela HEAD-trädet (git ls-tree -r -l)
//   node tools/check-repo-limits.mjs --tree <ref>        hela trädet för <ref>
//   node tools/check-repo-limits.mjs --cached            pre-commit: indexet mot HEAD, bara ändrade filer
//   node tools/check-repo-limits.mjs --tree HEAD --changed-since HEAD^1
//                                                        CI: PR-merge-diffen plus ändrade allowlistposter,
//                                                        så att en gles blob:none-klon bara hämtar diffens blobbar.
import { execFileSync } from 'node:child_process';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWLIST = 'tools/repo-limits-allowlist.json';
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_DOC_BYTES = 100 * 1024;
export const NEXT_AGENT = 'docs/NEXT-AGENT.md';
export const MAX_NEXT_AGENT_LINES = 150;
export const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.tif', '.tiff', '.ico', '.heic',
  '.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.wav', '.mp3', '.m4a', '.ogg', '.oga', '.opus', '.flac', '.aac']);

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mb = bytes => `${(bytes / MAX_FILE_BYTES).toFixed(2)} MB`;
const kb = bytes => `${Math.ceil(bytes / 1024)} kB`;

export function lineCount(text) {
  if (!text) return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

export function isMediaBinary({ path, binary }) {
  return path.startsWith('media/') && (binary || MEDIA_EXTENSIONS.has(posix.extname(path).toLowerCase()));
}

function validPath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\')
    && !/[\0-\x1f]/.test(path) && !path.split('/').some(part => ['', '.', '..'].includes(part));
}

export function allowlistErrors(allowlist) {
  if (!Array.isArray(allowlist)) return [`${ALLOWLIST} ska vara en lista med { path, maxBytes, reason }`];
  const errors = [];
  allowlist.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).sort().join() !== 'maxBytes,path,reason' || !validPath(entry.path)
      || !Number.isSafeInteger(entry.maxBytes) || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push(`${ALLOWLIST}: post ${index} ska ha exakt path, maxBytes (heltal) och reason`);
    } else if (entry.maxBytes <= MAX_FILE_BYTES) {
      errors.push(`${ALLOWLIST}: ${entry.path} har maxBytes ${entry.maxBytes}, som inte är över gränsen ${MAX_FILE_BYTES}; ta bort posten`);
    }
  });
  const paths = allowlist.map(entry => entry?.path);
  if (new Set(paths).size !== paths.length) errors.push(`${ALLOWLIST}: varje path får bara finnas en gång`);
  if (paths.join('\n') !== [...paths].sort().join('\n')) errors.push(`${ALLOWLIST}: posterna ska vara sorterade efter path`);
  return errors;
}

// files: [{ path, bytes, baseBytes?, added?, moved?, binary?, lines? }] for the inspected set.
// bytes null means the path is absent from the checked tree. complete: files is the whole tree.
export function checkRepoLimits({ files, allowlist, complete = false }) {
  const errors = allowlistErrors(allowlist);
  const entries = new Map(Array.isArray(allowlist) ? allowlist.filter(entry => validPath(entry?.path)).map(entry => [entry.path, entry]) : []);
  const seen = new Set();
  for (const file of files) {
    seen.add(file.path);
    const entry = entries.get(file.path);
    if (file.bytes === null || file.bytes === undefined) {
      if (entry) errors.push(`${file.path}: finns inte längre; ta bort posten ur ${ALLOWLIST}`);
      continue;
    }
    if (file.bytes > MAX_FILE_BYTES) {
      if (!entry) errors.push(`${file.path}: ${mb(file.bytes)}, över gränsen 1 MB och utan undantag. `
        + (file.path.startsWith('media/') || MEDIA_EXTENSIONS.has(posix.extname(file.path).toLowerCase())
          ? 'Lägg mediet i Blob via Admin; Git lagrar inte media.'
          : 'Dela upp filen, generera den vid bygget eller lägg den i Blob; ett godkänt undantag kräver en post i ' + ALLOWLIST + '.'));
      else if (Number.isSafeInteger(entry.maxBytes) && file.bytes > entry.maxBytes) errors.push(`${file.path}: växer från ${entry.maxBytes} till ${file.bytes} byte. `
        + 'Allowlistade filer får inte växa; lägg ny version i Blob via Admin i stället.');
      else if (Number.isSafeInteger(entry.maxBytes) && file.bytes < entry.maxBytes) errors.push(`${file.path}: har krympt till ${file.bytes} byte; sänk maxBytes till ${file.bytes} i ${ALLOWLIST}`);
    } else if (entry) {
      errors.push(`${file.path}: är nu ${file.bytes} byte, under gränsen 1 MB; ta bort posten ur ${ALLOWLIST}`);
    }
    if (isMediaBinary(file)) {
      if (file.added && !file.moved) errors.push(`${file.path}: ny binär under media/. Lägg mediet i Blob via Admin; Git lagrar inte media.`);
      else if (Number.isSafeInteger(file.baseBytes) && file.bytes > file.baseBytes) errors.push(`${file.path}: binären under media/ växer från ${file.baseBytes} till ${file.bytes} byte. `
        + 'Lägg den nya versionen i Blob via Admin; Git lagrar inte media.');
    }
    if (file.path.startsWith('docs/') && !file.path.startsWith('docs/history/') && file.bytes > MAX_DOC_BYTES) {
      errors.push(`${file.path}: ${kb(file.bytes)}, över taket 100 kB för levande dokument. Flytta äldre avsnitt till docs/history/ eller radera dem.`);
    }
    if (file.path === NEXT_AGENT && Number.isInteger(file.lines) && file.lines > MAX_NEXT_AGENT_LINES) {
      errors.push(`${NEXT_AGENT}: ${file.lines} rader, över taket ${MAX_NEXT_AGENT_LINES}. Flytta äldre avsnitt till docs/history/ eller radera avklarat.`);
    }
  }
  if (complete) for (const path of entries.keys()) if (!seen.has(path)) errors.push(`${path}: finns inte i trädet; ta bort posten ur ${ALLOWLIST}`);
  return errors;
}

// ---- Git inspection -------------------------------------------------------

function runner(cwd) {
  return (args, input) => execFileSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
}

function objectSizes(git, oids) {
  const unique = [...new Set(oids)];
  if (!unique.length) return new Map();
  const output = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], unique.join('\n') + '\n');
  const sizes = new Map();
  for (const line of output.split('\n').filter(Boolean)) {
    const [oid, type, size] = line.split(' ');
    if (type !== 'blob') throw Error(`Git-objektet ${oid} kunde inte läsas (${type})`);
    sizes.set(oid, Number(size));
  }
  return sizes;
}

function readJson(git, spec, fallback) {
  let text;
  try { text = git(['cat-file', 'blob', spec]); } catch { return fallback; }
  return JSON.parse(text);
}

function parseLsTree(output) {
  // "<mode> <type> <oid> <size>\t<path>" (ls-tree -l) or without size.
  return output.split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t');
    const [mode, type, oid, size] = record.slice(0, tab).trim().split(/\s+/);
    return { mode, type, oid, bytes: size === undefined || size === '-' ? null : Number(size), path: record.slice(tab + 1) };
  });
}

function parseRawDiff(output) {
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  const records = [];
  for (let index = 0; index < fields.length; index += 2) {
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40,64}) ([a-f0-9]{40,64}) ([A-Z])$/.exec(fields[index]);
    if (!match || !fields[index + 1]) throw Error('Oväntad rad i git diff --raw');
    records.push({ baseMode: match[1], mode: match[2], baseOid: match[3], oid: match[4], status: match[5], path: fields[index + 1] });
  }
  return records;
}

function parseNumstat(output) {
  const binary = new Set();
  for (const record of output.split('\0').filter(Boolean)) {
    const match = /^(-|\d+)\t(-|\d+)\t(.+)$/s.exec(record);
    if (match && match[1] === '-' && match[2] === '-') binary.add(match[3]);
  }
  return binary;
}

const lines = (git, oid) => lineCount(git(['cat-file', 'blob', oid]));

// Whole tree: one ls-tree process for every size; every allowlist entry is validated.
export function inspectTree({ cwd = repository, tree = 'HEAD' } = {}) {
  const git = runner(cwd);
  const blobs = parseLsTree(git(['ls-tree', '-r', '-l', '-z', tree])).filter(entry => entry.type === 'blob');
  const files = blobs.map(({ path, bytes, oid }) => ({ path, bytes, ...(path === NEXT_AGENT ? { lines: lines(git, oid) } : {}) }));
  return { files, allowlist: readJson(git, `${tree}:${ALLOWLIST}`, []), complete: true };
}

// A diff: tree against base (CI) or the index against HEAD (pre-commit, tree null).
export function inspectChanges({ cwd = repository, tree = null, base = 'HEAD' } = {}) {
  const git = runner(cwd);
  const range = tree ? [base, tree] : ['--cached'];
  const common = ['--no-renames', '--no-ext-diff', '--no-textconv', '-z'];
  // numstat reads both sides, so a partial clone prefetches the diff's blobs in one batch here.
  const binary = parseNumstat(git(['-c', 'diff.relative=false', 'diff', '--numstat', ...common, ...range, '--']));
  const records = parseRawDiff(git(['-c', 'diff.relative=false', 'diff', '--raw', '--no-abbrev', ...common, ...range, '--']))
    .filter(record => record.mode !== '160000' && record.baseMode !== '160000');
  const target = path => tree ? `${tree}:${path}` : `:${path}`;
  let hasBase = true;
  try { git(['rev-parse', '--verify', '--quiet', `${base}^{tree}`]); } catch { hasBase = false; }
  const allowlist = readJson(git, target(ALLOWLIST), []);
  const baseAllowlist = hasBase ? readJson(git, `${base}:${ALLOWLIST}`, []) : [];
  // Allowlist entries that were added, removed or changed are checked even when their file is not in the diff.
  const key = entry => JSON.stringify([entry?.path, entry?.maxBytes]);
  const before = new Set((Array.isArray(baseAllowlist) ? baseAllowlist : []).map(key));
  const after = new Set((Array.isArray(allowlist) ? allowlist : []).map(key));
  const changedEntries = [...(Array.isArray(allowlist) ? allowlist : []).filter(entry => !before.has(key(entry))),
    ...(Array.isArray(baseAllowlist) ? baseAllowlist : []).filter(entry => !after.has(key(entry)))]
    .map(entry => entry?.path).filter(validPath);
  const inDiff = new Set(records.map(record => record.path));
  const extra = [...new Set(changedEntries)].filter(path => !inDiff.has(path)).sort();
  let extraBlobs = [];
  if (extra.length) {
    // In a blob:none clone the size needs the blob. A numstat diff from the empty tree fetches
    // all of them in one batch instead of one lazy fetch per object.
    if (tree) git(['--literal-pathspecs', 'diff', '--numstat', ...common, git(['hash-object', '-t', 'tree', '--stdin'], '').trim(), tree, '--', ...extra]);
    extraBlobs = tree
      ? parseLsTree(git(['--literal-pathspecs', 'ls-tree', '-r', '-z', tree, '--', ...extra])).filter(entry => entry.type === 'blob')
      : git(['--literal-pathspecs', 'ls-files', '-s', '-z', '--', ...extra]).split('\0').filter(Boolean)
        .map(record => { const tab = record.indexOf('\t'); return { oid: record.slice(0, tab).split(' ')[1], path: record.slice(tab + 1) }; });
  }
  const present = records.filter(record => record.status !== 'D');
  const sizes = objectSizes(git, [...present.map(record => record.oid),
    ...present.filter(record => record.status !== 'A' && !/^0+$/.test(record.baseOid)).map(record => record.baseOid),
    ...extraBlobs.map(blob => blob.oid)]);
  const removed = new Set(records.filter(record => record.status === 'D').map(record => record.baseOid));
  const files = records.map(record => record.status === 'D' ? { path: record.path, bytes: null } : {
    path: record.path,
    bytes: sizes.get(record.oid),
    baseBytes: record.status === 'A' || /^0+$/.test(record.baseOid) ? null : sizes.get(record.baseOid),
    added: record.status === 'A',
    moved: record.status === 'A' && removed.has(record.oid),
    binary: binary.has(record.path),
    ...(record.path === NEXT_AGENT ? { lines: lines(git, record.oid) } : {}),
  });
  const found = new Map(extraBlobs.map(blob => [blob.path, blob]));
  for (const path of extra) {
    const blob = found.get(path);
    files.push(blob ? { path, bytes: sizes.get(blob.oid), ...(path === NEXT_AGENT ? { lines: lines(git, blob.oid) } : {}) } : { path, bytes: null });
  }
  return { files, allowlist, complete: false };
}

export function parseArgs(args) {
  const ref = value => typeof value === 'string' && /^[\w./^~-]+$/.test(value) && !value.startsWith('-');
  if (args.length === 0) return { tree: 'HEAD' };
  if (args.length === 1 && args[0] === '--cached') return { cached: true };
  if (args.length === 2 && args[0] === '--tree' && ref(args[1])) return { tree: args[1] };
  if (args.length === 4 && args[0] === '--tree' && ref(args[1]) && args[2] === '--changed-since' && ref(args[3])) return { tree: args[1], since: args[3] };
  return null;
}

export function main(args = process.argv.slice(2), { cwd = repository } = {}) {
  const options = parseArgs(args);
  if (!options) {
    console.error('Användning: node tools/check-repo-limits.mjs [--cached | --tree <ref> [--changed-since <ref>]]');
    return 2;
  }
  const result = options.cached ? inspectChanges({ cwd })
    : options.since ? inspectChanges({ cwd, tree: options.tree, base: options.since })
      : inspectTree({ cwd, tree: options.tree });
  const errors = checkRepoLimits(result);
  for (const error of errors) console.error(error);
  if (errors.length) {
    console.error(`Repogränser: ${errors.length} fel. Regler och undantag: tools/check-repo-limits.mjs och ${ALLOWLIST}.`);
    return 1;
  }
  const where = options.cached ? 'indexet mot HEAD' : options.since ? `${options.tree} mot ${options.since}` : `hela ${options.tree}`;
  console.log(`Repogränser: ${result.files.length} filer kontrollerade (${where}); ${Array.isArray(result.allowlist) ? result.allowlist.length : 0} undantag över 1 MB.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error('Repogränser kunde inte kontrolleras: ' + error.message); process.exitCode = 1; }
}
