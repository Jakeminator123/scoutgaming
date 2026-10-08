// Monetary report uses integer cents and persisted settlement receipts, never UI awards.
export function createTransactions(db,now=Date.now){
 db.exec(`CREATE TABLE IF NOT EXISTS shared_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,player_id TEXT NOT NULL,name TEXT NOT NULL,
 round_id TEXT,at INTEGER NOT NULL,kind TEXT NOT NULL,amount_cents INTEGER NOT NULL,
 before_cents INTEGER NOT NULL,after_cents INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS shared_transactions_scope ON shared_transactions(room,at,id);
 CREATE TRIGGER IF NOT EXISTS shared_transactions_no_update BEFORE UPDATE ON shared_transactions BEGIN SELECT RAISE(ABORT,'Transactions are append-only'); END;
 CREATE TRIGGER IF NOT EXISTS shared_transactions_no_delete BEFORE DELETE ON shared_transactions BEGIN SELECT RAISE(ABORT,'Transactions are append-only'); END;`);
 const cents=n=>Math.round(n*100);
 function record(room,p,roundId,kind,before,after){
  db.prepare('INSERT INTO shared_transactions(room,player_id,name,round_id,at,kind,amount_cents,before_cents,after_cents) VALUES (?,?,?,?,?,?,?,?,?)').run(room,p.id,p.name,roundId??null,now(),kind,cents(after)-cents(before),cents(before),cents(after));
 }
 // Existing balances are an opening snapshot, not manufactured historic credits.
 db.exec('BEGIN IMMEDIATE');try{
  for(const p of db.prepare('SELECT room,id,name,balance FROM shared_players').all())if(!db.prepare('SELECT 1 FROM shared_transactions WHERE room=? AND player_id=? LIMIT 1').get(p.room,p.id))record(p.room,p,null,'opening_snapshot',p.balance,p.balance);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 function read({room='astrid',from,to,playerId,kind='settlements',before}={}){
  const start=from==null||from===''?0:Number(from),end=to==null||to===''?now():Number(to),cursor=before==null||before===''?Number.MAX_SAFE_INTEGER:Number(before);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||!Number.isSafeInteger(cursor)||cursor<1)throw Error('Invalid transaction range');
  if(!['settlements','movements'].includes(kind))throw Error('Invalid transaction view');
  const scope=[],params=[];
  if(room!=='all'){scope.push('room=?');params.push(room);}
  if(playerId){scope.push('player_id=?');params.push(playerId);}
  const base=scope.length?scope.join(' AND ')+' AND ':'';
  const where=base+"CAST(json_extract(receipt,'$.settledAt') AS INTEGER)>=? AND CAST(json_extract(receipt,'$.settledAt') AS INTEGER)<=?",args=[...params,start,end];
  const summary=db.prepare(`SELECT COUNT(*) AS settlements,COUNT(DISTINCT room||':'||round_id) AS rounds,COALESCE(SUM(CAST(ROUND(json_extract(receipt,'$.staked')*100) AS INTEGER)),0) AS stakesCents,COALESCE(SUM(CAST(ROUND(json_extract(receipt,'$.returned')*100) AS INTEGER)),0) AS payoutsCents FROM shared_settlements WHERE ${where}`).get(...args);
  summary.houseNetCents=summary.stakesCents-summary.payoutsCents;
  summary.holdPercent=summary.stakesCents?summary.houseNetCents/summary.stakesCents*100:null;
  let rows;
  if(kind==='settlements')rows=db.prepare(`SELECT rowid AS id,room,round_id,player_id,receipt FROM shared_settlements WHERE ${where} AND rowid<? ORDER BY rowid DESC LIMIT 101`).all(...args,cursor).map(row=>{
   const r=JSON.parse(row.receipt),p=db.prepare('SELECT name FROM shared_players WHERE room=? AND id=?').get(row.room,row.player_id);
   return {id:row.id,room:row.room,roundId:row.round_id,playerId:row.player_id,name:p?.name??row.player_id,at:r.settledAt,stakesCents:cents(r.staked),payoutsCents:cents(r.returned),houseNetCents:cents(r.staked)-cents(r.returned)};
  });
  else rows=db.prepare(`SELECT id,room,round_id AS roundId,player_id AS playerId,name,at,kind,amount_cents AS amountCents,before_cents AS beforeCents,after_cents AS afterCents FROM shared_transactions WHERE ${base}at>=? AND at<=? AND id<? ORDER BY id DESC LIMIT 101`).all(...args,cursor);
  const nextBefore=rows.length>100?rows[99].id:null;rows=rows.slice(0,100);
  let openStakesCents=0,uncommittedBetsCents=0;
  for(const row of db.prepare('SELECT id,state FROM shared_rooms').all()){
   if(room!=='all'&&row.id!==room)continue;const r=JSON.parse(row.state),own=box=>!playerId||r.owners[box]===playerId;
   if(r.phase==='round')for(const h of r.round.hands)if(own(h.box))openStakesCents+=cents(h.stake+h.pp+h.tp+(h.insured||0));
   if(r.phase==='bets')r.bets.forEach((b,i)=>{if(own(i))uncommittedBetsCents+=cents(b.main+b.pp+b.tp);});
  }
  const coverage=db.prepare(`SELECT MIN(at) AS movementsSince FROM shared_transactions${scope.length?' WHERE '+scope.join(' AND '):''}`).get(...params);
  return {demo:true,serverNow:now(),room,kind,summary,rows,nextBefore,coverage,openStakesCents,uncommittedBetsCents,players:db.prepare('SELECT id,name,room FROM shared_players'+(room==='all'?'':' WHERE room=?')+' ORDER BY name').all(...(room==='all'?[]:[room])),rooms:db.prepare('SELECT id FROM shared_rooms ORDER BY id').all().map(r=>r.id)};
 }
 return {record,read};
}
