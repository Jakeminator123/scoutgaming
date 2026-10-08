import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createSharedTable} from '../server/shared-table.mjs';
import {verifyShoe,replayShuffle} from '../vendor/croupier/shoe-proof.mjs';
import {auditAuthorized} from '../server/audit-access.mjs';
import {classifyManifest,mediaInventory} from '../server/media-registry.mjs';
const source=JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url)));
const manifest=classifyManifest(source).manifest;
for(const clips of [manifest.deal,manifest.repliker])for(const c of clips)c.dur=.1;
function setup(){
 const dir=mkdtempSync(join(tmpdir(),'astrid-audit-')),file=join(dir,'table.sqlite');let time=100000;
 let service=createSharedTable(file,{manifest,now:()=>time});
 const state=()=>service.run('audit-player',{session:'audit',op:'state'});
 const send=(op,extra={})=>service.run('audit-player',{session:'audit',op,version:state().version,requestId:crypto.randomUUID(),...extra});
 const finish=()=>{const v=state();time=Math.max(time+1,(v.plan?.endAt??time)+1);service.tick();};
 const round=()=>{
   let v=state();if(v.phase==='settled')send('next');
   if(state().me.balance<200)send('refill');
   for(let seat=0;seat<7;seat++)send('bet',{seat,field:'main',chip:5});
   send('ready');finish();
   for(let i=0;i<20&&state().phase==='round';i++){
     v=state();if(v.round.phase==='insurance')send('insurance',{take:false});
     else if(v.round.phase==='decisions')send('act',{action:'stand'});
     finish();
   }
   assert.equal(state().phase,'settled');
 };
 send('join',{name:'Audit QA',seats:[0,1,2,3,4,5,6]});
 return{file,state,send,finish,round,get service(){return service;},restart(){service.close();service=createSharedTable(file,{manifest,now:()=>time});},close(){service.close();rmSync(dir,{recursive:true,force:true});}};
}
test('real shared engine closes shoe, replays RNG and accounts for burn, draws, action log and unused cards',()=>{
 const t=setup();try{
  const id=t.state().shoe.id,commitment=t.state().shoe.commitment;
  assert.equal(commitment.length,64);t.round();t.restart();
  for(let i=0;i<40&&t.state().shoe.id===id;i++)t.round();
  assert.notEqual(t.state().shoe.id,id);
  const result=t.service.backoffice({room:'audit',shoeId:id});
  assert.equal(result.verification.status,'verified',JSON.stringify(result.verification));
  assert.equal(result.proof.commitment,commitment);assert.equal(result.proof.draws[0].kind,'burn');
  assert.equal(result.proof.draws.length+result.proof.remaining.length,416);
  assert.ok(result.proof.draws.length>=312);assert.ok(result.proof.remaining.length>0);
  assert.equal(result.proof.commandDraws.length,result.proof.draws.length-1);
  assert.equal(new Set(replayShuffle(result.proof.samples).map(c=>c.serial)).size,416);
  const wrong=structuredClone(result.proof);wrong.draws[5].card.r='invalid';assert.equal(verifyShoe(wrong,commitment).status,'failed');
  const missing=structuredClone(result.proof);missing.commandDraws.pop();assert.equal(verifyShoe(missing,commitment).status,'failed');
  const rng=structuredClone(result.proof);rng.samples[0]^=12345;assert.equal(verifyShoe(rng,commitment).status,'failed');
  const rest=structuredClone(result.proof);rest.remaining.pop();assert.equal(verifyShoe(rest,commitment).status,'failed');
  const duplicate=structuredClone(result.proof);duplicate.draws[3].card.serial=duplicate.draws[2].card.serial;assert.equal(verifyShoe(duplicate,commitment).status,'failed');
  const numbered=structuredClone(result.proof);numbered.draws[2].position=2;assert.equal(verifyShoe(numbered,commitment).status,'failed');
 }finally{t.close();}
});
test('live APIs redact shuffle samples, remaining order and hole card; retries and rejected actions do not add audit rows',()=>{
 const t=setup();try{
  const request={session:'audit',op:'bet',seat:0,field:'main',chip:5,requestId:'once'};
  t.service.run('audit-player',request);const db=new DatabaseSync(t.file);
  const count=()=>db.prepare('SELECT count(*) n FROM audit_events').get().n;
  const before=count();t.service.run('audit-player',request);assert.equal(count(),before);
  assert.throws(()=>t.send('act',{action:'split'}));assert.equal(count(),before);
  t.send('ready');const view=t.state(),data=t.service.backoffice({room:'audit'});
  assert.throws(()=>t.service.backoffice({room:'audit',shoeId:view.shoe.id}),/private/);
  assert.ok(data.events.find(e=>e.type==='presentation.plan'));
  for(const e of data.events.filter(e=>e.payload.draws))assert.ok(e.payload.draws.every(d=>typeof d.card==='string'));
  for(const forbidden of ['samples','nonce','holeCard','commandDraws']){assert.equal(JSON.stringify(view).includes('"'+forbidden+'"'),false);assert.equal(JSON.stringify(data).includes('"'+forbidden+'"'),false);}
  assert.throws(()=>db.prepare('DELETE FROM audit_events').run(),/append-only/);
  assert.throws(()=>db.prepare("UPDATE audit_shoes SET commitment='tamper'").run(),/immutable/);
  db.close();
 }finally{t.close();}
});
test('legacy shoe is marked incomplete, never given invented shuffle proof',()=>{
 const t=setup();try{
  const db=new DatabaseSync(t.file);const r=JSON.parse(db.prepare('SELECT state FROM shared_rooms WHERE id=?').get('audit').state);
  const old=r.game.shoe.id;delete r.game.shoe.proof;r.game.shoe.cutReached=true;
  db.prepare('DELETE FROM audit_shoes').run();db.prepare('UPDATE shared_rooms SET state=? WHERE id=?').run(JSON.stringify(r),'audit');db.close();
  t.round();const oldProof=t.service.backoffice({room:'audit',shoeId:old});assert.equal(oldProof.verification.status,'incomplete');assert.equal(oldProof.proof.legacy,true);
 }finally{t.close();}
});
test('audit bridge fails closed and only accepts a loopback service with its secret, never browser credentials',()=>{
 const req={headers:{authorization:'Bearer internal-service'},socket:{remoteAddress:'127.0.0.1'}};
 assert.equal(auditAuthorized(req,''),false);
 assert.equal(auditAuthorized(req,'internal-service'),true);
 assert.equal(auditAuthorized({...req,headers:{authorization:'Basic aigaming:demo'}},'internal-service'),false);
 assert.equal(auditAuthorized({...req,headers:{...req.headers,origin:'https://croupier.scoutgg.dev'}},'internal-service'),false);
 assert.equal(auditAuthorized({...req,socket:{remoteAddress:'203.0.113.3'}},'internal-service'),false);
});
test('media registry preserves legacy takes but removes them from all runtime variant picks',()=>{
 const {registry,manifest}=classifyManifest(source);
 assert.ok(registry.some(c=>c.category==='legacy_training'));
 assert.equal(manifest.repliker.length,11);assert.ok(manifest.repliker.find(c=>c.id==='sidebet_2'));assert.ok(!manifest.repliker.find(c=>c.id==='sidebet_1'));
 for(const entry of Object.values(manifest.handelser))for(const id of entry.varianter)assert.ok(manifest.repliker.find(c=>c.id===id));
 const inventory=mediaInventory(new URL('../public',import.meta.url).pathname,registry);assert.ok(inventory.length>=66);assert.equal(inventory.filter(c=>c.category==='gameplay').length,27+33);
 assert.equal(registry.filter(c=>c.category==='legacy_training').length,40*4);
 assert.equal(new Set(registry.map(c=>c.id)).size,registry.length);
 for(const bank of Object.values(manifest.repliker_sprak)){assert.equal(bank.length,11);assert.ok(bank.some(c=>c.id==='sidebet_2'));assert.ok(!bank.some(c=>c.id==='sidebet_1'));}
 assert.ok(inventory.filter(c=>!registry.some(r=>r.url===c.url)&&c.id!=='ambience').every(c=>c.category==='legacy_training'));
 assert.ok(inventory.every(c=>c.available));
});

test('operations reports real seats and stakes without exposing cards or mutating gameplay',()=>{
 const t=setup();try{
  const db=new DatabaseSync(t.file);
  const state=()=>db.prepare('SELECT state FROM shared_rooms WHERE id=?').get('audit').state;
  const previous=state(),head=db.prepare('SELECT MAX(seq) n FROM audit_events').get().n;
  let data=t.service.backoffice({view:'operations'}),table=data.tables[0];
  assert.equal(data.view,'operations');assert.equal(data.summary.activeTables,1);
  assert.equal(data.summary.playersAtTables,1);assert.equal(table.occupiedSeats,7);
  assert.deepEqual(table.players[0].seats,[1,2,3,4,5,6,7]);assert.equal(table.phase,'bets');
  assert.equal(table.roundId,null);assert.equal(table.openStakesCents,0);
  assert.equal(state(),previous);assert.equal(db.prepare('SELECT MAX(seq) n FROM audit_events').get().n,head);
  t.send('bet',{seat:0,field:'main',chip:5});t.send('bet',{seat:0,field:'pp',chip:5});
  table=t.service.backoffice({view:'operations'}).tables[0];
  assert.equal(table.preparedBetsCents,1000);assert.equal(table.openStakesCents,0);
  t.send('ready');data=t.service.backoffice({view:'operations'});table=data.tables[0];
  assert.equal(table.phase,'dealing');assert.equal(table.openStakesCents,1000);assert.equal(table.preparedBetsCents,0);
  assert.equal(table.roundId,t.state().roundId);assert.equal(table.shoe.dealt+table.shoe.remaining,416);
  for(const forbidden of ['token','balance','cards','proof','samples','nonce','plan','hands','history','insurance'])assert.equal(JSON.stringify(data).includes('"'+forbidden+'":'),false,forbidden);
  db.close();
 }finally{t.close();}
});

test('John workspace reports only recorded settlements, hides active cards and is a pure read',()=>{
 const t=setup();try{
  const db=new DatabaseSync(t.file),before=()=>JSON.stringify({rooms:db.prepare('SELECT * FROM shared_rooms').all(),players:db.prepare('SELECT * FROM shared_players').all(),events:db.prepare('SELECT count(*) n FROM audit_events').get()});
  t.round();const receipt=t.state().me.lastSettlement;sameRead();
  t.send('next');t.send('bet',{seat:0,field:'main',chip:5});t.send('ready');sameRead();
  function sameRead(){const snapshot=before(),w=t.service.backoffice({view:'workspace'}),encoded=JSON.stringify(w);assert.equal(before(),snapshot);assert.equal(w.settlements.length,1);assert.equal(w.settlements[0].stakesCents,Math.round(receipt.staked*100));assert.equal(w.settlements[0].payoutsCents,Math.round(receipt.returned*100));assert.equal(w.settlements[0].hands.length,receipt.hands.length);assert.equal(w.manifest.deal.length,10);assert.equal(w.players[0].name,'Audit QA');for(const forbidden of ['token','samples','nonce','holeCard','commandDraws','proof','insuranceDue'])assert.equal(encoded.includes('"'+forbidden+'":'),false,forbidden);}
  db.close();
 }finally{t.close();}
});
