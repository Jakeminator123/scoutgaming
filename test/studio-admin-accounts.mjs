import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminAccounts } from '../apps/studio/lib/studio-admin-accounts.mjs';
import { createStudioAdminApi } from '../apps/studio/lib/studio-admin-api.mjs';

const scope = {environment:'fixture',workspaceId:'croupier'}, publicOrigin = 'https://studio.example.invalid';
function fixture(overrides = {}) {
  let state = {users:[],tokens:[],apiKeys:[],playerAccounts:[]};
  const writes = [],sent = [],requests = [], failure = {sql:null};
  const boDb = { transaction:async work => {
    const previous = structuredClone(state);
    try { return await work(); } catch (error) { state = previous; throw error; }
  },prepare(sql) {
    const rows = async args => {
      if (failure.sql && sql.startsWith(failure.sql)) throw Error('PRIVATE DATABASE URL');
      if (sql.startsWith('SELECT id FROM users WHERE lower')) return state.users.filter(user => user.username.toLowerCase() === args[0] || user.email?.toLowerCase() === args[1]);
      if (sql === 'SELECT id,username,email,role,hash FROM users WHERE username=? FOR UPDATE') return state.users.filter(user => user.username === args[0]);
      writes.push({sql,args});
      if (sql.startsWith('INSERT INTO users')) { state.users.push({id:String(state.users.length+1),username:args[0],email:args[1],role:args[2],created_at:args[3],hash:null}); return []; }
      if (sql === 'DELETE FROM tokens WHERE username=?') { state.tokens = state.tokens.filter(token => token.username !== args[0]); return []; }
      if (sql.startsWith('INSERT INTO tokens')) { state.tokens.push({token:args[0],username:args[1],kind:args[2],exp:args[3]}); return []; }
      if (sql.startsWith('INSERT INTO api_keys')) { state.apiKeys.push(args); return []; }
      throw Error(`Unhandled test SQL: ${sql}`);
    };
    return {all:(...args)=>rows(args),get:async (...args)=>(await rows(args))[0],run:async (...args)=>{await rows(args);return {changes:1};}};
  }};
  const gameDb = { prepare(sql) {
    assert.equal(sql, 'SELECT player_id FROM player_accounts WHERE lower(email)=? OR lower(email)=?');
    return { all: async (...args) => state.playerAccounts.filter(account => args.includes(account.email.toLowerCase())) };
  } };
  const options = {boDb,gameDb,scope,publicOrigin,now:()=>2_000_000,mail:{send:async value=>{sent.push(value);return {sent:true};}},...overrides};
  const data = createStudioAdminAccounts(options);
  const context = (action,body,role='admin') => ({body,scope,actor:{user:'operator',role},endpoint:{action},
    request:new Request(`${publicOrigin}/studio/api/admin/${action}`,{method:'POST',body:JSON.stringify(body)})});
  const call = (action,body,role) => data.handlers.get(`POST /studio/api/admin/${action}`)(context(action,body,role));
  return {get state(){return state;},writes,sent,requests,failure,boDb,data,options,context,call};
}

test('invite creates an inactive existing-domain identity and hashed invitation; no bearer returns to browser', async () => {
  const f = fixture(), response = await f.call('users/invite',{email:' NEW@EXAMPLE.INVALID ',role:'admin'});
  assert.deepEqual(response,{ok:true,kind:'invite',emailSent:true});
  assert.equal(f.state.users[0].role,'admin'); assert.equal(f.state.users[0].username,'new@example.invalid'); assert.equal(f.state.users[0].hash,null);
  assert.equal(f.state.tokens.length,1); assert.match(f.state.tokens[0].token,/^studio-sha256:/);
  assert.equal(f.sent.length,1); assert.match(f.sent[0].link,/\/studio\/set-password\?t=/);
  assert.equal(JSON.stringify(response).includes(new URL(f.sent[0].link).searchParams.get('t')),false);
  await assert.rejects(f.call('users/invite',{email:'NEW@example.invalid',role:'admin'}),error=>error.statusCode===409);
  assert.equal(f.state.users.length,1);
});

test('invite/token creation is atomic and failed persistence never sends mail', async () => {
  const f = fixture(); f.failure.sql = 'INSERT INTO tokens';
  await assert.rejects(f.call('users/invite',{email:'new@example.invalid',role:'admin'}));
  assert.deepEqual(f.state.users,[]); assert.deepEqual(f.state.tokens,[]); assert.deepEqual(f.sent,[]);
});

test('native invitations send only after the outer product transaction commits', async () => {
  let locked = false; const sent = [];
  const f = fixture({ mail: { send: async value => { assert.equal(locked, false); sent.push(value); return { sent: true }; } } });
  const api = createStudioAdminApi({ authorize: () => ({ user: 'operator', role: 'superadmin', scope }),
    handlers: f.data.handlers, gates: f.data.gates, allowedOrigins: [publicOrigin], publicHosts: [new URL(publicOrigin).host],
    mutationTransaction: async work => { locked = true; try { return await f.boDb.transaction(work); } finally { locked = false; } } });
  const request = action => new Request(`${publicOrigin}/studio/api/admin/${action}`, { method: 'POST',
    headers: { origin: publicOrigin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify(action === 'users/invite' ? { email: 'new@example.invalid', role: 'admin' } : { username: 'new@example.invalid' }) });
  for (const action of ['users/invite', 'users/resend']) {
    const response = await api.handle(request(action)); assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, kind: 'invite', emailSent: true });
  }
  assert.equal(sent.length, 2); assert.equal(f.state.tokens.length, 1);
});

test('an outer transaction failure never delivers its otherwise minted invitation', async () => {
  const f = fixture();
  const api = createStudioAdminApi({ authorize: () => ({ user: 'operator', role: 'superadmin', scope }),
    handlers: f.data.handlers, gates: f.data.gates, allowedOrigins: [publicOrigin], publicHosts: [new URL(publicOrigin).host],
    mutationTransaction: work => f.boDb.transaction(async () => { await work(); throw Error('PRIVATE COMMIT FAILURE'); }) });
  const response = await api.handle(new Request(`${publicOrigin}/studio/api/admin/users/invite`, { method: 'POST',
    headers: { origin: publicOrigin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'new@example.invalid', role: 'admin' }) }));
  assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /PRIVATE/);
  assert.deepEqual(f.state.users, []); assert.deepEqual(f.state.tokens, []); assert.deepEqual(f.sent, []);
});

test('resend invalidates prior invitation, selects proper invite/reset kind and reports mail failure truthfully', async () => {
  const f = fixture({mail:{send:async()=>({sent:false})}});
  await f.call('users/invite',{email:'new@example.invalid',role:'admin'});
  const previous = f.state.tokens[0].token;
  assert.deepEqual(await f.call('users/resend',{username:'new@example.invalid'}),{ok:true,kind:'invite',emailSent:false});
  assert.notEqual(f.state.tokens[0].token,previous); assert.equal(f.state.tokens.length,1);
  f.state.users[0].hash = 'existing-hash';
  assert.deepEqual(await f.call('users/resend',{username:'new@example.invalid'}),{ok:true,kind:'reset',emailSent:false});
  assert.equal(f.state.tokens[0].exp,2000 + 2*3600);
});

test('role, server scope, unknown fields and missing mail are enforced before account writes', async () => {
  const f = fixture();
  for (const [body,role] of [
    ...['reader','staff','player','superadmin','unknown'].map(role=>[{email:'new@example.invalid',role},'admin']),
    ...['reader','staff','player','unknown'].map(role=>[{email:'new@example.invalid',role:'admin'},role]),
    [{email:'new@example.invalid',role:'admin',actor:'other'},'admin'],
  ]) {
    await assert.rejects(f.call('users/invite',body,role));
  }
  const context = f.context('users/invite',{email:'new@example.invalid',role:'admin'}); context.scope = {...scope,workspaceId:'other'};
  await assert.rejects(f.data.handlers.get('POST /studio/api/admin/users/invite')(context));
  assert.equal(f.writes.length,0);
  const noMail = fixture({mail:undefined});
  assert.equal(noMail.data.handlers.has('POST /studio/api/admin/users/invite'),false);
  assert.equal(noMail.data.handlers.has('POST /studio/api/admin/users/resend'),false);
});

test('partner create validates exact scopes and creates one-time credentials in existing Neon domain', async () => {
  const f = fixture(), result = await f.call('apikeys/create',{name:' Example ',scopes:['launch','events'],walletUrl:'https://wallet.example.com/wallet',ipAllow:'203.0.113.7,2001:db8::1'});
  assert.equal(result.ok,true); assert.match(result.key.key,/^ck_live_/); assert.match(result.key.secret,/^cs_/);
  assert.deepEqual(result.key.scopes,['launch','events']); assert.equal(f.state.apiKeys.length,1);
  assert.equal(f.state.apiKeys[0][7],'operator'); assert.equal(f.state.apiKeys[0][5],'https://wallet.example.com/wallet');
  for (const body of [{name:'Example',scopes:['bogus']},{name:'Example',scopes:['play','play']},{name:'Example',scopes:[]},{name:'Example',secret:'injected'},{name:'Example',ipAllow:'*'}]) {
    await assert.rejects(f.call('apikeys/create',body));
  }
  for (const role of ['reader','staff','player','unknown']) await assert.rejects(f.call('apikeys/create',{name:'Example'},role),error=>error.statusCode===403);
  assert.equal(f.state.apiKeys.length,1);
});

test('wallet callback metadata rejects local addresses, credentials and malformed URLs before insert', async () => {
  const f = fixture();
  for (const walletUrl of ['http://wallet.example.com','https://127.0.0.1/wallet','https://[::1]/wallet','https://10.10.1.1',
    'https://169.254.169.254/metadata','https://172.16.1.1','https://192.168.1.1','https://100.64.0.1','https://service.local',
    'https://user:password@wallet.example.com','https://wallet.example.com:8443','https://wallet.example.com/#secret']) {
    await assert.rejects(f.call('apikeys/create',{name:'Example',walletUrl}));
  }
  assert.equal(f.state.apiKeys.length,0);
});

test('missing Render authority does not advertise or register player/runtime/partner mutations', () => {
  const f = fixture();
  for (const action of ['players/password','players/status','apikeys/revoke','apikeys/rotate','apikeys/launch','apikeys/credit']) {
    assert.equal(f.data.handlers.has(`POST /studio/api/admin/${action}`),false);
  }
  const api = createStudioAdminApi({authorize:async()=>({user:'operator',role:'superadmin',scope}),mutationTransaction:work=>work(),handlers:f.data.handlers,gates:f.data.gates,
    allowedOrigins:[publicOrigin],publicHosts:[new URL(publicOrigin).host]});
  assert.deepEqual(api.availableActions({user:'operator',role:'superadmin',scope}).sort(),['POST apikeys/create','POST users/invite','POST users/resend']);
});

test('all runtime operations delegate the full transaction to Render with trusted actor/scope and original request', async () => {
  const calls = [], f = fixture({gameAuthority:{execute:async value=>{calls.push(value);return {ok:true,playerId:'player',balance:10};}}});
  const inputs = [['players/status',{playerId:'player',status:'blocked',reason:'operator request'}],['apikeys/revoke',{id:'key'}],
    ['apikeys/rotate',{id:'key'}],['apikeys/launch',{id:'key',playerId:'partner-player',displayName:'  A B ',currency:'EUR',language:'en'}],
    ['apikeys/credit',{id:'key',playerId:'partner-player',amount:100}]];
  for (const [action,body] of inputs) await f.call(action,body);
  assert.equal(calls.length,5); assert.deepEqual(f.writes,[]);
  for (const item of calls) { assert.deepEqual(item.actor,{user:'operator',role:'admin'}); assert.deepEqual(item.scope,scope); assert.ok(item.request instanceof Request); }
  const gate = f.data.gates.get('cancel-player-runtime');
  assert.equal(gate(f.context('players/status',inputs[0][1])),true); assert.equal(gate(f.context('apikeys/credit',inputs[4][1])),false);
});

test('invalid domain inputs do not reach Render and missing/failed acknowledgement is an error', async () => {
  let calls = 0;
  const f = fixture({gameAuthority:{execute:async()=>{calls++;return {ok:false};}}});
  for (const [action,body] of [['players/status',{playerId:'player',status:'delete',reason:'test'}],['players/status',{playerId:'player',status:'blocked',reason:''}],
    ['apikeys/launch',{id:'key',displayName:'\u202Eattack'}],['apikeys/credit',{id:'key',playerId:'player',amount:Infinity}],['apikeys/credit',{id:'key',playerId:'player',amount:1,actor:'other'}]]) {
    await assert.rejects(f.call(action,body));
  }
  assert.equal(calls,0);
  await assert.rejects(f.call('apikeys/revoke',{id:'key'}),error=>error.statusCode===503);
  assert.equal(calls,1); assert.deepEqual(f.writes,[]);
});
