import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLayerPacksRoute } from '../web/layer-packs.mjs';

function responseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(body = '') { this.body += body; },
  };
}

test('layer-packs route denies requests without lane flag', async () => {
  const route = createLayerPacksRoute();
  const res = responseRecorder();
  const handled = await route({ method: 'GET', headers: {} }, res, '/layer-packs/runtime/player.js');
  assert.equal(handled, true);
  assert.equal(res.statusCode, 404);
});

test('layer-packs runtime supports range with lane flag', async () => {
  const route = createLayerPacksRoute();
  const res = responseRecorder();
  const handled = await route({
    method: 'HEAD',
    headers: { cookie: 'croupier_layer_preview=1', range: 'bytes=0-15' },
  }, res, '/layer-packs/runtime/player.js');
  assert.equal(handled, true);
  assert.equal(res.statusCode, 206);
  assert.match(res.headers['Content-Range'], /^bytes 0-15\//);
});

test('layer-packs media traversal returns 404', async () => {
  const root = await mkdtemp(join(tmpdir(), 'layer-packs-route-'));
  try {
    await mkdir(join(root, 'media'), { recursive: true });
    await writeFile(join(root, 'catalog.json'), '{"lanes":[],"assets":[]}');
    const route = createLayerPacksRoute({ previewRoot: root });
    const res = responseRecorder();
    const handled = await route({
      method: 'GET',
      headers: { cookie: 'croupier_layer_preview=1' },
    }, res, '/layer-packs/paow/media/../catalog.json');
    assert.equal(handled, true);
    assert.equal(res.statusCode, 404);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('current preview retires Paow while preserving Dragge and shared assets',async()=>{
 const {readFile}=await import('node:fs/promises');const {fileURLToPath}=await import('node:url');
 const root=fileURLToPath(new URL('../packages/presentation/preview/site/',import.meta.url));
 const catalog=JSON.parse(await readFile(join(root,'catalog.json'),'utf8'));
 const route=createLayerPacksRoute({previewRoot:root}),request={method:'GET',headers:{cookie:'croupier_layer_preview=1'}};
 const retired=responseRecorder();assert.equal(await route(request,retired,'/layer-packs/paow/manifest.json'),true);assert.equal(retired.statusCode,404);
 const active=responseRecorder();assert.equal(await route(request,active,'/layer-packs/dragge/manifest.json'),true);assert.equal(active.statusCode,200);
 const manifest=JSON.parse(active.body);assert.match(manifest.dealer.id,/^dragge-/);
 assert.deepEqual(manifest.assets.map(row=>row.id),catalog.assets.map(row=>row.id));assert.equal(manifest.assets.length,3);assert.deepEqual(catalog.lanes.map(row=>row.name),['Dragge']);
 const shared=catalog.assets[0].src,denied=responseRecorder();
 await route({...request,method:'HEAD'},denied,'/layer-packs/paow/'+shared);assert.equal(denied.statusCode,404);
 const retained=responseRecorder();await route({...request,method:'HEAD'},retained,'/layer-packs/dragge/'+shared);assert.equal(retained.statusCode,200);
});


test('default layer manifest reads the Studio build in a fresh isolated checkout', async t => {
  const root=await mkdtemp(join(tmpdir(),'layer-packs-default-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'web'));await mkdir(join(root,'apps/studio/preview-build'),{recursive:true});
  await copyFile(new URL('../web/layer-packs.mjs',import.meta.url),join(root,'web/layer-packs.mjs'));
  await copyFile(new URL('../packages/presentation/preview/site/catalog.json',import.meta.url),join(root,'apps/studio/preview-build/catalog.json'));
  const {createLayerPacksRoute: createRoute}=await import(pathToFileURL(join(root,'web/layer-packs.mjs')).href);
  const route=createRoute({env:{}}),res=responseRecorder();
  assert.equal(await route({method:'GET',headers:{cookie:'croupier_layer_preview=1'}},res,'/layer-packs/dragge/manifest.json'),true);
  assert.equal(res.statusCode,200);assert.match(JSON.parse(res.body).dealer.id,/^dragge-/);
});
