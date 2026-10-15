import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import { createServer } from 'node:http';
import { craigIdentity as syncIdentity } from '../web/craig-identity.mjs';
import { craigIdentity as asyncIdentity } from '../web/storage/async-craig-identity.mjs';
import { playerAuth as syncPlayerAuth } from '../web/player-auth.mjs';
import { playerAuth as asyncPlayerAuth } from '../web/storage/async-player-auth.mjs';
import { createAccountCredentialResolver, effectiveAccountRole } from '../web/account-credentials.mjs';

function fixture(identityFactory=syncIdentity) {
  const users=new DatabaseSync(':memory:'),players=new DatabaseSync(':memory:');
  users.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,email TEXT,salt TEXT,hash TEXT,role TEXT)');
  players.exec(`CREATE TABLE players(id TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'active');
    CREATE TABLE player_accounts(email TEXT PRIMARY KEY,player_id TEXT UNIQUE,salt TEXT,hash TEXT);
    CREATE TABLE player_sessions(digest TEXT PRIMARY KEY,player_id TEXT,expires INTEGER,source_stamp TEXT,display_name TEXT);
    CREATE TABLE craig_player_links(craig_user_id TEXT PRIMARY KEY,player_id TEXT UNIQUE);`);
  const password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
  const hash=scryptSync(password,salt,64).toString('hex');
  const identity=identityFactory(users),resolver=createAccountCredentialResolver({identity,playerDb:players,playerAccounts:true});
  const admin=(id=1,name='operator',role='admin')=>users.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,name,`${name}@example.invalid`,salt,hash,role);
  const local=(name='player',id='player-1')=>{players.prepare('INSERT INTO players VALUES(?,?)').run(id,'active');players.prepare('INSERT INTO player_accounts VALUES(?,?,?,?)').run(`username:${name}`,id,salt,hash);};
  return {users,players,password,identity,resolver,admin,local,close(){users.close();players.close();}};
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

for(const [name,authFactory,identityFactory] of [['sync',syncPlayerAuth,syncIdentity],['async',asyncPlayerAuth,asyncIdentity]]) test(name+' player logout revokes only this session and clears N1 cookies only on the shared origin',async()=>{
  for(const sharedBackofficeOrigin of [false,true]) {
    const f=fixture(identityFactory);f.admin();
    try {
      const db=name==='sync'?f.players:{prepare:sql=>f.players.prepare(sql.replace(/\s+FOR UPDATE\b/g,'')),async transaction(work){f.players.exec('BEGIN IMMEDIATE');try{const result=await work();f.players.exec('COMMIT');return result;}catch(error){f.players.exec('ROLLBACK');throw error;}}};
      const origin='https://www.fixture.invalid';
      const req={url:'/api/auth/logout',method:'POST',headers:{host:'www.fixture.invalid',origin},socket:{encrypted:true}};
      let revocations=0,revocationFails=false;
      const auth=authFactory(db,()=>{f.players.prepare('INSERT INTO players VALUES(?,?)').run('own','active');return {id:'own'};},f.identity,{gameOrigin:origin,sharedBackofficeOrigin,backofficeLogout:async()=>{revocations++;if(revocationFails)throw Error('Private storage error');}});
      const account=await f.identity.find('operator');
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
      assert.equal(await auth.user({...req,headers:{cookie:other}}),'own','another browser session remains valid');
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
