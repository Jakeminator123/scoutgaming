import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createPostgresStore} from '../web/storage/postgres-store.mjs';
import {createPostgresRouletteCommand} from '../web/games/roulette/storage.mjs';
import {ROOM} from '../web/games/roulette/room.mjs';

export async function runRoulettePostgresChecks({pool,restart}={}) {
  const identity=(await pool.query("SELECT host(inet_server_addr()) AS address,current_user AS role,current_database() AS database,current_setting('listen_addresses') AS listeners")).rows[0];
  assert.deepEqual(identity,{address:'127.0.0.1',role:'studio_qa',database:'postgres',listeners:'127.0.0.1'});
  const checks=[],id='roulette-qa-'+randomUUID();let draws=0;
  const draw=context=>{draws++;return {...context,eventId:randomUUID(),occurredAt:new Date().toISOString(),outcome:{number:0,color:'green'}};};
  const open=()=>createPostgresRouletteCommand({pool:createPostgresStore({pool}).gamePool,draw});
  const sql=await readFile(new URL('../ops/neon-game/007-roulette-tables.sql',import.meta.url),'utf8');
  await pool.query(sql);await pool.query(sql);
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
  await pool.query("UPDATE croupier_game.players SET status='blocked' WHERE id=$1",[id]);
  await assert.rejects(run(next),/player_unavailable/);
  checks.push('roulette: blocked players cannot read or play a room');
  return {pool,checks};
}

test('roulette SQL acceptance refuses non-isolated database identities before mutation',async()=>{
  let queries=0;
  await assert.rejects(runRoulettePostgresChecks({pool:{query:async()=>{queries++;return {rows:[{address:'production.invalid',role:'owner',database:'game',listeners:'*'}]};}}}));
  assert.equal(queries,1);
});
