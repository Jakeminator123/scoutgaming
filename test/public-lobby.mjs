import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicLobbyFile, servePublicLobby, serveDesignPreview } from '../apps/studio/lib/design-preview.mjs';
import {playerAreaModel, renderPlayerAreaHtml} from '../apps/web/lib/player-area.mjs';
import { platformConfiguration, platformRoute, backendPlatformPath, platformBackendHeaders } from '../packages/navigation/server/platform-routing.mjs';
import { loadLobbyCatalog, lobbySelection, lobbyQuerySelection, playUrlFor } from '../apps/studio/client/runtime/public-lobby-catalog.mjs';

function publication(slug, game = 'blackjack') {
  return { schemaVersion: 1, operator: { slug, name: `Bolag ${slug}` }, packageRevision: 2, rooms: [{
    id: 'shared-room', name: `Rum ${slug}`, game, laneId: 'test-composition',
    presentation: { id: 'test-composition', label: 'Publicerad miljö' }, dealerDefault: 'nora',
    dealers: [{ id: 'nora', label: 'Nora', presentation: 'original', independentLayers: false,
      table: { enabled: false, default: null, allowed: [] },
      background: { enabled: false, default: null, allowed: [], mode: 'baked' } }],
    playUrl: `/play/${game}?operator=${slug}&table=shared-room`,
  }] };
}

test('Vercel ingress owns the lobby prefix and transforms it to the mounted Studio path', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const index = config.rewrites.findIndex(row => row.source === '/lobby/:path*');
  assert.ok(index >= 0 && index < config.rewrites.findIndex(row => row.source === '/(.*)'));
  assert.equal(config.rewrites[index].destination.service, 'studio');
  for (const path of ['/lobby', '/lobby/_assets/lobby/app.js', '/admin', '/control/rooms', '/partner/login']) {
    const rule = config.services.studio.routes.find(row => new RegExp(row.src).test(path));
    assert.ok(rule, path);
    assert.equal(path.replace(new RegExp(rule.src), rule.transforms[0].args), '/studio' + path);
  }
});

test('public lobby routing preserves queries and leaves admin access on its existing route', () => {
  const config = platformConfiguration({ CROUPIER_VERCEL_UI: '1', CROUPIER_BACKEND_ORIGIN: 'https://engine.example',
    CROUPIER_PUBLIC_ORIGIN: 'https://www.example.com', CROUPIER_LAB_UI_ORIGIN: 'https://studio.example',
    CROUPIER_VERCEL_INGRESS_SECRET: 'a'.repeat(40) });
  for (const path of ['/lobby', '/lobby/', '/lobby/_assets/lobby/app.js', '/lobby/_assets/fonts/inter.woff2', '/admin', '/admin/lobby']) {
    assert.deepEqual(platformRoute(new URL(path + '?operator=alpha', config.publicOrigin), config),
      { kind: 'lab', destination: config.labUiOrigin + '/studio' + path + '?operator=alpha' });
  }
  assert.equal(platformRoute(new URL('/lobby-other', config.publicOrigin), config).kind, 'frontend');
});

test('public file selection rejects admin, data, traversal and unrelated documents', () => {
  assert.equal(publicLobbyFile([]), 'public-lobby/index.html');
  assert.equal(publicLobbyFile(['_assets', 'lobby', 'app.js']), 'public-lobby/app.js');
  assert.equal(publicLobbyFile(['_assets', 'fonts', 'inter.woff2']), 'fonts/inter.woff2');
  for (const path of [null, ['admin'], ['_data', 'catalog'], ['_assets', 'admin', 'app.js'],
    ['_assets', 'lobby', 'index.html'], ['_assets', 'lobby', '..', 'admin', 'app.js'], ['_assets', 'fonts', '..\\admin\\app.js']])
    assert.equal(publicLobbyFile(path), null);
});

test('anonymous lobby serves only its public build; private previews still require authorization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-public-lobby-'));
  try {
    await mkdir(join(root, 'public-lobby')); await mkdir(join(root, 'admin'));
    await writeFile(join(root, 'public-lobby', 'index.html'), '<h1>Spellobby</h1>');
    await writeFile(join(root, 'public-lobby', 'app.js'), '0123456789');
    await writeFile(join(root, 'admin', 'index.html'), 'private admin');
    await writeFile(join(root, 'admin', 'hidden.js'), 'private admin script');
    await symlink(join(root, 'admin'), join(root, 'public-lobby', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const request = new Request('https://www.example.com/lobby');
    const response = await servePublicLobby(request, [], { root });
    assert.equal(response.status, 200); assert.match(await response.text(), /Spellobby/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const ranged = await servePublicLobby(new Request(request, { headers: { range: 'bytes=2-5' } }), ['_assets', 'lobby', 'app.js'], { root });
    assert.equal(ranged.status, 206); assert.equal(await ranged.text(), '2345');
    const head = await servePublicLobby(new Request(request, { method: 'HEAD' }), [], { root });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await servePublicLobby(new Request(request, { method: 'POST' }), [], { root })).status, 405);
    assert.equal((await servePublicLobby(request, ['_assets', 'admin', 'app.js'], { root })).status, 404);
    assert.equal((await servePublicLobby(request, ['_assets', 'lobby', 'escape', 'hidden.js'], { root })).status, 404);
    await assert.rejects(serveDesignPreview(request, [], { root }), /authorization_required/);
    await assert.rejects(serveDesignPreview(request, ['lobby'], { root, authorize: async () => {
      throw Object.assign(new Error('N1 required'), { statusCode: 401 });
    } }), /N1 required/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('public readers retain tenant, game and dealer choices without calling admin APIs', async () => {
  const called = [];
  const catalog = await loadLobbyCatalog({ fetchImpl: async (path, options) => {
    called.push(path); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    const value = path === '/api/operators'
      ? { operators: ['alpha', 'beta'].map(slug => ({ slug, name: `Bolag ${slug}` })) }
      : publication(path.split('/')[3], path.includes('/beta/') ? 'roulette' : 'blackjack');
    return Response.json(value);
  } });
  assert.deepEqual(called, ['/api/operators', '/api/operators/alpha/rooms', '/api/operators/beta/rooms']);
  for (const [slug, game] of [['alpha', 'blackjack'], ['beta', 'roulette']]) {
    const selected = lobbySelection(catalog, { ...lobbyQuerySelection(catalog, '?operator=' + slug + '&room=shared-room'), dealerId: 'nora' });
    assert.equal(playUrlFor(selected), `/play/${game}?operator=${slug}&table=shared-room&dealer=nora`);
  }
  assert.equal(lobbySelection(catalog, { operatorId: 'beta', roomKey: 'alpha:shared-room', dealerId: 'nora' }).room, null);
  assert.deepEqual(lobbyQuerySelection(catalog, '?operator=beta&room=missing'), {operatorId:'beta',roomKey:null,dealerId:null,unavailable:true});
});

test('unavailable or malformed public data fails closed; empty and withdrawn rooms stay empty', async () => {
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async () => new Response(null, { status: 503 }) }));
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async path => Response.json(path === '/api/operators'
    ? { operators: [{ slug: 'alpha', name: 'Alpha', private: true }] } : publication('alpha')) }));
  const directory = { operators: [{ slug: 'alpha', name: 'Alpha' }] };
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async path => path === '/api/operators'
    ? Response.json(directory) : new Response(null, { status: 503 }) }));
  const withdrawn = await loadLobbyCatalog({ fetchImpl: async path => path === '/api/operators'
    ? Response.json(directory) : new Response(null, { status: 404 }) });
  assert.deepEqual(withdrawn, { operators: [], rooms: [], dealers: [] });
  assert.deepEqual(await loadLobbyCatalog({ fetchImpl: async () => Response.json({ operators: [] }) }), withdrawn);
  const injected = publication('alpha'); injected.rooms[0].playUrl = 'https://elsewhere.example/play';
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async path => Response.json(path === '/api/operators' ? directory : injected) }));
});

import { animateScrollTo } from '../apps/studio/client/lobby/lib/scroll-motion.mjs';

test('cinematic scroll reaches its target and removes frames/listeners on finish, input or disposal', () => {
  for (const exit of ['complete', 'wheel', 'touchstart', 'keydown', 'pointerdown', 'unmount']) {
    let nextId = 0, done = 0;
    const frames = new Map(), listeners = new Map(), scrolls = [];
    const viewport = {
      scrollY: 10, performance: { now: () => 0 },
      requestAnimationFrame(fn) { frames.set(++nextId, fn); return nextId; },
      cancelAnimationFrame(id) { frames.delete(id); },
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); },
      scrollTo(options) { scrolls.push(options.top); },
    };
    const cancel = animateScrollTo(1000, 2400, () => done++, viewport);
    const tick = now => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); };
    tick(1200);
    assert.equal(scrolls[0], 505);
    if (exit === 'complete') tick(2400);
    else if (exit === 'unmount') cancel();
    else listeners.get(exit)();
    const count = scrolls.length;
    tick(3000); cancel();
    assert.equal(done, 1, exit);
    assert.equal(frames.size, 0, exit);
    assert.equal(listeners.size, 0, exit);
    assert.equal(scrolls.length, count, exit);
    assert.equal(scrolls.at(-1), exit === 'complete' ? 1000 : 505);
  }
});


test('public lobby exposes one profile entry through the existing authenticated account surface', async () => {
  const require = createRequire(new URL('../apps/studio/client/package.json', import.meta.url));
  const root = fileURLToPath(new URL('../apps/studio/client/lobby/', import.meta.url));
  const {outputFiles} = await require('esbuild').build({stdin:{contents:
    "export {Header} from './components/header.tsx'; export {LobbyProvider} from './components/lobby-provider.tsx';",
    resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',
    alias:{'@':root,'next/link':fileURLToPath(new URL('../apps/studio/client/runtime/navigation.tsx',import.meta.url))},
    external:['react','react-dom','/composition-runtime/compositor.js'],logLevel:'silent'});
  const module={exports:{}};
  new Function('require','module','exports',outputFiles[0].text)(require,module,module.exports);
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const {Header,LobbyProvider}=module.exports;
  const html=renderToStaticMarkup(React.createElement(LobbyProvider,null,React.createElement(Header)));
  const links=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(([,attrs])=>/href="\/play\/profil"/.test(attrs));
  assert.equal(links.length,1,'one account entry is shared by all viewport sizes');
  assert.match(links[0][2],/Min profil/);
  assert.doesNotMatch(links[0][1],/hidden|returnTo|target=/);
});


const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
test('lobby browser preserves choices, authenticated launch contract, account navigation and invalid-link isolation',
  {skip: browserModule ? false : 'Set CROUPIER_BROWSER_FIXTURE_MODULE for the isolated lobby browser check', timeout: 45_000}, async t => {
    const require = createRequire(new URL('../apps/studio/client/package.json', import.meta.url));
    const root = fileURLToPath(new URL('../apps/studio/client/lobby/', import.meta.url));
    const {outputFiles} = await require('esbuild').build({stdin: {contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {LobbyProvider} from './components/lobby-provider.tsx';
      import {DealersSection} from './components/sections/dealers-section.tsx';
      import {Header} from './components/header.tsx';
      createRoot(document.getElementById('root')).render(<LobbyProvider><Header/><DealersSection/></LobbyProvider>);
    `, resolveDir: root, loader: 'tsx'}, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
    external: ['/composition-runtime/compositor.js'],
    alias: {'@/lib/catalog.mjs': fileURLToPath(new URL('../apps/studio/client/runtime/public-lobby-catalog.mjs', import.meta.url)),
      '@': root, 'next/link': fileURLToPath(new URL('../apps/studio/client/runtime/navigation.tsx', import.meta.url)), 'next/image': fileURLToPath(new URL('../apps/studio/client/runtime/image.ts', import.meta.url))},
    define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent'});
    const pack = publication('alpha');
    pack.rooms[0].dealers.push({...pack.rooms[0].dealers[0], id: 'oskar', label: 'Oskar'});
    const html = '<!doctype html><html lang="sv"><meta charset="utf-8"><style>'
      + '[data-slot="dialog-overlay"]{position:fixed;inset:0;background:#0003}'
      + '[data-slot="dialog-content"]{position:fixed;top:10%;left:10%;background:white;padding:1rem}'
      + '[data-slot="dialog-content"][data-state="closed"]{animation:fixture-close 50ms}'
      + '@keyframes fixture-close{from{opacity:1}to{opacity:0}}'
      // Without the app's CSS, absolute portrait media would cover neighbouring cards.
      + 'img,video{pointer-events:none}</style><div id="root"></div>'
      + '<script type="module" src="/fixture.js"></script></html>';
    const unexpected = [], errors = [], portraitRequests = new Set();
    const server = createServer((request, response) => {
      const path = new URL(request.url, 'http://localhost').pathname;
      let body, type = 'application/json';
      if (path === '/lobby') {body = html; type = 'text/html; charset=utf-8';}
      else if (path === '/fixture.js') {body = outputFiles[0].text; type = 'application/javascript';}
      else if (path === '/api/operators') body = JSON.stringify({operators: [{slug: 'alpha', name: 'Bolag alpha'}]});
      else if (path === '/api/operators/alpha/rooms') body = JSON.stringify(pack);
      else if (path === '/play/blackjack') {body = '<h1>Isolerad launchmottagare</h1><a href="/lobby?operator=alpha&room=shared-room">Till lobbyn</a>'; type='text/html';}
      else if (path === '/play/profil' || path === '/play/historik') {
        const model=playerAreaModel({session:{authenticated:true},player:{name:'Isolerad spelare',balance:125,currency:'SEK'},results:{currencies:[],lastRound:null}},path.endsWith('profil')?'profil':'historik');
        body=renderPlayerAreaHtml(model);type='text/html';
      }
      else if (path === '/favicon.ico') {response.writeHead(204); response.end(); return;}
      // Decorative portrait stills/clips only; the fixture needs no media bytes.
      else if (path.startsWith('/admin/_assets/lobby/')) {portraitRequests.add(path); response.writeHead(204); response.end(); return;}
      else {unexpected.push(request.method + ' ' + path); response.writeHead(404); response.end(); return;}
      response.writeHead(200, {'content-type': type}); response.end(body);
    });
    t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
    const origin = 'http://127.0.0.1:' + server.address().port;
    const {chromium} = await import(pathToFileURL(browserModule).href);
    const channel = process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL;
    const browser = await chromium.launch({headless: true, ...(channel ? {channel} : {}),
      args: ['--disable-background-networking', '--disable-component-update', '--disable-domain-reliability']});
    t.after(() => browser.close());
    const context = await browser.newContext({serviceWorkers: 'block'});
    context.setDefaultTimeout(5_000);
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      unexpected.push(route.request().url()); return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    // Before a room is chosen, step 3 shows four locked portrait teasers under the glass.
    const dealerCards = page.locator('ul[aria-label="Dealers"] > li');
    await page.goto(origin + '/lobby');
    await page.locator('ul[aria-label="Dealers"][aria-hidden="true"] > li').nth(3).waitFor();
    assert.equal(await dealerCards.count(), 4);
    assert.equal(await page.locator('ul[aria-label="Dealers"] button:not([disabled])').count(), 0);
    assert.equal(await page.locator('a[href^="/play/blackjack"], a[href^="/play/roulette"]').count(), 0);
    await page.goto(origin + '/lobby?operator=alpha&room=shared-room');
    await page.getByRole('button', {name: 'Välj Oskar', exact: true}).waitFor();
    assert.deepEqual(await dealerCards.locator('button').evaluateAll(rows => rows.map(row => [row.getAttribute('aria-label'), row.disabled])), [
      ['Välj Nora', false], ['Välj Oskar', false],
      ...['Astrid', 'Mårten', 'Dragge', 'Anna'].map(name => [name + ' – inte tillgänglig i valt spelrum', true]),
    ], 'published dealers first, then disabled teasers');
    assert.ok(portraitRequests.has('/admin/_assets/lobby/images/dealers/astrid.jpg'));
    for (const [name, close] of [['Nora', 'Escape'], ['Oskar', 'button']]) {
      const trigger = page.getByRole('button', {name: 'Välj ' + name, exact: true});
      await trigger.focus(); await trigger.press('Enter');
      const dialog = page.getByRole('dialog', {name, exact: true});
      await dialog.waitFor({state: 'visible'});
      assert.equal(await dialog.getByRole('link', {name: 'Spela med ' + name}).getAttribute('href'),
        '/play/blackjack?operator=alpha&table=shared-room&dealer=' + name.toLowerCase());
      const closeButton = dialog.getByRole('button', {name: 'Stäng', exact: true});
      assert.equal(await closeButton.evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await dialog.getByRole('link').evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await closeButton.evaluate(element => element === document.activeElement), true);
      if (close === 'Escape') await page.keyboard.press('Escape');
      else await dialog.getByRole('button', {name: 'Stäng', exact: true}).click();
      await dialog.waitFor({state: 'detached'});
      await page.waitForFunction(label => document.activeElement?.getAttribute('aria-label') === label, 'Välj ' + name);
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    }
    // Use the real lobby components with a synthetic published room; no live game or media.
    const table1='11111111-1111-4111-8111-111111111111',table2='22222222-2222-4222-8222-222222222222';
    const back1='33333333-3333-4333-8333-333333333333',back2='44444444-4444-4444-8444-444444444444';
    Object.assign(pack.rooms[0].dealers[0],{presentation:'local',independentLayers:true,
      table:{enabled:true,default:table1,allowed:[{id:table1,label:'Grönt bord'},{id:table2,label:'Blått bord'}]},
      background:{enabled:true,mode:'video',default:back1,allowed:[{id:back1,label:'Lounge'},{id:back2,label:'Terrass'}]}});
    await page.goto(origin+'/lobby?operator=alpha&room=shared-room');
    await page.getByRole('button',{name:'Välj Nora',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'Nora',exact:true});
    await dialog.getByLabel('Bord',{exact:true}).selectOption(table2);
    await dialog.getByLabel('Bakgrund',{exact:true}).selectOption(back2);
    assert.equal(new URL(page.url()).searchParams.get('tableAsset'),table2);
    assert.equal(new URL(page.url()).searchParams.get('background'),back2);
    assert.equal(await page.evaluate(()=>localStorage.getItem('croupier.choices.alpha')),null,'no preference writes before launch');
    await page.reload();
    await page.getByLabel('Bord',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Bord',{exact:true}).inputValue(),table2);
    assert.equal(await page.getByLabel('Bakgrund',{exact:true}).inputValue(),back2);
    await page.getByRole('button',{name:'Välj Nora',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Nora',exact:true});
    assert.equal(await dialog.getByLabel('Bord',{exact:true}).inputValue(),table2,'reopening must retain the current chosen table');
    await dialog.getByRole('link',{name:'Spela med Nora',exact:true}).click();
    await page.waitForURL('**/play/blackjack?operator=alpha&table=shared-room&dealer=nora');
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('croupier.choices.alpha'))),{dealer:'nora',tableAsset:table2,background:back2});
    await page.getByRole('link',{name:'Till lobbyn',exact:true}).click();
    await page.getByLabel('Bord',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Bord',{exact:true}).inputValue(),table2,'return uses still-allowed saved choice');
    for(const [link,title]of [['Min profil','Egen profil'],['Historik','Egen historik']]){
      await page.getByRole('link',{name:link,exact:true}).click();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      await page.getByRole('link',{name:'Till spellobbyn',exact:true}).click();
      await page.waitForURL('**/lobby');
    }
    // Explicit empty choices override stored preferences when the publication has nullable defaults.
    pack.rooms[0].dealers[0].table.default=null;pack.rooms[0].dealers[0].background.default=null;
    await page.goto(origin+'/lobby?operator=alpha&room=shared-room&dealer=nora');
    await page.getByLabel('Bord',{exact:true}).selectOption('');
    await page.getByLabel('Bakgrund',{exact:true}).selectOption('');
    assert.equal(await page.getByLabel('Bord',{exact:true}).inputValue(),'');
    await page.reload();await page.getByLabel('Bord',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Bord',{exact:true}).inputValue(),'');
    assert.equal(await page.getByLabel('Bakgrund',{exact:true}).inputValue(),'');
    await page.goto(origin+'/lobby?operator=alpha&room=foreign-room&dealer=nora');
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('a[href^="/play/blackjack"]').count(),0);
    await page.goto(origin+'/lobby?operator=alpha&operator=beta&room=shared-room&dealer=nora');
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('a[href^="/play/blackjack"]').count(),0);
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  });

test('shared room command transport routes only its exact HTTP path through the existing signed backend', () => {
  const config = platformConfiguration({ CROUPIER_VERCEL_UI: '1', CROUPIER_BACKEND_ORIGIN: 'https://engine.example',
    CROUPIER_PUBLIC_ORIGIN: 'https://www.example.com', CROUPIER_LAB_UI_ORIGIN: 'https://studio.example',
    CROUPIER_VERCEL_INGRESS_SECRET: 'a'.repeat(40) });
  const path = '/api/shared-room/room-1/command';
  assert.equal(backendPlatformPath(path), true);
  assert.deepEqual(platformRoute(new URL(path, config.publicOrigin), config), { kind: 'backend', destination: config.backendOrigin + path });
  const headers = platformBackendHeaders(new Headers({ cookie: 'player_session=browser', origin: config.publicOrigin,
    'x-croupier-vercel-secret': 'forged', 'x-croupier-public-origin': 'forged' }), config);
  assert.equal(headers.get('cookie'), 'player_session=browser'); assert.equal(headers.get('origin'), config.publicOrigin);
  assert.equal(headers.get('x-croupier-vercel-secret'), config.secret); assert.equal(headers.get('x-croupier-public-origin'), config.publicOrigin);
  for (const invalid of ['/api/shared-room', '/api/shared-room/', path + '/', path + '?actorId=other', path + '#part',
    '/api/shared-room/ROOM/command', '/api/shared-room/%72oom-1/command', '/api/shared-room/%2572oom-1/command',
    '/api/shared-room//room-1/command', '/api/shared-room/' + 'a'.repeat(129) + '/command', '/api/shared-room/room-1/other']) {
    assert.equal(backendPlatformPath(invalid), false, invalid);
    assert.notEqual(platformRoute(new URL(invalid, config.publicOrigin), config).kind, 'backend', invalid);
  }
});