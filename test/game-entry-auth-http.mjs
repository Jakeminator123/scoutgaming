// Native N1 login against the actual engine on its own PostgreSQL database: the
// Studio auth actions use the same async stores (and FOR UPDATE) as production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createStudioNativeAuthActions} from '../apps/studio/lib/studio-native-auth-actions.mjs';
import {createStudioNativeAuth} from '../packages/studio-access/studio-native-auth.mjs';
import {playerAreaPage} from '../apps/web/lib/player-area.mjs';
import {ENGINE_QA_SKIP,createEngineDatabase,freePort,startEngine} from './fixtures/engine-qa.mjs';

test('fresh native N1 login reaches its own profile through the actual isolated engine and logs out coherently',{skip:ENGINE_QA_SKIP},async t=>{
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
      DEMO_GUEST_ACCESS:'1',CROUPIER_GENERATED_SPEECH:'',CROUPIER_GENERATED_SPEECH_STREAMING:'',CROUPIER_ASTRID_CAMERA:'',PUBLIC_URL:origin,BO_URL:origin}});
  const {boDb,db:gameDb}=database.store,scope={environment:'fixture',workspaceId:'croupier'};
  const authorize=createStudioNativeAuth({boDb,scope});
  const actions=createStudioNativeAuthActions({boDb,gameDb,scope,authorize,publicOrigin:origin,rateLimit:async()=>true,clientAddress:()=> 'fixture'});
  const native=async(action,body,cookie='')=>actions.handle(new Request(origin+'/studio/api/auth/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',cookie},body:JSON.stringify(body)}));
  const other=await request('/api/auth/player/register',{method:'POST',body:{username:'other-player',password}});assert.equal(other.status,200);
  const foreign=other.headers.getSetCookie().find(value=>value.startsWith('player_session=')).split(';')[0];
  const foreignPlayer=await (await request('/api/player',{method:'POST',cookie:foreign,body:{}})).json();
  const loggedIn=await native('login',{user:'fixtureadmin',pass:password},foreign);assert.equal(loggedIn.status,200);
  const boCookie=loggedIn.headers.getSetCookie().find(value=>value.startsWith('bo_jwt=')).split(';')[0];
  assert.match(loggedIn.headers.getSetCookie().find(value=>value.startsWith('player_session=')),/Max-Age=0/);
  const playersBeforeHandoff=(await gameDb.prepare('SELECT count(*) n FROM players').get()).n;
  const freshSession=await(await request('/api/auth/session',{cookie:boCookie})).json();
  assert.equal(freshSession.backofficeHandoff,true,'fresh N1 alone advertises verified handoff');assert.equal(freshSession.guest,false);
  assert.equal((await gameDb.prepare('SELECT count(*) n FROM players').get()).n,playersBeforeHandoff,'session decision does not create a disposable guest wallet');
  for(const entry of ['/blackjack?table=room-evening','/play/roulette?table=room-evening']) {
    const gameEntry=await request(entry,{cookie:boCookie});assert.equal(gameEntry.status,303);
    assert.equal(gameEntry.headers.get('location'),'/api/auth/bo/start?next='+encodeURIComponent(entry));
  }
  const mixed=boCookie+'; '+foreign;
  const session=await(await request('/api/auth/session',{cookie:mixed})).json();assert.equal(session.authenticated,false);assert.equal(session.backofficeHandoff,true);
  const profilePage=cookie=>playerAreaPage(new Request(origin+'/play/profil',{headers:{cookie}}),{
    CROUPIER_VERCEL_UI:'1',CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_PUBLIC_ORIGIN:origin,CROUPIER_LAB_UI_ORIGIN:origin,CROUPIER_BACKEND_ORIGIN:'https://engine.fixture.invalid',CROUPIER_VERCEL_INGRESS_SECRET:'fixture-ingress-secret-'.repeat(3)
  },'profil',{fetchImpl:(url,init)=>request(new URL(url).pathname,{method:init.method||'GET',cookie:init.headers.get('cookie'),...(init.body?{body:JSON.parse(init.body)}:{})})});
  const page=await profilePage(mixed);
  assert.equal(page.redirect,'/api/auth/bo/start?next=%2Fplay%2Fprofil');
  const start=await request(page.redirect,{cookie:mixed}),state=start.headers.getSetCookie()[0].split(';')[0];assert.equal(start.status,303);
  const approved=await request(start.headers.get('location'),{cookie:boCookie});assert.equal(approved.status,303);
  const callback=await request(approved.headers.get('location'),{cookie:state+'; '+mixed});assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/play/profil');
  const own=callback.headers.getSetCookie().find(value=>value.startsWith('player_session=')).split(';')[0],cookie=boCookie+'; '+own;
  const authenticated=await(await request('/api/auth/session',{cookie})).json();assert.equal(authenticated.authenticated,true);assert.equal(authenticated.backofficeHandoff,undefined);
  const player=await(await request('/api/player',{method:'POST',cookie,body:{}})).json();assert.notEqual(player.id,foreignPlayer.id);assert.equal(player.name,'fixtureadmin');
  assert.deepEqual(await(await request('/api/player',{method:'POST',cookie:foreign,body:{}})).json(),foreignPlayer,'other account balance and data remain unchanged');
  const ownProfile=await profilePage(cookie);assert.equal(ownProfile.redirect,null);assert.equal(ownProfile.data.player.name,'fixtureadmin');assert.match(ownProfile.html,/fixtureadmin/);
  const pendingCode=async bo=>{const start=await request('/api/auth/bo/start?next=/play/profil',{cookie:bo});const issued=await request(start.headers.get('location'),{cookie:bo});return {url:issued.headers.get('location'),state:start.headers.getSetCookie()[0].split(';')[0]};};
  const pending=await pendingCode(boCookie);
  const logout=await native('logout',{},cookie);assert.equal(logout.status,200);
  assert.equal((await(await request('/api/auth/session',{cookie})).json()).authenticated,false,'revoked player cookie cannot be replayed');
  assert.equal((await(await request('/api/auth/session',{cookie})).json()).backofficeHandoff,undefined,'revoked BO epoch cannot restart SSO');
  const before=(await gameDb.prepare('SELECT count(*) n FROM player_sessions').get()).n;
  assert.ok([400,401].includes((await request(pending.url,{cookie:pending.state+'; '+cookie})).status),'pending code cannot survive native logout');
  const again=await native('login',{user:'fixtureadmin',pass:password}),newBo=again.headers.getSetCookie().find(value=>value.startsWith('bo_jwt=')).split(';')[0];
  const pendingPlayerLogout=await pendingCode(newBo);
  const playerLogout=await request('/api/auth/logout',{method:'POST',cookie:newBo,body:{}});assert.equal(playerLogout.status,200);
  assert.ok(playerLogout.headers.getSetCookie().some(value=>value.startsWith('bo_game_state=; Path=/api/auth/bo/callback;')));
  assert.ok(playerLogout.headers.getSetCookie().some(value=>value.startsWith('bo_jwt=;')));
  assert.ok([400,401].includes((await request(pendingPlayerLogout.url,{cookie:pendingPlayerLogout.state+'; '+newBo})).status),'a delayed callback carrying both pre-logout cookies must be revoked server-side');
  assert.equal((await gameDb.prepare('SELECT count(*) n FROM player_sessions').get()).n,before,'logout callbacks cannot mint another session');
  assert.equal((await(await request('/api/auth/session',{cookie:newBo})).json()).backofficeHandoff,undefined,'old BO cookie cannot advertise a new authenticated handoff');
  const newStart=await request('/api/auth/bo/start?next=/play/profil',{cookie:newBo});assert.equal(newStart.status,303);
  const newAuthorization=await request(newStart.headers.get('location'),{cookie:newBo});
  assert.equal(newAuthorization.status,303);assert.match(newAuthorization.headers.get('location'),/^\/admin\/login\?returnTo=/,'old BO cookie must reauthenticate before a fresh code can be minted');
  assert.equal((await gameDb.prepare('SELECT count(*) n FROM player_sessions').get()).n,before);
});
