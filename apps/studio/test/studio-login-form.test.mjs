import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as login from '../lib/studio-login-client.mjs';
import { createStudioNativeAuthActions } from '../lib/studio-native-auth-actions.mjs';

const require = createRequire(import.meta.url), { transformSync } = require('next/dist/build/swc');
const compile = (source, filename) => transformSync(source, { filename,
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' } }).code;
const compiled = compile(readFileSync(new URL('../components/studio-login.tsx', import.meta.url), 'utf8'), 'studio-login.tsx');
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require: name => name.endsWith('.module.css')
  ? { __esModule: true, default: {} } : name === '../lib/studio-login-client.mjs' ? login : require(name), fetch, URL }, { filename: 'studio-login.tsx' });
const propsFor = (authBase, mode = 'login') => ({ authBase, mode, resetAvailable: true,
  returnTo: '/studio/admin/drift', token: mode === 'set-password' ? 't'.repeat(48) : null });
const ssr = props => renderToString(React.createElement(module.exports.StudioLogin, props));

test('installed React SSR renders every auth form as exact POST with all controls disabled before hydration', () => {
  for (const authBase of ['/api/auth', '/studio/api/auth']) for (const mode of ['login', 'set-password']) {
    const html = ssr(propsFor(authBase, mode)), forms = [...html.matchAll(/<form\b[^>]*>/g)];
    assert.equal(forms.length, mode === 'login' ? 2 : 1);
    for (const form of forms) { assert.match(form[0], /method="post"/); assert.match(form[0], new RegExp(`action="${authBase}/(?:login|reset-request|set-password)"`)); }
    for (const control of html.matchAll(/<(?:input|button)\b[^>]*>/g)) assert.match(control[0], /disabled=""/);
    assert.match(html, /aria-busy="true"/); assert.match(html, /role="status"/); assert.match(html, /<noscript>/);
    assert.doesNotMatch(html, /name="token"|tttttttt|formmethod="get"/);
  }
});

test('unhydrated browser POST fallback is rejected as non-JSON before auth, rate-limit or mail work', async () => {
  const actions = createStudioNativeAuthActions({ boDb: { prepare: () => assert.fail('no SQL work'), transaction: () => assert.fail('no transaction work') }, scope: { environment: 'fixture', workspaceId: 'croupier' },
    publicOrigin: 'https://login.fixture.invalid', allowedOrigins: ['https://login.fixture.invalid'],
    authorize: () => assert.fail('no auth work'), rateLimit: () => assert.fail('no rate-limit work'),
    clientAddress: () => assert.fail('no client work'), mail: { send: () => assert.fail('no mail work') } });
  for (const action of ['login', 'reset-request', 'set-password']) {
    const response = await actions.handle(new Request(`https://login.fixture.invalid/studio/api/auth/${action}`, {
      method: 'POST', headers: { Origin: 'https://login.fixture.invalid', 'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded' }, body: 'user=synthetic&pass=fixture-only' }));
    assert.equal(response.status, 415); assert.doesNotMatch(await response.text(), /fixture-only|synthetic/);
  }
});

// Optional actual browser lifecycle fixture. It uses installed production React
// modules and intercepted synthetic origins; no devserver or external request.
// CI without browser dependencies still executes the actual SSR/API tests above.
const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
function browserSources() {
  const readCjs = (packageName, name) => readFileSync(join(dirname(require.resolve(packageName + '/package.json')), 'cjs', name), 'utf8');
  return {
    react: readCjs('react', 'react.production.js'),
    'react/jsx-runtime': readCjs('react', 'react-jsx-runtime.production.js'),
    'react-dom': readCjs('react-dom', 'react-dom.production.js'),
    'react-dom/client': readCjs('react-dom', 'react-dom-client.production.js'),
    scheduler: readCjs('scheduler', 'scheduler.production.js'),
    '../lib/studio-login-client.mjs': compile(readFileSync(new URL('../lib/studio-login-client.mjs', import.meta.url), 'utf8'), 'studio-login-client.mjs'),
    ...Object.fromEntries(['design-preview-paths', 'partner-login-return'].map(name =>
      ['./' + name + '.mjs', compile(readFileSync(new URL('../lib/' + name + '.mjs', import.meta.url), 'utf8'), name + '.mjs')])),
    ...Object.fromEntries(['workspace-surfaces', 'control-flow', 'admin-workspace-routes'].map(name =>
      ['../../../packages/navigation/' + name + '.mjs', compile(readFileSync(new URL('../../../packages/navigation/' + name + '.mjs', import.meta.url), 'utf8'), name + '.mjs')])),
    './admin-workspace-routes.mjs': compile(readFileSync(new URL('../../../packages/navigation/admin-workspace-routes.mjs', import.meta.url), 'utf8'), 'admin-workspace-routes.mjs'),
    './operator-slug.mjs': compile(readFileSync(new URL('../../../packages/navigation/operator-slug.mjs', import.meta.url), 'utf8'), 'operator-slug.mjs'),
    './studio-login.module.css': 'module.exports={__esModule:true,default:{}};',
    component: compiled,
  };
}
function fixtureRequire(sources) {
  const cache = {}, process = {env:{NODE_ENV:'production'}};
  function require(name) {
    if (cache[name]) return cache[name].exports;
    if (!Object.hasOwn(sources,name)) throw Error('Unknown browser fixture module: ' + name);
    const module = cache[name] = {exports:{}};
    new Function('module','exports','require','process',sources[name])(module,module.exports,require,process);
    return module.exports;
  }
  return require;
}
function browserBootstrap(props) {
  return '(() => { const require=(' + fixtureRequire.toString() + ')(' + JSON.stringify(browserSources()) + ');' +
    'window.fixtureHydrate=()=>require("react-dom/client").hydrateRoot(document.getElementById("root"),' +
    'require("react").createElement(require("component").StudioLogin,' + JSON.stringify(props) + ')); })();';
}

async function buildAdminBrowserFixture(root) {
  const { build } = await import('esbuild'), { writeFile } = await import('node:fs/promises');
  const source = fileURLToPath(new URL('../client/', import.meta.url));
  // An isolated worktree may read already-installed, identically locked modules.
  // Compile its own real Admin source; never reuse a possibly stale app bundle.
  const modules = process.env.CROUPIER_DESIGN_FIXTURE_MODULES || join(source,'node_modules');
  assert.equal(readFileSync(join(dirname(modules),'package-lock.json'),'utf8') === readFileSync(join(source,'package-lock.json'),'utf8'),true,
    'Admin fixture dependencies must match this checkout lockfile');
  const result = await build({entryPoints:[join(source,'admin/entry.tsx')],outfile:join(root,'admin/app.js'),
    bundle:true,write:false,minify:true,platform:'browser',target:'es2022',jsx:'automatic',logLevel:'error',
    nodePaths:[modules],external:['/composition-runtime/compositor.js'],
    define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'"/studio"'},
    alias:{react:join(modules,'react'),'react-dom':join(modules,'react-dom'),'@':join(source,'admin'),
      'next/link':join(source,'runtime/navigation.tsx'),'next/navigation':join(source,'runtime/navigation.tsx'),'next/image':join(source,'runtime/image.ts')},
  });
  for (const output of result.outputFiles) await writeFile(output.path,output.contents);
  // This is functional context acceptance, not a visual/CSS acceptance fixture.
  await writeFile(join(root,'admin/index.html'),'<!doctype html><html lang="sv"><head><meta charset="utf-8"><link rel="stylesheet" href="/admin/_assets/admin/app.css">' +
    '<style>.studio-canvas{height:480px}[hidden]{display:none!important}</style></head><body><div id="root"></div><script src="/admin/_assets/admin/app.js" defer></script></body></html>');
}

test('browser fixture loads the real login component and every return-path dependency without a browser', () => {
  const load = fixtureRequire(browserSources()), client = load('../lib/studio-login-client.mjs');
  assert.equal(typeof load('component').StudioLogin, 'function');
  for (const target of ['/admin/clips?operator=north&table=room-7&composition=scene-7&dealer=vera&game=roulette',
    '/control/preview?operator=north&lane=scene-7', '/control/administration?tab=operations&operator=north&room=room-7#status',
    '/partner/north/rooms?room=vip-room']) {
    assert.equal(client.studioLoginReturnTo(target), login.studioLoginReturnTo(target));
    assert.equal(client.studioLoginDestination(target), login.studioLoginDestination(target));
  }
});

test('actual browser cold Enter/submit stays inert and hydrated forms use JSON POST only', { skip: !browserModule }, async () => {
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL ? { channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL } : {}) });
  try {
    for (const authBase of ['/api/auth', '/studio/api/auth']) for (const mode of ['login', 'set-password']) {
      const props = propsFor(authBase, mode), requests = [], context = await browser.newContext();
      try {
        const page = await context.newPage(); const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://login.fixture.invalid/**', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.pathname === '/admin/login') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<div id="root">${ssr(props)}</div>` });
          requests.push({ path: url.pathname, search: url.search, method: request.method(), contentType: request.headers()['content-type'], body: request.postData() });
          return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"fixture-denied"}' });
        });
        await page.goto('https://login.fixture.invalid/admin/login');
        assert.equal(await page.locator('form:not(details form) input:enabled').count(), 0);
        assert.equal(await page.locator('form:not(details form) button:enabled').count(), 0);
        assert.deepEqual(await page.locator('form').evaluateAll(forms => forms.map(form => [...new FormData(form).keys()])), mode === 'login' ? [[], []] : [[]]);
        await page.keyboard.press('Enter'); await page.waitForTimeout(30); assert.equal(requests.length, 0);
        // Even a forced native submit uses the exact internal POST fallback.
        // Disabled controls contribute no password/user/token to FormData.
        const coldPost = page.waitForResponse(response => response.url().includes(authBase));
        await page.locator('form').first().evaluate(form => form.requestSubmit()); await coldPost;
        await page.waitForURL(url => url.pathname === `${authBase}/${mode}`, { waitUntil: 'load' });
        assert.equal(requests.length, 1); assert.equal(requests[0].method, 'POST'); assert.equal(requests[0].search, '');
        assert.equal(requests[0].body ?? '', '');
        await page.goto('https://login.fixture.invalid/admin/login'); requests.length = 0;
        await page.addScriptTag({ content: browserBootstrap(props) }); await page.evaluate(() => window.fixtureHydrate());
        await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false);
        const form = page.locator('form').first();
        if (mode === 'login') await form.locator('[name="user"]').fill('synthetic');
        await form.locator('[name="pass"]').fill('fixture-password-only');
        if (mode === 'set-password') await form.locator('[name="confirm"]').fill('fixture-password-only');
        await form.locator('[name="pass"]').press('Enter');
        await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('Inloggningen') || document.querySelector('[role="status"]')?.textContent?.includes('Åtgärden'));
        assert.equal(requests.length, 1); assert.equal(requests[0].method, 'POST'); assert.equal(requests[0].search, '');
        assert.equal(requests[0].path, `${authBase}/${mode}`); assert.equal(requests[0].contentType, 'application/json');
        assert.equal(JSON.parse(requests[0].body).pass, 'fixture-password-only');
        assert.equal(await form.locator('[name="pass"]').inputValue(), '');
        if (mode === 'login') {
          await page.locator('summary').click(); const reset = page.locator('details form');
          await reset.locator('input').fill('synthetic'); const resetResponse=page.waitForResponse(response => response.url().endsWith('/reset-request'));
          await reset.locator('input').press('Enter'); await resetResponse;
          await page.waitForFunction(() => document.querySelector('details button')?.disabled === false);
          assert.equal(requests.length, 2); assert.equal(requests[1].path, `${authBase}/reset-request`);
          assert.equal(requests[1].method, 'POST'); assert.equal(requests[1].search, '');
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('actual browser expired Admin login restores the real room view through history and reload', { skip: !browserModule }, async () => {
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const { createPgliteStore } = await import('../../../test/fixtures/pglite-pool.mjs');
  const { scryptSync } = await import('node:crypto');
  const { mkdtemp, mkdir, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { createStudioNativeAuth } = await import('../../../packages/studio-access/studio-native-auth.mjs');
  const { assertNativeStudioRequest } = await import('../lib/studio-native-runtime.mjs');
  const { createSeedProject, defaultPresentationLane, validateProject, addDealer } = await import('../../../packages/presentation/contracts/studio-model.mjs');
  const catalog = await import('../lib/design-preview-catalog.mjs');
  const nextPage = await import('../lib/next-page-navigation.mjs');
  const preview = await import('../lib/design-preview.mjs');
  const publicOrigin = 'https://admin.fixture.invalid', labOrigin = 'https://studio.fixture.invalid';
  const config = { allowedOrigins:[publicOrigin,labOrigin], publicHosts:['admin.fixture.invalid','studio.fixture.invalid'],
    apiBase:'/studio/api/admin', authBase:'/studio/api/auth' };
  const expectedContext = {operator:'fixture-operator',table:'fixture-room-7',composition:'fixture-scene',dealer:'linnea',game:'roulette'};
  const expectedLabels = {operator:'C4 valt bolag',room:'C4 valt rum',composition:'C4 vald sammansättning',dealer:'Linnea'};
  // The dealer nav owns the dealer in its path; the room context travels in the query (Admin nivå 1).
  const {dealer:dealerId,...roomContext} = expectedContext;
  const expectedQuery = {flik:'klipp',...roomContext};
  const target = '/admin/dealers/' + dealerId + '?' + new URLSearchParams(expectedQuery);
  const project = addDealer(createSeedProject(),'linnea','Linnea');
  project.lanes = [{...defaultPresentationLane('astrid'),id:'fixture-default-scene',label:'C4 annan sammansättning'},
    {...defaultPresentationLane('linnea'),id:expectedContext.composition,label:expectedLabels.composition}];
  validateProject(project);
  const room = {schemaVersion:2,id:expectedContext.table,name:expectedLabels.room,operatorId:expectedContext.operator,
    presentationLaneId:expectedContext.composition,gameLaneId:'fixture-game-lane',game:expectedContext.game,state:'preview'};
  const administration = {rooms:[{...room,id:'fixture-other-company-room',operatorId:'fixture-first-operator',presentationLaneId:'fixture-default-scene',name:'C4 annat bolags rum'},
    {...room,id:'fixture-first-room',presentationLaneId:'fixture-default-scene',name:'C4 annat rum'},room]};
  assert.notEqual(room.id,room.presentationLaneId);
  async function assertRoomView(page) {
    const studio = page.getByRole('region',{name:'Klippkarta för vald dealer'});
    // The nav owns the dealer: the map names it, never offers it as a choice; the room context is chosen under Spelbord och publicering.
    await studio.locator('.studio-primary-context').getByText(expectedLabels.dealer,{exact:true}).waitFor();
    await studio.locator('summary').filter({hasText:'Spelbord och publicering'}).click();
    const choices = [['Bolag',expectedContext.operator,expectedLabels.operator],['Spel',expectedContext.game,'Roulette'],['Spelbord',expectedContext.table,expectedLabels.room]];
    for (const [name,value,label] of choices) {
      const select = studio.getByRole('combobox',{name,exact:true});await select.waitFor();
      assert.equal(await select.inputValue(),value,name + ' must come from the returned stored room context');
      assert.equal(await select.locator('option:checked').textContent(),label);
      assert.equal(await select.isEnabled(),true);
    }
    assert.equal(new URL(page.url()).pathname,'/admin/dealers/' + dealerId);
    assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams),expectedQuery);
  }
  // Scenmallar and back are in-app navigations of the same Admin document; the dealer and the room context travel with them.
  async function assertSceneRoundTrip(page) {
    const studio = page.getByRole('region',{name:'Klippkarta för vald dealer'});
    const publicationRead = page.waitForResponse(response => new URL(response.url()).pathname === '/studio/api/partner/branding');
    await studio.getByRole('link',{name:'Öppna i Scenmallar',exact:true}).click();
    await page.waitForURL(url=>url.pathname==='/admin/scenes');
    assert.equal(new URL(page.url()).pathname,'/admin/scenes');
    assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams),{tab:'mallar',...expectedContext},'Scenmallar keeps the dealer and the room context');
    const scene = page.getByRole('region',{name:'Sceneditor',exact:true});
    const composition = page.getByRole('region',{name:'Gemensam sammansättningsmall',exact:true});
    await composition.getByRole('heading',{name:expectedLabels.composition,exact:true}).waitFor();
    assert.equal(await composition.getByRole('listitem').filter({hasText:expectedLabels.operator + ' · ' + expectedLabels.room}).textContent(),expectedLabels.operator + ' · ' + expectedLabels.room);
    assert.equal(await composition.getByRole('combobox',{name:'Förvald dealer',exact:true}).inputValue(),expectedContext.dealer);
    assert.equal((await publicationRead).status(),404,'the fixture operator has no published package');
    assert.equal(await scene.getByRole('button',{name:'Spara utkast',exact:true}).isDisabled(),true,'opening the scene must not create a draft');
    await scene.getByRole('link',{name:'Till klippkartan',exact:true}).click();
    await page.waitForURL(publicOrigin + target);
    assert.equal(await studio.getByRole('button',{name:'Spara utkast',exact:true}).isDisabled(),true,'reading the room must not create a draft');
  }
  const unexpected = () => assert.fail('fixture must not access another runtime or data source');
  const load = (path, overrides) => {
    const url = new URL(path, import.meta.url), module = {exports:{}}, localRequire = createRequire(url);
    vm.runInNewContext(compile(readFileSync(url,'utf8'),url.pathname), {
      module,exports:module.exports,Request,Headers,URL,process:{env:{CROUPIER_LAB_BASE_PATH:'/studio'}},
      require:name => Object.hasOwn(overrides,name) ? overrides[name] : localRequire(name),
    });
    return module.exports;
  };
  const root = await mkdtemp(join(tmpdir(), 'croupier-admin-login-'));
  let browser;
  try {
    await mkdir(join(root,'admin'));
    await buildAdminBrowserFixture(root);
    browser = await chromium.launch({headless:true, ...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL ? {channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL} : {})});
    for (const prefix of ['', '/studio']) {
      // The engine's PostgreSQL schema on PGlite for credentials; Studio documents stay in-memory fixture rows.
      const database = await createPgliteStore(), boDb = database.boDb;
      const context = await browser.newContext();
      try {
        const pass = 'Isolated-Admin-Login-Only', salt = 'fixture-salt', clock = {now:Date.now() - 8 * 86400_000};
        await boDb.prepare('INSERT INTO users (id,username,email,role,salt,hash,created_at) VALUES (?,?,?,?,?,?,?)').run(7,'Operator','operator@example.invalid','superadmin',salt,scryptSync(pass,salt,64).toString('hex'),'fixture');
        await boDb.prepare('INSERT INTO meta VALUES (?,?)').run('jwt_secret','a'.repeat(64));
        await boDb.prepare('INSERT INTO bo_auth_epochs VALUES (?,?)').run(7,2);
        const operators = [], documents = new Map();
        const insertOperator = {run:(id,slug,name,status)=>operators.push({id,slug,name,status})};
        insertOperator.run('fixture-first-operator','fixture-first-operator','C4 annat bolag','active');
        insertOperator.run(expectedContext.operator,expectedContext.operator,expectedLabels.operator,'active');
        const insertDocument = {run:(kind,document)=>documents.set(kind,document)};
        for (const [kind,value] of Object.entries({project,administration,inventory:{videos:[],families:[]}})) insertDocument.run(kind,JSON.stringify(value));
        const readDocument = kind => JSON.parse(documents.get(kind));
        const storedDocuments = () => [...documents].sort(([a],[b])=>a.localeCompare(b)), storedBefore = storedDocuments();
        const store = {listOperators:async()=>operators.map(row=>({...row})),getCurrentPackage:async()=>null};
        const policy = {readSaved:async()=>({project:readDocument('project'),administration:readDocument('administration'),
          projectRevision:project.revision,administrationRevision:'fixture-administration-7'})};
        const scope = {environment:'fixture',workspaceId:'croupier'};
        const authorize = createStudioNativeAuth({boDb,scope,now:()=>clock.now});
        const actions = createStudioNativeAuthActions({boDb,gameDb:database.db,scope,authorize,publicOrigin,allowedOrigins:config.allowedOrigins,
          now:()=>clock.now,rateLimit:()=>true,clientAddress:()=> 'isolated-admin-browser',mail:{send:unexpected}});
        // Expire only a cookie signed by this in-memory fixture. No logout or
        // shared account/session mutation is involved in reaching the login page.
        const expired = await actions.handle(new Request(publicOrigin + '/studio/api/auth/login', {method:'POST',
          headers:{'content-type':'application/json',origin:publicOrigin,'sec-fetch-site':'same-origin'},
          body:JSON.stringify({user:'operator',pass,returnTo:target})}));
        assert.equal(expired.status,200);
        const expiredToken = expired.headers.get('set-cookie').match(/^bo_jwt=([^;]+)/)[1];
        clock.now += 8 * 86400_000;
        await context.addCookies([{name:'bo_jwt',value:expiredToken,domain:'admin.fixture.invalid',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
        const runtime = {nativeStudioAdminEnabled:()=>true,nativeStudioAdminConfiguration:()=>config,assertNativeStudioRequest,
          studioNativeRuntime:async()=>({authorize,readDesignCatalog:()=>catalog.registeredDesignCatalog({store,policy})})};
        const guard = load('../lib/ui-server.ts', {
          './studio-native-runtime.mjs':runtime,'./next-page-navigation.mjs':nextPage,
          './studio-server.mjs':{studioInitialData:unexpected},'./remote-ui.mjs':{remoteUiConfiguration:unexpected},
        });
        const admin = load('../app/admin/[[...path]]/route.ts', {
          '../../../lib/ui-server':guard,'../../../lib/studio-native-runtime.mjs':runtime,
          '../../../lib/design-preview-catalog.mjs':catalog,
          '../../../lib/design-preview.mjs':{...preview,serveDesignPreview:(request,path,options)=>preview.serveDesignPreview(request,path,{...options,root})},
        });
        const failures = [], documentStatuses = [], posts = [], dataReads = [];
        await context.route('**/*', async route => {
          try {
            const request = route.request(), url = new URL(request.url());
            assert.equal(url.origin,publicOrigin,'fixture intercept forbids unexpected origins');
            const headers = new Headers(await request.allHeaders());headers.set('host',url.host);
            if (request.method() === 'POST' && !headers.has('sec-fetch-site')) {
              assert.equal(new URL(request.frame().url()).origin,url.origin);assert.equal(headers.get('origin'),url.origin);
              headers.set('sec-fetch-site','same-origin');
            }
            if (url.pathname === '/admin/login') {
              const page = load('../app/admin/login/page.tsx', {
                '@/components/studio-login':module.exports,'@/lib/studio-native-runtime.mjs':runtime,
                '@/lib/studio-login-client.mjs':login,'@/lib/next-page-navigation.mjs':nextPage,'next/headers':{headers:async()=>headers},
              });
              const tree = await page.default({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))});
              assert.equal(tree.props.returnTo,target);
              return route.fulfill({contentType:'text/html; charset=utf-8',body:'<div id="root">' + ssr(tree.props) + '</div><script>' + browserBootstrap(tree.props) + ';window.fixtureHydrate();</script>'});
            }
            if (url.pathname === '/studio/api/auth/login') {
              posts.push(url.pathname);assert.equal(JSON.parse(request.postData()).returnTo,target);
              const response = await actions.handle(new Request(url,{method:request.method(),headers,body:request.postData()}));
              assert.equal(response.status,200,'real native fixture login succeeds');
              return route.fulfill({status:response.status,headers:{...Object.fromEntries(response.headers),'set-cookie':response.headers.getSetCookie().join('\n')},body:await response.text()});
            }
            assert.equal(request.method(),'GET','only login may write in this fixture');
            if (['/studio/api/project','/studio/api/videos'].includes(url.pathname)) {
              assert.equal((await authorize(new Request(url,{headers}))).role,'admin');
              assert.equal(url.search,'');dataReads.push(url.pathname);
              return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/project')?{project:readDocument('project')}:readDocument('inventory'))});
            }
            if (url.pathname === '/studio/api/partner/branding') {
              assert.equal((await authorize(new Request(url,{headers}))).role,'admin');
              assert.deepEqual(Object.fromEntries(url.searchParams),{operator:expectedContext.operator});
              assert.equal(await store.getCurrentPackage(expectedContext.operator),null);
              dataReads.push(url.pathname);
              return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Not found'})});
            }
            // Decorative lobby portraits (scene template cards, avatars) are static artwork, not data; not served here.
            if (/^\/admin\/_assets\/lobby\/images\/(?:dealers|lobby)\/[a-z-]+\.(?:jpg|png)$/.test(url.pathname)) return route.fulfill({status:404,body:''});
            // The documents are the dealer nav (the login return) and Scenmallar; the page itself navigates between them.
            const navDocument = ['/admin/dealers/' + dealerId,'/studio/admin/dealers/' + dealerId].includes(url.pathname);
            const document = navDocument || ['/admin/scenes','/studio/admin/scenes'].includes(url.pathname);
            assert.ok(document || ['/admin/_data/catalog','/admin/_assets/admin/app.js','/admin/_assets/admin/app.css'].includes(url.pathname),'only real Admin fixture routes and assets are served: ' + url.pathname);
            if (navDocument) assert.equal(url.search,new URL(target,publicOrigin).search); else if (!document) assert.equal(url.search,'');
            const path = url.pathname.replace(/^\/(?:studio\/)?admin\//,'').split('/');
            const response = await admin.GET(new Request(url,{headers}),{params:Promise.resolve({path})});
            if (document) documentStatuses.push(response.status);
            if (url.pathname === '/admin/_data/catalog') dataReads.push(url.pathname);
            assert.equal(response.headers.get('cache-control'),'private, no-store');
            assert.equal(response.headers.get('vary'),'Cookie');
            if (response.status === 307) {
              const destination = response.headers.get('location');
              assert.equal(destination,publicOrigin + '/admin/login?returnTo=' + encodeURIComponent(target));
              // Like the handoff fixture above, replay the redirect receipt as a
              // new navigation so Playwright intercepts every synthetic request.
              // This shim has its own HTML policy; it does not test redirect CSP.
              return route.fulfill({contentType:'text/html',body:'<script>location.replace(' + JSON.stringify(destination) + ')</script>'});
            }
            assert.equal(response.status,200);
            return route.fulfill({status:200,headers:Object.fromEntries(response.headers),body:await response.text()});
          } catch(error) {failures.push(error);await route.fulfill({status:500,body:'Isolated Admin fixture failed'});}
        });
        const page = await context.newPage();page.setDefaultTimeout(10_000);page.on('pageerror',error=>failures.push(error));
        try {
          await page.goto(publicOrigin + prefix + target);
          await page.waitForURL(publicOrigin + '/admin/login?returnTo=' + encodeURIComponent(target));
          assert.deepEqual(documentStatuses,[307]);
          const form = page.locator('form').first();
          await form.locator('[name="user"]').fill('operator');await form.locator('[name="pass"]').fill(pass);await form.locator('button').click();
          await page.waitForURL(publicOrigin + target);
          await assertRoomView(page);
          await page.goBack();await page.waitForURL(publicOrigin + '/admin/login?returnTo=' + encodeURIComponent(target));
          await page.goForward();await page.waitForURL(publicOrigin + target);await assertRoomView(page);
          const readsBeforeReload = dataReads.length;
          await page.reload();await assertRoomView(page);
          // The clip map reads the catalog, the project and the videos; the company's publication is read in Scenmallar only.
          assert.deepEqual(dataReads.slice(readsBeforeReload).sort(),['/admin/_data/catalog','/studio/api/project','/studio/api/videos']);
          const readsBeforeScene = dataReads.length;
          await assertSceneRoundTrip(page);
          assert.deepEqual(dataReads.slice(readsBeforeScene),['/studio/api/partner/branding'],'Scenmallar reads the publication once, without rereading the project');
          assert.deepEqual(posts,['/studio/api/auth/login']);assert.ok(documentStatuses.slice(1).every(status=>status===200));
          assert.deepEqual(storedDocuments(),storedBefore,'room inspection does not mutate saved data');
          const cookies = await context.cookies(), cookie = cookies.find(item=>item.name==='bo_jwt');
          assert.ok(cookie);assert.notEqual(cookie.value,expiredToken);assert.equal(cookie.domain,'admin.fixture.invalid');
          assert.equal(cookie.secure,true);assert.equal(cookie.httpOnly,true);assert.equal(cookies.some(item=>item.domain==='studio.fixture.invalid'),false);
          assert.equal((await authorize(new Request(publicOrigin + target,{headers:{cookie:'bo_jwt=' + cookie.value}}))).role,'admin');
          assert.equal((await boDb.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(7)).epoch,2);
          assert.deepEqual(failures,[]);
        } catch(error) {throw failures[0] ?? error;}
      } finally {await context.close();await database.close();}
    }
  } finally {await browser?.close();assert.equal(dirname(root),tmpdir());await rm(root,{recursive:true,force:true});}
});
