import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createAccountCredentialResolver } from '../packages/studio-access/server/account-credentials.mjs';
import { createPlayerAdministration, createPlayerPasswordCommand } from '../packages/storage/server/player-administration.mjs';
import { createPgliteStore } from './fixtures/pglite-pool.mjs';

// Real PostgreSQL (PGlite) with the product schema: FOR UPDATE and rollback run as written.
async function fixture() {
  const store=await createPgliteStore();
  let failAudit=false;
  const db={...store.db,prepare(sql){if(failAudit&&sql.startsWith('INSERT INTO player_admin_events'))throw Error('audit unavailable');return store.db.prepare(sql);}};
  const administration=createPlayerAdministration({db,boDb:store.boDb}),password=randomBytes(24).toString('base64url');
  const sql=store.db;
  const money=()=>Promise.all([['players','id'],['transactions','id'],['blackjack_tables','player_id']].map(([table,key])=>sql.prepare(`SELECT * FROM ${table} ORDER BY ${key}`).all()));
  return {sql,administration,password,money,set failAudit(value){failAudit=value;},close:()=>store.close()};
}

test('password change revokes sessions but preserves player, wallet and round ledger exactly across reconstruction',async()=>{
  const f=await fixture();
  try {
    const player=await f.administration.create({username:'player',password:f.password,actor:'operator'});
    await f.sql.prepare('INSERT INTO blackjack_tables VALUES(?,?)').run(player.id,JSON.stringify({round:{id:'round-1',stake:20}}));
    for(const table of ['player_sessions','preview_sessions']) await f.sql.prepare(`INSERT INTO ${table} (digest,player_id,expires) VALUES(?,?,?)`).run(randomBytes(32).toString('hex'),player.id,Date.now()+60000);
    const before=await f.money(),old=await f.sql.prepare('SELECT * FROM player_accounts').get(),changedPassword=randomBytes(24).toString('base64url');
    const result=await f.administration.setPassword({playerId:player.id,password:changedPassword,actor:'operator',reason:'Requested credential change'});
    assert.deepEqual(result,{id:player.id,changed:true});assert.deepEqual(await f.money(),before);
    const account=await f.sql.prepare('SELECT * FROM player_accounts').get();assert.notEqual(account.salt,old.salt);assert.notEqual(account.hash,old.hash);
    assert.equal(timingSafeEqual(scryptSync(changedPassword,account.salt,64),Buffer.from(account.hash,'hex')),true);
    assert.equal(timingSafeEqual(scryptSync(f.password,account.salt,64),Buffer.from(account.hash,'hex')),false);
    for(const table of ['player_sessions','preview_sessions']) assert.equal((await f.sql.prepare(`SELECT count(*) n FROM ${table}`).get()).n,0);
    const fresh=createAccountCredentialResolver({playerDb:f.sql,playerAccounts:true});assert.equal((await fresh.authenticate('player',changedPassword)).kind,'player');assert.equal(await fresh.authenticate('player',f.password),null);
    const events=(await f.sql.prepare('SELECT action,previous_status,status FROM player_admin_events ORDER BY id').all()).map(row=>({...row}));assert.deepEqual(events,[{action:'create',previous_status:null,status:'active'},{action:'password',previous_status:'active',status:'active'}]);
  } finally {await f.close();}
});

test('invalid, unknown, closed and failed-audit changes cannot partially replace credentials or sessions',async()=>{
  const f=await fixture();
  try {
    const player=await f.administration.create({username:'player',password:f.password,actor:'operator'});
    for(const table of ['player_sessions','preview_sessions']) await f.sql.prepare(`INSERT INTO ${table} (digest,player_id,expires) VALUES(?,?,?)`).run(randomBytes(32).toString('hex'),player.id,Date.now()+60000);
    const snapshot=()=>Promise.all(['player_sessions','preview_sessions'].map(table=>f.sql.prepare(`SELECT * FROM ${table} ORDER BY digest`).all()));
    const before=await f.sql.prepare('SELECT * FROM player_accounts').all(),sessions=await snapshot();
    const body={playerId:player.id,password:randomBytes(24).toString('base64url'),actor:'operator',reason:'Reset requested'};
    await assert.rejects(f.administration.setPassword({...body,password:'x'}),{statusCode:400});
    await assert.rejects(f.administration.setPassword({...body,playerId:'missing'}),{statusCode:404});
    await f.sql.prepare("UPDATE players SET status='closed'").run();await assert.rejects(f.administration.setPassword(body),{statusCode:409});
    await f.sql.prepare("UPDATE players SET status='active'").run();f.failAudit=true;await assert.rejects(f.administration.setPassword(body),/audit unavailable/);
    assert.deepEqual(await f.sql.prepare('SELECT * FROM player_accounts').all(),before);assert.deepEqual(await snapshot(),sessions);
    assert.equal((await f.sql.prepare("SELECT count(*) n FROM player_admin_events WHERE action='password'").get()).n,0);
  } finally {await f.close();}
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
