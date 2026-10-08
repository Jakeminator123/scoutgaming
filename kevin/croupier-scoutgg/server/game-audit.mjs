import { digest, verifyShoe } from '../vendor/croupier/shoe-proof.mjs';
import { SHOE_RULES } from '../vendor/croupier/shoe-game.mjs';
// All writes use the game's existing SQLite transaction. No independent commit.
export function createGameAudit(db, now=Date.now) {
  db.exec(`CREATE TABLE IF NOT EXISTS audit_shoes (
    id TEXT PRIMARY KEY, room TEXT NOT NULL, opened_at INTEGER NOT NULL, closed_at INTEGER,
    commitment TEXT, dealt INTEGER NOT NULL, remaining INTEGER NOT NULL, proof TEXT, verdict TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, round_id TEXT,
    at INTEGER NOT NULL, parent INTEGER, type TEXT NOT NULL, payload TEXT NOT NULL,
    previous_hash TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS audit_shoes_room ON audit_shoes(room,opened_at);
    CREATE INDEX IF NOT EXISTS audit_events_shoe ON audit_events(room,json_extract(payload,'$.shoeId'),seq);
    CREATE INDEX IF NOT EXISTS audit_events_room_round ON audit_events(room,round_id,seq);
    CREATE TRIGGER IF NOT EXISTS audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_commitment_fixed BEFORE UPDATE OF commitment ON audit_shoes WHEN NEW.commitment IS NOT OLD.commitment BEGIN SELECT RAISE(ABORT,'Opening commitment is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS audit_closed_fixed BEFORE UPDATE ON audit_shoes WHEN OLD.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'Closed shoe is immutable'); END;`);
  function event(room,roundId,type,payload,parent=null){
    const previous=db.prepare('SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1').get()?.hash??'genesis';
    const at=now(),data=JSON.stringify(payload);
    const hash=digest({room,roundId:roundId??null,at,parent,type,payload:data,previous});
    return Number(db.prepare('INSERT INTO audit_events(room,round_id,at,parent,type,payload,previous_hash,hash) VALUES (?,?,?,?,?,?,?,?)').run(room,roundId??null,at,parent,type,data,previous,hash).lastInsertRowid);
  }
  function sync(room,game){
    for(const proof of game.closedShoes??[]){
      const stored=db.prepare('SELECT * FROM audit_shoes WHERE id=?').get(proof.shoeId);
      if(!proof.legacy)proof.commandDraws=db.prepare("SELECT payload FROM audit_events WHERE room=? AND type LIKE 'engine.%' AND json_extract(payload,'$.shoeId')=? ORDER BY seq").all(room,proof.shoeId).flatMap(row=>JSON.parse(row.payload).draws??[]);
      const result=proof.legacy||!stored?.commitment?{status:'incomplete',checks:[],disclaimer:'Shoe began before audit capture; no historical proof is claimed.'}:verifyShoe(proof,stored.commitment);
      db.prepare('INSERT OR IGNORE INTO audit_shoes VALUES (?,?,?,?,?,?,?,?,?)').run(proof.shoeId,room,now(),null,null,proof.dealt??proof.draws.length,proof.remainingCount??proof.remaining.length,null,'incomplete');
      db.prepare('UPDATE audit_shoes SET closed_at=?,dealt=?,remaining=?,proof=?,verdict=? WHERE id=? AND closed_at IS NULL').run(now(),proof.dealt??proof.draws.length,proof.remainingCount??proof.remaining.length,JSON.stringify(proof),result.status,proof.shoeId);
      event(room,null,'shoe.closed',{shoeId:proof.shoeId,verification:result});
    }
    delete game.closedShoes;
    if(!game.shoe)return;
    const s=game.shoe,commitment=s.proof?.commitment??null;
    const stored=db.prepare('SELECT commitment FROM audit_shoes WHERE id=?').get(s.id);
    if(stored && stored.commitment!==commitment)throw Error('Shoe commitment changed');
    if(!stored){
      db.prepare('INSERT INTO audit_shoes VALUES (?,?,?,?,?,?,?,?,?)').run(s.id,room,now(),null,commitment,s.dealt,s.cards.length,null,commitment?'open':'incomplete');
      event(room,null,'shoe.opened',{shoeId:s.id,commitment,rules:SHOE_RULES,coverage:commitment?'complete from shuffle':'legacy: capture begins mid-shoe'});
    }
    db.prepare('UPDATE audit_shoes SET dealt=?,remaining=? WHERE id=? AND closed_at IS NULL').run(s.dealt,s.cards.length,s.id);
  }
  function read({room='astrid',before=Number.MAX_SAFE_INTEGER,shoeId}={}){
    if(shoeId){
      const s=db.prepare('SELECT * FROM audit_shoes WHERE id=? AND room=?').get(shoeId,room);
      if(!s)throw Error('Shoe not found');
      if(!s.closed_at)throw Error('Shoe order is private until this shoe closes');
      const proof=JSON.parse(s.proof);
      const {proof:storedProof,...metadata}=s;
      return {shoe:metadata,proof,verification:proof.legacy||!s.commitment?{status:'incomplete',checks:[]}:verifyShoe(proof,s.commitment)};
    }
    const shoes=db.prepare('SELECT id,room,opened_at,closed_at,commitment,dealt,remaining,verdict FROM audit_shoes WHERE room=? ORDER BY opened_at DESC,rowid DESC LIMIT 100').all(room);
    // Page whole rounds, never cut a tree in half. Latest 20 rounds before cursor.
    const rounds=db.prepare('SELECT round_id,MAX(seq) AS last FROM audit_events WHERE room=? AND round_id IS NOT NULL GROUP BY round_id HAVING MAX(seq)<? ORDER BY last DESC LIMIT 20').all(room,Number(before)||Number.MAX_SAFE_INTEGER);
    const events=[];
    for(const round of rounds){
      const rows=db.prepare('SELECT * FROM audit_events WHERE room=? AND round_id=? ORDER BY seq').all(room,round.round_id);
      const settled=rows.some(e=>e.type==='engine.collect');
      for(const row of rows){
        const payload=JSON.parse(row.payload);
        // Never disclose a live round's hole card, even to the backoffice.
        if(!settled && payload.draws)payload.draws=payload.draws.map(d=>({position:d.position,kind:d.kind,card:'hidden until settlement'}));
        events.push({...row,payload});
      }
    }
    const activity=db.prepare('SELECT * FROM audit_events WHERE room=? AND round_id IS NULL ORDER BY seq DESC LIMIT 100').all(room).map(e=>({...e,payload:JSON.parse(e.payload)}));
    return {activity,rules:SHOE_RULES,rooms:db.prepare('SELECT id FROM shared_rooms ORDER BY id').all().map(r=>r.id),room,shoes,events,nextBefore:rounds.length===20?rounds.at(-1).last:null,serverNow:now(),chainHead:db.prepare('SELECT seq,hash FROM audit_events ORDER BY seq DESC LIMIT 1').get()??null};
  }
  return {event,sync,read};
}
