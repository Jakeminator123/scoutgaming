// Read-only BO projection. Never return raw room state: it contains the shoe.
export function readOperations(db, now = Date.now) {
  const at = now();
  const tables = db.prepare('SELECT id,state FROM shared_rooms ORDER BY id').all().map(row => {
    const r = JSON.parse(row.state);
    const owners = r.owners ?? [];
    const seated = db.prepare('SELECT id,name,seen FROM shared_players WHERE room=?').all(row.id)
      .filter(p => owners.includes(p.id))
      .map(p => ({id:p.id, name:p.name, online:at-p.seen<15000,
        seats:owners.flatMap((owner,i)=>owner===p.id?[i+1]:[])}));
    const cents = amount => Math.round(amount * 100);
    const presenting = r.phase==='round' && r.plan?.endAt > at;
    const phase = presenting ? 'dealing' : r.phase==='round' ? r.round?.phase ?? 'round' : r.phase;
    const latest = db.prepare('SELECT at FROM audit_events WHERE room=? ORDER BY seq DESC LIMIT 1').get(row.id);
    return {
      id:row.id, dealer:'Astrid', game:'Blackjack', capacity:7,
      phase, roundId:r.phase==='bets'?null:r.roundId??null,
      occupiedSeats:owners.filter(Boolean).length, players:seated,
      onlinePlayers:seated.filter(p=>p.online).length,
      deadline:presenting?r.plan.endAt:r.phase==='bets'?r.deadline:r.actionDeadline,
      lastActionAt:latest?.at??null,
      openStakesCents:r.phase==='round'?(r.round?.hands??[]).reduce((total,h)=>total+cents(h.stake+h.pp+h.tp+(h.insured||0)),0):0,
      preparedBetsCents:r.phase==='bets'?(r.bets??[]).reduce((total,b)=>total+cents(b.main+b.pp+b.tp),0):0,
      shoe:r.game.shoe?{id:r.game.shoe.id,dealt:r.game.shoe.dealt,remaining:r.game.shoe.cards.length}:null
    };
  });
  return {view:'operations',demo:true,serverNow:at,tables,
    summary:{tables:tables.length,activeTables:tables.filter(t=>t.onlinePlayers>0).length,
      playersAtTables:tables.reduce((n,t)=>n+t.players.length,0),
      occupiedSeats:tables.reduce((n,t)=>n+t.occupiedSeats,0),
      openStakesCents:tables.reduce((n,t)=>n+t.openStakesCents,0)}};
}
