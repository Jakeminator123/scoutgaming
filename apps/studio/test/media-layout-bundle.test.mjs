// Studios Vercel-bundle saknar media/layout.json och media/blob-index.json
// (outputFileTracingExcludes i apps/studio/next.config.mjs). tools/media-layout.mjs läser
// layoutfilen bara när readMediaLayout anropas, och Studios nativa medievägar skickar alltid
// Neons runtimeCatalog. Provet låser båda: importen läser ingen mediefil, och de nativa
// vägarna fungerar när filerna saknas, utan att ens försöka läsa dem.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const watched = /(?:^|[\\/])media[\\/](?:layout\.json|blob-index\.json|catalog[\\/])/;
const touched = [];
let missing = false; // true: filerna finns inte, som i Vercel-bundeln.
const absent = path => Object.assign(new Error(`ENOENT: no such file or directory, '${path}'`), { code: 'ENOENT', path });

function spy(target, names, asyncCall) {
  for (const name of names) {
    const original = target[name];
    target[name] = function (path, ...rest) {
      if (watched.test(String(path))) {
        touched.push(`${name} ${String(path).replaceAll('\\', '/').replace(/^.*\/media\//, 'media/')}`);
        if (missing) { if (asyncCall) return Promise.reject(absent(path)); throw absent(path); }
      }
      return original.call(this, path, ...rest);
    };
  }
}
spy(fs, ['lstatSync', 'statSync', 'readFileSync', 'existsSync', 'openSync', 'realpathSync', 'accessSync'], false);
spy(fsp, ['readFile', 'lstat', 'stat', 'open', 'realpath', 'access'], true);
syncBuiltinESMExports(); // Även `import { lstatSync } from 'node:fs'` ser spionerna.

test('importing tools/media-layout.mjs and the Studio modules that use it reads no media file', async () => {
  const layout = await import('../../../tools/media-layout.mjs');
  for (const module of ['media-blob-index.mjs', 'studio-media-runtime.mjs', 'legacy-clip-inventory.mjs']) await import(`../lib/${module}`);
  assert.deepEqual(touched, []);
  assert.equal(typeof layout.readMediaLayout, 'function', 'the reader exists for local tools and is only called on demand');
});

test('native Studio media paths serve from the Neon catalogue when the bundle has no layout or Blob index file', async () => {
  const { readRuntimeCatalogFixture } = await import('../../../test/fixtures/runtime-media-catalog.mjs');
  const { createSeedProject, isAssetCompatible } = await import('../../../packages/presentation/contracts/studio-model.mjs');
  const { createStudioMediaRuntime } = await import('../lib/studio-media-runtime.mjs');
  const catalog = readRuntimeCatalogFixture(repository); // Testets eget underlag, läst före provet.
  touched.length = 0; missing = true;
  try {
    const scope = { environment: 'media_layout_bundle_qa', workspaceId: 'croupier' };
    let reads = 0;
    const neon = { scope, listMedia: async () => [], readRuntimeCatalog: async () => { reads++; return { revision: 'a'.repeat(64), value: structuredClone(catalog) }; },
      readDocument: async name => name === 'administration' ? { revision: 'fixture', value: { tiers: {}, rooms: [], pitboss: {}, tournaments: [], voiceReview: {},
        genVerdicts: {}, genLandings: {}, legacyClipReview: { sourceSha256: 'a'.repeat(64), neverAgain: {} } } } : null };
    // Produktionen har fortfarande CROUPIER_MEDIA_BLOB_INDEX satt (docs/ENVIRONMENT-VARIABLES.md); katalogen går före.
    const env = { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-no-network', CROUPIER_MEDIA_BLOB_INDEX: '/var/task/media/blob-index.json' };
    const media = createStudioMediaRuntime({ repository: neon, scope, env, repositoryRoot: repository });
    const blobRows = new Map(catalog.blobIndex.files.map(row => [row.logicalPath, row]));
    const json = catalog.layout.files.find(row => row.access === 'public' && row.publicUrl && row.path.endsWith('.json') && blobRows.has(row.path));
    const video = catalog.layout.files.find(row => row.access === 'public' && !row.path.endsWith('.json') && blobRows.get(row.path)?.access === 'public');
    assert.ok(json && video, 'the catalogue fixture has public metadata and public media');
    assert.deepEqual(await media.readMetadata(json.publicUrl.slice(1)), JSON.parse(catalog.legacy.entries['media/' + json.path]));
    const response = await media.publicMediaResponse(json.publicUrl, new Request('https://metadata.qa.invalid' + json.publicUrl));
    assert.equal(response.status, 200);
    assert.equal(await media.hasPublicMedia('media/' + video.path), true);
    assert.equal(await media.hasPublicMedia('media/unregistered/clip.mp4'), false);
    const project = createSeedProject();
    for (const line of project.lines) {
      const asset = project.assets.find(row => isAssetCompatible(project.events.find(event => event.id === line.eventId), row));
      for (const variant of line.variants) variant.assetId = asset.id;
    }
    const controls = await media.legacyControls(project);
    assert.ok(controls.runtime, 'legacy clip controls resolve from the catalogue');
    assert.ok(reads >= 5, 'every operation read the scoped Neon catalogue');
    assert.deepEqual(touched, [], 'no native path tried to read media/layout.json or media/blob-index.json');
  } finally { missing = false; }
});
