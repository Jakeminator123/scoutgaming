// Native N1 login against the actual engine on its own PostgreSQL database. The
// BO-to-player handoff is retired: an administrator cookie alone never becomes a
// player session, and the old handoff routes cannot mint one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createStudioNativeAuthActions} from '../apps/studio/lib/studio-native-auth-actions.mjs';
import {createStudioNativeAuth} from '../packages/studio-access/studio-native-auth.mjs';
import {ENGINE_QA_SKIP,createEngineDatabase,freePort,startEngine} from './fixtures/engine-qa.mjs';

test('a native N1 login starts no player handoff on the actual isolated engine and logs out coherently',{skip:ENGINE_QA_SKIP},async t=>{
  const database=await createEngineDatabase(t),port=await freePort();
  const origin='https://www.fixture.invalid',password='Isolated-N1-Player-Test-Password';
  const request=(path,{method='GET',cookie='',body,originHeader=origin}={})=>new Promise((resolve,reject)=>{
    const url=new URL(path,origin);
    const req=httpRequest({hostname:'127.0.0.1',port,path:url.pathname+url.search,method,headers:{host:new URL(origin).host,cookie,origin:originHeader,'content-type':'application/json'}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const headers=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});
    });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  await startEngine(t,{database,port,preload:[new URL('./fixtures/generated-speech-stream-fetch.mjs',import.meta.url).href],
    env:{NODE_ENV:'production',CROUPIER_CLOUD_RUNTIME:'1',CROUPIER_PLAYER_ACCOUNTS:'1',
      CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER:'fixtureadmin',CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD:password,
      CROUPIER_GENERATED_SPEECH:'',CROUPIER_GENERATED_SPEECH_STREAMING:'',CROUPIER_ASTRID_CAMERA:'',PUBLIC_URL:origin,BO_URL:origin}});
  const {boDb,db:gameDb}=database.store,scope={environment:'fixture',workspaceId:'croupier'};
  const authorize=createStudioNativeAuth({boDb,scope});
  const actions=createStudioNativeAuthActions({boDb,gameDb,scope,authorize,publicOrigin:origin,rateLimit:async()=>true,clientAddress:()=> 'fixture'});
  const native=async(action,body,cookie='')=>actions.handle(new Request(origin+'/studio/api/auth/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',cookie},body:JSON.stringify(body)}));
  const sessions=async()=>(await gameDb.prepare('SELECT count(*) n FROM player_sessions').get()).n;
  const loggedIn=await native('login',{user:'fixtureadmin',pass:password});assert.equal(loggedIn.status,200);
  const boCookie=loggedIn.headers.getSetCookie().find(value=>value.startsWith('bo_jwt=')).split(';')[0];
  const before=await sessions();
  const session=await(await request('/api/auth/session',{cookie:boCookie})).json();
  assert.equal(session.authenticated,false,'an administrator cookie is not a player session');
  assert.equal(session.backofficeHandoff,undefined,'the engine advertises no handoff');
  for(const entry of ['/blackjack?table=room-evening','/play/roulette?table=room-evening']) {
    const admin=await request(entry,{cookie:boCookie}),anonymous=await request(entry);
    const location=admin.headers.get('location')??'';
    assert.equal(location.startsWith('/api/auth/bo/'),false,`${entry} does not redirect into a handoff`);
    // An Admin cookie without a player session gets exactly the ordinary player flow.
    assert.equal(admin.status,anonymous.status,`${entry}: same status as without a cookie`);
    assert.equal(location,anonymous.headers.get('location')??'',`${entry}: same destination as without a cookie`);
  }
  const state='a'.repeat(64),code='b'.repeat(64);
  for(const path of ['/api/auth/bo/start?next=%2Fplay%2Fprofil',`/api/bo/game-login?state=${state}`,`/api/auth/bo/callback?state=${state}&code=${code}`,
    '/api/auth/lab/start?next=%2F',`/api/bo/lab-login?state=${state}`,'/api/bo/speech-qa','/api/bo/config']) {
    const response=await request(path,{cookie:`bo_jwt=${boCookie.slice('bo_jwt='.length)}; bo_game_state=${state}`});
    assert.notEqual(response.status,303,`${path} is no handoff`);
    assert.equal(response.headers.getSetCookie().some(value=>value.startsWith('player_session=')),false,`${path} mints no player session`);
  }
  assert.equal(await sessions(),before,'retired handoff routes create no session');
  const logout=await request('/api/auth/logout',{method:'POST',cookie:boCookie,body:{}});assert.equal(logout.status,200);
  const cleared=logout.headers.getSetCookie();
  assert.ok(cleared.some(value=>value.startsWith('bo_jwt=;')),'shared-origin logout clears the administrator cookie');
  assert.equal(cleared.some(value=>value.startsWith('bo_game_state=')),false,'no handoff state cookie remains to clear');
  const relogin=await native('login',{user:'fixtureadmin',pass:password});assert.equal(relogin.status,200,'logout leaves the account usable');
});
