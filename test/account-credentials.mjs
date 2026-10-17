import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { craigIdentity as syncIdentity } from '../web/craig-identity.mjs';
import { craigIdentity as asyncIdentity } from '../packages/studio-access/server/craig-identity.mjs';
import { playerAuth as syncPlayerAuth } from '../web/player-auth.mjs';
import { playerAuth as asyncPlayerAuth } from '../web/storage/async-player-auth.mjs';
import { backofficeGameAuth as syncBackofficeGameAuth } from '../web/bo-game-auth.mjs';
import { backofficeGameAuth as asyncBackofficeGameAuth } from '../web/storage/async-bo-game-auth.mjs';
import { createStudioNativeAuthActions } from '../apps/studio/lib/studio-native-auth-actions.mjs';
import { createAccountCredentialResolver, effectiveAccountRole } from '../packages/studio-access/server/account-credentials.mjs';

function fixture(identityFactory=syncIdentity) {
  const users=new DatabaseSync(':memory:'),players=new DatabaseSync(':memory:');
  users.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,email TEXT,salt TEXT,hash TEXT,role TEXT);
    CREATE TABLE bo_auth_epochs(user_id INTEGER PRIMARY KEY,epoch INTEGER NOT NULL);`);
  players.exec(`CREATE TABLE players(id TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'active');
    CREATE TABLE player_accounts(email TEXT PRIMARY KEY,player_id TEXT UNIQUE,salt TEXT,hash TEXT);
    CREATE TABLE player_sessions(digest TEXT PRIMARY KEY,player_id TEXT,expires INTEGER,source_stamp TEXT,display_name TEXT);
    CREATE TABLE craig_player_links(craig_user_id TEXT PRIMARY KEY,player_id TEXT UNIQUE);`);
  const password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
  const hash=scryptSync(password,salt,64).toString('hex');
  const identity=identityFactory(users),resolver=createAccountCredentialResolver({identity,playerDb:players,playerAccounts:true});
  const admin=(id=1,name='operator',role='admin')=>users.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,name,`${name}@example.invalid`,salt,hash,role);
  const local=(name='player',id='player-1')=>{players.prepare('INSERT INTO players VALUES(?,?)').run(id,'active');players.prepare('INSERT INTO player_accounts VALUES(?,?,?,?)').run(`username:${name}`,id,salt,hash);};
  const authEpoch=id=>users.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(id)?.epoch??0;
  const revoke=id=>users.prepare('INSERT INTO bo_auth_epochs VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET epoch=epoch+1').run(id);
  return {users,players,password,identity,resolver,admin,local,authEpoch,revoke,close(){users.close();players.close();}};
}
for(const [name,factory] of [['sync',syncIdentity],['async',asyncIdentity]]) {
  test(`${name} resolver preserves credentials and resolves admin aliases and game-only roles`,async()=>{
    const f=fixture(factory);
    try {
      for(const [id,role] of [[1,'admin'],[2,'superadmin'],[3,'reader'],[4,'staff']])f.admin(id,`operator${id}`,role);
      f.local();const before=f.users.prepare('SELECT * FROM users').all();
      for(const [id,role] of [[1,'admin'],[2,'admin'],[3,'player'],[4,'player']]) {
        const account=await f.resolver.authenticate(` OPERATOR${id}@EXAMPLE.INVALID `,f.password);
        assert.equal(account.kind,'craig');assert.equal(account.id,String(id));assert.equal(account.role,role);
        assert.equal(await f.resolver.keyFor(`operator${id}`),await f.resolver.keyFor(`operator${id}@example.invalid`));
      }
      const player=await f.resolver.authenticate('PLAYER',f.password);
      assert.equal(player.kind,'player');assert.equal(player.playerId,'player-1');assert.equal(player.role,'player');
      assert.match(player.sourceStamp,/^local:[a-f0-9]{64}$/);assert.equal('hash' in player,false);assert.equal('salt' in player,false);
      assert.deepEqual(f.users.prepare('SELECT * FROM users').all(),before);
      assert.equal(effectiveAccountRole('unknown'),null);
    } finally {f.close();}
  });
  test(`${name} resolver rejects ambiguous or pending identities without checking another account password`,async()=>{
    const f=fixture(factory);
    try {
      f.admin();f.local('operator');
      assert.equal(await f.resolver.authenticate('operator',f.password),null);
      assert.equal(await f.resolver.authenticate('operator',randomBytes(24).toString('hex')),null);
      f.users.prepare('UPDATE users SET salt=NULL,hash=NULL').run();
      assert.equal(await f.resolver.authenticate('operator',f.password),null);
      f.users.prepare('DELETE FROM users').run();assert.equal((await f.resolver.authenticate('operator',f.password)).kind,'player');
      assert.equal(await f.resolver.authenticate('missing',f.password),null);
      assert.equal(await f.resolver.authenticate('operator',randomBytes(24).toString('hex')),null);
      assert.equal(f.players.prepare('SELECT count(*) n FROM player_sessions').get().n,0);
    } finally {f.close();}
  });
}
for(const [name,authFactory,identityFactory] of [['sync',syncPlayerAuth,syncIdentity],['async',asyncPlayerAuth,asyncIdentity]]) {
  test(`${name} unified game entry grants the same admin identity both cookies and keeps player credentials game-only`,async()=>{
    const f=fixture(identityFactory);f.admin();f.local();
    let next=0,adminCalls=0;
    const db=name==='sync'?f.players:{prepare:sql=>f.players.prepare(sql.replace(/\s+FOR UPDATE\b/g,'')),async transaction(work){f.players.exec('BEGIN IMMEDIATE');try{const value=await work();f.players.exec('COMMIT');return value;}catch(error){f.players.exec('ROLLBACK');throw error;}}};
    const auth=authFactory(db,({name})=>{const id=`linked-${++next}`;f.players.prepare('INSERT INTO players VALUES(?,?)').run(id,'active');return {id,name};},f.identity,{playerAccounts:true,
      administratorSession:async(_req,account)=>{assert.equal(account.role,'admin');adminCalls++;return `bo_jwt=${randomBytes(24).toString('base64url')}; Path=/; HttpOnly`;}});
    const server=createServer(async(req,res)=>{if(await auth.handle(req,res))return;res.writeHead(404);res.end();});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
    const login=(email,password=f.password)=>fetch(base+'/api/auth/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email,password})});
    try {
      const before=f.users.prepare('SELECT * FROM users').all();
      const admin=await login('operator');assert.equal(admin.status,200);assert.match(admin.headers.get('set-cookie'),/bo_jwt=/);assert.match(admin.headers.get('set-cookie'),/player_session=/);
      const local=await login('player');assert.equal(local.status,200);assert.match(local.headers.get('set-cookie'),/bo_jwt=;[^,]*Max-Age=0/);assert.match(local.headers.get('set-cookie'),/lab_session=;[^,]*Max-Age=0/);assert.equal(adminCalls,1);
      const wrong=await login('player',randomBytes(24).toString('hex'));assert.equal(wrong.status,401);
      f.local('operator','collision-player');const collision=await login('operator');assert.equal(collision.status,401);assert.deepEqual(await collision.json(),await wrong.json());assert.equal(adminCalls,1);
      assert.equal(f.players.prepare('SELECT count(*) n FROM craig_player_links').get().n,1);assert.equal(next,1);
      assert.deepEqual(f.users.prepare('SELECT * FROM users').all(),before);
    } finally {await new Promise(resolve=>server.close(resolve));f.close();}
  });
}

test('disabled local-account login still inspects its namespace and cannot bypass a Studio collision',async()=>{
  const f=fixture();
  try {
    f.admin();f.local('operator');
    const disabled=createAccountCredentialResolver({identity:f.identity,playerDb:f.players,playerAccounts:false});
    assert.equal(await disabled.authenticate('operator',f.password),null);
    f.users.prepare('DELETE FROM users').run();assert.equal(await disabled.authenticate('operator',f.password),null);
    assert.equal((await f.resolver.authenticate('operator',f.password)).kind,'player');
  } finally {f.close();}
});

for(const [name,authFactory,identityFactory] of [['sync',syncPlayerAuth,syncIdentity],['async',asyncPlayerAuth,asyncIdentity]]) test(name+' shared-origin logout revokes its BO epoch while separate-origin logout revokes only this session',async()=>{
  for(const sharedBackofficeOrigin of [false,true]) {
    const f=fixture(identityFactory);f.admin();
    try {
      const db=name==='sync'?f.players:{prepare:sql=>f.players.prepare(sql.replace(/\s+FOR UPDATE\b/g,'')),async transaction(work){f.players.exec('BEGIN IMMEDIATE');try{const result=await work();f.players.exec('COMMIT');return result;}catch(error){f.players.exec('ROLLBACK');throw error;}}};
      const origin='https://www.fixture.invalid';
      const req={url:'/api/auth/logout',method:'POST',headers:{host:'www.fixture.invalid',origin},socket:{encrypted:true}};
      let revocations=0,revocationFails=false;
      const auth=authFactory(db,()=>{f.players.prepare('INSERT INTO players VALUES(?,?)').run('own','active');return {id:'own'};},f.identity,{gameOrigin:origin,sharedBackofficeOrigin,authEpoch:f.authEpoch,backofficeLogout:async()=>{revocations++;if(revocationFails)throw Error('Private storage error');f.revoke(1);}});
      const account={...await f.identity.find('operator'),authEpoch:0};
      const cookie=(await auth.fromBackoffice(req,account)).split(';')[0],other=(await auth.fromBackoffice(req,account)).split(';')[0];
      const response=()=>({writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=JSON.parse(body);}});
      let res=response();await auth.handle({...req,headers:{...req.headers,origin:'https://attacker.invalid',cookie}},res);
      assert.equal(res.status,403);assert.equal(res.headers['Set-Cookie'],undefined);assert.equal(await auth.user({...req,headers:{cookie}}),'own');
      assert.equal(revocations,0,'foreign Origin cannot invalidate BO authority');
      if(sharedBackofficeOrigin) {
        revocationFails=true;res=response();await auth.handle({...req,headers:{...req.headers,cookie}},res);
        assert.equal(res.status,503);assert.equal(res.headers['Set-Cookie'],undefined);assert.equal(res.body.error,'Logout unavailable');
        assert.equal(await auth.user({...req,headers:{cookie}}),'own','failed revocation cannot claim a successful logout');
        revocationFails=false;
      }
      res=response();await auth.handle({...req,headers:{...req.headers,cookie}},res);
      assert.equal(res.status,200);assert.equal(await auth.user({...req,headers:{cookie}}),null);
      assert.equal(revocations,sharedBackofficeOrigin?2:0);
      assert.equal(await auth.user({...req,headers:{cookie:other}}),sharedBackofficeOrigin?null:'own',
        'N1 logout revokes the same BO epoch in another browser; a separate game-origin logout does not');
      const cleared=[res.headers['Set-Cookie']].flat();
      assert.equal(cleared.length,sharedBackofficeOrigin?4:2);
      assert.ok(cleared.every(value=>value.includes('Max-Age=0')&&value.includes('HttpOnly')&&value.includes('Secure')));
      assert.equal(cleared.some(value=>value.startsWith('bo_jwt=')),sharedBackofficeOrigin);
      assert.equal(cleared.some(value=>value.startsWith('lab_session=')),sharedBackofficeOrigin);
      assert.ok(cleared.some(value=>value.startsWith('bo_game_state=; Path=/api/auth/bo/callback;')));
      assert.equal(f.players.prepare('SELECT count(*) n FROM players').get().n,1);
      assert.equal(f.players.prepare('SELECT count(*) n FROM craig_player_links').get().n,1);
    } finally {f.close();}
  }
});

for(const [name,authFactory,identityFactory,handoffFactory] of [
  ['sync',syncPlayerAuth,syncIdentity,syncBackofficeGameAuth],
  ['async',asyncPlayerAuth,asyncIdentity,asyncBackofficeGameAuth],
]) for(const boundary of ['before issuance','after issuance']) test(name+' completed N1 logout must not be undone by a delayed callback '+boundary, {timeout:5000}, async()=>{
  const f=fixture(identityFactory);f.admin();
  const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
  const authorized=deferred(),resume=deferred();
  let pending;
  try {
    f.users.exec(`CREATE TABLE lab_sessions(craig_user_id TEXT);
      CREATE TABLE bo_lab_handoffs(craig_user_id TEXT);`);
    f.players.exec(`CREATE TABLE bo_game_handoffs(state_digest TEXT PRIMARY KEY,next_path TEXT NOT NULL,
      expires INTEGER NOT NULL,code_digest TEXT UNIQUE,craig_user_id TEXT,username TEXT,source_stamp TEXT,session_until INTEGER);`);
    const adapter=sqlite=>({prepare:sql=>sqlite.prepare(sql.replace(/\s+FOR UPDATE\b/g,'')),async transaction(work){
      sqlite.exec('BEGIN IMMEDIATE');try{const result=await work();sqlite.exec('COMMIT');return result;}
      catch(error){sqlite.exec('ROLLBACK');throw error;}
    }});
    const db=name==='sync'?f.players:adapter(f.players),boDb=adapter(f.users);
    const origin='https://www.fixture.invalid',scope={environment:'fixture',workspaceId:'croupier'};
    const auth=authFactory(db,()=>{f.players.prepare('INSERT INTO players VALUES(?,?)').run('own','active');return {id:'own'};},f.identity,{authEpoch:f.authEpoch});
    const account=await f.identity.find('operator');
    const claims={sub:account.name,aud:'backoffice',role:'admin',source_stamp:account.stamp,auth_epoch:0,exp:Math.floor(Date.now()/1000)+3600};
    // Credential verification is a fixture boundary; session issuance, SQL and
    // the native logout action below use their real implementations.
    const boSession=async req=>req.headers.cookie?.includes('bo_jwt=fixture')
      && (f.users.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(account.id)?.epoch??0)===claims.auth_epoch ? claims:null;
    const handle=handoffFactory({db,identity:f.identity,boSession,validLaunch:()=>false,
      publicUrl:origin,boUrl:origin,publicGamePath:'/blackjack',auth:{...auth,async fromBackoffice(...args){
        // Deterministic interleaving: the callback already passed its BO check,
        // but the browser has not received any new player_session cookie.
        const issued=boundary==='after issuance'?await auth.fromBackoffice(...args):null;
        authorized.resolve();await resume.promise;return issued??auth.fromBackoffice(...args);
      }}});
    async function request(address,cookie='bo_jwt=fixture') {
      const url=new URL(address,origin),req={url:url.pathname+url.search,method:'GET',headers:{host:url.host,cookie},socket:{encrypted:true}};
      const response={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
      await handle(req,response);return response;
    }
    const start=await request('/api/auth/bo/start?next=/play/profil');assert.equal(start.status,303);
    const state=new URL(start.headers.Location).searchParams.get('state');
    const grant=await request(start.headers.Location);assert.equal(grant.status,303);
    pending=request(grant.headers.Location,'bo_jwt=fixture; bo_game_state='+state);
    await authorized.promise;
    const actions=createStudioNativeAuthActions({boDb,gameDb:db,scope,publicOrigin:origin,
      authorize:async()=>({user:account.name,role:'admin',scope})});
    const logout=await actions.handle(new Request(origin+'/studio/api/auth/logout',{method:'POST',
      headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',cookie:'bo_jwt=fixture'},body:'{}'}));
    assert.equal(logout.status,200);
    assert.equal(f.users.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(account.id).epoch,1);
    assert.equal(f.players.prepare('SELECT count(*) n FROM player_sessions').get().n,boundary==='after issuance'?1:0);
    assert.equal(f.players.prepare('SELECT count(*) n FROM bo_game_handoffs').get().n,0);
    resume.resolve();const callback=await pending;
    const cookie=[callback.headers['Set-Cookie']??[]].flat().find(value=>value.startsWith('player_session='))?.split(';')[0]??'';
    assert.equal(await auth.user({headers:{cookie}}),null,
      'a delayed handoff response must not restore a valid player session after successful N1 logout');
  } finally {resume.resolve();await pending?.catch(()=>{});f.close();}
});

for(const [name,authFactory,identityFactory,handoffFactory] of [
  ['sync',syncPlayerAuth,syncIdentity,syncBackofficeGameAuth],
  ['async',asyncPlayerAuth,asyncIdentity,asyncBackofficeGameAuth],
]) test(name+' cross-origin handoff freezes the authorizing epoch and rejects legacy or malformed provenance',async()=>{
  const f=fixture(identityFactory);f.admin();
  try {
    f.players.exec(`CREATE TABLE bo_game_handoffs(state_digest TEXT PRIMARY KEY,next_path TEXT NOT NULL,
      expires INTEGER NOT NULL,code_digest TEXT UNIQUE,craig_user_id TEXT,username TEXT,source_stamp TEXT,session_until INTEGER);`);
    const db=name==='sync'?f.players:{prepare:sql=>f.players.prepare(sql.replace(/\s+FOR UPDATE\b/g,'')),async transaction(work){
      f.players.exec('BEGIN IMMEDIATE');try{const result=await work();f.players.exec('COMMIT');return result;}
      catch(error){f.players.exec('ROLLBACK');throw error;}
    }};
    const auth=authFactory(db,()=>{f.players.prepare('INSERT INTO players VALUES(?,?)').run('own','active');return {id:'own'};},f.identity,{authEpoch:f.authEpoch});
    const account=await f.identity.find('operator'),game='https://game.fixture.invalid',bo='https://bo.fixture.invalid';
    let claimsEpoch;
    const handle=handoffFactory({db,auth,identity:f.identity,validLaunch:()=>false,publicUrl:game,boUrl:bo,publicGamePath:'/blackjack',
      boSession:async()=>({sub:account.name,role:'admin',aud:'backoffice',source_stamp:account.stamp,
        auth_epoch:claimsEpoch===undefined?f.authEpoch(account.id):claimsEpoch,exp:Math.floor(Date.now()/1000)+3600})});
    async function request(address,cookie='') {
      const url=new URL(address,game),response={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
      await handle({url:url.pathname+url.search,method:'GET',headers:{host:url.host,cookie},socket:{encrypted:true}},response);return response;
    }
    async function grant() {
      const start=await request('/api/auth/bo/start?next=/play/profil');assert.equal(start.status,303);
      const state=new URL(start.headers.Location).searchParams.get('state'),authorized=await request(start.headers.Location);
      assert.equal(authorized.status,303);return {address:authorized.headers.Location,cookie:'bo_game_state='+state};
    }
    const old=await grant();
    assert.equal(f.players.prepare('SELECT source_stamp FROM bo_game_handoffs').get().source_stamp,`bo:0:${account.stamp}`);
    f.revoke(account.id);
    assert.equal((await request(old.address,old.cookie)).status,401,'an old BO code cannot adopt the newer epoch at callback');
    assert.equal(f.players.prepare('SELECT count(*) n FROM player_sessions').get().n,0);
    const fresh=await grant(),accepted=await request(fresh.address,fresh.cookie);
    assert.equal(accepted.status,303,'cross-origin callback needs its state cookie, not a BO cookie on the game host');
    const cookie=accepted.headers['Set-Cookie'].find(value=>value.startsWith('player_session=')).split(';')[0];
    assert.equal(await auth.user({headers:{cookie}}),'own');
    assert.equal(f.players.prepare('SELECT source_stamp FROM player_sessions').get().source_stamp,`bo:1:${account.stamp}`);
    for(const source of [account.stamp,`credential:${account.stamp}`,`bo:-1:${account.stamp}`,`bo:01:${account.stamp}`,
      `bo:9007199254740992:${account.stamp}`,`bo:1:${account.stamp}:extra`]) {
      const invalid=await grant();f.players.prepare('UPDATE bo_game_handoffs SET source_stamp=?').run(source);
      assert.equal((await request(invalid.address,invalid.cookie)).status,401,'unversioned or malformed handoffs require a new login');
    }
    for(const epoch of [-1,Infinity,NaN,Number.MAX_SAFE_INTEGER+1]) {
      claimsEpoch=epoch;const start=await request('/api/auth/bo/start?next=/play/profil');
      assert.match((await request(start.headers.Location)).headers.Location,/^\/studio\/login\?/);
    }
    assert.equal(f.players.prepare('SELECT count(*) n FROM player_sessions').get().n,1,'invalid codes create no sessions');
    f.revoke(account.id);assert.equal(await auth.user({headers:{cookie}}),null,'every later read checks the frozen epoch');
  } finally {f.close();}
});

for(const [name,authFactory,identityFactory] of [['sync',syncPlayerAuth,syncIdentity],['async',asyncPlayerAuth,asyncIdentity]])
test(name+' N1 revocation preserves new credential, local, partner and other-account sessions while denying ambiguous legacy stamps',async()=>{
  const f=fixture(identityFactory);f.admin();f.admin(2,'other');f.local();
  try {
    const db=name==='sync'?f.players:{prepare:sql=>f.players.prepare(sql.replace(/\s+FOR UPDATE\b/g,'')),async transaction(work){
      f.players.exec('BEGIN IMMEDIATE');try{const result=await work();f.players.exec('COMMIT');return result;}
      catch(error){f.players.exec('ROLLBACK');throw error;}
    }};
    const origin='https://www.fixture.invalid',partnerSecret='isolated-partner-secret';let created=0;
    const auth=authFactory(db,()=>{const id='linked-'+(++created);f.players.prepare('INSERT INTO players VALUES(?,?)').run(id,'active');return {id};},f.identity,
      {playerAccounts:true,gameOrigin:origin,authEpoch:f.authEpoch,allowLegacyPartnerSessions:false,
        partnerAuthority:async id=>({id,secret:partnerSecret,revoked_at:null,wallet_url:null})});
    const req={headers:{host:'www.fixture.invalid',origin},socket:{encrypted:true}};
    async function login(email) {
      const request={...req,url:'/api/auth/login',method:'POST',async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify({email,password:f.password}));}};
      const response={writeHead(status,headers){this.status=status;this.headers=headers;},end(){}};
      await auth.handle(request,response);assert.equal(response.status,200);
      return [response.headers['Set-Cookie']].flat().find(value=>value.startsWith('player_session=')).split(';')[0];
    }
    const account={...await f.identity.find('operator'),authEpoch:0};
    const boCookie=(await auth.fromBackoffice(req,account)).split(';')[0];
    const otherCookie=(await auth.fromBackoffice(req,{...await f.identity.find('other'),authEpoch:0})).split(';')[0];
    const credentialCookie=await login('operator'),localCookie=await login('player');
    f.players.prepare('INSERT INTO players VALUES(?,?)').run('partner-player','active');
    const partnerCookie=(await auth.fromPartner(req,{sub:'partner-player',partner:'fixture-key',
      partner_key_stamp:createHash('sha256').update(partnerSecret).digest('hex')})).split(';')[0];
    const ownId=await auth.user({headers:{cookie:boCookie}}),otherId=await auth.user({headers:{cookie:otherCookie}});
    assert.equal(await auth.user({headers:{cookie:credentialCookie}}),ownId);
    const oldToken=randomBytes(32).toString('hex');
    f.players.prepare('INSERT INTO player_sessions VALUES(?,?,?,?,?)').run(createHash('sha256').update(oldToken).digest('hex'),ownId,Date.now()+60000,account.stamp,null);
    assert.equal(await auth.user({headers:{cookie:'player_session='+oldToken}}),null,'legacy BO and CRAIG fingerprints are indistinguishable and require one fresh login');
    const noIdentity=authFactory(db,()=>assert.fail('cannot create a player during session lookup'));
    assert.equal(await noIdentity.user({headers:{cookie:'player_session='+oldToken}}),null,'missing identity configuration cannot revive legacy BO authority');
    const sessionCount=f.players.prepare('SELECT count(*) n FROM player_sessions').get().n;
    f.revoke(account.id);
    assert.equal(await auth.user({headers:{cookie:boCookie}}),null);
    assert.equal(await auth.user({headers:{cookie:otherCookie}}),otherId);
    assert.equal(await auth.user({headers:{cookie:credentialCookie}}),ownId);
    assert.equal(await auth.user({headers:{cookie:localCookie}}),'player-1');
    assert.equal(await auth.user({headers:{cookie:partnerCookie}}),'partner-player');
    await assert.rejects(async()=>auth.fromBackoffice(req,account),/expired/,'issuance refuses an old epoch');
    assert.equal(f.players.prepare('SELECT count(*) n FROM player_sessions').get().n,sessionCount,'revocation does not mass-delete rows or wallets');
    assert.equal(created,2);
  } finally {f.close();}
});
