import {readOperations} from './operations.mjs';

// Explicit projection of recorded data. Never serialize room state, player tokens,
// requests, shoe order or a live round's hole card into an operator response.
export function readBackofficeWorkspace(db, now=Date.now) {
  const at=now(), operations=readOperations(db,()=>at);
  const players=db.prepare('SELECT room,id,name,balance,seen FROM shared_players ORDER BY name').all();
  const settlements=db.prepare('SELECT rowid AS id,room,round_id,player_id,receipt FROM shared_settlements ORDER BY rowid DESC').all().map(row=>{
    const r=JSON.parse(row.receipt);
    return {id:row.id,room:row.room,roundId:row.round_id,playerId:row.player_id,at:r.settledAt,
      stakesCents:Math.round(r.staked*100),payoutsCents:Math.round(r.returned*100),hands:r.hands};
  });
  const movements=db.prepare('SELECT id,room,round_id AS roundId,player_id AS playerId,name,at,kind,amount_cents AS amountCents,before_cents AS beforeCents,after_cents AS afterCents FROM shared_transactions ORDER BY id DESC').all();
  const shoes=db.prepare('SELECT id,room,opened_at,closed_at,commitment,dealt,remaining,verdict FROM audit_shoes ORDER BY opened_at DESC').all();
  return {view:'workspace',demo:true,serverNow:at,operations,players,settlements,movements,shoes,
    coverage:{movementsSince:movements.at(-1)?.at??null,settlementsSince:settlements.at(-1)?.at??null},
    unavailable:['operator brand attribution','historic sessions','device and IP history','chat archive','player blocks','dealer reassignment','uptime history']};
}
