import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createSharedTable} from '../server/shared-table.mjs';
const manifest={deal:[1,2,3,4,5,6,7,'dealer'].map(i=>({id:`deal_pos${i}`,url:`/${i}.mp4`,dur:.1})).concat(['hole','flip'].map(i=>({id:`deal_${i}`,url:`/${i}.mp4`,dur:.1}))),repliker:['goodluck','insurance','bust','win','lose','push','blackjack','dealerbust','dealerblackjack','double','sidebet'].map(event=>({id:event,event,url:`/${event}.mp4`,dur:.1}))};
function setup(){
 const dir=mkdtempSync(join(tmpdir(),'astrid-shared-')),file=join(dir,'table.sqlite');let time=100000,welcome=[];
 let s=createSharedTable(file,{manifest,now:()=>time,onWelcome:x=>welcome.push(x)});
 const state=(who='kevin',room='party')=>s.run(who,{session:room,op:'state'});
 const send=(who,op,extra={},room='party')=>s.run(who,{session:room,op,version:state(who,room).version,requestId:crypto.randomUUID(),...extra});
 const setShoe=ranks=>{const db=new DatabaseSync(file),r=JSON.parse(db.prepare('SELECT state FROM shared_rooms WHERE id=?').get('party').state);r.game.shoe.cards.splice(-ranks.length,ranks.length,...ranks.map((r,i)=>(typeof r==='object'?r:{r,s:['♠','♦','♥','♣'][i%4]})).reverse());db.prepare('UPDATE shared_rooms SET state=? WHERE id=?').run(JSON.stringify(r),'party');db.close();};
 const advance=ms=>{time+=ms;s.tick();};
 const finish=()=>{time=state().plan.endAt+1;s.tick();};
 return{state,send,setShoe,advance,finish,get service(){return s;},welcome,restart(){s.close();s=createSharedTable(file,{manifest,now:()=>time});},close(){s.close();rmSync(dir,{recursive:true,force:true});}};
}
test('joining claims multiple boxes atomically, enforces names and isolates sessions',async()=>{
 const t=setup();try{
 const k=t.send('kevin','join',{name:'Kevin',seats:[2,3]});assert.deepEqual(k.me.seats,[2,3]);
 assert.throws(()=>t.send('john','join',{name:'John',seats:[3,4]}),/just taken/);assert.equal(t.state('john').me,null);
 const j=t.send('john','join',{name:'John',seats:[4]});assert.equal(j.players.length,2);assert.equal(k.me.balance,1000);
 assert.deepEqual(t.state().players.map(p=>p.name),['Kevin','John']);
 assert.throws(()=>t.send('other','join',{name:'Kevin',seats:[5]}),/already/);
 assert.throws(()=>t.send('other','join',{name:'<img>',seats:[5]}),/name/);
 assert.throws(()=>t.send('other','join',{name:'Other',seats:[5,5]}),/boxes/);
 assert.equal(t.state('kevin','different').players.length,0);
 await Promise.resolve();assert.deepEqual(t.welcome.map(x=>x.text),['Hi Kevin, how are you today?','Hi John, how are you today?']);
 t.send('kevin','join',{name:'Kevin',seats:[2,3]});await Promise.resolve();assert.equal(t.welcome.length,2);
 }finally{t.close();}
});
test('players share bets, one deadline and one shoe, but can only spend on their own boxes',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[2,3]});t.send('john','join',{name:'John',seats:[4]});
 const one=t.send('kevin','bet',{seat:3,field:'main',chip:5});
 const two=t.service.run('john',{session:'party',op:'bet',version:one.version-1,requestId:'concurrent-bet',seat:4,field:'main',chip:25});assert.equal(one.deadline,two.deadline);
 assert.deepEqual(t.state().bets,t.state('john').bets);assert.deepEqual(t.state().shoe,t.state('john').shoe);
 assert.throws(()=>t.send('john','bet',{seat:3,field:'main',chip:500}),/your boxes/);
 assert.throws(()=>t.send('kevin','bet',{seat:2,field:'pp',chip:5}),/Place your bets please/);
 const request={session:'party',op:'refill',version:two.version,requestId:'same'};
 assert.equal(t.service.run('kevin',request).me.balance,2000);assert.equal(t.service.run('kevin',request).me.balance,2000);assert.equal(t.state('john').me.balance,1000);
 t.send('john','ready');assert.equal(t.state().phase,'bets');
 t.send('kevin','ready');assert.equal(t.state().phase,'round');assert.equal(t.state().me.balance,1995);assert.equal(t.state('john').me.balance,975);
 assert.deepEqual(t.state().plan,t.state('john').plan);assert.equal(t.state().plan.steps.filter(s=>s.kind==='deal').length,6);
 assert.throws(()=>t.send('kevin','act',{action:'hit'}),/Wait/);
 }finally{t.close();}
});
test('turn ownership, split draws and payouts survive restart for both players',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.send('john','join',{name:'John',seats:[4]});
 t.setShoe(['10','8','6','8','8','10','3','2','10','5','10']);
 t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('john','bet',{seat:4,field:'main',chip:25});t.send('kevin','ready');t.send('john','ready');t.finish();
 let v=t.state();const first=v.round.hands[v.round.active].box,who=first===3?'kevin':'john',other=who==='john'?'kevin':'john';
 assert.throws(()=>t.send(other,'act',{action:'stand'}),/another player/);
 if(who==='john'){t.send('john','act',{action:'stand'});t.finish();}
 let split=t.send('kevin','act',{action:'split'});assert.equal(split.round.hands.filter(h=>h.box===3).length,2);assert.equal(split.me.balance,990);t.finish();t.restart();
 for(let i=0;i<6&&t.state().phase==='round';i++){
   v=t.state();if(v.round.phase==='settled'){t.finish();break;}
   const owner=v.round.hands[v.round.active].box===3?'kevin':'john';t.send(owner,'act',{action:'stand'});t.finish();
 }
 v=t.state();assert.equal(v.phase,'settled');assert.equal(v.round.hands.length,3);const before=v.me.balance;
 t.advance(5000);assert.equal(t.state().me.balance,before);assert.deepEqual(t.state().round,t.state('john').round);
 const kReturn=v.round.hands.filter(h=>h.box===3).reduce((n,h)=>n+h.result+h.sideReturn,0);
 const jReturn=v.round.hands.filter(h=>h.box===4).reduce((n,h)=>n+h.result+h.sideReturn,0);
 assert.equal(t.service.backoffice({view:'transactions',room:'party',kind:'movements'}).rows.find(r=>r.kind==='split').amountCents,-500);
 assert.equal(v.me.balance,990+kReturn);assert.equal(t.state('john').me.balance,975+jReturn);
 assert.equal(JSON.stringify(v).includes('holeCard'),false);assert.equal(JSON.stringify(v).includes('"token"'),false);
 }finally{t.close();}
});
test('insurance is decided and charged separately for each player',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.send('john','join',{name:'John',seats:[4]});t.setShoe(['8','9','A','8','8','K']);
 t.send('kevin','bet',{seat:3,field:'main',chip:10});t.send('john','bet',{seat:4,field:'main',chip:10});t.send('kevin','ready');t.send('john','ready');t.finish();
 assert.equal(t.state().insuranceDue,true);t.send('kevin','insurance',{take:true});assert.equal(t.state().insuranceDue,false);assert.equal(t.state('john').insuranceDue,true);
 t.send('john','insurance',{take:false});assert.equal(t.state().me.balance,985);assert.equal(t.state('john').me.balance,990);t.finish();
 assert.equal(t.state().me.balance,1000);assert.equal(t.state('john').me.balance,990);
 const ledger=t.service.backoffice({view:'transactions',room:'party',kind:'movements'});assert.equal(ledger.rows.filter(r=>r.kind==='insurance').length,1);assert.equal(ledger.rows.find(r=>r.kind==='insurance').amountCents,-500);assert.equal(ledger.summary.houseNetCents,1000);
 }finally{t.close();}
});
test('server starts after 20 seconds and recovers abandoned turns without double dealing',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.setShoe(['8','6','9','10','5']);t.send('kevin','bet',{seat:3,field:'main',chip:5});t.advance(20000);
 assert.equal(t.state().phase,'round');const plan=t.state().plan.id;t.finish();assert.equal(t.state().plan.id,plan);
 t.advance(90001);t.finish();assert.equal(t.state().phase,'settled');
 t.send('kevin','next');t.advance(120001);assert.equal(t.state('john').players.length,0);
 }finally{t.close();}
});


test('reported scenario: losing hand plus $1,000 blackjack returns exactly $2,500, never table-wide winnings',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[2,3]});t.send('john','join',{name:'John',seats:[4]});
 t.send('kevin','refill');t.send('kevin','refill');t.send('kevin','refill');
 // John 20, Kevin natural at box 3, Kevin 16 at box 2, dealer 18. No sides hit.
 t.setShoe(['K','A','9','10','Q','K','7','8']);
 for(const seat of [2,3]){t.send('kevin','bet',{seat,field:'main',chip:500});t.send('kevin','bet',{seat,field:'main',chip:500});for(const field of ['pp','tp'])t.send('kevin','bet',{seat,field,chip:50});}
 t.send('john','bet',{seat:4,field:'main',chip:500});t.send('kevin','ready');t.send('john','ready');t.finish();
 t.send('john','act',{action:'stand'});t.finish();t.send('kevin','act',{action:'stand'});t.finish();
 const v=t.state();assert.equal(v.me.lastReturn,2500);assert.equal(v.me.balance,4300);
 assert.equal(v.me.lastSettlement.staked,2200);assert.equal(v.me.lastSettlement.net,300);
 assert.equal(t.state('john').me.lastReturn,1000);
 t.restart();assert.equal(t.state().me.lastSettlement.returned,2500);
 t.send('kevin','next');assert.equal(t.state().me.lastSettlement.returned,2500);
 }finally{t.close();}
});
test('winning side bets are announced, paid once through split, and recorded separately',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});
 t.setShoe([{r:'8',s:'♠'},{r:'8',s:'♠'},{r:'8',s:'♠'},{r:'10',s:'♥'},{r:'10',s:'♦'},{r:'10',s:'♣'}]);
 for(const field of ['main','pp','tp'])t.send('kevin','bet',{seat:3,field,chip:5});
 let v=t.send('kevin','ready');assert.ok(v.plan.steps.some(s=>s.clip?.id==='sidebet'));
 assert.equal(v.round.hands[0].sideReturn,635);t.finish();t.send('kevin','act',{action:'split'});t.finish();
 t.send('kevin','act',{action:'stand'});t.finish();t.send('kevin','act',{action:'stand'});t.finish();
 v=t.state();assert.equal(v.me.lastReturn,645);assert.equal(v.me.balance,1625);
 assert.equal(v.me.lastSettlement.hands.reduce((n,h)=>n+h.sideReturn,0),635);
 t.restart();t.advance(100000);assert.equal(t.state().me.balance,1625);
 }finally{t.close();}
});
test('double debits exactly one additional stake and a busted hand cannot win against dealer bust',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[2,3]});
 t.setShoe(['10','5','6','6','6','10','K','10','K']);
 t.send('kevin','bet',{seat:2,field:'main',chip:100});t.send('kevin','bet',{seat:3,field:'main',chip:100});t.send('kevin','ready');t.finish();
 t.send('kevin','act',{action:'hit'});t.finish();
 const v=t.send('kevin','act',{action:'double'});assert.equal(v.me.balance,700);t.finish();
 assert.equal(t.state().me.lastReturn,400);assert.equal(t.state().me.balance,1100);
 assert.equal(t.state().me.lastSettlement.staked,300);
 const ledger=t.service.backoffice({view:'transactions',room:'party',kind:'movements'});assert.equal(ledger.rows.find(r=>r.kind==='double').amountCents,-10000);assert.equal(ledger.summary.houseNetCents,-10000);
 }finally{t.close();}
});
test('15 second server decision deadline survives restart and stands only at expiry',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.setShoe(['8','6','9','10','5']);t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');t.finish();
 const v=t.state();assert.equal(v.actionMs,15000);assert.equal(v.actionDeadline-v.plan.endAt,15000);
 t.advance(14998);t.restart();assert.equal(t.state().round.phase,'decisions');
 t.advance(2);t.finish();assert.equal(t.state().phase,'settled');
 }finally{t.close();}
});

test('a seated nonparticipant retains the return of their own last completed round',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.send('john','join',{name:'John',seats:[4]});
 t.setShoe(['A','10','K','8']);t.send('kevin','bet',{seat:3,field:'main',chip:10});t.advance(20000);t.finish();
 assert.equal(t.state().me.lastReturn,25);
 t.send('kevin','next');t.setShoe(['A','10','K','8']);t.send('john','bet',{seat:4,field:'main',chip:5});t.advance(20000);t.finish();
 assert.equal(t.state().me.lastReturn,25);assert.equal(t.state().me.lastSettlement.returned,25);assert.equal(t.state('john').me.lastReturn,12.5);
 }finally{t.close();}
});

test('24-hour break blocks betting and refills across tables, survives restart and cannot be undone',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.send('kevin','bet',{seat:3,field:'main',chip:5});
 t.send('kevin','join',{name:'Kevin',seats:[3]},'other');t.send('kevin','bet',{seat:3,field:'main',chip:5},'other');
 const v=t.send('kevin','pause');assert.ok(v.pausedUntil>v.serverNow);assert.equal(v.bets[3].main,0);assert.equal(t.state('kevin','other').bets[3].main,0);
 t.restart();assert.equal(t.state().pausedUntil,v.pausedUntil);
 for(const op of ['refill','ready','undo','doubleBets','allSeats'])assert.throws(()=>t.send('kevin',op),/break/);
 assert.throws(()=>t.send('kevin','bet',{seat:3,field:'main',chip:5},'other'),/break/);
 assert.throws(()=>t.send('kevin','join',{name:'Kevin',seats:[2]},'new'),/break/);
 t.advance(86400001);t.send('kevin','join',{name:'Kevin',seats:[3]});assert.equal(t.send('kevin','bet',{seat:3,field:'main',chip:5}).bets[3].main,5);
 }finally{t.close();}
});
test('break during active hand blocks extra risk but permits stand and existing settlement',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.setShoe(['8','6','9','10','5']);t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');t.finish();
 t.send('kevin','pause');assert.throws(()=>t.send('kevin','act',{action:'hit'}),/break/);t.send('kevin','act',{action:'stand'});t.finish();assert.equal(t.state().phase,'settled');assert.ok(t.state().me.lastSettlement);
 }finally{t.close();}
});

test('leaving between rounds releases only own seats and clears pending bets',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[2,3]});t.send('john','join',{name:'John',seats:[4]});t.send('kevin','bet',{seat:3,field:'main',chip:5});
 const v=t.send('kevin','leave');assert.deepEqual(v.me.seats,[]);assert.equal(v.me.balance,1000);assert.equal(v.bets[3].main,0);assert.equal(v.deadline,null);assert.ok(v.owners[4]);
 assert.deepEqual(t.send('other','join',{name:'Other',seats:[2,3]}).me.seats,[2,3]);
 }finally{t.close();}
});
test('leave during dealing survives restart, auto-stands and pays exactly once before freeing seats',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.setShoe(['10','8','7','10']);t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');
 assert.equal(t.send('kevin','leave').me.leaving,true);t.restart();assert.equal(t.state().me.leaving,true);assert.throws(()=>t.send('other','join',{name:'Other',seats:[3]}),/just taken/);
 for(let i=0;i<8&&t.state().phase==='round';i++)t.finish();
 const v=t.state();assert.equal(v.phase,'bets');assert.deepEqual(v.me.seats,[]);assert.equal(v.me.balance,995);assert.equal(v.me.lastSettlement.staked,5);assert.equal(v.me.lastSettlement.returned,0);assert.equal(t.state().me.balance,995);
 assert.deepEqual(t.send('other','join',{name:'Other',seats:[3]}).me.seats,[3]);
 }finally{t.close();}
});
test('leaving declines insurance automatically without adding risk',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.setShoe(['10','A','7','6']);t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');t.send('kevin','leave');
 for(let i=0;i<8&&t.state().phase==='round';i++)t.finish();
 assert.deepEqual(t.state().me.seats,[]);assert.equal(t.state().me.lastSettlement.staked,5);assert.equal(t.state().me.lastSettlement.hands[0].insured,0);
 }finally{t.close();}
});
test('disconnected owners cannot strand a settled table',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.setShoe(['10','8','7','10']);t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');t.finish();t.send('kevin','act',{action:'stand'});t.finish();assert.equal(t.state().phase,'settled');
 t.advance(120001);const v=t.state('other');assert.equal(v.phase,'bets');assert.ok(v.owners.every(x=>x===null));assert.equal(t.state().me.balance,995);
 t.send('other','join',{name:'Other',seats:[3]});
 }finally{t.close();}
});

test('one player leaving an active shared hand does not release or play another owner hand',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.send('john','join',{name:'John',seats:[4]});t.setShoe(['10','10','8','7','7','10']);
 for(const [who,seat] of [['kevin',3],['john',4]])t.send(who,'bet',{seat,field:'main',chip:5});t.send('kevin','ready');t.send('john','ready');t.send('kevin','leave');t.finish();
 const v=t.state('john');assert.equal(v.owners[v.round.hands[v.round.active].box],v.me.id);assert.deepEqual(v.me.seats,[4]);assert.equal(v.me.leaving,false);t.send('john','act',{action:'stand'});
 for(let i=0;i<8&&t.state().phase==='round';i++)t.finish();
 assert.deepEqual(t.state().me.seats,[]);assert.deepEqual(t.state('john').me.seats,[4]);assert.equal(t.state('john').phase,'settled');assert.equal(t.state('john').me.balance,995);assert.equal(t.state().me.balance,995);
 }finally{t.close();}
});
test('transactions follow real balance changes once, survive restart, and exclude demo credits from house results',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[0]});
 const refill={session:'party',op:'refill',requestId:'ledger-refill'};t.service.run('kevin',refill);t.service.run('kevin',refill);
 t.setShoe(['10','9','10','7','10']);
 t.send('kevin','bet',{seat:0,field:'main',chip:10});t.send('kevin','bet',{seat:0,field:'pp',chip:5});t.send('kevin','bet',{seat:0,field:'tp',chip:5});
 const report=kind=>t.service.backoffice({view:'transactions',room:'party',kind});
 assert.equal(report('movements').rows.length,2);assert.equal(report('settlements').uncommittedBetsCents,2000);
 t.send('kevin','ready');assert.equal(report('settlements').openStakesCents,2000);assert.equal(report('settlements').summary.settlements,0);t.finish();
 for(let i=0;i<8&&t.state().phase==='round';i++){const s=t.state();if(s.round.phase==='decisions')t.send('kevin','act',{action:'stand'});else if(s.round.phase==='insurance')t.send('kevin','insurance',{take:false});t.finish();}
 assert.equal(t.state().phase,'settled');const before=report('movements');assert.deepEqual(before.rows.map(r=>r.kind),['payout','stake','demo_refill','opening_credit']);
 for(let i=0;i<before.rows.length-1;i++)assert.equal(before.rows[i].beforeCents,before.rows[i+1].afterCents);
 const receipt=t.state().me.lastSettlement;assert.equal(report('settlements').summary.houseNetCents,Math.round((receipt.staked-receipt.returned)*100));assert.equal(report('settlements').openStakesCents,0);
 t.restart();assert.equal(report('movements').rows.length,4);t.service.tick();assert.equal(report('movements').rows.length,4);
 }finally{t.close();}
});
test('OpenClaw context is read-only and speech decisions link to the existing audit chain',()=>{
 const t=setup();try{
  t.send('kevin','join',{name:'Kevin',seats:[0]});
  const before=t.state(),context=t.service.presentationContext('party');
  assert.equal(context.sessionRevision,String(before.version));
  assert.ok(!JSON.stringify(context).includes('Kevin'));assert.ok(!Object.hasOwn(context,'cards'));
  t.service.recordSpeechDecision({...context,decision:'openclaw',responseId:'greeting',requestId:'speech-1',text:'PRIVATE'});
  const after=t.state();assert.equal(after.version,before.version);assert.equal(after.me.balance,before.me.balance);
  const audit=t.service.backoffice({room:'party'});const event=audit.activity.find(e=>e.type==='presentation.speech_choice');
  assert.equal(event.parent,context.parent);assert.equal(event.payload.responseId,'greeting');assert.ok(!JSON.stringify(event).includes('PRIVATE'));
 }finally{t.close();}
});
test('opening hole and filmed reveal keep the same shoe draw and store canonical event IDs',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.setShoe(['8','K','9','A']);t.send('kevin','bet',{seat:3,field:'main',chip:5});const r=t.send('kevin','ready');
 const hole=r.plan.steps.find(s=>s.clip?.id==='deal_hole'),flip=r.plan.steps.find(s=>s.clip?.id==='deal_flip');
 assert.equal(hole.track,'hole');assert.equal(flip.track,'flip');assert.equal(hole.shoeDraw,flip.shoeDraw);assert.ok(flip.startAt>=hole.endAt);
 assert.equal(hole.catalogEventId,'deal.dealer');assert.equal(flip.catalogEventId,'reveal.dealer');assert.equal(flip.clip.sound,false);
 t.finish();assert.equal(t.state().phase,'settled');
 }finally{t.close();}
});

test('read-only dealer game context is tied to the guest and hides future cards and the hole card',()=>{
 const t=setup();try{
  t.send('kevin','join',{name:'Kevin',seats:[3]});
  t.send('john','join',{name:'John',seats:[4]});
  t.setShoe(['5','6','7','8','9','2','3','4']);
  t.send('kevin','bet',{seat:3,field:'main',chip:5});
  t.send('john','bet',{seat:4,field:'main',chip:5});
  t.send('kevin','ready');
  const opening=t.send('john','ready');
  const whileDealing=t.service.readGameState('party','kevin');
  assert.equal(whileDealing.phase,'dealing');
  assert.deepEqual(whileDealing.hands,[]);
  assert.deepEqual(whileDealing.dealerCards,[]);
  t.finish();
  const before=t.state(),kevin=t.service.readGameState('party','kevin'),john=t.service.readGameState('party','john');
  const nameMatched=t.service.readGameState('party',null,'kevin');
  assert.equal(kevin.phase,'decisions');
  assert.deepEqual(kevin.boxes,[4]);
  assert.equal(kevin.hands.length,1);assert.equal(kevin.hands[0].cards.length,2);
  assert.ok(kevin.hands[0].total>=2&&kevin.hands[0].total<=21);
  assert.deepEqual(john.boxes,[3]);assert.equal(john.hands[0].box,3);   // seat index 4 is box 3 counted from first base
  assert.deepEqual(nameMatched.hands,kevin.hands);
  assert.ok(kevin.dealerCards.length<=1);assert.equal(kevin.dealerTotal,null);
  assert.equal(Object.hasOwn(kevin,'balance'),false);assert.equal(Object.hasOwn(kevin,'token'),false);
  assert.equal(JSON.stringify(kevin).includes('John'),false);
  assert.equal(t.state().version,before.version);
  assert.equal(opening.round.hands.length,2);
 }finally{t.close();}
});
test('Repeat bet puts the previous round\'s stakes back on the player\'s own boxes (CH feedback)',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[2,3]});t.send('john','join',{name:'John',seats:[4]});
 assert.throws(()=>t.send('kevin','repeat'),/No previous bet/);assert.equal(t.state().me.repeatable,false);
 t.setShoe(['10','10','10','9','9','9','8','8']);
 t.send('kevin','bet',{seat:2,field:'main',chip:25});t.send('kevin','bet',{seat:3,field:'main',chip:10});t.send('kevin','bet',{seat:3,field:'pp',chip:5});
 t.send('john','bet',{seat:4,field:'main',chip:50});t.send('kevin','ready');t.send('john','ready');t.finish();
 for(let k=0;k<8&&t.state().phase!=='settled';k++){t.advance(60001);t.finish();}
 assert.equal(t.state().phase,'settled');t.send('kevin','next');assert.equal(t.state().phase,'bets');
 assert.equal(t.state().me.repeatable,true);
 const v=t.send('kevin','repeat');
 assert.deepEqual(v.bets[2],{main:25,pp:0,tp:0});assert.deepEqual(v.bets[3],{main:10,pp:5,tp:0});
 assert.equal(v.bets[4].main,0,'never touches another player\'s box');
 t.send('kevin','undo');assert.equal(t.state().bets[2].main,0,'undo takes the repeat back');
 }finally{t.close();}
});
test('a returning player with no boxes can sit down while another hand is played (CH report)',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.send('john','join',{name:'John',seats:[4]});
 t.send('john','leave');assert.deepEqual(t.state('john').me.seats,[]);
 t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');assert.equal(t.state().phase,'round');
 const v=t.send('john','join',{name:'John',seats:[4]});assert.deepEqual(v.me.seats,[4]);
 }finally{t.close();}
});
test('a seated player changing boxes mid-round gets the free ones now; boxes still in play are released after the round (feedback #7)',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3,4]});
 t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');assert.equal(t.state().phase,'round');
 const v=t.send('kevin','join',{name:'Kevin',seats:[4,5]});
 assert.deepEqual([...v.me.seats].sort(),[3,4,5],'box 3 holds a live hand, so it stays until the round ends');
 assert.deepEqual(v.me.boxesAfterRound,[4,5]);
 for(let k=0;k<6&&t.state().phase!=='settled';k++){t.advance(60001);t.finish();}
 t.send('kevin','next');
 assert.deepEqual([...t.state().me.seats].sort(),[4,5]);assert.equal(t.state().owners[3],null);assert.deepEqual(t.state().me.boxesAfterRound,null);
 }finally{t.close();}
});
test('a player with two boxes can bet on one and drop the other, between rounds or mid-round (Serhiy)',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3,4]});
 t.send('kevin','bet',{seat:3,field:'main',chip:5});t.send('kevin','ready');
 assert.equal(t.state().phase,'round');assert.deepEqual(t.state().round.hands.map(h=>h.box),[3],'the unbet box is simply not dealt');
 const v=t.send('kevin','join',{name:'Kevin',seats:[3]});
 assert.equal(v.owners[4],null,'the empty box is released at once');assert.deepEqual(v.me.seats,[3]);
 }finally{t.close();}
});
test('a seated player opens a free box by betting on it, like putting chips in a box at the table (CH)',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3]});t.send('john','join',{name:'John',seats:[5]});
 const v=t.send('kevin','bet',{seat:2,field:'main',chip:25});
 assert.deepEqual([...v.me.seats].sort(),[2,3]);assert.equal(v.bets[2].main,25);
 assert.throws(()=>t.send('kevin','bet',{seat:5,field:'main',chip:5}),/your boxes/,'a box another player holds stays theirs');
 assert.throws(()=>t.send('kevin','bet',{seat:6,field:'pp',chip:5}),/your boxes|Place your bets/,'a side bet alone does not open a box');
 assert.equal(t.state().owners[6],null);
 assert.throws(()=>t.send('guest','bet',{seat:1,field:'main',chip:5}),/your boxes|Join/,'someone not seated cannot open a box this way');
 }finally{t.close();}
});

test('a seated player renames by joining with the boxes they hold: bets, balance, a live hand and a pending box change stay (Emil #9)',()=>{
 const t=setup();try{
 t.send('kevin','join',{name:'Kevin',seats:[3,4]});t.send('john','join',{name:'John',seats:[6]});
 t.send('kevin','bet',{seat:3,field:'main',chip:5});
 let v=t.send('kevin','join',{name:'Kev',seats:[3,4]});
 assert.equal(v.me.name,'Kev');assert.deepEqual(v.me.seats,[3,4]);assert.equal(v.bets[3].main,5);assert.equal(v.me.balance,1000);
 assert.deepEqual(t.state('john').players.map(p=>p.name).sort(),['John','Kev']);
 assert.throws(()=>t.send('kevin','join',{name:'john',seats:[3,4]}),/already/);
 assert.throws(()=>t.send('kevin','join',{name:'<b>',seats:[3,4]}),/name/);
 t.send('john','leave');t.send('kevin','ready');assert.equal(t.state().phase,'round');
 v=t.send('kevin','join',{name:'Kev',seats:[4,5]});assert.deepEqual(v.me.boxesAfterRound,[4,5]);
 const hands=JSON.stringify(v.round.hands);
 v=t.send('kevin','join',{name:'Kevin',seats:v.me.boxesAfterRound});
 assert.equal(v.me.name,'Kevin');assert.deepEqual(v.me.boxesAfterRound,[4,5],'a pending box change survives a rename');assert.equal(JSON.stringify(v.round.hands),hands);assert.equal(v.me.balance,995);
 }finally{t.close();}
});
