import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designPreviewFile, serveDesignPreview, servePublicLobby, designPreviewAuthRedirect } from '../lib/design-preview.mjs';
import { studioLoginReturnTo, studioLoginDestination } from '../lib/studio-login-client.mjs';
import { platformConfiguration, platformRoute } from '../../apps/croupier-frontend/lib/platform-routing.mjs';

test('preview documents and assets have exact route boundaries', () => {
  assert.equal(designPreviewFile([]), 'admin/index.html');
  assert.equal(designPreviewFile(['admin','operators']), 'admin/index.html');
  assert.equal(designPreviewFile(['lobby']), 'lobby/index.html');
  assert.equal(designPreviewFile(['_assets','lobby','images','dealers','astrid.jpg']), 'lobby/images/dealers/astrid.jpg');
  for (const path of [['api'], ['_assets','admin','..','private.js'], ['_assets','admin','.env'],
    ['_assets','admin','index.html'], ['_assets','elsewhere','file.js'], ['%2e%2e'], ['admin','payments','delete'], ['admin\\accounts']])
    assert.equal(designPreviewFile(path), null);
});

test('login returns only to known preview documents; never assets, queries or another origin', () => {
  for (const path of ['/admin', '/admin/structure', '/admin/lobby', '/admin/admin/accounts']) {
    assert.equal(studioLoginReturnTo(path), path);
    assert.equal(studioLoginReturnTo('/studio' + path), path);
    assert.equal(studioLoginDestination(path, '/api/auth'), path);
  }
  for (const value of ['/admin/_assets/admin/app.js', '/admin/unknown', '/admin?returnTo=https://elsewhere.test', '//elsewhere.test/admin', '/admin/../api'])
    assert.equal(studioLoginReturnTo(value), '/admin');
});

test('public admin documents and assets route to Studio without changing control', () => {
  const config = platformConfiguration({ CROUPIER_VERCEL_UI: '1', CROUPIER_BACKEND_ORIGIN: 'https://engine.example', CROUPIER_PUBLIC_ORIGIN: 'https://www.example.com',
    CROUPIER_LAB_UI_ORIGIN: 'https://studio.example', CROUPIER_VERCEL_INGRESS_SECRET: 'a'.repeat(40) });
  assert.ok(config);
  for (const path of ['/admin','/admin/lobby','/admin/_assets/admin/app.js']) {
    assert.deepEqual(platformRoute(new URL(path, config.publicOrigin), config), { kind: 'lab', destination: config.labUiOrigin + '/studio' + path });
  }
});

test('native document login uses the public mounted path; resources fail without redirects or caching', async () => {
  for (const basePath of ['', '/studio']) {
    for (const target of ['/admin', '/admin/lobby', '/studio/admin/rooms']) {
      const response = designPreviewAuthRedirect(`/login?returnTo=${encodeURIComponent(target)}`, { basePath });
      const expected = target.replace(/^\/studio/, '');
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), `${basePath}/login?returnTo=${encodeURIComponent(expected)}`);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Cookie');
      assert.equal(await response.text(), '');
    }
    const denied = designPreviewAuthRedirect('/login?returnTo=%2Fstudio', { basePath, resource: true });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('location'), null);
    assert.equal(denied.headers.get('cache-control'), 'private, no-store');
    assert.equal(await denied.text(), '');
  }
  assert.equal(designPreviewAuthRedirect('/login?returnTo=https%3A%2F%2Felsewhere.test', { basePath: '/studio' }).headers.get('location'), '/studio/login?returnTo=%2Fadmin');
  assert.equal(designPreviewAuthRedirect('https://public.example/api/auth/lab/start?next=%2Fstudio%2Fadmin'), null);
});

test('every asset request reauthorizes, rejects writes, streams ranges and sends isolation headers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-design-preview-'));
  try {
    await mkdir(join(root, 'lobby'));
    await writeFile(join(root, 'lobby', 'clip.mp4'), '0123456789');
    const url = 'http://127.0.0.1/admin/_assets/lobby/clip.mp4';
    const segments = ['_assets', 'lobby', 'clip.mp4'];
    let authorized = 0;
    const authorize = async request => { assert.equal(request.method, 'GET'); authorized++; };
    const denied = Object.assign(new Error('denied'), { statusCode: 401 });
    await assert.rejects(serveDesignPreview(new Request(url), segments, { root, authorize: async () => { throw denied; } }), error => error === denied);
    const response = await serveDesignPreview(new Request(url, { headers: { range: 'bytes=2-5' } }), segments, { root, authorize });
    assert.equal(response.status, 206); assert.equal(await response.text(), '2345');
    assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
    const head = await serveDesignPreview(new Request(url, { method: 'HEAD' }), segments, { root, authorize });
    assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
    assert.equal(authorized, 2);
    assert.equal((await serveDesignPreview(new Request(url, { method: 'POST', body: '{}' }), segments, { root, authorize })).status, 405);
    assert.equal(authorized, 2);
    assert.equal((await serveDesignPreview(new Request(url, { headers: { range: 'bytes=100-' } }), segments, { root, authorize })).status, 416);
    assert.equal((await serveDesignPreview(new Request(url), ['_assets','lobby','missing.mp4'], { root, authorize })).status, 404);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('staff permits Blob; public lobby permits D-ID; assets retain same-origin policy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-design-import-'));
  try {
    for (const surface of ['admin', 'lobby', 'public-lobby']) {
      await mkdir(join(root, surface));
      await writeFile(join(root, surface, 'index.html'), '<!doctype html>');
      await writeFile(join(root, surface, 'app.js'), 'void 0;');
    }
    let authorizations = 0;
    const authorize = async () => { authorizations++; };
    const documents = [[], ['clips'], ['structure'], ['dealers'], ['rooms'], ['assets'], ['admin', 'accounts']];
    for (const segments of [...documents, ['lobby'], ['_assets', 'admin', 'app.js'], ['_assets', 'lobby', 'app.js']]) {
      const response = await serveDesignPreview(new Request('https://studio.test/admin/' + segments.join('/')), segments, { root, authorize });
      assert.equal(response.status, 200);
      const csp = response.headers.get('content-security-policy');
      const connect = csp.split(';').find(directive => directive.trim().startsWith('connect-src')).trim();
      assert.equal(connect, documents.includes(segments) ? "connect-src 'self' https://vercel.com/api/blob https://vercel.com/api/blob/" : "connect-src 'self'");
      assert.match(csp, documents.includes(segments) ? /frame-src 'self';/ : /frame-src 'none';/);
      assert.match(csp, /script-src 'self';/);
      assert.match(csp, /img-src 'self' blob: data:;/);
      assert.match(csp, /media-src 'self' blob:;/);
      await response.text();
    }
    assert.equal(authorizations, documents.length + 3);
    for (const segments of [[], ['_assets', 'lobby', 'app.js']]) {
      const response = await servePublicLobby(new Request('https://studio.test/lobby/' + segments.join('/')), segments, { root });
      assert.equal(response.status, 200);
      const csp = response.headers.get('content-security-policy');
      assert.match(csp, segments.length ? /connect-src 'self';/ : /connect-src 'self' https:\/\/api\.d-id\.com;/);
      assert.match(csp, segments.length ? /media-src 'self' blob:;/ : /media-src 'self' blob: https:\/\/agents-results\.d-id\.com;/);
      assert.match(csp, /script-src 'self';/);
      assert.doesNotMatch(response.headers.get('content-security-policy'), /vercel.com/);
      assert.match(csp,/frame-src 'none';/);
      await response.text();
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('retired Admin library authorizes before redirecting to the registered assets surface',async()=>{
  for(const prefix of ['/admin','/studio/admin'])for(const method of ['GET','HEAD']){
    const url='https://studio.test'+prefix+'/material-library?role=background&game=roulette&operator=north&room=vip';
    let authorized=0;
    const authorize=async request=>{authorized++;assert.equal(request.url,url);};
    const denied=new Error('denied');
    await assert.rejects(serveDesignPreview(new Request(url,{method}),['material-library'],{authorize:async()=>{throw denied;}}),error=>error===denied);
    const response=await serveDesignPreview(new Request(url,{method}),['material-library'],{authorize});
    assert.equal(authorized,1);assert.equal(response.status,307);assert.equal(await response.text(),'');
    const target=new URL(response.headers.get('location'),'https://studio.test');
    assert.equal(target.pathname,'/admin/assets');assert.equal(target.searchParams.get('tab'),'backgrounds');
    for(const [key,value] of [['game','roulette'],['operator','north'],['room','vip']])assert.equal(target.searchParams.get(key),value);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal((await serveDesignPreview(new Request(url,{method:'POST'}),['material-library'],{authorize})).status,405);
    assert.equal(authorized,1);
  }
});

test('retired library login returns to canonical assets without accepting invalid context',()=>{
  for(const prefix of ['/admin','/studio/admin']){
    const target=studioLoginReturnTo(prefix+'/material-library?role=background&game=roulette&room=vip');
    assert.equal(target,'/admin/assets?role=background&game=roulette&room=vip&tab=backgrounds');
    assert.equal(studioLoginReturnTo(prefix+'/material-library?role=table&role=background'),'/admin');
    assert.equal(studioLoginReturnTo(prefix+'/material-library?returnTo=https://outside.invalid'),'/admin');
  }
});
