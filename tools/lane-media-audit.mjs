import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, unlink } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const safe = value => typeof value === 'string' && value.length > 0 && !/[\\:\u0000]/.test(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..');
const reject = () => { throw Error('media_retirement_not_verified'); };

/** Explicit candidate paths only. Neither missing references nor a directory
 * name is proof of disuse. Callers supply audited runtime/deployment roots and
 * complete live document/history/job references for every sharing environment. */
export function planMediaRetirement({ layout, index, candidates, protectedPaths, references, inventory }) {
  if (layout?.schemaVersion !== 1 || index?.schemaVersion !== 1 || inventory?.complete !== true
    || !Array.isArray(inventory.blobs) || !Array.isArray(references) || !references.length
    || references.some(source => source.complete !== true || !Array.isArray(source.references))
    || !Array.isArray(protectedPaths) || !protectedPaths.length || !Array.isArray(candidates)) reject();
  const rows = new Map(layout.files.map(row => [row.path, row]));
  const blobs = new Map(inventory.blobs.map(row => [row.pathname, row]));
  const live = new Set(references.flatMap(source => source.references));
  const protectedSet = new Set(protectedPaths), wanted = new Set(candidates), removed = [], held = [];
  if (wanted.size !== candidates.length) reject();
  for (const path of wanted) {
    const row = rows.get(path);
    if (!safe(path) || !row || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.size)) reject();
    const pointers = index.files.filter(file => file.logicalPath === path);
    const identities = [path, 'media/' + path, '/media/' + path, row.legacyPath, row.publicUrl,
      row.sha256, ...pointers.flatMap(file => [file.id, file.storage.pathname])].filter(Boolean);
    if (protectedSet.has(path) || identities.some(value => live.has(value))) held.push({ path, reason: 'referenced' });
    else removed.push(row);
  }
  const retired = new Set(removed.map(row => row.path));
  const nextIndex = { ...index, files: index.files.filter(row => !retired.has(row.logicalPath)) };
  const remainingObjects = new Set(nextIndex.files.map(row => row.storage.pathname));
  const deletes = new Map();
  for (const row of index.files.filter(row => retired.has(row.logicalPath))) {
    const key = row.storage.pathname;
    if (remainingObjects.has(key) || live.has(key)) continue;
    if (!safe(key) || !key.startsWith('croupier/media/') || !blobs.has(key)
      || blobs.get(key).size !== row.size || row.storage.sha256 !== row.sha256 || row.storage.size !== row.size) reject();
    deletes.set(key, { pathname: key, size: row.size, sha256: row.sha256 });
  }
  return { schemaVersion: 1, inputLayoutSha256: sha(JSON.stringify(layout)), inputIndexSha256: sha(JSON.stringify(index)),
    removed, held, blobDeletes: [...deletes.values()],
    nextLayout: { ...layout, files: layout.files.filter(row => !retired.has(row.path)) }, nextIndex };
}

/** Check ALL bytes and parent paths before deleting the first local file.
 * No recursive deletion, unregistered files, directories or symlinks. */
export async function removeRetiredLocalFiles(plan, { root, layout, index }) {
  if (sha(JSON.stringify(layout)) !== plan.inputLayoutSha256 || sha(JSON.stringify(index)) !== plan.inputIndexSha256) reject();
  const media = resolve(root, 'media'), files = [];
  for (const row of plan.removed) {
    if (!safe(row.path)) reject();
    const file = resolve(media, row.path), inside = relative(media, file);
    if (!inside || inside.startsWith('..') || inside.includes(':')) reject();
    for (const directory of [media, ...row.path.split('/').slice(0, -1).map((_, i, parts) => join(media, ...parts.slice(0, i + 1)))]) {
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) reject();
    }
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== row.size
      || (await realpath(file)).toLowerCase() !== file.toLowerCase() || sha(await readFile(file)) !== row.sha256) reject();
    files.push(file);
  }
  for (const file of files) await unlink(file);
  return { files: files.length, bytes: plan.removed.reduce((sum, row) => sum + row.size, 0) };
}

/** Must run only after every affected deployment uses nextIndex. A fresh
 * inventory/reference plan must equal the reviewed deletion set. Unknown Blob
 * objects, uploads, journals and other namespaces are never candidates. */
export async function deleteRetiredBlobs(plan, { expectedPlan, deployedIndexSha256, del, token }) {
  if (deployedIndexSha256 !== sha(JSON.stringify(plan.nextIndex))
    || JSON.stringify(plan.blobDeletes) !== JSON.stringify(expectedPlan.blobDeletes)
    || typeof del !== 'function' || !token) reject();
  for (let i = 0; i < plan.blobDeletes.length; i += 100) {
    await del(plan.blobDeletes.slice(i, i + 100).map(row => row.pathname), { token });
  }
  return { objects: plan.blobDeletes.length, bytes: plan.blobDeletes.reduce((sum, row) => sum + row.size, 0) };
}
