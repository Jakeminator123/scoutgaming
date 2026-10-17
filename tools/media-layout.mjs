import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMediaLayout,validateMediaLayout} from '../packages/studio-registry/server/media-layout.mjs';
export {PRESENTATION_BANK,validateMediaLayout,validateMediaAliases} from '../packages/studio-registry/server/media-layout.mjs';
export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
export function readMediaLayout(root = repositoryRoot) {
  const file = join(root, 'media/layout.json'), info = lstatSync(file), key = `${info.size}:${info.mtimeMs}`;
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('Unsafe media layout.');
  if (cache.get(file)?.key === key) return cache.get(file).layout;
  const layout = validateMediaLayout(JSON.parse(readFileSync(file, 'utf8')));
  cache.set(file,{key,layout}); return layout;
}
export const {presentationBankRoot,normalizePresentationArchive,resolveMediaAbsolutePath,resolveMediaPath,resolvePublicMedia,openPublicMedia} = createMediaLayout({repositoryRoot,readMediaLayout});
