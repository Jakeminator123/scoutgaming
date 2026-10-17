import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createAccountCredentialResolver } from '../packages/studio-access/server/account-credentials.mjs';
import { createPlayerAdministration, createPlayerPasswordCommand } from '../packages/storage/server/player-administration.mjs';

function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE players(id TEXT PRIMARY KEY,name TEXT,currency TEXT,balance INTEGER,created_at TEXT,status TEXT DEFAULT 'active',account_epoch INTEGER DEFAULT 0,closed_at TEXT);
    CREATE TABLE player_accounts(email TEXT PRIMARY KEY,player_id TEXT UNIQUE,salt TEXT,hash TEXT);
    CREATE TABLE transactions(player_id TEXT,type TEXT,amount INTEGER,currency TEXT,meta TEXT,at TEXT);
    CREATE TABLE blackjack_tables(player_id TEXT PRIMARY KEY,state TEXT);
    CREATE TABLE player_sessions(digest TEXT PRIMARY KEY,player_id TEXT,expires INTEGER);
    CREATE TABLE preview_sessions(digest TEXT PRIMARY KEY,player_id TEXT,expires INTEGER);
    CREATE TABLE lissabon_profile_sessions(digest TEXT PRIMARY KEY,player_id TEXT,expires INTEGER);
    CREATE TABLE craig_player_links(craig_user_id TEXT PRIMARY KEY,player_id TEXT);
    CREATE TABLE bo_game_handoffs(craig_user_id TEXT);
    CREATE TABLE player_admin_events(player_id TEXT,actor TEXT,action TEXT,reason TEXT,previous_status TEXT,status TEXT,at TEXT);`);
  let failAudit=false;
  const db={prepare(sql){if(failAudit&&sql.startsWith('INSERT INTO player_admin_events'))throw Error('audit unavailable');return sqlite.prepare(sql.replace(/\s+FOR UPDATE\b/g,''));},async transaction(work){sqlite.exec('BEGIN IMMEDIATE');try{const value=await work();sqlite.exec('COMMIT');return value;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  const administration=createPlayerAdministration({db}),password=randomBytes(24).toString('base64url');
  const money=()=>['players','transactions','blackjack_tables'].map(table=>sqlite.prepare(`SELECT * FROM ${table}`).all());
  return {sqlite,administration,password,money,set failAudit(value){failAudit=value;},close:()=>sqlite.close()};
}

test('password change revokes sessions but preserves player, wallet and round ledger exactly across reconstruction',async()=>{
  const f=fixture();
  try {
    const player=await f.administration.create({username:'player',password:f.password,actor:'operator'});
    f.sqlite.prepare('INSERT INTO blackjack_tables VALUES(?,?)').run(player.id,JSON.stringify({round:{id:'round-1',stake:20}}));
    for(const table of ['player_sessions','preview_sessions','lissabon_profile_sessions']) f.sqlite.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run(randomBytes(32).toString('hex'),player.id,Date.now()+60000);
    const before=f.money(),old=f.sqlite.prepare('SELECT * FROM player_accounts').get(),changedPassword=randomBytes(24).toString('base64url');
    const result=await f.administration.setPassword({playerId:player.id,password:changedPassword,actor:'operator',reason:'Requested credential change'});
    assert.deepEqual(result,{id:player.id,changed:true});assert.deepEqual(f.money(),before);
    const account=f.sqlite.prepare('SELECT * FROM player_accounts').get();assert.notEqual(account.salt,old.salt);assert.notEqual(account.hash,old.hash);
    assert.equal(timingSafeEqual(scryptSync(changedPassword,account.salt,64),Buffer.from(account.hash,'hex')),true);
    assert.equal(timingSafeEqual(scryptSync(f.password,account.salt,64),Buffer.from(account.hash,'hex')),false);
    for(const table of ['player_sessions','preview_sessions','lissabon_profile_sessions']) assert.equal(f.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n,0);
    const fresh=createAccountCredentialResolver({playerDb:f.sqlite,playerAccounts:true});assert.equal((await fresh.authenticate('player',changedPassword)).kind,'player');assert.equal(await fresh.authenticate('player',f.password),null);
    const events=f.sqlite.prepare('SELECT action,previous_status,status FROM player_admin_events').all().map(row=>({...row}));assert.deepEqual(events,[{action:'create',previous_status:null,status:'active'},{action:'password',previous_status:'active',status:'active'}]);
  } finally {f.close();}
});

test('invalid, unknown, closed and failed-audit changes cannot partially replace credentials or sessions',async()=>{
  const f=fixture();
  try {
    const player=await f.administration.create({username:'player',password:f.password,actor:'operator'});
    for(const table of ['player_sessions','preview_sessions','lissabon_profile_sessions']) f.sqlite.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run(randomBytes(32).toString('hex'),player.id,Date.now()+60000);
    const before=f.sqlite.prepare('SELECT * FROM player_accounts').all(),sessions=['player_sessions','preview_sessions','lissabon_profile_sessions'].map(table=>f.sqlite.prepare(`SELECT * FROM ${table}`).all());
    const body={playerId:player.id,password:randomBytes(24).toString('base64url'),actor:'operator',reason:'Reset requested'};
    await assert.rejects(f.administration.setPassword({...body,password:'x'}),{statusCode:400});
    await assert.rejects(f.administration.setPassword({...body,playerId:'missing'}),{statusCode:404});
    f.sqlite.prepare("UPDATE players SET status='closed'").run();await assert.rejects(f.administration.setPassword(body),{statusCode:409});
    f.sqlite.prepare("UPDATE players SET status='active'").run();f.failAudit=true;await assert.rejects(f.administration.setPassword(body),/audit unavailable/);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM player_accounts').all(),before);assert.deepEqual(['player_sessions','preview_sessions','lissabon_profile_sessions'].map(table=>f.sqlite.prepare(`SELECT * FROM ${table}`).all()),sessions);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM player_admin_events WHERE action='password'").get().n,0);
  } finally {f.close();}
});

test('Render password command waits for actual runtime cancellation and never acknowledges its failure',async()=>{
  let released,entered;const ready=new Promise(resolve=>{entered=resolve;});
  let settled=false,changes=0,cancelCalls=0;
  const command=createPlayerPasswordCommand({administration:{async setPassword(){changes++;return {id:'player-1',changed:true};}},cancelRuntime:async id=>{assert.equal(id,'player-1');cancelCalls++;entered();await new Promise(resolve=>{released=resolve;});}});
  const request={body:{playerId:'player-1',password:randomBytes(24).toString('base64url'),reason:'Reset requested'},actor:{user:'operator',role:'admin'}};
  const pending=command(request).then(value=>{settled=true;return value;});await ready;assert.equal(settled,false);assert.equal(changes,1);released();assert.deepEqual(await pending,{ok:true,id:'player-1',changed:true});assert.equal(cancelCalls,1);
  const failed=createPlayerPasswordCommand({administration:{async setPassword(){return {id:'player-1'};}},cancelRuntime:async()=>{throw Error('cancel unavailable');}});
  await assert.rejects(failed(request),/cancel unavailable/);
  await assert.rejects(command({...request,actor:{user:'player',role:'reader'}}),{statusCode:400});assert.equal(changes,1);
});
