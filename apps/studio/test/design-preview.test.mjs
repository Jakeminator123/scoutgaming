import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { designPreviewFile, serveDesignPreview, servePublicLobby, designPreviewAuthRedirect } from '../lib/design-preview.mjs';
import { studioLoginReturnTo, studioLoginDestination } from '../lib/studio-login-client.mjs';
import { platformConfiguration, platformRoute } from '../../../packages/navigation/server/platform-routing.mjs';

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
  for (const path of ['/admin', '/admin/lobby', '/admin/system?flik=personal', '/admin/dealers/vera?flik=tal&verktyg=dialog', '/admin/companies/north', '/admin/rooms/room-1', '/admin/scenes?tab=miljoer',
    '/admin/scenes?tab=material&filter=bordsgrafik', '/admin/scenes?tab=material&filter=arkiverat&game=roulette', '/admin/scenes?tab=miljoer&composition=studion&operator=north&table=kvall']) {
    assert.equal(studioLoginReturnTo(path), path);
    assert.equal(studioLoginReturnTo('/studio' + path), path);
    assert.equal(studioLoginDestination(path, '/api/auth'), path);
  }
  // Retired documents return to the page that replaced them.
  for (const [path, canonical] of [['/admin/structure', '/admin/system?flik=beroenden'], ['/admin/admin/accounts', '/admin/system?flik=personal']]) {
    assert.equal(studioLoginReturnTo(path), canonical);
    assert.equal(studioLoginReturnTo('/studio' + path), canonical);
    assert.equal(studioLoginDestination(path, '/api/auth'), canonical);
  }
  for (const value of ['/admin/_assets/admin/app.js', '/admin/unknown', '/admin?returnTo=https://elsewhere.test', '//elsewhere.test/admin', '/admin/../api',
    '/admin/dealers/vera/edit', '/admin/scenes/x', '/admin/rooms/-x', '/admin/system?token=x', '/admin/dealers/vera?flik=tal&flik=klipp', '/admin/scenes?tab=material&filter=a&filter=b', '/admin/scenes?tab=material&filter=<x>', '/admin/companies/north#x'])
    assert.equal(studioLoginReturnTo(value), '/admin', value);
});

test('public admin documents and assets route to Studio without changing control', () => {
  const config = platformConfiguration({ CROUPIER_VERCEL_UI: '1', CROUPIER_BACKEND_ORIGIN: 'https://engine.example', CROUPIER_PUBLIC_ORIGIN: 'https://www.example.com',
    CROUPIER_VERCEL_INGRESS_SECRET: 'a'.repeat(40) });
  assert.ok(config);
  for (const path of ['/admin','/admin/lobby','/admin/_assets/admin/app.js']) {
    assert.deepEqual(platformRoute(new URL(path, config.publicOrigin), config), { kind: 'lab', destination: config.labUiOrigin + '/studio' + path });
  }
});

test('native document login uses the public mounted path; resources fail without redirects or caching', async () => {
  for (const basePath of ['', '/studio']) {
    for (const target of ['/admin', '/admin/lobby', '/studio/admin/rooms/room-1']) {
      const response = designPreviewAuthRedirect(`/admin/login?returnTo=${encodeURIComponent(target)}`, { basePath });
      const expected = target.replace(/^\/studio/, '');
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), `/admin/login?returnTo=${encodeURIComponent(expected)}`);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Cookie');
      assert.equal(await response.text(), '');
    }
    const denied = designPreviewAuthRedirect('/admin/login?returnTo=%2Fstudio', { basePath, resource: true });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('location'), null);
    assert.equal(denied.headers.get('cache-control'), 'private, no-store');
    assert.equal(await denied.text(), '');
  }
  assert.equal(designPreviewAuthRedirect('/admin/login?returnTo=https%3A%2F%2Felsewhere.test', { basePath: '/studio' }).headers.get('location'), '/admin/login?returnTo=%2Fadmin');
  assert.equal(designPreviewAuthRedirect('https://public.example/api/auth/lab/start?next=%2Fstudio%2Fadmin'), null);
  const publicOrigin='https://public.example';
  assert.equal(designPreviewAuthRedirect(publicOrigin+'/admin/login?returnTo=%2Fadmin%2Frooms%2Froom-1',{publicOrigin}).headers.get('location'),publicOrigin+'/admin/login?returnTo=%2Fadmin%2Frooms%2Froom-1');
  assert.equal(designPreviewAuthRedirect('/admin/login?returnTo=%2Fstudio%2Fadmin%2Frooms').headers.get('location'),'/admin/login?returnTo=%2Fadmin%2Fcompanies%3Ftab%3Dspelbord','a retired room list returns to its replacement');
  assert.equal(designPreviewAuthRedirect('https://foreign.invalid/admin/login?returnTo=%2Fadmin',{publicOrigin}),null);
  assert.equal(designPreviewAuthRedirect(publicOrigin+'/admin/login?returnTo=%2Fadmin',{publicOrigin}).headers.get('referrer-policy'),'no-referrer');
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
    const documents = [[], ['dealers'], ['dealers', 'vera'], ['scenes'], ['companies'], ['companies', 'north'], ['rooms', 'room-1'], ['system'], ['guide']];
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

test('only lobby images and videos are browser-cacheable; documents, scripts and failures stay uncached', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-lobby-media-'));
  try {
    for (const surface of ['admin', 'lobby', 'public-lobby']) {
      await mkdir(join(root, surface));
      await writeFile(join(root, surface, 'index.html'), '<!doctype html>');
      await writeFile(join(root, surface, 'app.js'), 'void 0;');
      await writeFile(join(root, surface, 'theme.css'), ':root{}');
      if (surface === 'admin') continue;
      await mkdir(join(root, surface, 'images', 'dealers'), { recursive: true });
      await mkdir(join(root, surface, 'videos', 'dealers'), { recursive: true });
      await writeFile(join(root, surface, 'images', 'dealers', 'astrid.jpg'), '0123456789');
      await writeFile(join(root, surface, 'videos', 'dealers', 'astrid-look.mp4'), '0123456789');
    }
    await mkdir(join(root, 'fonts'));
    await writeFile(join(root, 'fonts', 'inter.woff2'), 'font');
    const authorize = async () => {};
    const admin = (segments, init) => serveDesignPreview(new Request('https://studio.test/admin/' + segments.join('/'), init), segments, { root, authorize });
    const lobby = (segments, init) => servePublicLobby(new Request('https://studio.test/lobby/' + segments.join('/'), init), segments, { root });
    const uncached = await serveDesignPreview(new Request('https://studio.test/admin'), [], { root, authorize });
    const media = [['_assets', 'lobby', 'images', 'dealers', 'astrid.jpg'], ['_assets', 'lobby', 'videos', 'dealers', 'astrid-look.mp4']];
    for (const serve of [admin, lobby]) for (const segments of media) {
      const full = await serve(segments);
      const ranged = await serve(segments, { headers: { range: 'bytes=2-5' } });
      assert.equal(full.status, 200); assert.equal(await full.text(), '0123456789');
      assert.equal(ranged.status, 206); assert.equal(await ranged.text(), '2345');
      for (const response of [full, ranged]) {
        assert.equal(response.headers.get('cache-control'), 'private, max-age=3600');
        for (const name of ['vary', 'x-content-type-options', 'x-robots-tag', 'cross-origin-resource-policy'])
          assert.equal(response.headers.get(name), uncached.headers.get(name));
        assert.match(response.headers.get('content-security-policy'), /connect-src 'self'; frame-src 'none'/);
      }
      assert.equal((await serve(segments, { headers: { range: 'bytes=100-' } })).headers.get('cache-control'), 'private, no-store');
      const missing = [...segments.slice(0, -1), 'missing' + segments.at(-1).slice(-4)];
      assert.equal((await serve(missing)).status, 404);
      assert.equal((await serve(missing)).headers.get('cache-control'), 'private, no-store');
    }
    const documentsAndCode = [
      [admin, []], [admin, ['lobby']], [admin, ['_assets', 'admin', 'app.js']], [admin, ['_assets', 'lobby', 'app.js']],
      [admin, ['_assets', 'lobby', 'theme.css']], [admin, ['_assets', 'fonts', 'inter.woff2']],
      [lobby, []], [lobby, ['_assets', 'lobby', 'app.js']], [lobby, ['_assets', 'lobby', 'theme.css']], [lobby, ['_assets', 'fonts', 'inter.woff2']],
    ];
    for (const [serve, segments] of documentsAndCode) {
      const response = await serve(segments);
      assert.equal(response.status, 200, segments.join('/'));
      assert.equal(response.headers.get('cache-control'), 'private, no-store', segments.join('/'));
      await response.text();
    }
    assert.equal((await lobby(['_assets', 'admin', 'app.js'])).headers.get('cache-control'), 'private, no-store');
    await uncached.text();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('lobby media validators let browsers keep ranged video and never stitch a replaced file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-lobby-validators-'));
  const digest = body => `"${createHash('sha256').update(body).digest('base64url')}"`;
  try {
    for (const surface of ['lobby', 'public-lobby']) {
      await mkdir(join(root, surface, 'videos', 'dealers'), { recursive: true });
      await writeFile(join(root, surface, 'app.js'), '0123456789');
      await writeFile(join(root, surface, 'videos', 'dealers', 'astrid-look.mp4'), '0123456789');
    }
    const authorize = async () => {};
    const admin = (segments, headers = {}, method = 'GET') => serveDesignPreview(new Request('https://studio.test/admin/' + segments.join('/'), { method, headers }), segments, { root, authorize });
    const lobby = (segments, headers = {}, method = 'GET') => servePublicLobby(new Request('https://studio.test/lobby/' + segments.join('/'), { method, headers }), segments, { root });
    const clip = ['_assets', 'lobby', 'videos', 'dealers', 'astrid-look.mp4'];
    const tag = digest('0123456789');
    for (const [serve, surface] of [[admin, 'lobby'], [lobby, 'public-lobby']]) {
      const full = await serve(clip), ranged = await serve(clip, { range: 'bytes=0-' }), head = await serve(clip, {}, 'HEAD');
      assert.equal(full.status, 200); assert.equal(ranged.status, 206); assert.equal(head.status, 200);
      for (const response of [full, ranged, head]) {
        assert.equal(response.headers.get('etag'), tag);
        assert.ok(Date.parse(response.headers.get('last-modified')));
        assert.equal(response.headers.get('cache-control'), 'private, max-age=3600');
        await response.text();
      }
      // Only the exact strong tag resumes; a stale tag, weak tag or date sends the whole file.
      const resumed = await serve(clip, { range: 'bytes=2-5', 'if-range': tag });
      assert.equal(resumed.status, 206); assert.equal(await resumed.text(), '2345');
      for (const ifRange of ['"stale"', 'W/' + tag, full.headers.get('last-modified')]) {
        const whole = await serve(clip, { range: 'bytes=2-5', 'if-range': ifRange });
        assert.equal(whole.status, 200); assert.equal(whole.headers.get('content-range'), null);
        assert.equal(whole.headers.get('content-length'), '10'); assert.equal(await whole.text(), '0123456789');
      }
      for (const ifNoneMatch of [tag, 'W/' + tag, '"other", ' + tag, '*']) {
        const unchanged = await serve(clip, { 'if-none-match': ifNoneMatch, range: 'bytes=0-' });
        assert.equal(unchanged.status, 304); assert.equal(await unchanged.text(), '');
        assert.equal(unchanged.headers.get('etag'), tag);
        assert.equal(unchanged.headers.get('cache-control'), 'private, max-age=3600');
        assert.equal(unchanged.headers.get('vary'), 'Cookie');
      }
      const changed = await serve(clip, { 'if-none-match': '"other"' });
      assert.equal(changed.status, 200); assert.equal(await changed.text(), '0123456789');
      // A redeployed clip gets a new tag, so the old cached bytes are never resumed.
      await writeFile(join(root, surface, 'videos', 'dealers', 'astrid-look.mp4'), 'replaced clip');
      const replaced = await serve(clip, { range: 'bytes=0-3', 'if-range': tag });
      assert.equal(replaced.status, 200); assert.equal(await replaced.text(), 'replaced clip');
      assert.equal(replaced.headers.get('etag'), digest('replaced clip'));
      // Scripts keep uncached behaviour: no validators and no conditional answers.
      for (const headers of [{}, { 'if-none-match': '*' }, { range: 'bytes=2-5', 'if-range': '"stale"' }]) {
        const script = await serve(['_assets', 'lobby', 'app.js'], headers);
        assert.equal(script.status, headers.range ? 206 : 200);
        assert.equal(script.headers.get('etag'), null); assert.equal(script.headers.get('last-modified'), null);
        assert.equal(script.headers.get('cache-control'), 'private, no-store');
        await script.text();
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('retired Admin library authorizes before redirecting to the registered material tab of Scenes',async()=>{
  for(const prefix of ['/admin','/studio/admin'])for(const method of ['GET','HEAD']){
    const url='https://studio.test'+prefix+'/material-library?role=background&game=roulette&operator=north&room=vip';
    let authorized=0;
    const authorize=async request=>{authorized++;assert.equal(request.url,url);};
    const denied=new Error('denied');
    await assert.rejects(serveDesignPreview(new Request(url,{method}),['material-library'],{authorize:async()=>{throw denied;}}),error=>error===denied);
    const response=await serveDesignPreview(new Request(url,{method}),['material-library'],{authorize});
    assert.equal(authorized,1);assert.equal(response.status,307);assert.equal(await response.text(),'');
    const target=new URL(response.headers.get('location'),'https://studio.test');
    assert.equal(target.pathname,'/admin/scenes');assert.equal(target.searchParams.get('tab'),'material');assert.equal(target.searchParams.get('filter'),'bakgrund');assert.equal(target.searchParams.has('role'),false);
    for(const [key,value] of [['game','roulette'],['operator','north'],['room','vip']])assert.equal(target.searchParams.get(key),value);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal((await serveDesignPreview(new Request(url,{method:'POST'}),['material-library'],{authorize})).status,405);
    assert.equal(authorized,1);
  }
});

test('retired library login returns to the canonical material tab without accepting invalid context',()=>{
  for(const prefix of ['/admin','/studio/admin']){
    const target=studioLoginReturnTo(prefix+'/material-library?role=background&game=roulette&room=vip');
    assert.equal(target,'/admin/scenes?tab=material&filter=bakgrund&game=roulette&room=vip');
    assert.equal(studioLoginReturnTo(prefix+'/material-library?role=table&role=background'),'/admin');
    assert.equal(studioLoginReturnTo(prefix+'/material-library?returnTo=https://outside.invalid'),'/admin');
  }
});

test('retired Admin pages authenticate before redirecting and retain explicit resource context',async()=>{
  // [old document, destination path, its tab, whether the dealer or company moves into the path]
  const cases=[['tools','/admin/dealers',null],['admin/payments','/admin/system','spelare'],['admin/log','/admin/companies/north',null,'operator'],['admin/operators','/admin/companies/north',null,'operator'],
    ['openclaw?tab=models','/admin/system','agenter'],['openclaw?tab=agent','/admin/dealers/nora','tal','dealer'],
    ['openclaw?tab=probe','/admin/dealers/nora','tal','dealer'],['openclaw?tab=drift','/admin/dealers/nora','tal','dealer'],['openclaw?tab=assistant','/admin',null],['ai/chat','/admin',null]];
  for(const [old,destination,flik,inPath] of cases)for(const method of ['GET','HEAD']){
    const url=new URL('https://studio.test/admin/'+old);
    url.searchParams.append('dealer','nora');url.searchParams.append('operator','north');url.searchParams.append('room','one');url.searchParams.append('room','two');
    const segments=url.pathname.slice('/admin/'.length).split('/');
    await assert.rejects(serveDesignPreview(new Request(url,{method}),segments,{authorize:async()=>{throw Error('denied');}}),/denied/);
    let authorized=0;const response=await serveDesignPreview(new Request(url,{method}),segments,{authorize:async()=>{authorized++;}});
    assert.equal(authorized,1);assert.equal(response.status,307);
    const target=new URL(response.headers.get('location'),url);assert.equal(target.pathname,destination,old);assert.equal(target.searchParams.get('flik'),flik,old);
    assert.equal(target.searchParams.get('dealer'),inPath==='dealer'?null:'nora',old);assert.equal(target.searchParams.get('operator'),inPath==='operator'?null:'north',old);
    assert.deepEqual(target.searchParams.getAll('room'),['one','two'],old);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
  }
});
