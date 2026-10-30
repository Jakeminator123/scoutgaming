import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createPostgresStore} from '../services/game/storage/postgres-store.mjs';
import {createPostgresRouletteCommand} from '../services/game/games/roulette/storage.mjs';
import {ROOM} from '../services/game/games/roulette/room.mjs';
import {createPgliteStore} from './fixtures/pglite-pool.mjs';
import {describePocket} from '../services/game/games/roulette/index.mjs';
import {createRouletteRoomAccess} from '../services/game/games/roulette/access.mjs';
import {createFrozenDealerContextReader} from '../packages/presentation/server/frozen-dealer-presentation.mjs';
import {createOperatorStore} from '../packages/operators/server/operator-store.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
import {withPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';

// Run the same persisted-funding checks locally in PGlite and in CI's isolated PostgreSQL.
async function fundingChecks(pool) {
  const id='roulette-funding-'+randomUUID(),reservation=randomUUID();let draws=0,number=2;
  const run=createPostgresRouletteCommand({pool:createPostgresStore({pool}).gamePool,draw:context=>{
    draws++;return {...context,eventId:randomUUID(),occurredAt:new Date().toISOString(),outcome:describePocket(number)};
  }});
  await pool.query('INSERT INTO croupier_game.players(id,name,currency,balance,created_at) VALUES($1,$2,$3,100,$4)',[id,'Synthetic funding','USD',new Date().toISOString()]);
  await pool.query("INSERT INTO croupier_game.shared_wallet_reservations(reservation_id,player_id,room_id,kind,amount,generation) VALUES($1,$2,'synthetic-blackjack','stake',100,0)",[reservation,id]);
  const blocked={id,op:'spin',requestId:randomUUID(),version:0,bets:[{id:'red',amount:100}]};
  for(let i=0;i<2;i++) await assert.rejects(run(blocked),/insufficient_balance/);
  assert.equal(draws,0);
  const empty=await run({id,op:'state'});
  assert.equal(empty.balance,100);assert.equal(empty.version,0);assert.equal(empty.rounds.length,0);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM croupier_game.transactions WHERE player_id=$1',[id])).rows[0].n),0);
  await pool.query('UPDATE croupier_game.shared_wallet_reservations SET amount=80 WHERE reservation_id=$1',[reservation]);
  const request={...blocked,requestId:randomUUID(),bets:[{id:'red',amount:20}]};
  const loss=await run(request);
  assert.equal(loss.balance,80);assert.equal(loss.round.net,-20);assert.equal(draws,1);
  const replay=await run(request);
  assert.equal(replay.replayed,true);assert.deepEqual(replay.round,loss.round);assert.equal(draws,1);
  await assert.rejects(run({...request,requestId:randomUUID(),version:1}),/insufficient_balance/);
  await pool.query('UPDATE croupier_game.shared_wallet_reservations SET amount=60 WHERE reservation_id=$1',[reservation]);
  number=1;
  const win=await run({...request,requestId:randomUUID(),version:1});
  assert.equal(win.balance,100);assert.equal(win.round.net,20);assert.equal(draws,2);
  assert.equal(Number((await pool.query('SELECT amount FROM croupier_game.shared_wallet_reservations WHERE reservation_id=$1',[reservation])).rows[0].amount),60);
  const ledger=(await pool.query('SELECT type,amount FROM croupier_game.transactions WHERE player_id=$1 ORDER BY id',[id])).rows;
  assert.deepEqual(ledger.map(row=>[row.type,Number(row.amount)]),[['roulette_bet',-20],['roulette_bet',-20],['roulette_payout',40]]);
}

async function reservationLockCheck(pool) {
  const id='roulette-lock-'+randomUUID();let draws=0,entered;
  await pool.query('INSERT INTO croupier_game.players(id,name,currency,balance,created_at) VALUES($1,$2,$3,100,$4)',[id,'Synthetic lock','USD',new Date().toISOString()]);
  const waiting=new Promise(resolve=>{entered=resolve;});
  const observed={query:(...args)=>pool.query(...args),async connect(){const client=await pool.connect();return {release:()=>client.release(),query(sql,values){
    const result=client.query(sql,values);
    if(sql.includes('players')&&sql.includes('FOR UPDATE')) entered();
    return result;
  }};}};
  const run=createPostgresRouletteCommand({pool:createPostgresStore({pool:observed}).gamePool,draw:()=>{draws++;throw Error('must not draw');}});
  const writer=await pool.connect();let attempt;
  try {
    await writer.query('BEGIN');
    // The real reservation trigger acquires the player lock before its insert.
    await writer.query("INSERT INTO croupier_game.shared_wallet_reservations(reservation_id,player_id,room_id,kind,amount,generation) VALUES($1,$2,'synthetic-blackjack','stake',100,0)",[randomUUID(),id]);
    attempt=run({id,op:'spin',requestId:randomUUID(),version:0,bets:[{id:'red',amount:100}]}).then(value=>({value}),error=>({error}));
    await Promise.race([waiting,attempt.then(()=>assert.fail('spin completed before acquiring the player lock'))]);
    const pid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    let blocked=false;
    for(let i=0;i<100&&!blocked;i++){
      blocked=(await writer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked',[pid])).rows[0].blocked;
      if(!blocked) await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(blocked,true,'roulette must be waiting for the reservation writer before its commit');
    await writer.query('COMMIT');
    assert.equal((await attempt).error?.message,'insufficient_balance');assert.equal(draws,0);
  } finally {await writer.query('ROLLBACK');writer.release();await attempt;}
}

async function publicationPoolChecks(pool) {
  const scope={environment:'roulette-pool-qa',workspaceId:randomUUID()};
  const {presentation}=cloudPresentationFixture({lanes:[defaultPresentationLane('astrid')]});
  const room={schemaVersion:2,id:'roulette-one',name:'Pool QA',operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:'mobile-phone',state:'live',game:'roulette'};
  const administration={rooms:[room],gameLane:'mobile-phone',gameLanes:[{schemaVersion:1,id:'mobile-phone',label:'Portrait',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}],
    tiers:{classic:'vera',high:'astrid',vip:'amira'},tournaments:[],pitboss:{payout10x:true,streak5:true,randomWalkMin:45}};
  const repository=createStudioRepository({pool,scope});
  await repository.initializeDocument('administration',{value:administration,actor:'qa'});
  const operators=await createOperatorStore({sql:pool,scope});
  await operators.createOperator({operatorId:'north',slug:'north',name:'North',actor:'qa'});
  await operators.publishPackage({operatorId:'north',actor:'qa',expectedRevision:null,lanes:['mobile-phone'],games:['roulette'],tables:[room.id],branding:withPackagePresentation({},presentation)});
  const ids=Array.from({length:8},()=>randomUUID());
  for(const id of ids) await pool.query('INSERT INTO croupier_game.players(id,name,currency,balance,created_at) VALUES($1,$2,$3,$4,$5)',[id,'Pool QA','USD',100,new Date().toISOString()]);
  let active=0,peak=0,acquired=0,barrier=null,unblock;
  const limited={query:(...args)=>pool.query(...args),async connect(){
    assert.ok(active<8,'must not borrow a ninth connection while eight wallet transactions are held');
    const raw=await pool.connect();active++;peak=Math.max(peak,active);
    return {async query(sql,values){
      const result=await raw.query(sql,values);
      if(barrier&&sql.includes('FOR UPDATE')&&sql.includes('players')){if(++acquired===8)unblock();await barrier;}
      return result;
    },release(){active--;raw.release();}};
  }};
  const access=createRouletteRoomAccess({readCurrentContext:createFrozenDealerContextReader({pool:limited,scope})});
  const context=await access({operator:'north',table:room.id});
  const run=createPostgresRouletteCommand({pool:createPostgresStore({pool:limited}).gamePool});
  async function together(op){
    acquired=0;barrier=new Promise(resolve=>{unblock=resolve;});
    try {return await Promise.all(ids.map(id=>run(op==='state'?{id,op}:{id,op,requestId:randomUUID(),version:0,currency:'USD',bets:[{id:'red',amount:1}]},context)));}
    finally {barrier=null;}
  }
  assert.equal((await together('state')).length,8);assert.equal((await together('spin')).length,8);
  assert.equal(peak,8);assert.equal(active,0);
  const before=await pool.query('SELECT balance FROM croupier_game.players WHERE id=$1',[ids[0]]);
  const saved=await repository.readDocument('administration');administration.rooms[0].state='preview';
  await repository.saveDocument('administration',{value:administration,actor:'qa',expectedRevision:saved.revision});
  // With Studio 023 the package's own rooms freeze the state, so the pause is also published as
  // pkg+1 with the document's rooms (the dual write L3 PR 3 gives A:room-state). Without 023 the
  // package has no rooms and the document alone revokes, as before.
  await operators.publishPackage({operatorId:'north',actor:'qa',expectedRevision:1,lanes:['mobile-phone'],games:['roulette'],tables:[room.id],branding:withPackagePresentation({},presentation)});
  await assert.rejects(run({id:ids[0],op:'spin',requestId:randomUUID(),version:1,currency:'USD',bets:[{id:'red',amount:1}]},context),/roulette_room_not_found/);
  assert.deepEqual((await pool.query('SELECT balance FROM croupier_game.players WHERE id=$1',[ids[0]])).rows,before.rows);
  assert.equal(active,0);
}

export async function runRoulettePostgresChecks({pool,restart}={}) {
  const identity=(await pool.query("SELECT host(inet_server_addr()) AS address,current_user AS role,current_database() AS database,current_setting('listen_addresses') AS listeners")).rows[0];
  assert.deepEqual(identity,{address:'127.0.0.1',role:'studio_qa',database:'postgres',listeners:'127.0.0.1'});
  const checks=[],id='roulette-qa-'+randomUUID();let draws=0;
  const draw=context=>{draws++;return {...context,eventId:randomUUID(),occurredAt:new Date().toISOString(),outcome:{number:0,color:'green'}};};
  const open=()=>createPostgresRouletteCommand({pool:createPostgresStore({pool}).gamePool,draw});
  const sql=await readFile(new URL('../ops/neon-game/007-roulette-tables.sql',import.meta.url),'utf8');
  await pool.query(sql);await pool.query(sql);
  await pool.query(await readFile(new URL('../ops/neon-game/008-shared-wallet.sql',import.meta.url),'utf8'));
  await pool.query('INSERT INTO croupier_game.players(id,name,currency,balance,created_at) VALUES($1,$2,$3,$4,$5)',[id,'Isolated roulette','USD',100,new Date().toISOString()]);
  let run=open();
  const request={id,op:'spin',requestId:randomUUID(),version:0,bets:[{id:'straight-0',amount:2}]};
  const responses=await Promise.all(Array.from({length:4},()=>run(request)));
  assert.equal(draws,1);assert.equal(responses.filter(row=>!row.replayed).length,1);
  assert.ok(responses.every(row=>row.balance===170&&row.round.id===responses[0].round.id));
  checks.push('roulette: concurrent identical commands draw and settle once');
  const race=await Promise.allSettled(Array.from({length:4},()=>run({...request,requestId:randomUUID(),version:1})));
  assert.equal(race.filter(row=>row.status==='fulfilled').length,1);
  assert.ok(race.filter(row=>row.status==='rejected').every(row=>row.reason.message==='room_changed'));
  assert.equal(draws,2);assert.equal((await run({id,op:'state'})).balance,240);
  checks.push('roulette: concurrent different commands reject stale room versions');
  const foreign={room:{...ROOM,operatorId:'other-operator',id:'other-room'}};
  assert.equal((await run({id,op:'state'},foreign)).version,0);
  // Different room wallets still share the same player row lock.
  await Promise.all([run({...request,requestId:randomUUID(),version:2}),run({...request,requestId:randomUUID()},foreign)]);
  assert.equal((await run({id,op:'state'})).balance,380);
  checks.push('roulette: operator rooms isolate receipts and serialize the shared wallet');
  const before=await run({id,op:'state'}),next={...request,requestId:randomUUID(),version:3};
  await assert.rejects(run(next,{recheck:async()=>{throw Error('publication revoked');}}),/publication revoked/);
  assert.deepEqual(await run({id,op:'state'}),before);
  // A real ledger constraint failure must roll back the already-updated room/wallet.
  await pool.query("ALTER TABLE croupier_game.transactions ADD CONSTRAINT roulette_qa_reject CHECK (type <> 'roulette_bet') NOT VALID");
  try {await assert.rejects(run(next),error=>error.code==='23514');}
  finally {await pool.query('ALTER TABLE croupier_game.transactions DROP CONSTRAINT roulette_qa_reject');}
  assert.deepEqual(await run({id,op:'state'}),before);
  assert.equal(Number((await pool.query('SELECT sum(amount) AS net FROM croupier_game.transactions WHERE player_id=$1',[id])).rows[0].net),280);
  checks.push('roulette: revoked publications and failed ledger writes roll back all three records');
  assert.equal(typeof restart,'function');pool=await restart();run=open();
  assert.deepEqual(await run({id,op:'state'}),before);
  assert.equal((await run(request)).round.id,responses[0].round.id);
  assert.equal((await run(request)).balance,380);
  checks.push('roulette: persisted receipts and wallet survive a PostgreSQL restart');
  // Ported from the retired SQLite storage test: a later currency change never relabels settled rounds.
  await pool.query("UPDATE croupier_game.players SET currency='EUR' WHERE id=$1",[id]);
  const settled=(await run({id,op:'state'})).rounds;
  assert.ok(settled.length>0&&settled.every(round=>round.currency==='USD'));
  const firstBet=(await pool.query("SELECT meta FROM croupier_game.transactions WHERE player_id=$1 AND type='roulette_bet' ORDER BY id LIMIT 1",[id])).rows[0];
  assert.equal(JSON.parse(firstBet.meta).roundId,responses[0].round.id);
  checks.push('roulette: a currency change keeps settled rounds and their ledger in the original currency');
  await pool.query("UPDATE croupier_game.players SET status='blocked' WHERE id=$1",[id]);
  await assert.rejects(run(next),/player_unavailable/);
  checks.push('roulette: blocked players cannot read or play a room');
  await fundingChecks(pool);
  await reservationLockCheck(pool);
  checks.push('roulette: reserved funds cannot spin, settled receipts replay and waiting commands see committed reservations');
  await publicationPoolChecks(pool);
  checks.push('roulette: eight real publication rechecks reuse the held wallet clients; revocation rolls back');
  return {pool,checks};
}

test('roulette SQL acceptance refuses non-isolated database identities before mutation',async()=>{
  let queries=0;
  await assert.rejects(runRoulettePostgresChecks({pool:{query:async()=>{queries++;return {rows:[{address:'production.invalid',role:'owner',database:'game',listeners:'*'}]};}}}));
  assert.equal(queries,1);
});

test('roulette funding excludes reservations before entropy and settles only available stakes on the real schema',async t=>{
  const store=await createPgliteStore();t.after(()=>store.close());
  await fundingChecks(store.pool);
});
