import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, lstat, open, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MEDIA_FAMILY_DEFINITIONS,
  mediaDefinitionForPath,
  validateLabVideoManifest,
  videoIdFromSha256,
} from '../lab/lib/lab-video-manifest.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '../media/dealers/astrid/runtime/presentation');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function samePath(a, b) { return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b; }
function toPosix(path) { return path.split(sep).join('/'); }
function fingerprint(info) { return `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`; }
function fail(message) { throw new Error(message); }

async function safeRoot(path) {
  const absolute = resolve(path);
  const info = await lstat(absolute);
  if (!info.isDirectory() || info.isSymbolicLink()) fail('Media root must be a real directory.');
  const canonical = await realpath(absolute);
  if (!samePath(absolute, canonical)) fail('Media root symlinks are not allowed.');
  await access(canonical, constants.R_OK);
  return canonical;
}

async function walk(root, directory = root, found = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    const relativePath = toPosix(relative(root, absolute));
    if (!relativePath || relativePath.startsWith('../') || isAbsolute(relativePath)) fail('Path escaped the media root.');
    if (entry.isSymbolicLink()) fail(`Symlinks are not allowed in the media bank: ${relativePath}`);
    if (entry.isDirectory()) await walk(root, absolute, found);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) found.push(relativePath);
    else if (entry.isFile() && entry.name === '.gitkeep') continue;
  }
  return found;
}

async function hashMedia(root, relativePath) {
  const absolute = join(root, ...relativePath.split('/'));
  const distance = relative(root, absolute);
  if (!distance || distance.startsWith('..') || isAbsolute(distance)) fail(`Unsafe media path: ${relativePath}`);
  const info = await lstat(absolute, { bigint: true });
  if (!info.isFile() || info.isSymbolicLink()) fail(`Media must be a regular file: ${relativePath}`);
  const canonical = await realpath(absolute);
  if (!samePath(absolute, canonical)) fail(`Media symlinks are not allowed: ${relativePath}`);
  const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || fingerprint(opened) !== fingerprint(info)) fail(`Media changed before hashing: ${relativePath}`);
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
    if (fingerprint(await handle.stat({ bigint: true })) !== fingerprint(opened)) fail(`Media changed while hashing: ${relativePath}`);
    return { size: Number(opened.size), sha256: hash.digest('hex') };
  } finally { await handle.close(); }
}

async function previousIdentities(manifestPath) {
  let value;
  try { value = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  if (![1, 2].includes(value.schemaVersion) || !Array.isArray(value.items)) fail('Previous manifest cannot preserve media identities.');
  // Previous paths may intentionally move between a family's standard and
  // variant folders. Only content identities are carried forward; the newly
  // scanned tree is validated against the current locked definitions below.
  const identities = new Map();
  for (const item of value.items) {
    if (!item || !UUID.test(item.id) || !SHA256.test(item.sha256) || !Number.isSafeInteger(item.size) || item.size < 1) fail('Previous manifest contains an invalid identity.');
    const existing = identities.get(item.sha256);
    if (existing && (existing.id !== item.id || existing.size !== item.size)) fail('Previous manifest contains conflicting hash identities.');
    identities.set(item.sha256, { id: item.id, size: item.size });
  }
  return identities;
}

export async function buildLabVideoManifest({ root = DEFAULT_ROOT } = {}) {
  const canonicalRoot = await safeRoot(root);
  const manifestPath = join(canonicalRoot, 'lab-video-manifest.json');
  const previous = await previousIdentities(manifestPath);
  const paths = (await walk(canonicalRoot)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const items = [];
  const hashes = new Set();
  for (const relativePath of paths) {
    const placement = mediaDefinitionForPath(relativePath);
    if (!placement) fail(`MP4 is outside the allowed media roots: ${relativePath}`);
    const { size, sha256 } = await hashMedia(canonicalRoot, relativePath);
    if (hashes.has(sha256)) fail(`Duplicate media bytes would create a duplicate identity: ${relativePath}`);
    hashes.add(sha256);
    const preserved = previous.get(sha256);
    if (preserved && preserved.size !== size) fail(`Preserved identity has a different size: ${relativePath}`);
    const id = preserved?.id ?? videoIdFromSha256(sha256);
    if (id !== videoIdFromSha256(sha256)) fail(`Existing ID is not hash-stable: ${relativePath}`);
    items.push({ id, familyId: placement.definition.id, role: placement.role, relativePath, extension: 'mp4', size, sha256 });
  }

  const itemByPath = new Map(items.map(item => [item.relativePath, item]));
  for (const definition of MEDIA_FAMILY_DEFINITIONS) {
    for (const path of definition.standardPaths) if (!itemByPath.has(path)) fail(`Required standard media is missing: ${path}`);
    const info = await lstat(join(canonicalRoot, ...definition.variantDirectory.split('/')));
    if (!info.isDirectory() || info.isSymbolicLink()) fail(`Variant directory is missing or unsafe: ${definition.variantDirectory}`);
  }
  const families = MEDIA_FAMILY_DEFINITIONS.map(definition => ({
    id: definition.id,
    dealerId: definition.dealerId,
    eventId: definition.eventId,
    situation: definition.situation,
    playbackType: definition.playbackType,
    standardIds: definition.standardPaths.map(path => itemByPath.get(path).id),
    variantIds: items.filter(item => item.familyId === definition.id && item.role === 'variant').map(item => item.id),
  }));
  return validateLabVideoManifest({ schemaVersion: 2, source: 'emil/dealklipp-v1', families, items });
}

export function manifestJson(manifest) { return `${JSON.stringify(validateLabVideoManifest(manifest), null, 2)}\n`; }

async function main(argv) {
  let check = false, root = DEFAULT_ROOT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') check = true;
    else if (argv[i] === '--root' && argv[i + 1]) root = resolve(argv[++i]);
    else fail(`Unknown argument: ${argv[i]}`);
  }
  const manifest = await buildLabVideoManifest({ root });
  const output = manifestJson(manifest);
  const manifestPath = join(resolve(root), 'lab-video-manifest.json');
  if (check) {
    const current = await readFile(manifestPath, 'utf8');
    if (current !== output) fail('lab-video-manifest.json is not deterministic or up to date.');
  } else await writeFile(manifestPath, output, 'utf8');
  process.stdout.write(`${check ? 'Verified' : 'Wrote'} ${manifest.items.length} media items in ${manifest.families.length} families.\n`);
}

if (process.argv[1] && samePath(resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
