import { roomCommand, newRoom, cents, ROOM } from './room.mjs';

const unavailable = () => Object.assign(Error('roulette_not_ready'), { statusCode:503 });
function playerBalance(player) {
  if (!player || player.status && player.status !== 'active') throw Error('player_unavailable');
  const balance = Number(player.balance); cents(balance); return balance;
}
function response(result, player, balance, requestId) {
  return { ...result.view, player:{ id:player.id, name:player.name }, balance, currency:player.currency,
    requestId:requestId ?? null, replayed:result.replayed ?? false, round:result.round ?? null };
}
function ledger(round) {
  return JSON.stringify({ game:'roulette', roomId:round.event.roomId, roundId:round.id,
    number:round.event.outcome.number, wagered:round.wagered, returned:round.returned });
}
export function createSqliteRouletteCommand({ db, draw }) {
  db.exec('CREATE TABLE IF NOT EXISTS roulette_tables (player_id TEXT NOT NULL REFERENCES players(id), operator_id TEXT NOT NULL, room_id TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY(player_id,operator_id,room_id))');
  return ({ id, ...request }, {room = ROOM} = {}) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const player = db.prepare('SELECT id,name,currency,balance FROM players WHERE id=?').get(id);
      const before = playerBalance(player);
      const saved = db.prepare('SELECT state FROM roulette_tables WHERE player_id=? AND operator_id=? AND room_id=?').get(id,room.operatorId,room.id);
      const state = saved ? JSON.parse(saved.state) : newRoom();
      const result = roomCommand(state,request,before,{ draw, currency:player.currency, room });
      let balance = before;
      if (result.changed) {
        balance = result.round.balanceAfter;
        db.prepare('INSERT INTO roulette_tables (player_id,operator_id,room_id,state) VALUES (?,?,?,?) ON CONFLICT(player_id,operator_id,room_id) DO UPDATE SET state=excluded.state').run(id,room.operatorId,room.id,JSON.stringify(state));
        db.prepare('UPDATE players SET balance=? WHERE id=?').run(balance,id);
        const insert = db.prepare('INSERT INTO transactions (player_id,type,amount,currency,meta,at) VALUES (?,?,?,?,?,?)');
        insert.run(id,'roulette_bet',-result.round.wagered,player.currency,ledger(result.round),result.round.event.occurredAt);
        if (result.round.returned) insert.run(id,'roulette_payout',result.round.returned,player.currency,ledger(result.round),result.round.event.occurredAt);
      }
      db.exec('COMMIT');
      return response(result,player,balance,request.requestId);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
}
export function createPostgresRouletteCommand({ pool, draw }) {
  return async ({ id, ...request }, {room = ROOM, recheck = async()=>{}} = {}) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN; SET LOCAL statement_timeout = '15000ms'; SET LOCAL lock_timeout = '5000ms'");
      // Shared with blackjack, deposits and currency changes: one wallet writer at a time.
      const player = (await client.query('SELECT id,name,currency,balance,status FROM players WHERE id=$1 FOR UPDATE',[id])).rows[0];
      const before = playerBalance(player);
      const saved = (await client.query('SELECT state FROM croupier_game.roulette_tables WHERE player_id=$1 AND operator_id=$2 AND room_id=$3',[id,room.operatorId,room.id])).rows[0];
      const state = saved ? JSON.parse(saved.state) : newRoom();
      const result = roomCommand(state,request,before,{ draw, currency:player.currency, room });
      let balance = before;
      if (result.changed) {
        balance = result.round.balanceAfter;
        await client.query('INSERT INTO croupier_game.roulette_tables (player_id,operator_id,room_id,state) VALUES ($1,$2,$3,$4) ON CONFLICT(player_id,operator_id,room_id) DO UPDATE SET state=EXCLUDED.state',[id,room.operatorId,room.id,JSON.stringify(state)]);
        await client.query('UPDATE players SET balance=$1 WHERE id=$2',[balance,id]);
        const insert = 'INSERT INTO transactions (player_id,type,amount,currency,meta,at) VALUES ($1,$2,$3,$4,$5,$6)';
        await client.query(insert,[id,'roulette_bet',-result.round.wagered,player.currency,ledger(result.round),result.round.event.occurredAt]);
        if (result.round.returned) await client.query(insert,[id,'roulette_payout',result.round.returned,player.currency,ledger(result.round),result.round.event.occurredAt]);
      }
      await recheck(client);
      await client.query('COMMIT');
      return response(result,player,balance,request.requestId);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve original failure. */ }
      if (error.code === '42P01') throw unavailable();
      throw error;
    } finally { client.release(); }
  };
}
