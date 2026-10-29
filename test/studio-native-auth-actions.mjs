import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, scryptSync } from 'node:crypto';
import { createStudioNativeAuthActions, createStudioLoginRateLimit, createStudioPasswordDelivery } from '../apps/studio/lib/studio-native-auth-actions.mjs';
import { createStudioNativeAuth } from '../packages/studio-access/studio-native-auth.mjs';
import { fixtureDatabaseUrl } from './fixtures/database-url.mjs';
import { nativeStudioAdminConfiguration, createNativeStudioRequestHandlers } from '../apps/studio/lib/studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from '../apps/studio/lib/studio-native-request.mjs';
import { createStudioAdminApi } from '../apps/studio/lib/studio-admin-api.mjs';
import { studioAdminEndpoint } from '../apps/studio/lib/studio-admin-contract.mjs';

const scope = { environment:'fixture',workspaceId:'croupier' }, publicOrigin = 'https://studio.example.invalid';
const password = 'existing-private-password', salt = 'fixture-salt';
function fixture(overrides = {}) {
  let state = { users:[{ id:'7',username:'Operator',email:'operator@example.invalid',role:'superadmin',salt,
    hash:scryptSync(password,salt,64).toString('hex') }], tokens:[],playerAccounts:[],playerSessions:[],gameHandoffs:[],meta:{ jwt_secret:'a'.repeat(64) },epochs:{ 7:2 },lab:['7'],handoffs:['7'] };
  const reads = [], mail = [], counters = [], clock = { value:2_000_000 }, failure = { sql:null };
  let tail = Promise.resolve();
  const boDb = { transaction(work) {
    const pending = tail.then(async () => {
      const before = structuredClone(state);
      try { return await work(); } catch (error) { state = before; throw error; }
    });
    tail = pending.catch(() => {}); return pending;
  }, prepare(sql) {
    reads.push(sql);
    const query = async args => {
      if (failure.sql && sql.startsWith(failure.sql)) throw Error('PRIVATE DATABASE CONNECTION');
      if (sql === "SELECT v FROM meta WHERE k='jwt_secret'") return state.meta.jwt_secret ? [{v:state.meta.jwt_secret}] : [];
      if (sql === 'SELECT v FROM meta WHERE k=? FOR UPDATE') return state.meta[args[0]] === undefined ? [] : [{v:state.meta[args[0]]}];
      if (sql.startsWith('INSERT INTO meta')) { state.meta[args[0]] = args[1]; return []; }
      if (sql.includes('LEFT JOIN bo_auth_epochs')) return state.users.filter(user => sql.includes('lower(u.username)')
        ? user.username.toLowerCase() === args[0] || user.email?.toLowerCase() === args[1] : user.id === String(args[0]))
        .map(user => ({ ...user, epoch: state.epochs[user.id] ?? 0 }));
      if (sql.includes('FROM users WHERE lower(username)=? OR lower(email)=?')) return state.users.filter(user => user.username.toLowerCase() === args[0] || user.email?.toLowerCase() === args[1]);
      if (sql === 'SELECT id FROM users WHERE username=? FOR UPDATE' || sql === 'SELECT id,role FROM users WHERE username=? FOR UPDATE') return state.users.filter(user => user.username === args[0]);
      if (sql === 'SELECT role FROM users WHERE id=?' || sql === 'SELECT salt,hash FROM users WHERE id=?') return state.users.filter(user => user.id === String(args[0]));
      if (sql === 'SELECT epoch FROM bo_auth_epochs WHERE user_id=?') return [{epoch:state.epochs[args[0]] || 0}];
      if (sql.startsWith('INSERT INTO bo_auth_epochs')) { state.epochs[args[0]] = (state.epochs[args[0]] || 0) + 1; return []; }
      if (sql === 'DELETE FROM lab_sessions WHERE craig_user_id=?') { state.lab = state.lab.filter(id => id !== String(args[0])); return []; }
      if (sql === 'DELETE FROM bo_lab_handoffs WHERE craig_user_id=?') { state.handoffs = state.handoffs.filter(id => id !== String(args[0])); return []; }
      if (sql.startsWith('INSERT INTO tokens')) { state.tokens.push({token:args[0],username:args[1],kind:args[2],exp:args[3]}); return []; }
      if (sql === 'DELETE FROM tokens WHERE username=?') { state.tokens = state.tokens.filter(token => token.username !== args[0]); return []; }
      if (sql.startsWith('DELETE FROM tokens WHERE (token=? OR token=?)')) {
        const selected = state.tokens.filter(token => (token.token === args[0] || token.token === args[1]) && token.exp >= args[2] && ['invite','reset'].includes(token.kind));
        state.tokens = state.tokens.filter(token => !selected.includes(token)); return selected;
      }
      if (sql === 'UPDATE users SET salt=?,hash=? WHERE username=? RETURNING id') {
        const selected = state.users.filter(user => user.username === args[2]);
        for (const user of selected) { user.salt = args[0]; user.hash = args[1]; state.epochs[user.id] = (state.epochs[user.id] || 0) + 1; }
        return selected.map(user => ({ id:user.id }));
      }
      throw Error(`Unhandled test SQL: ${sql}`);
    };
    return { all:(...args) => query(args),get:async (...args) => (await query(args))[0],run:async (...args) => { await query(args); return {changes:1}; } };
  } };
  const gameDb = { prepare(sql) {
    reads.push(sql);
    if (sql === 'DELETE FROM player_sessions WHERE digest=?') return { run:async value => {
      const count=state.playerSessions.length;state.playerSessions=state.playerSessions.filter(session=>session.digest!==value);
      return {changes:count-state.playerSessions.length};
    } };
    if (sql === 'DELETE FROM bo_game_handoffs WHERE craig_user_id=?') return { run:async value => {
      const count=state.gameHandoffs.length;state.gameHandoffs=state.gameHandoffs.filter(flow=>flow.craig_user_id!==value);
      return {changes:count-state.gameHandoffs.length};
    } };
    assert.equal(sql, 'SELECT email,player_id,salt,hash FROM player_accounts WHERE lower(email)=? OR lower(email)=?');
    return { all: async (...args) => state.playerAccounts.filter(account => args.includes(account.email.toLowerCase())) };
  } };
  const authorize = createStudioNativeAuth({ boDb,scope,now:() => clock.value });
  const rateLimit = createStudioLoginRateLimit({ boDb,now:() => clock.value });
  const send = async invitation => { mail.push(invitation); return {sent:true}; };
  const options = { boDb,gameDb,scope,authorize,publicOrigin,allowedOrigins:[publicOrigin],now:() => clock.value,
    mail:{send},clientAddress:() => 'trusted-edge-client',rateLimit:async input => { counters.push(input); return rateLimit(input); },...overrides };
  const actions = createStudioNativeAuthActions(options);
  function request(action,body = {},options = {}) {
    return new Request(`${publicOrigin}/studio/api/auth/${action}`,{method:'POST',headers:{ 'Content-Type':'application/json',
      Origin:publicOrigin,'Sec-Fetch-Site':'same-origin',...(options.headers || {}) },body:JSON.stringify(body),...options });
  }
  const call = (action,body,options) => actions.handle(request(action,body,options));
  return { get state() { return state; },boDb,clock,mail,reads,counters,failure,authorize,actions,call,request,options };
}
const status = expected => error => error.statusCode === expected;

test('unified login and session retain real credentials, scoped writes and immediate revocation', async () => {
  const config = nativeStudioAdminConfiguration({
    CROUPIER_PUBLIC_ORIGIN:publicOrigin,
    CROUPIER_STUDIO_ENVIRONMENT_ID:scope.environment,CROUPIER_STUDIO_WORKSPACE_ID:scope.workspaceId,
    CROUPIER_GAME_DATABASE_URL:fixtureDatabaseUrl('postgres://fixture.neon.tech/fixture?sslmode=require','fixture') });
  const f = fixture({allowedOrigins:config.allowedOrigins});
  const login = await f.actions.handle(normalizeNativeStudioRequest(f.request('login',{user:'operator',pass:password}),config));
  assert.equal(login.status,200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const endpoint = studioAdminEndpoint('POST','/studio/api/admin/tier');
  let writes = 0, checks = 0, revokeDuringLock = false;
  const api = createStudioAdminApi({ authorize:async request=>{checks++;return f.authorize(request);},
    allowedOrigins:config.allowedOrigins,publicHosts:config.publicHosts,
    handlers:new Map([['POST /studio/api/admin/tier',async context=>{
      assert.deepEqual(context.scope,scope);assert.equal(context.actor.accountId,'7');
      assert.deepEqual(context.body,{tier:'fixture',expectedRevision:3});writes++;return {ok:true};
    }]]),gates:new Map(endpoint.handlerRequirements.map(name=>[name,async()=>true])),
    mutationTransaction:async work=>{if(revokeDuringLock)f.state.epochs['7']++;return work();} });
  const native = createNativeStudioRequestHandlers({configuration:()=>config,runtime:async()=>({api,authorize:f.authorize})});
  const headers={cookie,host:'studio.example.invalid','x-forwarded-host':'studio.example.invalid','x-forwarded-proto':'https'};
  const sessionRequest=()=>new Request(publicOrigin+'/api/auth/session',{headers});
  const session=await native.handleNativeSession(sessionRequest());
  assert.equal(session.status,200);assert.deepEqual(await session.json(),{username:'Operator',role:'admin',availableActions:['POST tier'],gameOrigin:publicOrigin});
  const post=(extra={})=>new Request(publicOrigin+'/api/admin/tier',{method:'POST',headers:{...headers,origin:publicOrigin,
    'sec-fetch-site':'same-origin','content-type':'application/json',...extra},body:JSON.stringify({tier:'fixture',expectedRevision:3})});
  assert.equal((await native.handleNativeAdmin(post())).status,200);assert.equal(writes,1);assert.equal(checks,3);
  for(const change of [{origin:'https://foreign.invalid'},{'x-forwarded-host':'foreign.invalid'},{'sec-fetch-site':'cross-site'},{'next-action':'fixture'}]){
    assert.equal((await native.handleNativeAdmin(post(change))).status,403);assert.equal(checks,3);
  }
  const missingOrigin=post();missingOrigin.headers.delete('origin');
  assert.equal((await native.handleNativeAdmin(missingOrigin)).status,403);assert.equal(writes,1);
  revokeDuringLock=true;
  assert.equal((await native.handleNativeAdmin(post())).status,401);assert.equal(writes,1);
  assert.equal((await native.handleNativeSession(sessionRequest())).status,401);
  assert.equal((await native.handleNativeAdmin(post())).status,401);assert.equal(writes,1);
});

test('native login reuses existing identity and signer; resulting cookie validates all current claims', async () => {
  const f = fixture();
  const login = await f.call('login',{user:' OPERATOR@EXAMPLE.INVALID ',pass:password});
  assert.equal(login.status,200); assert.deepEqual(await login.json(),{ok:true,username:'Operator',role:'admin'});
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
  const jwt = cookie.split(';')[0];
  assert.deepEqual(await f.authorize(new Request(`${publicOrigin}/studio/api/auth/session`,{headers:{cookie:jwt}})),{accountId:'7',user:'Operator',role:'admin',scope});
  assert.equal(f.state.meta.jwt_secret,'a'.repeat(64)); assert.equal(f.state.users.length,1);
  assert.equal(f.state.users[0].role,'superadmin'); assert.equal(f.counters[0].user,'craig:7');
  f.state.epochs['7']++;
  await assert.rejects(f.authorize(new Request(`${publicOrigin}/studio/api/auth/session`,{headers:{cookie:jwt}})),status(401));
});

test('successful Studio login clears a foreign player cookie without changing its stored session or wallet', async () => {
  const f=fixture(),token='b'.repeat(64),digest=createHash('sha256').update(token).digest('hex');
  f.state.playerSessions=[{digest,player_id:'foreign-player'}];f.state.players=[{id:'foreign-player',balance:321}];
  const wallet=structuredClone(f.state.players),before=structuredClone(f.state.playerSessions),request=f.request('login',{user:'operator',pass:password});
  request.headers.set('cookie','player_session='+token);
  const result=await f.actions.handle(request),cookies=result.headers.getSetCookie();
  assert.equal(result.status,200);assert.equal(cookies.length,2);
  assert.ok(cookies.some(value=>/^bo_jwt=[A-Za-z0-9_.-]+;/.test(value)));
  assert.ok(cookies.includes('player_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure'));
  assert.deepEqual(f.state.playerSessions,before);assert.deepEqual(f.state.players,wallet);
});

test('wrong password and foreign Origin never clear or revoke a current player session', async () => {
  for(const invalid of ['password','origin']) {
    const f=fixture(),token='b'.repeat(64);
    f.state.playerSessions=[{digest:createHash('sha256').update(token).digest('hex'),player_id:'foreign-player'}];
    const before=structuredClone(f.state.playerSessions),request=f.request('login',{user:'operator',pass:invalid==='password'?'wrong':password});
    request.headers.set('cookie','player_session='+token);
    if(invalid==='origin')request.headers.set('origin','https://foreign.invalid');
    const result=await f.actions.handle(request);
    assert.equal(result.status,invalid==='password'?401:403);assert.deepEqual(result.headers.getSetCookie(),[]);
    assert.deepEqual(f.state.playerSessions,before);assert.equal(f.state.epochs['7'],2);
  }
});

test('Studio logout revokes only the current player digest and clears auth and handoff cookies', async () => {
  const f=fixture(),token='b'.repeat(64),other='c'.repeat(64),hash=value=>createHash('sha256').update(value).digest('hex');
  f.state.playerSessions=[{digest:hash(token),player_id:'foreign-player'},{digest:hash(other),player_id:'foreign-player'},{digest:hash('d'.repeat(64)),player_id:'other-player'}];
  f.state.players=[{id:'foreign-player',balance:321},{id:'other-player',balance:654}];const wallets=structuredClone(f.state.players);
  const login=await f.call('login',{user:'operator',pass:password}),boCookie=login.headers.getSetCookie().find(value=>value.startsWith('bo_jwt=')).split(';')[0];
  const request=f.request('logout',{});request.headers.set('cookie',boCookie+'; player_session='+token);
  const result=await f.actions.handle(request);
  assert.equal(result.status,200);assert.equal(result.headers.getSetCookie().length,4);
  assert.ok(result.headers.getSetCookie().some(value=>value.startsWith('player_session=;')&&value.includes('Max-Age=0')));
  assert.deepEqual(f.state.playerSessions,[{digest:hash(other),player_id:'foreign-player'},{digest:hash('d'.repeat(64)),player_id:'other-player'}]);
  assert.deepEqual(f.state.playerAccounts,[]);assert.equal(f.state.users.length,1);assert.deepEqual(f.state.players,wallets);
  const revocations=f.reads.filter(sql=>sql.includes('DELETE FROM player_sessions'));
  assert.deepEqual(revocations,['DELETE FROM player_sessions WHERE digest=?']);
});

test('Studio logout without game storage still clears the player cookie and revoked auth cannot delete sessions', async () => {
  const f=fixture(),login=await f.call('login',{user:'operator',pass:password});
  const actions=createStudioNativeAuthActions({...f.options,gameDb:undefined});
  const request=f.request('logout',{});request.headers.set('cookie',login.headers.getSetCookie()[0].split(';')[0]+'; player_session='+'b'.repeat(64));
  const result=await actions.handle(request);
  assert.equal(result.status,200);assert.equal(result.headers.getSetCookie().length,4);
  assert.ok(result.headers.getSetCookie().some(value=>value.startsWith('player_session=;')));
  assert.ok(result.headers.getSetCookie().includes('bo_game_state=; Path=/api/auth/bo/callback; HttpOnly; SameSite=Lax; Max-Age=0; Secure'));
  assert.equal((await f.actions.handle(new Request(request.url,{method:'POST',headers:request.headers,body:'{}'}))).status,401);
  assert.ok(f.reads.every(sql=>!sql.includes('DELETE FROM player_sessions')));
});

test('Studio logout revokes pending game codes only for the verified account and expires the callback-path cookie', async () => {
  const f=fixture();
  const current={state_digest:'current-state',code_digest:'issued-code',craig_user_id:'7',username:'Operator'};
  const another={state_digest:'another-state',code_digest:'another-code',craig_user_id:'8',username:'Operator'};
  const unissued={state_digest:'unissued-state',code_digest:null,craig_user_id:null};
  f.state.gameHandoffs=[current,{...current,state_digest:'second-state'},another,unissued];
  const login=await f.call('login',{user:'operator',pass:password}),request=f.request('logout',{});
  // The callback-path state cookie is not sent to the Studio logout path.
  request.headers.set('cookie',login.headers.getSetCookie()[0].split(';')[0]);
  const result=await f.actions.handle(request);
  assert.equal(result.status,200);assert.deepEqual(f.state.gameHandoffs,[another,unissued]);
  assert.ok(result.headers.getSetCookie().includes('bo_game_state=; Path=/api/auth/bo/callback; HttpOnly; SameSite=Lax; Max-Age=0; Secure'));
  assert.deepEqual(f.reads.filter(sql=>sql.includes('DELETE FROM bo_game_handoffs')),['DELETE FROM bo_game_handoffs WHERE craig_user_id=?']);
  assert.equal(f.state.users[0].role,'superadmin');assert.deepEqual(f.state.playerSessions,[]);
});

test('foreign Origin and ambiguous player cookies never revoke an arbitrary player session on Studio logout', async () => {
  for(const mode of ['origin','duplicate','invalid']) {
    const f=fixture(),token='b'.repeat(64);
    f.state.playerSessions=[{digest:createHash('sha256').update(token).digest('hex'),player_id:'foreign-player'}];
    f.state.gameHandoffs=[{state_digest:'pending',code_digest:'issued-code',craig_user_id:'7'}];
    const pending=structuredClone(f.state.gameHandoffs);
    const before=structuredClone(f.state.playerSessions),login=await f.call('login',{user:'operator',pass:password});
    const request=f.request('logout',{}),boCookie=login.headers.getSetCookie()[0].split(';')[0];
    request.headers.set('cookie',boCookie+'; player_session='+token+(mode==='duplicate'?'; player_session='+'c'.repeat(64):mode==='invalid'?'x':''));
    if(mode==='origin')request.headers.set('origin','https://foreign.invalid');
    const result=await f.actions.handle(request);
    assert.equal(result.status,mode==='origin'?403:200);assert.deepEqual(f.state.playerSessions,before);
    assert.ok(f.reads.every(sql=>!sql.includes('DELETE FROM player_sessions')));
    if(mode==='origin'){
      assert.deepEqual(result.headers.getSetCookie(),[]);assert.equal(f.state.epochs['7'],2);
      assert.deepEqual(f.state.gameHandoffs,pending);assert.ok(f.reads.every(sql=>!sql.includes('DELETE FROM bo_game_handoffs')));
    }
  }
});

test('native login accepts exact Admin destinations and refuses the retired game and Lab handoff', async () => {
  for (const returnTo of ['/admin', '/studio/administration']) {
    const f = fixture();
    assert.equal((await f.call('login',{user:'operator',pass:password,returnTo})).status,200);
  }
  for (const returnTo of [`/api/bo/game-login?state=${'a'.repeat(64)}`, `/api/bo/lab-login?state=${'a'.repeat(64)}`, `/api/bo/game-login?state=${'a'.repeat(63)}`,
    `/api/bo/lab-login?state=${'a'.repeat(64)}&token=secret`, '/api/bo/users', '//attacker.invalid']) {
    const f = fixture(); assert.equal((await f.call('login',{user:'operator',pass:password,returnTo})).status,400);
  }
});

test('login refuses wrong passwords, ambiguous identities, invalid role, incomplete account and missing existing signer', async () => {
  for (const [alter,pass] of [[f => {},'wrong-password'],[f => f.state.users.push({...f.state.users[0],id:'8'}),password],
    ...['reader','staff','player','unknown'].map(role=>[f => f.state.users[0].role=role,password]),[f => f.state.users[0].hash=null,password],
    [f => f.state.playerAccounts.push({email:'username:operator',player_id:'local-player'}),password]]) {
    const f = fixture(); alter(f);
    const result = await f.call('login',{user:'operator',pass});
    assert.equal(result.status,401); assert.equal(result.headers.get('set-cookie'),null);
    assert.deepEqual(await result.json(),{error:'Authentication required'});
  }
  const f = fixture(); delete f.state.meta.jwt_secret;
  const result = await f.call('login',{user:'operator',pass:password});
  assert.equal(result.status,503); assert.equal(f.state.meta.jwt_secret,undefined);
});

test('native public auth rejects cross-site, spoofed host, arbitrary fields and redirects before identity writes', async () => {
  const f = fixture();
  for (const [body,headers,expected] of [
    [{user:'operator',pass:password},{Origin:'https://attacker.invalid'},403],
    [{user:'operator',pass:password},{'Sec-Fetch-Site':'cross-site'},403],
    [{user:'operator',pass:password},{'X-Forwarded-Host':'attacker.invalid'},403],
    [{user:'operator',pass:password,actor:'superadmin'},{},400],
    [{user:'operator',pass:password,returnTo:'https://attacker.invalid'},{},400],
  ]) {
    const request = f.request('login',body); for (const [key,value] of Object.entries(headers)) request.headers.set(key,value);
    assert.equal((await f.actions.handle(request)).status,expected);
  }
  assert.equal(f.counters.length,0);
  const oversized = f.request('login',{user:'operator',pass:'x'.repeat(9000)});
  assert.equal((await f.actions.handle(oversized)).status,413);
  const invalidType = f.request('login',{user:'operator',pass:password}); invalidType.headers.set('content-type','text/plain');
  assert.equal((await f.actions.handle(invalidType)).status,415);
});

test('password delivery hashes new stored tokens and resend invalidates old token without returning bearer', async () => {
  const f = fixture(), delivery = createStudioPasswordDelivery({boDb:f.boDb,mail:f.options.mail,publicOrigin,now:() => f.clock.value});
  const first = await f.boDb.transaction(() => delivery.mint({username:'Operator',email:'operator@example.invalid',role:'superadmin',kind:'invite'}));
  const raw = new URL(first.link).searchParams.get('t');
  assert.match(f.state.tokens[0].token,/^studio-sha256:[a-f0-9]{64}$/);
  assert.equal(f.state.tokens[0].token,`studio-sha256:${createHash('sha256').update(raw).digest('hex')}`);
  const second = await f.boDb.transaction(() => delivery.mint({username:'Operator',email:'operator@example.invalid',role:'superadmin',kind:'reset'}));
  assert.notEqual(first.link,second.link); assert.equal(f.state.tokens.length,1);
  assert.equal((await f.call('set-password',{token:raw,pass:'new-private-password'})).status,400);
});

test('new and outstanding legacy password links are single-use; password change revokes epoch and sessions atomically', async () => {
  for (const legacy of [false,true]) {
    const f = fixture(), raw = 'b'.repeat(32);
    f.state.tokens.push({token:legacy ? raw : `studio-sha256:${createHash('sha256').update(raw).digest('hex')}`,username:'Operator',kind:'reset',exp:999999});
    const cookieBefore = (await f.call('login',{user:'operator',pass:password})).headers.get('set-cookie').split(';')[0];
    const response = await f.call('set-password',{token:raw,pass:'new-private-password'});
    assert.equal(response.status,200); assert.equal(f.state.epochs['7'],3); assert.deepEqual(f.state.lab,[]); assert.deepEqual(f.state.handoffs,[]);
    assert.equal(f.state.tokens.length,0);
    assert.match(response.headers.get('set-cookie'),/bo_jwt=;.*Max-Age=0/);
    await assert.rejects(f.authorize(new Request(`${publicOrigin}/studio/api/auth/session`,{headers:{cookie:cookieBefore}})),status(401));
    assert.equal((await f.call('set-password',{token:raw,pass:'different-password'})).status,400);
    assert.equal((await f.call('login',{user:'operator',pass:'new-private-password'})).status,200);
  }
});

test('two concurrent password submissions consume one token and only the committed password succeeds', async () => {
  const f = fixture(), token = 'b'.repeat(32);
  f.state.tokens.push({token,username:'Operator',kind:'invite',exp:999999});
  const responses = await Promise.all(['first-private-pass','second-private-pass'].map(pass => f.call('set-password',{token,pass})));
  assert.deepEqual(responses.map(response => response.status).sort(),[200,400]);
  assert.equal(f.state.epochs['7'],3);
  assert.equal((await f.call('login',{user:'operator',pass:'first-private-pass'})).status,200);
  assert.equal((await f.call('login',{user:'operator',pass:'second-private-pass'})).status,401);
});

test('password transaction failure restores token/password/epoch and never exposes connection details', async () => {
  const f = fixture(), token = 'b'.repeat(32), previousHash = f.state.users[0].hash;
  f.state.tokens.push({token,username:'Operator',kind:'invite',exp:999999});
  f.failure.sql = 'DELETE FROM lab_sessions';
  const result = await f.call('set-password',{token,pass:'new-private-password'});
  assert.equal(result.status,503); assert.equal((await result.text()).includes('PRIVATE'),false);
  assert.equal(f.state.tokens.length,1); assert.equal(f.state.users[0].hash,previousHash); assert.equal(f.state.epochs['7'],2);
});

test('reset request returns identical success for existing/missing/incomplete account and mail failure', async () => {
  for (const change of [f => {},f => f.state.users.length=0,f => f.state.users[0].hash=null]) {
    const f = fixture({mail:{send:async () => { throw Error('PRIVATE MAIL KEY'); }}}); change(f);
    const result = await f.call('reset-request',{user:'operator'});
    assert.equal(result.status,200); assert.deepEqual(await result.json(),{ok:true});
  }
  const f = fixture(); await f.call('reset-request',{user:'operator'});
  assert.equal(f.mail.length,1); assert.equal(f.mail[0].kind,'reset'); assert.equal(f.state.tokens.length,1);
});

test('logout bumps shared epoch and removes opaque sessions and handoffs; old JWT fails afterward', async () => {
  const f = fixture(), login = await f.call('login',{user:'operator',pass:password}), cookie = login.headers.get('set-cookie').split(';')[0];
  const request = f.request('logout',{}); request.headers.set('cookie',cookie);
  const result = await f.actions.handle(request);
  assert.equal(result.status,200); assert.equal(f.state.epochs['7'],3); assert.deepEqual(f.state.lab,[]); assert.deepEqual(f.state.handoffs,[]);
  await assert.rejects(f.authorize(new Request(`${publicOrigin}/studio/api/auth/session`,{headers:{cookie}})),status(401));
  assert.equal((await f.call('logout',{})).status,401);
});

test('persistent rate limiter survives reconstructed instance, serializes concurrent attempts and prunes expiry', async () => {
  const f = fixture(), first = createStudioLoginRateLimit({boDb:f.boDb,now:() => f.clock.value});
  const values = await Promise.allSettled(Array.from({length:11},() => first({clientKey:'edge-client',user:'operator',action:'login'})));
  assert.equal(values.filter(value => value.status === 'fulfilled').length,10);
  assert.equal(values.filter(value => value.status === 'rejected' && value.reason.statusCode === 429).length,1);
  const next = createStudioLoginRateLimit({boDb:f.boDb,now:() => f.clock.value});
  await assert.rejects(next({clientKey:'another-ip',user:'operator',action:'login'}),status(429));
  assert.equal(f.state.meta['studio-auth-rate-limit-v1'].includes('operator'),false);
  f.clock.value += 15 * 60_000;
  assert.equal(await next({clientKey:'another-ip',user:'operator',action:'login'}),true);
});

test('bounded limiter denies unknown-key flood and malformed persisted state instead of resetting budget', async () => {
  const f = fixture(), limiter = createStudioLoginRateLimit({boDb:f.boDb,now:() => f.clock.value,maxEntries:2});
  await limiter({clientKey:'one',user:'one',action:'login'});
  await assert.rejects(limiter({clientKey:'two',user:'two',action:'login'}),status(429));
  f.state.meta['studio-auth-rate-limit-v1'] = '{bad';
  await assert.rejects(limiter({clientKey:'one',user:'one',action:'login'}),status(503));
  assert.equal(f.state.meta['studio-auth-rate-limit-v1'],'{bad');
});

test('auth capabilities are omitted until required trusted rate-limit and mail bridges exist', async () => {
  const f = fixture({rateLimit:undefined,clientAddress:undefined,mail:undefined});
  assert.deepEqual(f.actions.availableActions,['logout']);
  assert.equal((await f.call('login',{user:'operator',pass:password})).status,503);
  assert.equal((await f.call('reset-request',{user:'operator'})).status,503);
  assert.equal(f.reads.length,0);
});
