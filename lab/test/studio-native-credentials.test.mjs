import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
import { createStudioNativeAuth } from '../lib/studio-native-auth.mjs';
import { createStudioNativeAuthActions } from '../lib/studio-native-auth-actions.mjs';
import { createStudioAdminAccounts } from '../lib/studio-admin-accounts.mjs';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { createStudioGameAuthority } from '../lib/studio-game-authority.mjs';
import { createStudioAdminData } from '../lib/studio-admin-data.mjs';
import { craigIdentity } from '../../web/storage/async-craig-identity.mjs';
import { playerAuth } from '../../web/storage/async-player-auth.mjs';
import { createAccountCredentialResolver } from '../../web/account-credentials.mjs';

const scope = { environment:'fixture',workspaceId:'croupier' };
const origin = 'https://studio.fixture.invalid';
const freshPassword = () => randomBytes(24).toString('base64url');
const credential = password => { const salt=randomBytes(16).toString('hex');return {salt,hash:scryptSync(password,salt,64).toString('hex')}; };
function loginFixture(role='admin') {
  const password=freshPassword(), signer=randomBytes(32).toString('hex');
  const state={users:[{id:'7',username:'operator',email:'operator@example.invalid',role,...credential(password)}],local:[],writes:[],limits:[]};
  function prepare(sql) {
    async function all(...args) {
      if(sql.includes('FROM meta'))return [{v:signer}];
      if(sql.includes('FROM bo_auth_epochs'))return [{epoch:0}];
      if(sql.includes('FROM users')) {
        if(sql.includes('lower(username)'))return state.users.filter(row=>row.username.toLowerCase()===args[0]||row.email.toLowerCase()===args[0]);
        if(sql.includes('username=?'))return state.users.filter(row=>row.username===args[0]);
        return state.users.filter(row=>String(row.id)===String(args[0]));
      }
      if(sql.includes('FROM player_accounts'))return state.local.filter(row=>args.includes(row.email.toLowerCase()));
      throw Error('Unexpected fixture query');
    }
    return {all,get:async(...args)=>(await all(...args))[0],run:async(...args)=>{state.writes.push({sql,args});return {changes:1};}};
  }
  const boDb={prepare,transaction:work=>work()},gameDb={prepare,transaction:work=>work()};
  const authorize=createStudioNativeAuth({boDb,scope});
  const actions=createStudioNativeAuthActions({boDb,gameDb,scope,authorize,publicOrigin:origin,
    rateLimit:async input=>{state.limits.push(input);return true;},clientAddress:()=> 'fixture-client'});
  const request=(user='operator',pass=password,extra={})=>new Request(origin+'/studio/api/auth/login',{method:'POST',
    headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({user,pass,...extra})});
  return {state,password,boDb,gameDb,authorize,actions,request};
}

test('same username/email password admits admin and legacy superadmin without changing raw roles or game cookies',async()=>{
  for(const role of ['admin','superadmin']) {
    const f=loginFixture(role);
    for(const login of ['operator','OPERATOR@example.invalid']) {
      const response=await f.actions.handle(f.request(login));
      assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{ok:true,username:'operator',role:'admin'});
      const cookie=response.headers.get('set-cookie');
      assert.match(cookie,/^bo_jwt=.*HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
      assert.doesNotMatch(cookie,/player_session|preview_session|lab_session/);
      const token=cookie.slice(7).split(';')[0],claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
      assert.equal(claims.aud,'backoffice');assert.equal(claims.role,role);
      const actor=await f.authorize(new Request(origin+'/studio/api/auth/session',{headers:{cookie:'bo_jwt='+token}}));
      assert.equal(actor.role,'admin');
    }
    assert.equal(f.state.users[0].role,role);
    assert.deepEqual(f.state.writes,[]);
    assert.deepEqual(f.state.limits.map(row=>row.user),['craig:7','craig:7']);
  }
});

test('nonadmin credentials, wrong passwords and client-selected roles never mint a Studio cookie',async()=>{
  for(const role of ['reader','staff','player']) {
    const f=loginFixture(role),response=await f.actions.handle(f.request());
    assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);
    assert.deepEqual(await response.json(),{error:'Authentication required'});
    assert.deepEqual(f.state.writes,[]);assert.equal(f.state.users[0].role,role);
  }
  const f=loginFixture();
  const wrong=await f.actions.handle(f.request('operator',freshPassword()));
  assert.equal(wrong.status,401);assert.equal(wrong.headers.get('set-cookie'),null);
  const spoof=await f.actions.handle(f.request('operator',f.password,{role:'admin'}));
  assert.equal(spoof.status,400);assert.equal(spoof.headers.get('set-cookie'),null);
});

test('native login shares game collision rules, including local and pending identities',async()=>{
  for(const pending of [false,true]) {
    const f=loginFixture();
    if(pending){f.state.users[0].salt=null;f.state.users[0].hash=null;}
    f.state.local=[{email:'username:operator',player_id:'local-player',...credential(f.password)}];
    const response=await f.actions.handle(f.request());
    assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);
    assert.deepEqual(await response.json(),{error:'Authentication required'});
    assert.deepEqual(f.state.writes,[]);
  }
  const local=loginFixture();local.state.users=[];
  local.state.local=[{email:'username:operator',player_id:'local-player',...credential(local.password)}];
  const response=await local.actions.handle(local.request());
  assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);
});

test('admin invitation refuses a player namespace collision before identity/token writes',async()=>{
  const f=loginFixture();f.state.users=[];
  f.state.local=[{email:'operator@example.invalid',player_id:'existing-player'}];
  const accounts=createStudioAdminAccounts({boDb:f.boDb,gameDb:f.gameDb,scope,mail:{send:async()=>({sent:true})},publicOrigin:origin});
  const handler=accounts.handlers.get('POST /studio/api/admin/users/invite');
  await assert.rejects(handler({body:{email:'operator@example.invalid',role:'admin'},actor:{user:'admin',role:'admin'},scope}),error=>error.statusCode===409);
  assert.deepEqual(f.state.writes,[]);
});

test('password action requires game authority and cancellation/lifecycle gates and never mutates Vercel storage',async()=>{
  let commands=0;
  const boDb={prepare:()=>assert.fail('no local database write'),transaction:()=>assert.fail('no local password transaction')};
  const absent=createStudioAdminAccounts({boDb,scope});
  assert.equal(absent.handlers.has('POST /studio/api/admin/players/password'),false);
  const password=freshPassword(),body={playerId:'fixture-player',password,reason:'operator request'};
  const accounts=createStudioAdminAccounts({boDb,scope,gameAuthority:{async execute(context){
    commands++;assert.equal(context.action,'players/password');assert.deepEqual(context.body,body);
    assert.equal(context.actor.role,'admin');return {ok:true,id:body.playerId,changed:true,password,secret:'must-not-leak'};
  }}});
  const session={user:'operator',role:'admin',scope};
  const makeApi=(gates=accounts.gates,actor=session)=>createStudioAdminApi({authorize:()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],handlers:accounts.handlers,gates});
  const request=payload=>new Request(origin+'/studio/api/admin/players/password',{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(payload??body)});
  for(const requirement of ['game-authority','player-lifecycle-and-ledger','cancel-player-runtime']) {
    const gates=new Map(accounts.gates);gates.delete(requirement);
    const blocked=makeApi(gates);assert.equal((await blocked.handle(request())).status,503);assert.deepEqual(blocked.availableActions(session).filter(action=>action.includes('players/password')),[]);
  }
  for(const role of ['reader','staff','player'])assert.equal((await makeApi(accounts.gates,{...session,role}).handle(request())).status,403);
  for(const patch of [{password:''},{password:'x'.repeat(129)},{reason:''},{role:'admin'}])assert.equal((await makeApi().handle(request({...body,...patch}))).status,400);
  assert.equal(commands,0);
  const response=await makeApi().handle(request());assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,id:body.playerId,changed:true});assert.equal(commands,1);
});

test('password transport uses the signed Render boundary and strips all credentials from its response',async()=>{
  const password=freshPassword(),ingress=freshPassword(),body={playerId:'fixture-player',password,reason:'operator request'};
  let calls=0;
  const authority=createStudioGameAuthority({scope,env:{CROUPIER_PUBLIC_ORIGIN:origin,CROUPIER_BACKEND_ORIGIN:'https://backend.fixture.invalid',CROUPIER_VERCEL_INGRESS_SECRET:ingress},fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://backend.fixture.invalid/api/studio-game/command');
    const payload=JSON.parse(options.body);assert.equal(payload.action,'players/password');assert.equal(payload.actor.role,'admin');assert.deepEqual(payload.body,body);
    assert.match(options.headers['x-croupier-studio-signature'],/^[a-f0-9]{64}$/);
    return Response.json({ok:true,authority:'render',scope,id:body.playerId,changed:true,password,secret:ingress});
  }});
  const input={action:'players/password',body,actor:{user:'operator',role:'superadmin'},scope,request:new Request(origin,{headers:{cookie:'bo_jwt=fixture'}})};
  assert.deepEqual(await authority.execute(input),{ok:true,id:body.playerId,changed:true});
  await assert.rejects(authority.execute({...input,actor:{user:'operator',role:'staff'}}),error=>error.statusCode===403);
  assert.equal(calls,1);
});

test('two concurrent administrator removals keep one live administrator and deny the revoked actor',async()=>{
  const users=[{id:'1',username:'one',role:'admin',hash:randomBytes(64).toString('hex')},{id:'2',username:'two',role:'superadmin',hash:randomBytes(64).toString('hex')}];
  let queue=Promise.resolve();
  const boDb={transaction(work){const result=queue.then(work);queue=result.catch(()=>{});return result;},prepare(sql){
    const all=async(...args)=>{
      if(sql.includes("role IN ('admin','superadmin')"))return users.filter(user=>['admin','superadmin'].includes(user.role)&&user.hash);
      if(sql.includes('FROM users'))return users.filter(user=>user.username===args[0]);
      return [];
    };
    return {all,get:async(...args)=>(await all(...args))[0],run:async(...args)=>{if(sql.startsWith('DELETE FROM users'))users.splice(users.findIndex(user=>user.id===args[0]),1);return {changes:1};}};
  }};
  const data=createStudioAdminData({db:boDb,boDb,scope,repository:{readDocument:async()=>null,saveDocument:async()=>null}});
  const remove=data.handlers.get('POST /studio/api/admin/users/remove');
  const context=(actor,target)=>({body:{username:target},actor:{user:actor,role:'admin'},scope});
  const results=await Promise.allSettled([remove(context('one','two')),remove(context('two','one'))]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.statusCode===403).length,1);
  assert.deepEqual(users.map(user=>user.username),['one']);
  await assert.rejects(remove(context('one','one')),error=>error.statusCode===403);
});

test('Studio password tokens reject unknown roles and preserve the single-use token',async()=>{
  for(const role of ['unknown','ADMIN','']) {
    const token=randomBytes(32).toString('base64url'),original=credential(freshPassword());
    const state={token:{username:'game-only',kind:'reset'},user:{id:'7',username:'game-only',role,...original},writes:0};
    const boDb={async transaction(work){const tokenBefore=state.token,userBefore={...state.user};try{return await work();}catch(error){state.token=tokenBefore;state.user=userBefore;throw error;}},prepare(sql){
      const all=async()=>{
        if(sql.startsWith('DELETE FROM tokens')&&sql.includes('RETURNING')){const found=state.token;state.token=null;return found?[found]:[];}
        if(sql.startsWith('SELECT id,role FROM users'))return [state.user];
        if(sql.startsWith('UPDATE users')){state.writes++;assert.fail('game-only password must not change');}
        return [];
      };return {all,get:async()=>(await all())[0],run:async()=>{state.writes++;assert.fail('no revocation/mutation after denied role');}};
    }};
    const actions=createStudioNativeAuthActions({boDb,scope,authorize:()=>assert.fail('no logged-in actor needed'),publicOrigin:origin,rateLimit:async()=>true,clientAddress:()=> 'fixture-client'});
    const response=await actions.handle(new Request(origin+'/studio/api/auth/set-password',{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({token,pass:freshPassword()})}));
    assert.equal(response.status,400);assert.equal(response.headers.get('set-cookie'),null);
    assert.equal(state.token?.kind,'reset');assert.equal(state.user.hash,original.hash);assert.equal(state.writes,0);
  }
});


function legacyResetFixture(role,{pending=false}={}) {
  const password=freshPassword(),clock=Date.now();
  const state={user:{id:'7',username:'game-only',email:'game-only@example.invalid',role,...(pending?{salt:null,hash:null}:credential(password))},tokens:new Map(),mail:[],revoked:[],epoch:4,gameSession:null};
  const boDb={async transaction(work){const user={...state.user},tokens=new Map(state.tokens);try{return await work();}catch(error){state.user=user;state.tokens=tokens;throw error;}},prepare(sql){
    const all=async(...args)=>{
      if(sql.startsWith('DELETE FROM tokens')&&sql.includes('RETURNING')) {
        const found=[...state.tokens].filter(([key,value])=>[args[0],args[1]].includes(key)&&value.exp>=args[2]);
        for(const[key]of found)state.tokens.delete(key);return found.map(([,value])=>({username:value.username,kind:value.kind}));
      }
      if(sql.startsWith('UPDATE users')) {state.user.salt=args[0];state.user.hash=args[1];state.epoch++;return [{id:state.user.id}];}
      if(sql.includes('FROM bo_auth_epochs'))return [{epoch:state.epoch}];
      if(sql.includes('FROM users')) {
        if(sql.includes('lower(username)'))return [state.user].filter(user=>user.username===args[0]||user.email===args[0]);
        if(sql.includes('username=?'))return [state.user].filter(user=>user.username===args[0]);
        return [state.user].filter(user=>user.id===String(args[0]));
      }
      if(sql.includes('FROM player_accounts'))return [];
      if(sql.includes('FROM player_sessions'))return state.gameSession?.digest===args[0]?[state.gameSession]:[];
      if(sql.includes('FROM craig_player_links'))return [{craig_user_id:'7'}];
      if(sql.includes('FROM players'))return [{status:'active'}];
      throw Error('Unexpected legacy-reset fixture query');
    };
    const run=async(...args)=>{
      if(sql.startsWith('INSERT INTO tokens'))state.tokens.set(args[0],{username:args[1],kind:args[2],exp:args[3]});
      else if(sql.startsWith('DELETE FROM tokens')){for(const[key,value]of state.tokens)if(value.username===args[0])state.tokens.delete(key);}
      else if(sql.startsWith('DELETE FROM lab_sessions'))state.revoked.push('lab');
      else if(sql.startsWith('DELETE FROM bo_lab_handoffs'))state.revoked.push('handoffs');
      else throw Error('Unexpected legacy-reset fixture mutation');
      return {changes:1};
    };
    return {all,get:async(...args)=>(await all(...args))[0],run};
  }};
  const identity=craigIdentity(boDb),authorize=createStudioNativeAuth({boDb,scope});
  const mail={send:async invitation=>{state.mail.push(invitation);return {sent:true};}};
  const actions=createStudioNativeAuthActions({boDb,gameDb:boDb,scope,authorize,mail,publicOrigin:origin,now:()=>clock,rateLimit:async()=>true,clientAddress:()=> 'legacy-reset-fixture'});
  const accounts=createStudioAdminAccounts({boDb,gameDb:boDb,scope,mail,publicOrigin:origin,now:()=>clock});
  const request=(action,body)=>new Request(origin+'/studio/api/auth/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(body)});
  const game=playerAuth(boDb,()=>assert.fail('reset/session must not create a player'),identity,{playerAccounts:true});
  const credentials=createAccountCredentialResolver({identity,playerDb:boDb,playerAccounts:true});
  return {state,password,identity,actions,accounts,request,game,credentials};
}

test('admin can resend activation or reset for stored reader/staff and preserve their game-only roles',async()=>{
  for(const role of ['reader','staff'])for(const pending of [false,true]) {
    const f=legacyResetFixture(role,{pending}),handler=f.accounts.handlers.get('POST /studio/api/admin/users/resend');
    const result=await handler({scope,actor:{user:'administrator',role:'admin'},body:{username:'game-only'}});
    assert.deepEqual(result,{ok:true,kind:pending?'invite':'reset',emailSent:true});
    assert.equal(f.state.mail.length,1);assert.equal(f.state.mail[0].role,role);
    const token=new URL(f.state.mail[0].link).searchParams.get('t'),nextPassword=freshPassword();
    const reset=await f.actions.handle(f.request('set-password',{token,pass:nextPassword}));
    assert.equal(reset.status,200);assert.deepEqual(await reset.json(),{ok:true});
    const cookies=reset.headers.get('set-cookie');assert.match(cookies,/bo_jwt=;.*Max-Age=0/);assert.match(cookies,/lab_session=;.*Max-Age=0/);
    assert.doesNotMatch(cookies,/bo_jwt=[A-Za-z0-9]|player_session/);
    const gameCredentials=await f.credentials.authenticate('game-only',nextPassword);
    assert.equal(gameCredentials?.role,'player');assert.equal(gameCredentials?.accountRole,role);
    const studio=await f.actions.handle(f.request('login',{user:'game-only',pass:nextPassword}));
    assert.equal(studio.status,401);assert.equal(studio.headers.get('set-cookie'),null);
    assert.equal(f.state.user.role,role);assert.deepEqual(f.state.revoked,['lab','handoffs']);
    assert.equal((await f.actions.handle(f.request('set-password',{token,pass:freshPassword()}))).status,400);
  }
});

test('reader/staff self-reset invalidates prior game fingerprint while new password remains game-only',async()=>{
  for(const role of ['reader','staff']) {
    const f=legacyResetFixture(role),bearer=randomBytes(32).toString('hex');
    f.state.gameSession={digest:createHash('sha256').update(bearer).digest('hex'),player_id:'game-player',source_stamp:await f.identity.stamp('7')};
    const gameRequest={headers:{cookie:'player_session='+bearer}};
    assert.equal((await f.game.session(gameRequest))?.playerId,'game-player');
    const requested=await f.actions.handle(f.request('reset-request',{user:'game-only@example.invalid'}));
    assert.deepEqual(await requested.json(),{ok:true});assert.equal(requested.headers.get('set-cookie'),null);
    assert.equal(f.state.mail.length,1);assert.equal(f.state.mail[0].kind,'reset');
    const token=new URL(f.state.mail[0].link).searchParams.get('t'),nextPassword=freshPassword();
    assert.equal((await f.actions.handle(f.request('set-password',{token,pass:nextPassword}))).status,200);
    assert.equal(await f.game.session(gameRequest),null);
    assert.equal(await f.credentials.authenticate('game-only',f.password),null);
    assert.equal((await f.credentials.authenticate('game-only',nextPassword))?.role,'player');
    assert.equal((await f.actions.handle(f.request('login',{user:'game-only',pass:nextPassword}))).status,401);
    assert.equal(f.state.user.role,role);assert.deepEqual(f.state.revoked,['lab','handoffs']);
  }
});

test('unknown CRAIG roles cannot mint, resend or publicly request credential resets',async()=>{
  const f=legacyResetFixture('unknown');
  const response=await f.actions.handle(f.request('reset-request',{user:'game-only'}));
  assert.deepEqual(await response.json(),{ok:true});assert.equal(f.state.mail.length,0);assert.equal(f.state.tokens.size,0);
  await assert.rejects(f.accounts.handlers.get('POST /studio/api/admin/users/resend')({scope,actor:{user:'administrator',role:'admin'},body:{username:'game-only'}}),error=>error.statusCode===409);
  assert.equal(f.state.tokens.size,0);assert.equal(f.state.user.role,'unknown');
});
