import { readFileSync, lstatSync, realpathSync, openSync, closeSync, fstatSync, constants } from 'node:fs';
import { resolve, join, dirname, relative, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PRESENTATION_BANK = 'media/dealers/astrid/runtime/presentation';
const cache = new Map();
const indexes = new WeakMap();
const MIME = { '.mp4':'video/mp4', '.webm':'video/webm', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json' };
const safe = path => typeof path === 'string' && path.length > 0 && !path.includes('\\') && !path.includes('\0') && !path.includes(':') && !path.startsWith('/') && path.split('/').every(part => part && part !== '.' && part !== '..');
const same = (a,b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
export function presentationBankRoot(root = repositoryRoot) { return join(root, PRESENTATION_BANK); }
export function normalizePresentationArchive(value,root=repositoryRoot){return typeof value==='string'&&isAbsolute(value)&&same(resolve(value),join(root,'emil/dealklipp-v1'))?presentationBankRoot(root):value;}
/** Internal filesystem consumers only. Public requests must use openPublicMedia. */
export function resolveMediaAbsolutePath(file, {repositoryRoot:root=repositoryRoot,layout}={}) {
  const path=relative(root,resolve(file)).split('\\').join('/');
  return safe(path)?resolveMediaPath(path,{repositoryRoot:root,layout}):file;
}
export function readMediaLayout(root = repositoryRoot) {
  const file = join(root, 'media/layout.json'), info = lstatSync(file), key = `${info.size}:${info.mtimeMs}`;
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('Unsafe media layout.');
  if (cache.get(file)?.key === key) return cache.get(file).layout;
  const layout = JSON.parse(readFileSync(file, 'utf8'));
  if (layout.schemaVersion !== 1 || !Array.isArray(layout.files) || typeof layout.roots !== 'object') throw new Error('Invalid media layout.');
  const paths = new Set(), legacy = new Set(), urls = new Set();
  for(const [old,next] of Object.entries(layout.roots)) if(!safe(old)||!safe(next)||!next.startsWith('media/')) throw new Error('Invalid media root.');
  for (const row of layout.files) {
    if (!safe(row.path) || !/^(dealers\/(astrid|vera|amira|mei)|game|site)\//.test(row.path) || !safe(row.legacyPath) || paths.has(row.path) || legacy.has(row.legacyPath)
      || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.size) || row.size < 0 || !['public','source','private'].includes(row.access)) throw new Error('Invalid media entry.');
    paths.add(row.path); legacy.add(row.legacyPath);
    if (row.publicUrl !== undefined && (row.access !== 'public' || urls.has(row.publicUrl) || !row.publicUrl.startsWith('/') || row.publicUrl.includes('\\') || !safe(row.publicUrl.slice(1)))) throw new Error('Invalid public alias.');
    if(row.publicUrl)urls.add(row.publicUrl);
  }
  validateMediaAliases(layout);index(layout);cache.set(file,{key,layout}); return layout;
}
/** Aliases retain their own access policy; their target supplies only bytes. */
export function validateMediaAliases(layout) {
  const rows = new Map(layout.files.map(row => [row.path,row]));
  for (const row of layout.files) if (row.canonicalPath !== undefined) {
    const target = rows.get(row.canonicalPath);
    if (!safe(row.canonicalPath) || !target || target === row || target.canonicalPath !== undefined
      || target.sha256 !== row.sha256 || target.size !== row.size || extname(target.path) !== extname(row.path))
      throw new Error(`Invalid canonical media alias: ${row.path}`);
  }
  return layout;
}
function index(layout){if(!indexes.has(layout))indexes.set(layout,{files:new Map(layout.files.flatMap(row=>[[row.legacyPath,row],['media/'+row.path,row]])),public:new Map(layout.files.filter(row=>row.access==='public').flatMap(row=>[[row.publicUrl,row],['/media/'+row.path,row]])),roots:Object.keys(layout.roots).sort((a,b)=>b.length-a.length)});return indexes.get(layout);}
/** Only explicit former roots are mapped; unknown repository paths stay put. */
export function resolveMediaPath(legacyPath, { repositoryRoot: root = repositoryRoot, layout } = {}) {
  if (!safe(legacyPath)) throw new Error('Unsafe media path.');
  if(!layout)try{layout=readMediaLayout(root);}catch(error){if(error.code!=='ENOENT')throw error;return join(root,legacyPath);}
  const direct = index(layout).files.get(legacyPath);
  if (direct) { validateMediaAliases(layout); return join(root, 'media', direct.canonicalPath ?? direct.path); }
  // A partially moved directory can still own renderer/admin code. Never
  // reinterpret an existing unregistered regular code file as a media asset.
  try{const current=lstatSync(join(root,legacyPath));if(current.isFile()&&!current.isSymbolicLink())return join(root,legacyPath);}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}
  const prefix = index(layout).roots.find(old => legacyPath === old || legacyPath.startsWith(old + '/'));
  if (!prefix) return join(root, legacyPath);
  const mapped = layout.roots[prefix];
  if (!safe(mapped)) throw new Error('Unsafe media root.');
  const next = mapped + legacyPath.slice(prefix.length), row = index(layout).files.get(next);
  if(row) { validateMediaAliases(layout); return join(root,'media',row.canonicalPath ?? row.path); }
  return join(root, next);
}
export function resolvePublicMedia(requestPath, { repositoryRoot: root = repositoryRoot, layout } = {}) {
  let path;
  try { path = decodeURIComponent(requestPath); } catch { return null; }
  if (!path.startsWith('/') || !safe(path.slice(1)) || path.includes('?') || path.includes('#')) return null;
  layout ??= readMediaLayout(root);
  const entry = index(layout).public.get(path);
  if(entry)validateMediaAliases(layout);
  return entry ? { ...entry, file: join(root, 'media', entry.canonicalPath ?? entry.path), logicalPath: entry.path } : null;
}
function assertParents(file, root) {
  const distance = relative(root,file);
  if (!distance || distance.startsWith('..') || distance.includes(':')) throw new Error('Media escaped its root.');
  for (const part of [root, ...distance.split(/[\\/]/).slice(0,-1).map((_,index)=>join(root,...distance.split(/[\\/]/).slice(0,index+1)))]) {
    const info=lstatSync(part);
    if (!info.isDirectory() || info.isSymbolicLink() || !same(realpathSync(part),resolve(part))) throw new Error('Media directory links are forbidden.');
  }
}
/** Caller owns and must close the descriptor on every HEAD/range/error branch. */
export function openPublicMedia(requestPath, options = {}) {
  const row = resolvePublicMedia(requestPath, options); if (!row) return null;
  const root=join(options.repositoryRoot ?? repositoryRoot,'media'); let fd;
  try {
    assertParents(row.file,root); const before=lstatSync(row.file);
    if (!before.isFile() || before.isSymbolicLink() || before.size !== row.size || !same(realpathSync(row.file),row.file)) return null;
    fd=openSync(row.file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); const opened=fstatSync(fd),after=lstatSync(row.file);
    if (!opened.isFile() || after.isSymbolicLink() || opened.dev!==before.dev || opened.ino!==before.ino || opened.dev!==after.dev || opened.ino!==after.ino || opened.size!==row.size) {closeSync(fd);return null;}
    return {...row,fd,mtimeMs:opened.mtimeMs,contentType:MIME[extname(row.file).toLowerCase()] ?? 'application/octet-stream'};
  } catch (error) { if(fd!==undefined)closeSync(fd); if(error.code==='ENOENT')return null; throw error; }
}
