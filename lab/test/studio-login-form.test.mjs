import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
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
  returnTo: '/studio/administration', token: mode === 'set-password' ? 't'.repeat(48) : null });
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
function browserBootstrap(props) {
  const readCjs = (packageName, name) => readFileSync(join(dirname(require.resolve(`${packageName}/package.json`)), 'cjs', name), 'utf8');
  const modules = {
    react: readCjs('react', 'react.production.js'),
    'react/jsx-runtime': readCjs('react', 'react-jsx-runtime.production.js'),
    'react-dom': readCjs('react-dom', 'react-dom.production.js'),
    'react-dom/client': readCjs('react-dom', 'react-dom-client.production.js'),
    scheduler: readCjs('scheduler', 'scheduler.production.js'),
    '../lib/studio-login-client.mjs': compile(readFileSync(new URL('../lib/studio-login-client.mjs', import.meta.url), 'utf8'), 'studio-login-client.mjs'),
    './studio-administration.module.css': 'module.exports={__esModule:true,default:{}};',
    component: compiled,
  };
  return `(() => { const sources=${JSON.stringify(modules)},cache={},process={env:{NODE_ENV:'production'}};
    function require(name){if(cache[name])return cache[name].exports;const m=cache[name]={exports:{}};
      new Function('module','exports','require','process',sources[name])(m,m.exports,require,process);return m.exports;}
    window.fixtureHydrate=()=>require('react-dom/client').hydrateRoot(document.getElementById('root'),
      require('react').createElement(require('component').StudioLogin,${JSON.stringify(props)})); })();`;
}
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
          if (url.pathname === '/login') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<div id="root">${ssr(props)}</div>` });
          requests.push({ path: url.pathname, search: url.search, method: request.method(), contentType: request.headers()['content-type'], body: request.postData() });
          return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"fixture-denied"}' });
        });
        await page.goto('https://login.fixture.invalid/login');
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
        await page.goto('https://login.fixture.invalid/login'); requests.length = 0;
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

test('actual browser canonical login keeps host-only BO cookies with signed game and Lab handoffs', { skip: !browserModule }, async () => {
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const { DatabaseSync } = await import('node:sqlite');
  const { scryptSync } = await import('node:crypto');
  const { craigIdentity } = await import('../../web/craig-identity.mjs');
  const { playerAuth } = await import('../../web/player-auth.mjs');
  const { backofficeGameAuth } = await import('../../web/bo-game-auth.mjs');
  const { backofficeLabAuth } = await import('../../web/bo-lab-auth.mjs');
  const { createStudioNativeAuth } = await import('../lib/studio-native-auth.mjs');
  const { nextStudioAuthEntryRedirect } = await import('../lib/next-page-navigation.mjs');
  const navigation = require('next/dist/client/components/redirect.js');
  const publicOrigin = 'https://game.fixture.invalid', labOrigin = 'https://studio.fixture.invalid';
  const config = { allowedOrigins:[publicOrigin,labOrigin], publicHosts:['game.fixture.invalid','studio.fixture.invalid'],
    apiBase:'/studio/api/admin',authBase:'/studio/api/auth' };
  const pages = Object.fromEntries(['login','set-password'].map(mode => [mode,
    compile(readFileSync(new URL('../app/' + mode + '/page.tsx', import.meta.url),'utf8'),mode + '.tsx')]));
  async function pageResponse(url, headers) {
    const mode = url.pathname.endsWith('/set-password') ? 'set-password' : 'login', pageModule = {exports:{}};
    const overrides = {
      '@/components/studio-login':module.exports,
      '@/lib/studio-native-runtime.mjs':{ nativeStudioAdminEnabled:()=>true,nativeStudioAdminConfiguration:()=>config },
      '@/lib/studio-login-client.mjs':login, '@/lib/next-page-navigation.mjs':{nextStudioAuthEntryRedirect},
      'next/headers':{headers:async()=>headers},'next/navigation':navigation,
    };
    vm.runInNewContext(pages[mode],{module:pageModule,exports:pageModule.exports,Request,Headers,process:{env:{}},
      require:name=>Object.hasOwn(overrides,name)?overrides[name]:require(name)});
    try {
      const tree = await pageModule.exports.default({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))});
      return {status:200,contentType:'text/html; charset=utf-8',
        body:'<meta name="referrer" content="no-referrer"><div id="root">' + ssr(tree.props) + '</div><script>' + browserBootstrap(tree.props) + ';window.fixtureHydrate();</script>'};
    } catch (error) {
      if (!navigation.getURLFromRedirectError(error)) throw error;
      return {status:navigation.getRedirectStatusCodeFromError(error),headers:{location:navigation.getURLFromRedirectError(error),'referrer-policy':'no-referrer'},body:''};
    }
  }
  const browser = await chromium.launch({ headless:true, ...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL ? {channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL} : {}) });
  try {
    for (const kind of ['game','lab']) for (const entry of ['/login','/studio/login']) {
      const bo = new DatabaseSync(':memory:'), game = new DatabaseSync(':memory:');
      const context = await browser.newContext();
      try {
        bo.exec('CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT,email TEXT,role TEXT,salt TEXT,hash TEXT); CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT); CREATE TABLE bo_auth_epochs(user_id TEXT PRIMARY KEY,epoch INTEGER);');
        const pass = 'Isolated-Studio-Login-Only', salt = 'fixture-salt';
        bo.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('7','Operator','operator@example.invalid','superadmin',salt,scryptSync(pass,salt,64).toString('hex'));
        bo.prepare('INSERT INTO meta VALUES (?,?)').run('jwt_secret','a'.repeat(64));
        bo.prepare('INSERT INTO bo_auth_epochs VALUES (?,?)').run('7',2);
        const adapter = db => ({prepare:sql => db.prepare(sql.replace(/ FOR UPDATE\b/g,'')),transaction:async work => {
          db.exec('BEGIN IMMEDIATE'); try {const result=await work();db.exec('COMMIT');return result;} catch(error){db.exec('ROLLBACK');throw error;}
        }});
        const boDb = adapter(bo), identity = craigIdentity(bo), scope = {environment:'fixture',workspaceId:'croupier'};
        const authorize = createStudioNativeAuth({boDb,scope});
        const boSession = async req => {
          try {await authorize(new Request(publicOrigin + '/studio/api/auth/session',{headers:{cookie:req.headers.cookie || ''}}));}
          catch(error) {if(error.statusCode === 401)return null;throw error;}
          const token = req.headers.cookie.match(/(?:^|;\s*)bo_jwt=([^;]+)/)?.[1];
          return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
        };
        const auth = playerAuth(game,()=>({id:'fixture-player'}),identity);
        const gameHandoff = backofficeGameAuth({db:game,auth,identity,boSession,validLaunch:()=>false,publicUrl:publicOrigin,boUrl:publicOrigin,publicGamePath:'/blackjack'});
        const labHandoff = backofficeLabAuth({db:bo,identity,boSession,authEpoch:id=>bo.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(id)?.epoch ?? 0,
          publicUrl:publicOrigin,boUrl:publicOrigin,labPublicUrl:publicOrigin,singleOrigin:true});
        const actions = createStudioNativeAuthActions({boDb,gameDb:adapter(game),scope,authorize,publicOrigin,allowedOrigins:config.allowedOrigins,
          rateLimit:()=>true,clientAddress:()=> 'isolated-browser',mail:{send:()=>assert.fail('no external mail')}});
        for (const returnTo of ['//attacker.invalid', '/api/bo/game-login?state=' + 'a'.repeat(63),
          '/api/bo/lab-login?state=' + 'a'.repeat(64) + '&next=/studio', ['a'.repeat(64)]]) {
          const rejected = await actions.handle(new Request(publicOrigin + '/studio/api/auth/login', {
            method:'POST',headers:{origin:publicOrigin,'sec-fetch-site':'same-origin','content-type':'application/json'},
            body:JSON.stringify({user:'operator',pass,returnTo}),
          }));
          assert.equal(rejected.status,400);assert.equal(rejected.headers.has('set-cookie'),false);
        }
        const seen = [], failures = [], callbacks = [];
        await context.route('**/*',async route => {
          try {
            const request = route.request(), url = new URL(request.url());
            // Playwright intercepts only the first URL in an HTTP redirect
            // chain. Replay each actual redirect receipt as a new top-level
            // navigation so every synthetic URL stays intercepted; cookies
            // are still parsed and scoped by the actual browser.
            const fulfill = response => {
              if (response.status >= 300 && response.status < 400 && response.headers?.location) {
                const destination = new URL(response.headers.location, url).href;
                const headers = {...response.headers};delete headers.location;
                return route.fulfill({status:200,headers,contentType:'text/html',
                  body:'<script>location.replace(' + JSON.stringify(destination) + ')</script>'});
              }
              return route.fulfill(response);
            };
            assert.ok(config.allowedOrigins.includes(url.origin),'fixture intercept forbids all external requests');
            const rawHeaders = await request.allHeaders(), headers = new Headers(rawHeaders); headers.set('host',url.host);
            // Chromium's intercepted request lacks network-added Fetch Metadata.
            // Bind its fixture value to the actual document and browser Origin.
            if (request.method() === 'POST' && !headers.has('sec-fetch-site')) {
              assert.equal(new URL(request.frame().url()).origin,url.origin);assert.equal(headers.get('origin'),url.origin);
              headers.set('sec-fetch-site','same-origin');
            }
            seen.push({origin:url.origin,path:url.pathname,method:request.method()});
            if (url.pathname === '/login' || url.pathname === '/set-password') {
              // The installed Next config applies these basePath:false aliases
              // before App Router; keep its original search string.
              const rules = await (await import('../next.config.mjs')).default.redirects();
              const rule = rules.find(item=>item.source === url.pathname);
              if (rule) return fulfill({status:307,headers:{location:rule.destination + url.search},body:''});
            }
            if (['/login','/studio/login','/set-password','/studio/set-password'].includes(url.pathname)) return fulfill(await pageResponse(url,headers));
            if (url.pathname === '/studio/api/auth/login') {
              const response = await actions.handle(new Request(url,{method:request.method(),headers,body:request.postData()}));
              assert.equal(response.status,200,'native fixture login succeeds');
              return fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
            }
            if (url.pathname.startsWith('/api/')) {
              const req = {url:url.pathname+url.search,method:request.method(),headers:Object.fromEntries(headers),socket:{encrypted:true,remoteAddress:'127.0.0.1'}};
              let status, responseHeaders, body;
              const res = {writeHead(code,values){status=code;responseHeaders=values;},end(value=''){body=value;}};
              const handled = await gameHandoff(req,res) || await labHandoff(req,res);
              assert.equal(handled,true,'only existing signed callback endpoints are intercepted');
              if (url.pathname.endsWith('/callback')) callbacks.push({url:url.href,status});
              const output = Object.fromEntries(Object.entries(responseHeaders).map(([key,value])=>[key.toLowerCase(),Array.isArray(value)?value.join('\n'):String(value)]));
              return fulfill({status,headers:output,body});
            }
            if (url.pathname === '/bo/login.html') {
              // The main release retains its legacy login entry. Issue and
              // validate that unchanged flow before choosing the native form.
              assert.equal(url.origin,publicOrigin);
              return fulfill({contentType:'text/html',body:'<h1>Legacy login remains available</h1>'});
            }
            const target = kind === 'game' ? '/blackjack' : '/studio/administration';
            assert.equal(url.origin,publicOrigin);assert.equal(url.pathname,target);
            if (kind === 'game') assert.equal(auth.user({headers:{cookie:rawHeaders.cookie || ''}}),'fixture-player');
            else assert.equal((await authorize(new Request(url,{headers}))).role,'admin');
            return fulfill({contentType:'text/html',body:'<h1>Isolated handoff completed</h1>'});
          } catch(error) {failures.push(error);await route.fulfill({status:500,body:'Isolated fixture failed'});}
        });
        const page = await context.newPage();
        const target = kind === 'game' ? '/blackjack?dealer=astrid&rehearsal=1' : '/studio/administration';
        try { await page.goto(publicOrigin + '/api/auth/' + (kind === 'game' ? 'bo' : 'lab') + '/start?next=' + encodeURIComponent(target)); } catch(error) { throw Error('Fixture start failed; intercepted=' + JSON.stringify(seen) + '; errors=' + failures.map(e=>e.message).join('|')); }
        if(failures.length) throw failures[0];
        await page.waitForURL(url=>url.origin === publicOrigin && url.pathname === '/bo/login.html');
        if(failures.length) throw failures[0];
        assert.ok(seen.some(item=>item.origin === publicOrigin && item.path === '/bo/login.html'));
        const returnTo = new URL(page.url()).searchParams.get('returnTo');
        assert.match(returnTo,new RegExp('^/api/bo/' + kind + '-login\\?state=[a-f0-9]{64}$'));
        await page.goto(labOrigin + entry + '?returnTo=' + encodeURIComponent(returnTo));
        await page.waitForURL(publicOrigin + '/studio/login?returnTo=' + encodeURIComponent(returnTo));
        const form = page.locator('form').first();
        await form.locator('[name="user"]').fill('operator');await form.locator('[name="pass"]').fill(pass);
        await form.locator('button').click();
        try {await page.waitForURL(publicOrigin + target,{timeout:5000});}
        catch(error) {if(failures.length)throw failures[0];throw Error('Fixture callback failed; finalPath='+new URL(page.url()).pathname+'; callbacks='+callbacks.map(v=>v.status)+'; seen='+JSON.stringify(seen));}
        assert.equal(callbacks.length,1);assert.equal(callbacks[0].status,303);
        assert.equal(seen.some(item=>item.origin === labOrigin && item.method === 'POST'),false);
        const cookies = await context.cookies();
        assert.equal(cookies.some(cookie=>cookie.domain === 'studio.fixture.invalid'),false);
        for (const name of ['bo_jwt',kind === 'game' ? 'player_session' : 'lab_session']) {
          const cookie = cookies.find(cookie=>cookie.name === name);assert.ok(cookie);
          assert.equal(cookie.domain,'game.fixture.invalid');assert.equal(cookie.secure,true);assert.equal(cookie.httpOnly,true);
        }
        assert.equal(cookies.some(cookie=>cookie.name === (kind === 'game' ? 'bo_game_state' : 'bo_lab_state')),false);
        await page.goto(callbacks[0].url);
        assert.equal(callbacks.length,2);assert.equal(callbacks[1].status,kind === 'game' ? 400 : 410);
        assert.deepEqual(failures,[]);
      } finally {await context.close();bo.close();game.close();}
    }
  } finally {await browser.close();}
});
