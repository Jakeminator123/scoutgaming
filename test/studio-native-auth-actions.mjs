import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, scryptSync } from 'node:crypto';
import { createStudioNativeAuthActions, createStudioLoginRateLimit, createStudioPasswordDelivery } from '../lab/lib/studio-native-auth-actions.mjs';
import { createStudioNativeAuth } from '../lab/lib/studio-native-auth.mjs';

const scope = { environment:'fixture',workspaceId:'croupier' }, publicOrigin = 'https://studio.example.invalid';
const password = 'existing-private-password', salt = 'fixture-salt';
function fixture(overrides = {}) {
  let state = { users:[{ id:'7',username:'Operator',email:'operator@example.invalid',role:'superadmin',salt,
    hash:scryptSync(password,salt,64).toString('hex') }], tokens:[],playerAccounts:[],meta:{ jwt_secret:'a'.repeat(64) },epochs:{ 7:2 },lab:['7'],handoffs:['7'] };
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

test('native login reuses existing identity and signer; resulting cookie validates all current claims', async () => {
  const f = fixture();
  const login = await f.call('login',{user:' OPERATOR@EXAMPLE.INVALID ',pass:password});
  assert.equal(login.status,200); assert.deepEqual(await login.json(),{ok:true,username:'Operator',role:'admin'});
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
  const jwt = cookie.split(';')[0];
  assert.deepEqual(await f.authorize(new Request(`${publicOrigin}/studio/api/auth/session`,{headers:{cookie:jwt}})),{user:'Operator',role:'admin',scope});
  assert.equal(f.state.meta.jwt_secret,'a'.repeat(64)); assert.equal(f.state.users.length,1);
  assert.equal(f.state.users[0].role,'superadmin'); assert.equal(f.counters[0].user,'craig:7');
  f.state.epochs['7']++;
  await assert.rejects(f.authorize(new Request(`${publicOrigin}/studio/api/auth/session`,{headers:{cookie:jwt}})),status(401));
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
