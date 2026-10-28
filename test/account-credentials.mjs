import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { craigIdentity } from '../packages/studio-access/server/craig-identity.mjs';
import { installBoAuthEpoch } from '../packages/studio-access/server/bo-auth-epoch.mjs';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { createAccountCredentialResolver, effectiveAccountRole } from '../packages/studio-access/server/account-credentials.mjs';
import { createPgliteStore } from './fixtures/pglite-pool.mjs';

// The engine's PostgreSQL stores (croupier_auth users, croupier_game players) on
// PGlite with the product schema, wired as services/game/server.mjs wires them.
async function fixture() {
  const store=await createPgliteStore(),users=store.boDb,players=store.db;
  const password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
  const hash=scryptSync(password,salt,64).toString('hex');
  const identity=craigIdentity(users),resolver=createAccountCredentialResolver({identity,playerDb:players,playerAccounts:true});
  const admin=(id=1,name='operator',role='admin')=>users.prepare('INSERT INTO users(id,username,email,salt,hash,role,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(id,name,`${name}@example.invalid`,salt,hash,role,'fixture');
  const player=id=>players.prepare('INSERT INTO players(id,name,created_at) VALUES(?,?,?)').run(id,id,'fixture');
  const local=async(name='player',id='player-1')=>{await player(id);await players.prepare('INSERT INTO player_accounts VALUES(?,?,?,?)').run(`username:${name}`,id,salt,hash);};
  const authEpoch=installBoAuthEpoch(users);
  const revoke=id=>users.prepare('INSERT INTO bo_auth_epochs(user_id,epoch) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET epoch=bo_auth_epochs.epoch+1').run(id);
  const count=async table=>(await players.prepare(`SELECT count(*) AS n FROM ${table}`).get()).n;
  return {users,players,password,identity,resolver,admin,player,local,authEpoch,revoke,count,close:()=>store.close()};
}
// A player session issued by the retired BO handoff: nothing mints `bo:<epoch>:<stamp>`
// provenance any more, but rows that still exist must keep their epoch checks.
async function retainedBackofficeSession(f,account,playerId) {
  let id=(await f.players.prepare('SELECT player_id FROM craig_player_links WHERE craig_user_id=?').get(account.id))?.player_id;
  if(!id){id=playerId;await f.player(id);await f.players.prepare('INSERT INTO craig_player_links VALUES (?,?)').run(account.id,id);}
  const token=randomBytes(32).toString('hex');
  await f.players.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'),id,Date.now()+86400000,`bo:${account.authEpoch}:${account.stamp}`,null);
  return 'player_session='+token;
}
test('resolver preserves credentials and resolves admin aliases and game-only roles',async()=>{
  const f=await fixture();
  try {
    for(const [id,role] of [[1,'admin'],[2,'superadmin'],[3,'reader'],[4,'staff']])await f.admin(id,`operator${id}`,role);
    await f.local();const before=await f.users.prepare('SELECT * FROM users ORDER BY id').all();
    for(const [id,role] of [[1,'admin'],[2,'admin'],[3,'player'],[4,'player']]) {
      const account=await f.resolver.authenticate(` OPERATOR${id}@EXAMPLE.INVALID `,f.password);
      assert.equal(account.kind,'craig');assert.equal(account.id,String(id));assert.equal(account.role,role);
      assert.equal(await f.resolver.keyFor(`operator${id}`),await f.resolver.keyFor(`operator${id}@example.invalid`));
    }
    const player=await f.resolver.authenticate('PLAYER',f.password);
    assert.equal(player.kind,'player');assert.equal(player.playerId,'player-1');assert.equal(player.role,'player');
    assert.match(player.sourceStamp,/^local:[a-f0-9]{64}$/);assert.equal('hash' in player,false);assert.equal('salt' in player,false);
    assert.deepEqual(await f.users.prepare('SELECT * FROM users ORDER BY id').all(),before);
    assert.equal(effectiveAccountRole('unknown'),null);
  } finally {await f.close();}
});
test('resolver rejects ambiguous or pending identities without checking another account password',async()=>{
  const f=await fixture();
  try {
    await f.admin();await f.local('operator');
    assert.equal(await f.resolver.authenticate('operator',f.password),null);
    assert.equal(await f.resolver.authenticate('operator',randomBytes(24).toString('hex')),null);
    await f.users.prepare('UPDATE users SET salt=NULL,hash=NULL').run();
    assert.equal(await f.resolver.authenticate('operator',f.password),null);
    await f.users.prepare('DELETE FROM users').run();assert.equal((await f.resolver.authenticate('operator',f.password)).kind,'player');
    assert.equal(await f.resolver.authenticate('missing',f.password),null);
    assert.equal(await f.resolver.authenticate('operator',randomBytes(24).toString('hex')),null);
    assert.equal(await f.count('player_sessions'),0);
  } finally {await f.close();}
});
test('unified game entry grants the same admin identity both cookies and keeps player credentials game-only',async()=>{
  const f=await fixture();await f.admin();await f.local();
  let next=0,adminCalls=0;
  const auth=playerAuth(f.players,async({name})=>{const id=`linked-${++next}`;await f.player(id);return {id,name};},f.identity,{playerAccounts:true,
    administratorSession:async(_req,account)=>{assert.equal(account.role,'admin');adminCalls++;return `bo_jwt=${randomBytes(24).toString('base64url')}; Path=/; HttpOnly`;}});
  const server=createServer(async(req,res)=>{if(await auth.handle(req,res))return;res.writeHead(404);res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const login=(email,password=f.password)=>fetch(base+'/api/auth/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email,password})});
  try {
    const before=await f.users.prepare('SELECT * FROM users ORDER BY id').all();
    const admin=await login('operator');assert.equal(admin.status,200);assert.match(admin.headers.get('set-cookie'),/bo_jwt=/);assert.match(admin.headers.get('set-cookie'),/player_session=/);
    const local=await login('player');assert.equal(local.status,200);assert.match(local.headers.get('set-cookie'),/bo_jwt=;[^,]*Max-Age=0/);assert.match(local.headers.get('set-cookie'),/lab_session=;[^,]*Max-Age=0/);assert.equal(adminCalls,1);
    const wrong=await login('player',randomBytes(24).toString('hex'));assert.equal(wrong.status,401);
    await f.local('operator','collision-player');const collision=await login('operator');assert.equal(collision.status,401);assert.deepEqual(await collision.json(),await wrong.json());assert.equal(adminCalls,1);
    assert.equal(await f.count('craig_player_links'),1);assert.equal(next,1);
    assert.deepEqual(await f.users.prepare('SELECT * FROM users ORDER BY id').all(),before);
  } finally {await new Promise(resolve=>server.close(resolve));await f.close();}
});

test('disabled local-account login still inspects its namespace and cannot bypass a Studio collision',async()=>{
  const f=await fixture();
  try {
    await f.admin();await f.local('operator');
    const disabled=createAccountCredentialResolver({identity:f.identity,playerDb:f.players,playerAccounts:false});
    assert.equal(await disabled.authenticate('operator',f.password),null);
    await f.users.prepare('DELETE FROM users').run();assert.equal(await disabled.authenticate('operator',f.password),null);
    assert.equal((await f.resolver.authenticate('operator',f.password)).kind,'player');
  } finally {await f.close();}
});

test('shared-origin logout revokes its BO epoch while separate-origin logout revokes only this session',async()=>{
  for(const sharedBackofficeOrigin of [false,true]) {
    const f=await fixture();await f.admin();
    try {
      const origin='https://www.fixture.invalid';
      const req={url:'/api/auth/logout',method:'POST',headers:{host:'www.fixture.invalid',origin},socket:{encrypted:true}};
      let revocations=0,revocationFails=false;
      const auth=playerAuth(f.players,async()=>{await f.player('own');return {id:'own'};},f.identity,{gameOrigin:origin,sharedBackofficeOrigin,authEpoch:f.authEpoch,backofficeLogout:async()=>{revocations++;if(revocationFails)throw Error('Private storage error');await f.revoke(1);}});
      const account={...await f.identity.find('operator'),authEpoch:0};
      const cookie=await retainedBackofficeSession(f,account,'own'),other=await retainedBackofficeSession(f,account,'own');
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
      assert.equal(cleared.length,sharedBackofficeOrigin?3:1);
      assert.ok(cleared.every(value=>value.includes('Max-Age=0')&&value.includes('HttpOnly')&&value.includes('Secure')));
      assert.equal(cleared.some(value=>value.startsWith('bo_jwt=')),sharedBackofficeOrigin);
      assert.equal(cleared.some(value=>value.startsWith('lab_session=')),sharedBackofficeOrigin);
      assert.equal(await f.count('players'),1);
      assert.equal(await f.count('craig_player_links'),1);
    } finally {await f.close();}
  }
});

test('N1 revocation preserves new credential, local, partner and other-account sessions while denying ambiguous legacy stamps',async()=>{
  const f=await fixture();await f.admin();await f.admin(2,'other');await f.local();
  try {
    const db=f.players;
    const origin='https://www.fixture.invalid',partnerSecret='isolated-partner-secret';let created=0;
    const auth=playerAuth(db,async()=>{const id='linked-'+(++created);await f.player(id);return {id};},f.identity,
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
    const boCookie=await retainedBackofficeSession(f,account,'linked-1');
    const otherCookie=await retainedBackofficeSession(f,{...await f.identity.find('other'),authEpoch:0},'linked-2');
    const credentialCookie=await login('operator'),localCookie=await login('player');
    await f.player('partner-player');
    const partnerCookie=(await auth.fromPartner(req,{sub:'partner-player',partner:'fixture-key',
      partner_key_stamp:createHash('sha256').update(partnerSecret).digest('hex')})).split(';')[0];
    const ownId=await auth.user({headers:{cookie:boCookie}}),otherId=await auth.user({headers:{cookie:otherCookie}});
    assert.equal(await auth.user({headers:{cookie:credentialCookie}}),ownId);
    const oldToken=randomBytes(32).toString('hex');
    await db.prepare('INSERT INTO player_sessions VALUES(?,?,?,?,?)').run(createHash('sha256').update(oldToken).digest('hex'),ownId,Date.now()+60000,account.stamp,null);
    assert.equal(await auth.user({headers:{cookie:'player_session='+oldToken}}),null,'legacy BO and CRAIG fingerprints are indistinguishable and require one fresh login');
    const noIdentity=playerAuth(db,()=>assert.fail('cannot create a player during session lookup'));
    assert.equal(await noIdentity.user({headers:{cookie:'player_session='+oldToken}}),null,'missing identity configuration cannot revive legacy BO authority');
    const sessionCount=await f.count('player_sessions');
    await f.revoke(account.id);
    assert.equal(await auth.user({headers:{cookie:boCookie}}),null);
    assert.equal(await auth.user({headers:{cookie:otherCookie}}),otherId);
    assert.equal(await auth.user({headers:{cookie:credentialCookie}}),ownId);
    assert.equal(await auth.user({headers:{cookie:localCookie}}),'player-1');
    assert.equal(await auth.user({headers:{cookie:partnerCookie}}),'partner-player');
    assert.equal(await f.count('player_sessions'),sessionCount,'revocation does not mass-delete rows or wallets');
    assert.equal(created,0,'logins reuse the existing Scout links');
  } finally {await f.close();}
});

test('async internal bindings share credential, BO epoch and partner validation without changing public sessions',async()=>{
  const f=await fixture();await f.admin();await f.local();
  try {
    const hash=value=>createHash('sha256').update(value).digest('hex');
    const account=await f.identity.find('operator'),local=await f.players.prepare('SELECT salt,hash FROM player_accounts').get();
    await f.player('linked-player');
    await f.players.prepare('INSERT INTO craig_player_links VALUES(?,?)').run(account.id,'linked-player');
    await f.player('partner-player');
    let key={id:'fixture-key',secret:'isolated-binding-secret',revoked_at:null,wallet_url:null};
    const partnerStamp=hash(key.secret),expiresAt=Date.now()+60000,reads=[];
    const db={prepare(sql){assert.match(sql,/^SELECT /);reads.push(sql);return f.players.prepare(sql);}};
    const auth=playerAuth(db,()=>assert.fail('binding cannot create a player'),f.identity,{playerAccounts:true,
      authEpoch:f.authEpoch,allowLegacyPartnerSessions:false,partnerAuthority:async()=>key});
    const sources=[
      ['player-1',`local:${hash(`${local.salt}:${local.hash}`)}`,{playerId:'player-1',partnerKeyId:null}],
      ['linked-player',`credential:${account.stamp}`,{playerId:'linked-player',partnerKeyId:null}],
      ['linked-player',`bo:0:${account.stamp}`,{playerId:'linked-player',partnerKeyId:null}],
      ['partner-player',`partner:fixture-key:${partnerStamp}`,{playerId:'partner-player',partnerKeyId:'fixture-key',partnerKeyStamp:partnerStamp,displayName:'fixture'}],
    ];
    const sessions=[];
    for(const [actorId,source,publicSession] of sources){
      const token=randomBytes(32).toString('hex'),digest=hash(token),sessionId='player-'+digest;
      await f.players.prepare('INSERT INTO player_sessions VALUES(?,?,?,?,?)').run(digest,actorId,expiresAt,source,'fixture');
      sessions.push({actorId,token,digest,sessionId,publicSession,request:{headers:{cookie:'player_session='+token}}});
    }
    const before=await f.players.prepare('SELECT * FROM player_sessions ORDER BY digest').all();
    for(const s of sessions){
      const expected={actorId:s.actorId,sessionId:s.sessionId,expiresAt,partnerKeyId:s.publicSession.partnerKeyId};
      const bound=await auth.binding(s.request),byId=await auth.bindingById(s.sessionId);
      assert.deepEqual(bound,expected);assert.equal(Object.isFrozen(bound),true);
      assert.deepEqual(byId,expected);assert.equal(Object.isFrozen(byId),true);
      assert.notEqual(bound.sessionId,'player-'+s.token,'the internal id is not a bearer token');
      assert.deepEqual(await auth.session(s.request),s.publicSession,'public session fields remain unchanged');
      assert.equal(await auth.user(s.request),s.actorId);
    }
    assert.deepEqual(await f.players.prepare('SELECT * FROM player_sessions ORDER BY digest').all(),before);
    const denied=async s=>{
      assert.equal(await auth.binding(s.request),null);assert.equal(await auth.bindingById(s.sessionId),null);
      assert.equal(await auth.session(s.request),null);
    };
    await f.revoke(account.id);await denied(sessions[2]);
    assert.ok(await auth.bindingById(sessions[1].sessionId),'BO logout does not revoke a credential login');
    await f.users.prepare('UPDATE users SET hash=? WHERE id=?').run('changed-credential',account.id);await denied(sessions[1]);
    await f.players.prepare('UPDATE player_accounts SET hash=?').run('changed-local');await denied(sessions[0]);
    await f.players.prepare('UPDATE player_accounts SET hash=?').run(local.hash);
    await f.players.prepare('UPDATE players SET status=? WHERE id=?').run('blocked','player-1');await denied(sessions[0]);
    await f.players.prepare('UPDATE players SET status=? WHERE id=?').run('active','player-1');
    const validKey={...key};
    for(const changed of [null,{...validKey,revoked_at:'revoked'},{...validKey,secret:'rotated'},
      {...validKey,wallet_url:'https://wallet.invalid'},{...validKey,id:'other-key'}]){
      key=changed;await denied(sessions[3]);
    }
    key=validKey;assert.ok(await auth.bindingById(sessions[3].sessionId));
    await f.players.prepare('UPDATE player_sessions SET expires=? WHERE digest=?').run(Date.now()-1,sessions[3].digest);await denied(sessions[3]);
    await f.players.prepare('UPDATE player_sessions SET digest=? WHERE digest=?').run(hash('replacement'),sessions[0].digest);await denied(sessions[0]);
    assert.ok(reads.length>0);
  } finally {await f.close();}
});

test('async binding rejects ambiguous cookies and invalid ids, and retains expiry from its one validated row',async()=>{
  const f=await fixture();await f.local();
  try {
    const token=randomBytes(32).toString('hex'),digest=createHash('sha256').update(token).digest('hex'),sessionId='player-'+digest;
    const expiresAt=Date.now()+60000,cookie='player_session='+token;
    await f.players.prepare('INSERT INTO player_sessions VALUES(?,?,?,?,?)').run(digest,'player-1',expiresAt,null,null);
    const reads=[];let afterSessionRead;
    const db={prepare(sql){assert.match(sql,/^SELECT /);return {async get(...args){
      reads.push(sql);const row=await f.players.prepare(sql).get(...args);
      if(sql.includes('FROM player_sessions')&&afterSessionRead){const hook=afterSessionRead;afterSessionRead=null;await hook();}
      return row;
    }};}};
    const auth=playerAuth(db,()=>assert.fail('read cannot create a player'));
    for(const value of ['',cookie+'; '+cookie,'player_session=bad; '+cookie,cookie+'; player_session=',cookie+'; player_session']){
      assert.equal(await auth.binding({headers:{cookie:value}}),null);
    }
    for(const value of [undefined,null,123,digest,'preview-'+digest,'player-'+digest.toUpperCase(),sessionId+'x']){
      assert.equal(await auth.bindingById(value),null);
    }
    assert.deepEqual(reads,[],'invalid bindings cannot reach the database');
    assert.deepEqual(await auth.session({headers:{cookie:cookie+'; '+cookie}}),{playerId:'player-1',partnerKeyId:null},'legacy session cookie parsing is unchanged');
    reads.length=0;
    afterSessionRead=()=>f.players.prepare('UPDATE player_sessions SET expires=? WHERE digest=?').run(expiresAt+10000,digest);
    assert.deepEqual(await auth.binding({headers:{cookie:'other=fixture; '+cookie}}),{actorId:'player-1',sessionId,expiresAt,partnerKeyId:null});
    assert.equal(reads.filter(sql=>sql.includes('FROM player_sessions')).length,1,'expiry is not fetched in a second lookup');
    assert.equal((await auth.bindingById(sessionId)).expiresAt,expiresAt+10000,'a later revalidation reads the current row');
    await f.players.prepare('DELETE FROM player_sessions WHERE digest=?').run(digest);
    assert.equal(await auth.bindingById(sessionId),null);
  } finally {await f.close();}
});

test('async binding propagates SQL and authority failures without an anonymous fallback',async()=>{
  const token='a'.repeat(64),digest=createHash('sha256').update(token).digest('hex'),request={headers:{cookie:'player_session='+token}};
  const sqlError=new Error('synthetic SQL failure');
  const broken=playerAuth({prepare(){return {get:async()=>{throw sqlError;}};}},()=>assert.fail('no writes'));
  for(const invoke of [()=>broken.binding(request),()=>broken.bindingById('player-'+digest),()=>broken.session(request)]){
    await assert.rejects(invoke,error=>error===sqlError);
  }
  const authorityError=new Error('synthetic authority failure');
  const db={prepare(sql){return {get:async()=>sql.includes('FROM player_sessions')
    ?{player_id:'partner-player',source_stamp:'partner:fixture-key',expires:Date.now()+60000}:{status:'active'}};}};
  const auth=playerAuth(db,()=>assert.fail('no writes'),null,{partnerAuthority:async()=>{throw authorityError;}});
  await assert.rejects(()=>auth.binding(request),error=>error===authorityError);
  await assert.rejects(()=>auth.bindingById('player-'+digest),error=>error===authorityError);
});
