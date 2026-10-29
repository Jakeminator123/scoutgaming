import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMediaLayout,validateMediaLayout} from '../packages/studio-registry/server/media-layout.mjs';
export {PRESENTATION_BANK,PRESENTATION_BANK_PATH,validateMediaLayout,validateMediaAliases} from '../packages/studio-registry/server/media-layout.mjs';
export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// readMediaLayout läser media/layout.json ur en checkout och är till för lokala verktyg och
// prov. Modulen läser ingen fil när den importeras; läsningen sker först vid ett anrop. Studios
// Vercel-bundle saknar filen (outputFileTracingExcludes i apps/studio/next.config.mjs), men dit
// når inget: Studios nativa medievägar skickar alltid Neons runtimeCatalog
// (packages/studio-registry/server/media-runtime.mjs, apps/studio/lib/studio-media-deletion.mjs),
// /api/clip-controls-vägen nås inte på Vercel eftersom Admin alltid körs nativt där,
// och resolveMediaPath tål en saknad fil (ENOENT). Låst av
// apps/studio/test/media-layout-bundle.test.mjs; lägg ingen läsning på modulnivå och ingen ny
// Studio-anropare utan runtimeCatalog.
const cache = new Map();
export function readMediaLayout(root = repositoryRoot) {
  const file = join(root, 'media/layout.json'), info = lstatSync(file), key = `${info.size}:${info.mtimeMs}`;
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('Unsafe media layout.');
  if (cache.get(file)?.key === key) return cache.get(file).layout;
  const layout = validateMediaLayout(JSON.parse(readFileSync(file, 'utf8')));
  cache.set(file,{key,layout}); return layout;
}
export const {presentationBankRoot,resolveMediaAbsolutePath,resolveMediaPath,resolvePublicMedia,openPublicMedia} = createMediaLayout({repositoryRoot,readMediaLayout});
