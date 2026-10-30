import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { studioRoots } from '../lib/studio-roots.mjs';
import { openPreviewFile, parseByteRange, previewAuthorizationRequest, previewContentType, previewRelativePath } from '../lib/preview-files.mjs';

function previewRoute(env, root, authorize=async()=>{}) {
  const file=new URL('../app/preview/[...path]/route.ts',import.meta.url),require=createRequire(file);
  const {transformSync}=require('next/dist/build/swc');
  const output=transformSync(readFileSync(file,'utf8'),{filename:fileURLToPath(file),jsc:{parser:{syntax:'typescript'}},module:{type:'commonjs'}});
  const module={exports:{}};let opens=0;
  const overrides={
    'next/dist/client/components/redirect-error':{isRedirectError:()=>false},
    '../../../lib/http-guard.mjs':{errorResponse:error=>new Response(null,{status:error.statusCode??500})},
    '../../../lib/ui-server':{authorizeUiPage:authorize},
    '../../../lib/preview-files.mjs':{parseByteRange,previewAuthorizationRequest,previewBuildDirectory:root,
      openPreviewFile:async(...args)=>{opens++;return openPreviewFile(...args);}},
  };
  vm.runInNewContext(output.code,{module,exports:module.exports,Request,Response,Headers,process:{env},
    require:name=>Object.hasOwn(overrides,name)?overrides[name]:require(name)},{filename:fileURLToPath(file)});
  return {...module.exports,opens:()=>opens};
}

test('preview serves only the two shared renderer modules, in every environment, after authorization',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-preview-route-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const name of ['compositor.js','geometry.js','preview.js','catalog.json'])await writeFile(join(root,name),'// '+name);
  for(const env of [{},{},{CROUPIER_CLOUD_RUNTIME:'1'},{}]){
    let authorizations=0;
    const route=previewRoute(env,root,async()=>{authorizations++;});
    for(const path of [['catalog.json'],['index.html'],['media','fixture.mp4'],['preview.js'],['media','compositor.js']])for(const method of ['GET','HEAD']){
      const response=await route[method](new Request('https://studio.example/preview/'+path.join('/'),{method}),{params:Promise.resolve({path})});
      assert.equal(response.status,404,JSON.stringify(env)+' '+path.join('/'));
      assert.equal(response.headers.get('cache-control'),'private, no-store');
    }
    assert.equal(route.opens(),0,'other paths never open the deployed disk');
    for(const name of ['compositor.js','geometry.js']){
      const response=await route.GET(new Request('https://studio.example/preview/'+name),{params:Promise.resolve({path:[name]})});
      assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'text/javascript');assert.equal(await response.text(),'// '+name);
    }
    assert.equal(route.opens(),2);assert.equal(authorizations,12);
  }
  const denied=previewRoute({},root,async()=>{throw Object.assign(Error('denied'),{statusCode:403});});
  assert.equal((await denied.GET(new Request('https://studio.example/preview/compositor.js'),{params:Promise.resolve({path:['compositor.js']})})).status,403);
  assert.equal(denied.opens(),0,'renderer code retains authorization');
});

test('preview paths allow only single safe segments inside the build directory', async () => {
  assert.equal(previewRelativePath(['..']), null);
  assert.equal(previewRelativePath(['media', '..', 'index.html']), null);
  assert.equal(previewRelativePath(['a..b.js']), null);
  assert.equal(previewRelativePath(['']), null);
  assert.equal(previewRelativePath(['media', '']), null);
  assert.equal(previewRelativePath(['a/b.js']), null);
  assert.equal(previewRelativePath([]), null);
  assert.equal(previewRelativePath(['compositor.js']), 'compositor.js');
  const root = await mkdtemp(join(tmpdir(), 'croupier-preview-files-'));
  try {
    await writeFile(join(root, 'compositor.js'), '// renderer');
    await writeFile(join(root, 'index.html'), '<!doctype html>');
    const opened = await openPreviewFile(root, ['compositor.js']);
    assert.equal(opened?.contentType, 'text/javascript');
    assert.equal(opened?.file, resolve(root, 'compositor.js'));
    assert.equal(await openPreviewFile(root, ['index.html']), null);
    assert.equal(await openPreviewFile(root, ['missing.js']), null);
    assert.equal(await openPreviewFile(root, ['..']), null);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir())));
    await rm(root, { recursive: true, force: true });
  }
});

test('preview content types allow only JavaScript renderer modules', () => {
  assert.equal(previewContentType('compositor.js'), 'text/javascript');
  for (const name of ['index.html', 'preview.css', 'catalog.json', 'clip.mp4', 'still.webp', 'table.png', 'notes.txt', 'noext'])
    assert.equal(previewContentType(name), null, name);
});

test('a single byte range is accepted and anything else is rejected', () => {
  assert.equal(parseByteRange(null, 10), null);
  assert.deepEqual(parseByteRange('bytes=0-3', 10), { status: 'ok', start: 0, end: 3 });
  assert.deepEqual(parseByteRange('bytes=4-', 10), { status: 'ok', start: 4, end: 9 });
  assert.deepEqual(parseByteRange('bytes=-2', 10), { status: 'ok', start: 8, end: 9 });
  assert.equal(parseByteRange('bytes=abc', 10).status, 'invalid');
  assert.equal(parseByteRange('bytes=0-1,2-3', 10).status, 'invalid');
  assert.equal(parseByteRange('bytes=5-4', 10).status, 'invalid');
  assert.equal(parseByteRange('bytes=20-30', 10).status, 'unsatisfiable');
});

test('same-origin preview iframe is authorized as a page GET and a cross-site frame is not rewritten', () => {
  const same = previewAuthorizationRequest(new Request('https://studio.example/preview/index.html', {
    method: 'HEAD',
    headers: { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'same-origin', cookie: 'session=1' },
  }));
  assert.equal(same.method, 'GET');
  assert.equal(same.headers.get('sec-fetch-dest'), null);
  assert.equal(same.headers.get('cookie'), 'session=1');
  const cross = previewAuthorizationRequest(new Request('https://studio.example/preview/clip.mp4', {
    headers: { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site' },
  }));
  assert.equal(cross.headers.get('sec-fetch-dest'), 'iframe');
  assert.equal(cross.headers.get('sec-fetch-site'), 'cross-site');
});


test('Studio roots distinguish a checkout named studio from its nested app directory', () => {
  for(const name of ['checkout','studio']) {
    const repositoryRoot=resolve(tmpdir(),'croupier-root-fixture',name),appRoot=join(repositoryRoot,'apps','studio');
    assert.deepEqual(studioRoots(repositoryRoot),{repositoryRoot,appRoot});
    assert.deepEqual(studioRoots(appRoot),{repositoryRoot,appRoot});
    assert.deepEqual(studioRoots(join(appRoot,'.')),{repositoryRoot,appRoot});
  }
});
