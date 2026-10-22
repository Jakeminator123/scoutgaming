import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {platformUiDocument} from '../lib/server-ui.mjs';
import { OPERATOR_NOT_FOUND_HTML } from '../../../packages/navigation/operator-entry.mjs';
import {preparePlatformUi} from '../tools/prepare-platform-ui.mjs';
import {platformConfiguration,platformRoute} from '../../../packages/navigation/server/platform-routing.mjs';
const env = {CROUPIER_VERCEL_UI:'1',CROUPIER_PUBLIC_ORIGIN:'https://game.example.invalid',CROUPIER_BACKEND_ORIGIN:'https://engine.onrender.com',
  CROUPIER_LAB_UI_ORIGIN:'https://studio.vercel.app',CROUPIER_VERCEL_INGRESS_SECRET:'test-only-ingress-secret-'.repeat(3)};

test('the game start validates the live session and preserves the engine document without a default dealer',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'lane-entry-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html>unconfigured local shell</html>');
  await writeFile(join(directory,'blackjack.html'),'<html><script src="blackjack-entry.mjs"></script></html>');
  let authenticated=false,failed=false,status=200;const calls=[];
  const cloudHtml='<html data-game-dealer="linnea" data-game-local-dealer="linnea" data-game-registered-dealers="cloud-context"><script src="app.mjs"></script></html>';
  const options={env:{...env,CROUPIER_STUDIO_NEON_POLICY:'1'},directory,fetchImpl:async(url,init)=>{
    calls.push({url,init});assert.equal(init.headers.get('cookie'),'fixture-session=existing');
    assert.equal(init.headers.get('x-croupier-vercel-secret'),env.CROUPIER_VERCEL_INGRESS_SECRET);
    if(failed)return new Response(null,{status:503});
    if(url.endsWith('/api/auth/session'))return Response.json({authenticated});
    assert.match(url,/\/blackjack(?:\?|$)/);assert.equal(init.redirect,'manual');
    return new Response(status===200?cloudHtml:OPERATOR_NOT_FOUND_HTML,{status});
  }};
  const request=path=>new Request(env.CROUPIER_PUBLIC_ORIGIN+path,{headers:{cookie:'fixture-session=existing','x-croupier-public-origin':'https://evil.invalid'}});
  let response=await platformUiDocument(request('/game?dealer=linnea&returnTo=https://evil.invalid'),options);
  assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'/player-login?dealer=linnea');
  assert.equal(calls.length,1);assert.equal(calls[0].init.headers.get('x-croupier-public-origin'),env.CROUPIER_PUBLIC_ORIGIN);
  authenticated=true;response=await platformUiDocument(request('/game?game=blackjack&dealer=linnea'),options);
  assert.equal(response.status,200);assert.equal(await response.text(),cloudHtml);
  assert.equal(calls.at(-1).url,env.CROUPIER_BACKEND_ORIGIN+'/blackjack?dealer=linnea','the public game selector never reaches the engine document');
  response=await platformUiDocument(request('/game?dealer=linnea&returnTo=https://evil.invalid'),options);
  assert.equal(await response.text(),cloudHtml);assert.equal(calls.at(-1).url,env.CROUPIER_BACKEND_ORIGIN+'/blackjack?dealer=linnea');
  status=404;response=await platformUiDocument(request('/game?dealer=amira'),options);assert.equal(response.status,404);status=200;
  authenticated=false;response=await platformUiDocument(request('/game?lane=mobile-phone'),options);assert.equal(response.headers.get('Location'),'/player-login?lane=mobile-phone');
  const beforeLogin=calls.length;response=await platformUiDocument(request('/player-login'),options);
  assert.equal(response.status,200);assert.match(await response.text(),/blackjack-entry.mjs/);assert.equal(calls.length,beforeLogin);
  for(const retired of ['/blackjack','/blackjack?dealer=linnea','/play/blackjack?dealer=linnea','/v2','/bo/login.html'])
    assert.equal((await platformUiDocument(request(retired),options)).status,404,retired);
  assert.equal(calls.length,beforeLogin,'retired addresses read no session');
  authenticated=true;failed=true;response=await platformUiDocument(request('/game?dealer=linnea'),options);
  assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/app.mjs|fixture-session/);
  assert.ok(calls.every(call=>!call.url.includes('/api/bo/config')));
});

test('a signed launch on the game start reaches the authoritative engine without another public alias',() => {
  const config = platformConfiguration({...env,CROUPIER_STUDIO_NEON_POLICY:'1'});
  const query = '?dealer=nora&performance=staged&motion=smooth60&launch=fixture.claim.signature&returnTo=https://evil.invalid';
  for (const routing of [config, platformConfiguration(env)]) {
    assert.deepEqual(platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/game'+query),routing),{kind:'backend',destination:env.CROUPIER_BACKEND_ORIGIN+'/game'+query});
  }
  assert.deepEqual(platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/player-login?dealer=nora'),config),{kind:'frontend'});
  assert.deepEqual(platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/game?dealer=nora'),config),{kind:'frontend'});
  // The engine still answers a launch with a 303 to /blackjack; that alias is a one-hop 308 back to /game.
  const engineReturn = platformRoute(new URL(env.CROUPIER_PUBLIC_ORIGIN+'/blackjack?dealer=nora'),config);
  assert.deepEqual(engineReturn,{kind:'redirect',status:308,destination:env.CROUPIER_PUBLIC_ORIGIN+'/game?game=blackjack&dealer=nora'});
  assert.deepEqual(platformRoute(new URL(engineReturn.destination),config),{kind:'frontend'});
});
test('Neon flag makes /game the actual shared player; off keeps the local shell and no login document',async t => {
  const directory = await mkdtemp(join(tmpdir(),'game-address-ui-'));t.after(() => rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html><script src="app.mjs"></script></html>');
  await writeFile(join(directory,'blackjack.html'),'<html><script src="blackjack-entry.mjs"></script></html>');
  const options = {env,directory,fetchImpl:async url => url.endsWith('/api/auth/session') ? Response.json({authenticated:true}) : new Response('<html data-game-path="/blackjack"><script src="app.mjs"></script></html>')};
  const off = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?dealer=elin'),options);
  assert.equal(off.status,200);assert.match(await off.text(),/app.mjs/);assert.doesNotMatch(await (await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game'),options)).text(),/data-game-path/);
  assert.equal((await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/player-login'),options)).status,404);
  assert.equal((await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/blackjack'),options)).status,404);
  options.env = {...env,CROUPIER_STUDIO_NEON_POLICY:'1'};
  const game = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?dealer=elin'),options);
  assert.equal(game.status,200);assert.match(await game.text(),/data-game-path="\/blackjack".*app.mjs/);
  const bare = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?returnTo=https://evil.invalid'),options);
  assert.equal(bare.status,303);assert.equal(bare.headers.get('Location'),'/lobby');assert.equal(await bare.text(),'');
  const login = await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/player-login'),options);
  assert.equal(login.status,200);assert.match(await login.text(),/data-game-path="\/blackjack".*blackjack-entry.mjs/);
  assert.equal((await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?dealer=elin',{method:'HEAD'}),options)).status,200);
  assert.equal(await (await platformUiDocument(new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?dealer=elin',{method:'HEAD'}),options)).text(),'');
});
test('prepared player login and modal distinguish canonical game from account entry without raw media copies',async t => {
  const directory = await mkdtemp(join(tmpdir(),'game-address-build-'));t.after(() => rm(directory,{recursive:true,force:true}));
  const result = await preparePlatformUi({env,output:directory});
  assert.ok(result.files.includes('/packages/navigation/game-entry.mjs'));
  assert.ok(result.files.every(path => !/\.(mp4|webm|mp3|wav|png)$/.test(path)));
  const login = await readFile(join(directory,'public/blackjack-entry.mjs'),'utf8');
  assert.match(login,/canonicalGameDestination/);assert.match(login,/location\.assign\(gameDestination\)/);
  const modal = await readFile(join(directory,'public/auth-modal.mjs'),'utf8');
  const html = await readFile(join(directory,'runtime-ui/blackjack.html'),'utf8');
  assert.match(modal,/Croupier account/);assert.match(modal,/\/api\/auth\/login/);
  for (const text of [html,login,modal]) assert.doesNotMatch(text,/account-kind|name="kind"|Skapa spelarkonto|\/api\/auth\/player\/register|existing Scout account/);
  assert.match(html,/Användarnamn eller e-post/);assert.match(html,/id="legacy-admin" hidden>Administratör\? <a href="\/studio\/login"/);
  assert.match(modal,/const playerLoginPath = '\/blackjack'/);
});

test('actual login module sends fresh and existing player sessions to the game without an entry loop',async t => {
  const original = new Map(['document','location','fetch'].map(key => [key,globalThis[key]]));
  t.after(() => {for (const [key,value] of original) {if (value === undefined) delete globalThis[key];else globalThis[key] = value;}});
  const sourceUrl = new URL('../../../services/game/public/blackjack-entry.mjs',import.meta.url);
  const source = (await readFile(sourceUrl,'utf8')).replace("'../../../packages/navigation/game-entry.mjs'",JSON.stringify(new URL('../../../packages/navigation/game-entry.mjs',sourceUrl).href));
  for (const [canonical,authenticated,query='?dealer=nora&motion=smooth60&launch=a.b.c&returnTo=https://evil.invalid'] of [[true,false],[true,true],[false,true],[true,false,''],[true,true,'']]) {
    const form = {hidden:true};
    const nodes = {form,'#status':{},'#submit':{},'#password':{value:'isolated-password'},'#username':{value:'isolated-player'},'#login-help':{},'#legacy-admin':{}};
    globalThis.document = {documentElement:{dataset:canonical ? {gamePath:'/blackjack'} : {}},querySelector:selector => nodes[selector]};
    const navigations = [],requests = [];
    const current = new URL('/player-login'+query,env.CROUPIER_PUBLIC_ORIGIN);
    globalThis.location = {href:current.href,origin:current.origin,search:current.search,
      assign:destination => navigations.push(['assign',destination]),replace:destination => navigations.push(['replace',destination])};
    globalThis.fetch = async (url,options) => {
      requests.push([url,options]);return new Response(JSON.stringify(url === '/api/auth/session'
        ? {authenticated,playerAccounts:true,sharedCredentials:true,localDemoProfiles:false} : {ok:true}),{headers:{'Content-Type':'application/json'}});
    };
    await import('data:text/javascript;base64,'+Buffer.from(source+`\n// case ${canonical}-${authenticated}-${query}`).toString('base64'));
    if (!authenticated) {assert.equal(form.hidden,false);await form.onsubmit({preventDefault(){}});}
    assert.deepEqual(navigations,[[authenticated ? 'replace' : 'assign',canonical ? '/game'+(query ? '?dealer=nora' : '') : '/lobby']]);
    if (!authenticated) {
      assert.equal(requests[1][0],'/api/auth/login');assert.equal(requests[1][1].method,'POST');
      assert.deepEqual(JSON.parse(requests[1][1].body),{email:'isolated-player',password:'isolated-password'});
      assert.equal(nodes['#password'].value,'');
    }
  }
});


test('shared login clears credentials before pending dispatch, prevents duplicates and sanitizes failures',async t=>{
  const original=new Map(['document','location','fetch'].map(key=>[key,globalThis[key]]));
  t.after(()=>{for(const [key,value]of original){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const sourceUrl=new URL('../../../services/game/public/blackjack-entry.mjs',import.meta.url);
  const source=(await readFile(sourceUrl,'utf8')).replace("'../../../packages/navigation/game-entry.mjs'",JSON.stringify(new URL('../../../packages/navigation/game-entry.mjs',sourceUrl).href));
  const form={hidden:true},nodes={form,'#status':{},'#submit':{},'#password':{value:'fixture-login-password'},'#username':{value:' Administrator '},'#login-help':{},'#legacy-admin':{}};
  globalThis.document={documentElement:{dataset:{gamePath:'/blackjack'}},querySelector:key=>nodes[key]};
  const navigations=[];globalThis.location={href:env.CROUPIER_PUBLIC_ORIGIN+'/player-login',origin:env.CROUPIER_PUBLIC_ORIGIN,search:'',assign:x=>navigations.push(x),replace:x=>navigations.push(x)};
  let writes=0,release,request;const waiting=new Promise(resolve=>{release=resolve;});
  globalThis.fetch=async(url,init)=>{if(url==='/api/auth/session')return Response.json({authenticated:false,sharedCredentials:true});++writes;request=[url,init];await waiting;return Response.json({error:'PRIVATE SERVER TEXT'},{status:401});};
  await import('data:text/javascript;base64,'+Buffer.from(source+'\n// pending shared login').toString('base64'));
  const first=form.onsubmit({preventDefault(){}});await form.onsubmit({preventDefault(){}});
  assert.equal(nodes['#password'].value,'');assert.equal(writes,1);assert.equal(request[0],'/api/auth/login');
  assert.deepEqual(JSON.parse(request[1].body),{email:'Administrator',password:'fixture-login-password'});
  assert.equal(request[1].credentials,'same-origin');assert.equal(request[1].cache,'no-store');assert.equal(request[1].redirect,'error');
  release();await first;assert.equal(writes,1);assert.equal(navigations.length,0);
  assert.match(nodes['#status'].textContent,/kunde inte verifieras/);assert.doesNotMatch(nodes['#status'].textContent,/PRIVATE|fixture-login-password/);
});

test('actual game modal accepts shared credentials, clears passwords and ignores a cancelled earlier response',async t=>{
  const original=new Map(['document','location','fetch'].map(key=>[key,globalThis[key]]));
  t.after(()=>{for(const [key,value]of original){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const nodes={'form':{},'.auth-close':{},'#auth-email':{value:' Operator '},'#auth-password':{value:'fixture-modal-password'},'#auth-error':{},'#auth-submit':{},'#auth-purpose':{},'#auth-account':{},'#auth-player-login':{}};
  let closeListener;const dialog={open:false,returnValue:'',setAttribute(){},querySelector:key=>nodes[key],
    addEventListener(type,listener){closeListener=listener;},showModal(){this.open=true;},close(value){this.returnValue=value;this.open=false;closeListener?.();}};
  globalThis.document={documentElement:{dataset:{}},createElement:()=>dialog,body:{appendChild(){}}};
  let writes=0,release;const waiting=new Promise(resolve=>{release=resolve;});const requests=[];
  globalThis.fetch=async(url,init)=>{if(url==='/api/auth/session')return Response.json({authenticated:false,sharedCredentials:true});requests.push([url,init]);++writes;if(writes===1){await waiting;return Response.json({ok:true});}return Response.json({error:'PRIVATE SERVER TEXT'},{status:401});};
  const source=(await readFile(new URL('../../../services/game/public/auth-modal.mjs',import.meta.url),'utf8')).replace("'../../../packages/navigation/game-entry.mjs'",JSON.stringify(new URL('../../../packages/navigation/game-entry.mjs',import.meta.url).href));
  const modal=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// shared modal lifecycle').toString('base64'));
  const firstResult=modal.requestLogin('Sign in to play');await new Promise(resolve=>setImmediate(resolve));nodes['#auth-password'].value='fixture-modal-password';
  const first=nodes.form.onsubmit({preventDefault(){}});
  await nodes.form.onsubmit({preventDefault(){}});assert.equal(writes,1);assert.equal(nodes['#auth-password'].value,'');
  assert.equal(requests[0][0],'/api/auth/login');assert.deepEqual(JSON.parse(requests[0][1].body),{email:'Operator',password:'fixture-modal-password'});
  dialog.close('cancel');assert.equal(await firstResult,false);
  const secondResult=modal.requestLogin('Sign in again');await new Promise(resolve=>setImmediate(resolve));nodes['#auth-password'].value='fixture-second-password';
  await nodes.form.onsubmit({preventDefault(){}});assert.equal(writes,2);assert.equal(dialog.open,true);
  assert.match(nodes['#auth-error'].textContent,/Unable to verify/);assert.doesNotMatch(nodes['#auth-error'].textContent,/PRIVATE|fixture-second-password/);
  release();await first;assert.equal(dialog.open,true);assert.equal(writes,2);dialog.close('cancel');assert.equal(await secondResult,false);
});

const flush=()=>new Promise(resolve=>setImmediate(resolve));
let importCase=0;
async function capabilityFixture(kind,{canonical=true,session={authenticated:false,sharedCredentials:true,playerAccounts:true},capability,post}={},run){
  const original=new Map(['document','location','fetch'].map(key=>[key,globalThis[key]]));
  const requests=[],navigations=[],current=new URL('/player-login?dealer=nora&motion=smooth60&launch=a.b.c&returnTo=https://evil.invalid',env.CROUPIER_PUBLIC_ORIGIN);
  const nodes=kind==='entry' ? {form:{hidden:true},'#status':{},'#submit':{},'#password':{value:'fixture-login-password'},'#username':{value:' identifier@example.invalid '},'#login-help':{},'#legacy-admin':{hidden:true}}
    : {'form':{},'.auth-close':{},'#auth-email':{value:' Operator '},'#auth-password':{value:''},'#auth-error':{},'#auth-submit':{},'#auth-purpose':{},'#auth-account':{},'#auth-player-login':{hidden:true}};
  let closeListener;const dialog={open:false,returnValue:'',setAttribute(){},querySelector:key=>nodes[key],addEventListener(type,listener){closeListener=listener;},showModal(){this.open=true;},close(value){this.returnValue=value;this.open=false;closeListener?.();}};
  globalThis.document={documentElement:{dataset:canonical?{gamePath:'/blackjack'}:{}},querySelector:key=>nodes[key],createElement:()=>dialog,body:{appendChild(){}}};
  globalThis.location={href:current.href,origin:current.origin,search:current.search,assign:x=>navigations.push(x),replace:x=>navigations.push(x)};
  globalThis.fetch=async(url,init)=>{requests.push([url,init]);return url==='/api/auth/session' ? capability?capability():Response.json(session) : post?post(url,init):Response.json({ok:true});};
  try{
    const url=new URL('../../../services/game/public/'+(kind==='entry'?'blackjack-entry.mjs':'auth-modal.mjs'),import.meta.url);
    const source=(await readFile(url,'utf8')).replace("'../../../packages/navigation/game-entry.mjs'",JSON.stringify(new URL('../../../packages/navigation/game-entry.mjs',url).href));
    const module=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// capability case '+(++importCase)).toString('base64'));
    await run({nodes,dialog,module,requests,navigations,writes:()=>requests.filter(([,init])=>init?.method==='POST')});
  }finally{for(const[key,value]of original){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}

test('entry capability picks exactly one old/new contract without username/password or privilege heuristics',async()=>{
  for(const [session,endpoint,key,legacyPlayer]of [
    [{authenticated:false,sharedCredentials:true,playerAccounts:true},'/api/auth/login','email',false],
    [{authenticated:false,sharedCredentials:true,playerAccounts:false},'/api/auth/login','email',false],
    [{authenticated:false,playerAccounts:true},'/api/auth/player/login','username',true],
    [{authenticated:false,sharedCredentials:false,playerAccounts:true},'/api/auth/player/login','username',true],
    [{authenticated:false,playerAccounts:false},'/api/auth/login','email',false],
  ])await capabilityFixture('entry',{session,post:()=>Response.json({error:'PRIVATE SERVER TEXT'},{status:401})},async({nodes,writes,navigations,requests})=>{
    assert.equal(nodes.form.hidden,false);assert.equal(nodes['#submit'].disabled,false);
    assert.equal(nodes['#legacy-admin'].hidden,!legacyPlayer);
    assert.equal(nodes['#password'].maxLength,session.sharedCredentials===true?256:128);
    await nodes.form.onsubmit({preventDefault(){}});
    assert.equal(writes().length,1);const[url,init]=writes()[0];assert.equal(url,endpoint);
    assert.deepEqual(JSON.parse(init.body),{[key]:'identifier@example.invalid',password:'fixture-login-password'});
    assert.equal(nodes['#password'].value,'');assert.equal(navigations.length,0);
    assert.doesNotMatch(nodes['#status'].textContent,/PRIVATE|fixture-login-password/);assert.match(nodes['#status'].textContent,/kunde inte verifieras/);
    assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');
    assert.equal(requests[0][1].cache,'no-store');assert.equal(requests[0][1].redirect,'error');
  });
});

test('legacy entry clears passwords before pending dispatch and cannot repeat or switch namespace after failure',async()=>{
  let release;const waiting=new Promise(resolve=>{release=resolve;});
  await capabilityFixture('entry',{session:{authenticated:false,playerAccounts:true},post:async()=>{await waiting;return Response.json({error:'PRIVATE SERVER TEXT'},{status:401});}},async({nodes,writes})=>{
    const first=nodes.form.onsubmit({preventDefault(){}});await nodes.form.onsubmit({preventDefault(){}});
    assert.equal(writes().length,1);assert.equal(nodes['#password'].value,'');assert.equal(nodes['#submit'].disabled,true);
    release();await first;assert.equal(writes().length,1);assert.equal(nodes['#submit'].disabled,false);
  });
});

test('entry and modal block all password dispatch when capability GET or JSON fails',async()=>{
  for(const capability of [()=>Response.json({},{status:503}),()=>{throw Error('PRIVATE NETWORK TEXT');},()=>new Response('bad json'),()=>Response.json([]),()=>Response.json({sharedCredentials:true})]){
    await capabilityFixture('entry',{capability},async({nodes,writes})=>{
      await nodes.form.onsubmit({preventDefault(){}});assert.equal(writes().length,0);assert.equal(nodes.form.hidden,true);assert.equal(nodes['#submit'].disabled,true);
      assert.doesNotMatch(nodes['#status'].textContent,/PRIVATE/);
    });
    await capabilityFixture('modal',{capability},async({module,nodes,dialog,writes})=>{
      const result=module.requestLogin('Sign in');await flush();nodes['#auth-password'].value='fixture-modal-password';
      await nodes.form.onsubmit({preventDefault(){}});assert.equal(writes().length,0);assert.equal(nodes['#auth-submit'].disabled,true);assert.equal(nodes['#auth-player-login'].hidden,true);
      assert.doesNotMatch(nodes['#auth-error'].textContent,/PRIVATE/);dialog.close('cancel');assert.equal(await result,false);
    });
  }
});

test('modal keeps one CRAIG/shared POST and exposes only a fixed or query-allowlisted legacy entry',async()=>{
  for(const[shared,players,canonical]of [[true,true,true],[false,true,true],[false,true,false],[false,false,true]])
    await capabilityFixture('modal',{canonical,session:{authenticated:false,playerAccounts:players,...(shared?{sharedCredentials:true}:{})},post:()=>Response.json({error:'PRIVATE SERVER TEXT'},{status:401})},async({module,nodes,dialog,writes})=>{
      const result=module.requestLogin('Sign in');await flush();
      assert.equal(nodes['#auth-player-login'].hidden,shared||!players);
      assert.equal(nodes['#auth-password'].maxLength,shared?256:128);
      // The engine modal derives its player entry from the canonical game address and
      // still rewrites the retired /blackjack prefix; until services/game/public/auth-modal.mjs
      // rewrites /game, the link lands on /game and the route sends the player on to /player-login.
      if(canonical)assert.match(nodes['#auth-player-login'].href,/^\/(?:game|player-login)\?dealer=nora$/);
      else assert.equal(nodes['#auth-player-login'].href,'/blackjack');
      nodes['#auth-password'].value='fixture-modal-password';await nodes.form.onsubmit({preventDefault(){}});
      assert.equal(writes().length,1);assert.equal(writes()[0][0],'/api/auth/login');
      assert.deepEqual(JSON.parse(writes()[0][1].body),{email:'Operator',password:'fixture-modal-password'});
      assert.equal(nodes['#auth-password'].value,'');assert.doesNotMatch(nodes['#auth-error'].textContent,/PRIVATE|fixture-modal-password/);
      dialog.close('cancel');assert.equal(await result,false);
    });
});

test('unknown operator slug is the company 404 from the engine, not the open catalogue',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'operator-entry-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'game.html'),'<html><script src="app.mjs"></script></html>');
  const unified={...env,CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1'};
  const enginePage='<!doctype html><html lang="sv"><head><title>Bolaget finns inte</title></head><body><h1>Bolaget finns inte</h1></body></html>';
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push(String(url));
    assert.equal(init.headers.get('cookie'),'fixture-session=existing');
    assert.equal(init.headers.get('x-croupier-vercel-secret'),env.CROUPIER_VERCEL_INGRESS_SECRET);
    if(String(url).endsWith('/api/auth/session'))return Response.json({authenticated:true});
    assert.match(String(url),/\/blackjack\?table=room-unknown&operator=nobody$/);
    assert.equal(init.redirect,'manual');
    if(init.method==='HEAD')return new Response(null,{status:404,headers:{'content-type':'text/html; charset=utf-8'}});
    return new Response(enginePage,{status:404,headers:{'content-type':'text/html; charset=utf-8'}});
  };
  const options={env:unified,directory,fetchImpl};
  const request=method=>new Request(env.CROUPIER_PUBLIC_ORIGIN+'/game?game=blackjack&operator=nobody&table=room-unknown',{method,headers:{cookie:'fixture-session=existing'}});
  const response=await platformUiDocument(request('GET'),options);
  assert.equal(response.status,404);assert.equal(await response.text(),enginePage);
  const head=await platformUiDocument(request('HEAD'),options);
  assert.equal(head.status,404);assert.equal(await head.text(),'');
  assert.equal(calls.some(url=>url.includes('/api/bo/config')),false);
  const fallback=await platformUiDocument(request('GET'),{...options,fetchImpl:async url=>{
    if(String(url).endsWith('/api/auth/session'))return Response.json({authenticated:true});
    return new Response('not found',{status:404});
  }});
  assert.equal(fallback.status,404);assert.equal(await fallback.text(),OPERATOR_NOT_FOUND_HTML);
  const foreign=await platformUiDocument(request('GET'),{...options,fetchImpl:async url=>{
    if(String(url).endsWith('/api/auth/session'))return Response.json({authenticated:true});
    return new Response(null,{status:303,headers:{location:'https://evil.invalid/steal'}});
  }});
  assert.equal(foreign.status,503);assert.doesNotMatch(await foreign.text(),/evil\.invalid/);
});

test('modal stays inert before capability resolves and ignores a cancelled stale GET response',async()=>{
  let release;const waiting=new Promise(resolve=>{release=resolve;});
  await capabilityFixture('modal',{capability:async()=>{await waiting;return Response.json({authenticated:false,sharedCredentials:true});}},async({module,nodes,dialog,writes})=>{
    const result=module.requestLogin('Sign in');nodes['#auth-password'].value='fixture-modal-password';await nodes.form.onsubmit({preventDefault(){}});
    assert.equal(writes().length,0);assert.equal(nodes['#auth-submit'].disabled,true);
    release();await flush();await nodes.form.onsubmit({preventDefault(){}});
    assert.equal(writes().length,1);assert.equal(await result,true);assert.equal(dialog.open,false);
  });
  let releaseCapability,reads=0;const stale=new Promise(resolve=>{releaseCapability=resolve;});
  await capabilityFixture('modal',{capability:async()=>{if(++reads===1){await stale;return Response.json({authenticated:false,playerAccounts:true});}return Response.json({authenticated:false,sharedCredentials:true});}},async({module,nodes,dialog})=>{
    const firstResult=module.requestLogin('Sign in');dialog.close('cancel');assert.equal(await firstResult,false);
    const secondResult=module.requestLogin('Sign in again');await flush();assert.equal(nodes['#auth-player-login'].hidden,true);
    releaseCapability();await flush();assert.equal(nodes['#auth-player-login'].hidden,true);assert.equal(nodes['#auth-submit'].disabled,false);
    dialog.close('cancel');assert.equal(await secondResult,false);
  });
});


test('verified N1 game handoff happens before fetching another player game document',async()=>{
  const calls=[];
  const request=new Request('https://game.example.invalid/game?game=blackjack&operator=swedish-games&table=room-evening',{headers:{cookie:'bo_jwt=verified; player_session=other'}});
  const response=await platformUiDocument(request,{env:{...env,CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1'},fetchImpl:async(url)=>{
    calls.push(new URL(url).pathname);assert.equal(new URL(url).pathname,'/api/auth/session');
    return Response.json({authenticated:false,backofficeHandoff:true});
  }});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/api/auth/bo/start?next='+encodeURIComponent('/game?game=blackjack&table=room-evening&operator=swedish-games'));
  assert.deepEqual(calls,['/api/auth/session']);
});
