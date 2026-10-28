import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { ENGINE_QA_SKIP, createEngineDatabase, freePort, insertCraigUser, startEngine } from './fixtures/engine-qa.mjs';

const game='https://game.example.test';
const frontend='https://preview.example.vercel.app';
const password='Synthetic-Proxy-Test-Password';

async function fixture(t) {
  const database=await createEngineDatabase(t),port=await freePort();
  await insertCraigUser(database,{id:1,username:'pilot-reader',email:'reader@example.invalid',salt:'isolated-proxy-salt',password,role:'reader'});
  let engine;
  async function start(extra={}){
    engine=await startEngine(t,{database,port,env:{NODE_ENV:'production',
      PUBLIC_URL:game,BO_URL:game,LAB_PUBLIC_URL:game,CROUPIER_CLOUD_LAYOUT:'single-origin',
      CROUPIER_CLOUD_RUNTIME:'1',...extra}});
  }
  async function stop(){
    await engine?.stop();
    engine=undefined;
  }
  function request(path,{method='GET',host=new URL(game).host,origin,site,cookie='',body}={}){
    return new Promise((resolve,reject)=>{
      const headers={Host:host,...(origin?{Origin:origin}:{}),...(site?{'Sec-Fetch-Site':site}:{}),
        ...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})};
      const req=httpRequest(`http://127.0.0.1:${port}${path}`,{method,headers},res=>{
        const chunks=[];res.on('data',chunk=>chunks.push(chunk));
        res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
      });
      req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
    });
  }
  return {start,stop,request};
}

test('opt-in Vercel Origin permits player POSTs with the observed Preview Host and keeps cookies host-only',{skip:ENGINE_QA_SKIP},async t=>{
  const f=await fixture(t);
  const login={email:'pilot-reader',password};
  const post=(path,body,options={})=>f.request(path,{method:'POST',body,origin:frontend,site:'same-origin',...options});
  await f.start({CROUPIER_VERCEL_FRONTEND_ORIGIN:frontend});
  assert.equal((await post('/api/auth/login',login,{origin:'https://evil.example.test'})).status,403);
  assert.equal((await post('/api/auth/login',login,{origin:`${frontend}/path`})).status,403);
  assert.equal((await post('/api/auth/login',login,{host:'attacker.invalid'})).status,403);
  assert.equal((await post('/api/auth/login',login,{site:'cross-site'})).status,403);
  const signedIn=await post('/api/auth/login',login);
  assert.equal(signedIn.status,200);
  assert.equal((await post('/api/auth/login',login,{host:new URL(frontend).host})).status,200,
    'Vercel external rewrite forwards its Preview Host');
  assert.equal((await post('/api/auth/login',login,{host:new URL(frontend).host,site:'cross-site'})).status,403);
  const setCookie=signedIn.headers['set-cookie']?.[0]??'';
  assert.match(setCookie,/^player_session=[a-f0-9]{64}/);
  assert.match(setCookie,/; HttpOnly; SameSite=Strict;/);
  assert.match(setCookie,/; Secure/);
  assert.doesNotMatch(setCookie,/; Domain=/i);
  assert.equal(signedIn.headers.location,undefined,'password login never redirects to Render');
  const cookie=setCookie.split(';')[0];
  const state=await post('/api/table',{op:'state'},{cookie});
  assert.equal(state.status,200,'authenticated game POST accepts the trusted preview origin');
  assert.equal((await post('/api/table',{op:'state'},{cookie,origin:'https://evil.example.test'})).status,403);
  assert.equal((await post('/api/table',{op:'state'},{cookie,host:new URL(frontend).host})).status,200);
  assert.equal((await post('/api/table',{op:'state'},{cookie,host:'attacker.invalid'})).status,403);
  assert.equal((await post('/api/bo/login',{user:'pilot-reader',pass:password})).status,403,
    'trusted Vercel player origin never crosses the stricter BO POST origin gate');
  // The BO-to-game handoff is retired: its start route redirects nowhere on either host.
  for (const host of [new URL(game).host, new URL(frontend).host]) {
    const boStart=await f.request('/api/auth/bo/start?next=%2F',{host});
    assert.notEqual(boStart.status,303,host);assert.equal(boStart.headers.location,undefined,host);
  }
  const logout=await post('/api/auth/logout',{}, {cookie});
  assert.equal(logout.status,200);
  assert.match(logout.headers['set-cookie']?.[0]??'',/Max-Age=0/);
  assert.equal((await f.request('/api/auth/session',{cookie})).body.includes('"authenticated":false'),true);
  await f.stop();
  await f.start();
  assert.equal((await post('/api/auth/login',login)).status,403,'default configuration does not trust Vercel');
  assert.equal((await post('/api/auth/login',login,{origin:game})).status,200,'Render origin still works');
});
