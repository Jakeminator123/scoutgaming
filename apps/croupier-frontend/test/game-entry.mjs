import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {platformUiDocument} from '../lib/server-ui.mjs';
import {preparePlatformUi} from '../tools/prepare-platform-ui.mjs';
import {platformConfiguration,platformRoute} from '../lib/platform-routing.mjs';
const env = {CROUPIER_VERCEL_UI:'1',CROUPIER_PUBLIC_ORIGIN:'https://game.example.invalid',CROUPIER_BACKEND_ORIGIN:'https://engine.onrender.com',
  CROUPIER_LAB_UI_ORIGIN:'https://studio.vercel.app',CROUPIER_VERCEL_INGRESS_SECRET:'test-only-ingress-secret-'.repeat(3)};

test('canonical platform routes redirect once before launch reaches the authoritative engine',() => {
  const config = platformConfiguration({...env,CROUPIER_STUDIO_NEON_POLICY:'1'});
  const query = '?dealer=mei&performance=staged&motion=smooth60&launch=fixture.claim.signature&returnTo=https://evil.invalid';
  const redirect = platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/game'+query),config);
  assert.deepEqual(redirect,{kind:'redirect',destination:env.CROUPIER_PUBLIC_ORIGIN+'/blackjack?dealer=mei&performance=staged&motion=smooth60&launch=fixture.claim.signature'});
  assert.equal(platformRoute(new URL(redirect.destination),config).kind,'backend');
  assert.deepEqual(platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/player-login?dealer=mei'),config),{kind:'frontend'});
  assert.deepEqual(platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/blackjack?dealer=mei'),config),{kind:'frontend'});
  const off = platformConfiguration(env);
  assert.deepEqual(platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/game'+query),off),{kind:'backend',destination:env.CROUPIER_BACKEND_ORIGIN+'/game'+query});
});
test('Neon flag makes blackjack the actual shared player and game a bounded alias; off keeps existing entry',async t => {
  const directory = await mkdtemp(join(tmpdir(),'game-address-ui-'));t.after(() => rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html><script src="app.mjs"></script></html>');
  await writeFile(join(directory,'blackjack.html'),'<html><script src="blackjack-entry.mjs"></script></html>');
  const options = {env,directory};
  const off = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/blackjack'),options);
  assert.match(await off.text(),/blackjack-entry.mjs/);
  assert.equal((await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/player-login'),options)).status,404);
  options.env = {...env,CROUPIER_STUDIO_NEON_POLICY:'1'};
  const game = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/blackjack?dealer=vera'),options);
  assert.equal(game.status,200);assert.match(await game.text(),/data-game-path="\/blackjack".*app.mjs/);
  const alias = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?dealer=vera&launch=a.b.c&returnTo=https://evil.invalid'),options);
  assert.equal(alias.status,307);assert.equal(alias.headers.get('Location'),'/blackjack?dealer=vera&launch=a.b.c');assert.equal(await alias.text(),'');
  const login = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/player-login'),options);
  assert.equal(login.status,200);assert.match(await login.text(),/data-game-path="\/blackjack".*blackjack-entry.mjs/);
  assert.equal((await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/blackjack',{method:'HEAD'}),options)).status,200);
  assert.equal(await (await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/blackjack',{method:'HEAD'}),options)).text(),'');
});
test('prepared player login and modal distinguish canonical game from account entry without raw media copies',async t => {
  const directory = await mkdtemp(join(tmpdir(),'game-address-build-'));t.after(() => rm(directory,{recursive:true,force:true}));
  const result = await preparePlatformUi({env,output:directory});
  assert.ok(result.files.includes('/game-entry-contract.mjs'));
  assert.ok(result.files.every(path => !/\.(mp4|webm|mp3|wav|png)$/.test(path)));
  const login = await readFile(join(directory,'public/blackjack-entry.mjs'),'utf8');
  assert.match(login,/canonicalGameDestination/);assert.match(login,/location\.assign\(gameDestination\)/);
  const modal = await readFile(join(directory,'public/auth-modal.mjs'),'utf8');assert.match(modal,/\/player-login/);
  assert.match(modal,/: '\/blackjack';/);assert.ok(!modal.includes('/frontend-preview/blackjack/'));
});

test('actual login module sends fresh and existing player sessions to the game without an entry loop',async t => {
  const original = new Map(['document','location','fetch'].map(key => [key,globalThis[key]]));
  t.after(() => {for (const [key,value] of original) {if (value === undefined) delete globalThis[key];else globalThis[key] = value;}});
  const sourceUrl = new URL('../../../web/public/blackjack-entry.mjs',import.meta.url);
  const source = (await readFile(sourceUrl,'utf8')).replace("'./game-entry-contract.mjs'",JSON.stringify(new URL('game-entry-contract.mjs',sourceUrl).href));
  for (const [canonical,authenticated] of [[true,false],[true,true],[false,true]]) {
    const form = {elements:{kind:{value:'player'}},hidden:true};
    const nodes = {form,'#status':{},'#submit':{},'#toggle':{},'#password':{value:'isolated-password'},
      '#username':{value:'isolated-player',previousElementSibling:{}},'#account-kind':{}};
    globalThis.document = {documentElement:{dataset:canonical ? {gamePath:'/blackjack'} : {}},querySelector:selector => nodes[selector]};
    const navigations = [],requests = [];
    const current = new URL('/player-login?dealer=mei&motion=smooth60&launch=a.b.c&returnTo=https://evil.invalid',env.CROUPIER_PUBLIC_ORIGIN);
    globalThis.location = {href:current.href,origin:current.origin,search:current.search,
      assign:destination => navigations.push(['assign',destination]),replace:destination => navigations.push(['replace',destination])};
    globalThis.fetch = async (url,options) => {
      requests.push([url,options]);return new Response(JSON.stringify(url === '/api/auth/session'
        ? {authenticated,playerAccounts:true,localDemoProfiles:false} : {ok:true}),{headers:{'Content-Type':'application/json'}});
    };
    await import('data:text/javascript;base64,'+Buffer.from(source+`\n// case ${canonical}-${authenticated}`).toString('base64'));
    if (!authenticated) {assert.equal(form.hidden,false);await form.onsubmit({preventDefault(){}});}
    assert.deepEqual(navigations,[[authenticated ? 'replace' : 'assign',canonical ? '/blackjack?dealer=mei&motion=smooth60' : '/?dealer=astrid&presentation=local']]);
    if (!authenticated) {
      assert.equal(requests[1][0],'/api/auth/player/login');assert.equal(requests[1][1].method,'POST');
      assert.deepEqual(JSON.parse(requests[1][1].body),{username:'isolated-player',password:'isolated-password'});
      assert.equal(nodes['#password'].value,'');
    }
  }
});
