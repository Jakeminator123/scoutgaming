import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindAstridSequence,ledgerDigest} from './sequence-binding.mjs';
const corners=[[100,100],[120,100],[120,130],[100,130]];
async function fixture(){
 const deliveries=[{cardId:'fourth',seatId:'seat-0',targetId:'seat-0-first',faceDown:false,card:{r:'Q',s:'♥'}}];
 const targets=[{seatId:'seat-0',targetId:'seat-0-first',corners}];
 const ledger={schema:'astrid-staged-sequence-v1',dealer:'astrid',sourceSha256:'1'.repeat(64),fps:24,
 deliveries:[{cardId:'fourth',seatId:'seat-0',targetId:'seat-0-first',targetCorners:corners,pickup:1,release:110,land:112}],
 frames:Array.from({length:115},(_,frame)=>({frame,cards:frame>=1&&frame<112?[{cardId:'fourth',corners,faceUp:true}]:[]}))};
 ledger.review={status:'staged-reviewed',evidence:'synthetic unit-test only; not media approval',payloadSha256:await ledgerDigest(ledger)};
 return {deliveries,targets,ledger};
}
async function resign(f){f.ledger.review.payloadSha256=await ledgerDigest(f.ledger);return f;}
test('hidden input rank/suit and extras never escape; pose cannot turn hole face up',async()=>{
 const f=await fixture();f.deliveries[0].faceDown=true;f.deliveries[0].extra={rank:'SECRET'};
 const b=await bindAstridSequence(f);const at=b.present(109);assert.equal(at.moving[0].face,'back');assert.equal(at.moving[0].card,undefined);
 const output=JSON.stringify([at,b.present(112)]);assert(!output.includes('SECRET'));assert(!output.includes('"r"'));assert(!output.includes('♥'));assert(!output.includes('extra'));
});
test('synthetic fixture: contact109, release110, land112 emits once (not real source timing)',async()=>{
 const b=await bindAstridSequence(await fixture());assert.equal(b.present(109).moving[0].phase,'contact');assert.equal(b.present(110).moving[0].phase,'released');assert.equal(b.present(111).newLandings.length,0);
 const end=b.present(112);assert.equal(end.moving.length,0);assert.equal(end.newLandings.length,1);assert.equal(b.present(112).newLandings.length,0);assert.equal(b.present(114).landed.length,1);
 assert.throws(()=>b.present(109),/rewind/);
});
test('dropped presentation frames catch up land once without replaying fabricated movement',async()=>{
 const b=await bindAstridSequence(await fixture());const end=b.present(114);assert.equal(end.newLandings.length,1);assert.equal(end.moving.length,0);assert.equal(b.present(114).newLandings.length,0);
});
test('missing and duplicate issued IDs fail',async()=>{
 let f=await fixture();delete f.deliveries[0].cardId;await assert.rejects(bindAstridSequence(f),/identity/);
 f=await fixture();f.deliveries.push({...f.deliveries[0]});f.ledger.deliveries.push({...f.ledger.deliveries[0]});await resign(f);await assert.rejects(bindAstridSequence(f),/Duplicate delivery ID/);
 f=await fixture();f.deliveries[0].cardId='unmatched';await assert.rejects(bindAstridSequence(f),/missing from server/);
});
test('unsupported exact seat and shifted target reject; no nearest-direction fallback',async()=>{
 let f=await fixture();f.deliveries[0].seatId='seat-1';await assert.rejects(bindAstridSequence(f),/exact seat/);
 f=await fixture();f.targets[0].corners=structuredClone(corners);f.targets[0].corners[0][0]++;await assert.rejects(bindAstridSequence(f),/exact seat target/);
});
test('count mismatch and unissued ledger/frame records reject',async()=>{
 let f=await fixture();f.deliveries=[];await assert.rejects(bindAstridSequence(f),/count mismatch/);
 f=await fixture();f.ledger.frames[109].cards[0].cardId='fifth';await resign(f);await assert.rejects(bindAstridSequence(f),/Unissued/);
 f=await fixture();f.ledger.frames[109].cards=[];await resign(f);await assert.rejects(bindAstridSequence(f),/Missing moving/);
});
test('review digest binds timing; no premature land or source cutoff',async()=>{
 let f=await fixture();f.ledger.deliveries[0].land=109;await assert.rejects(bindAstridSequence(f),/changed after review/);
 f=await fixture();f.ledger.deliveries[0].land=109;await resign(f);await assert.rejects(bindAstridSequence(f),/ordering/);
});
test('input and output snapshots are immutable across awaited validation',async()=>{
 const f=await fixture(),pending=bindAstridSequence(f);f.deliveries[0].card.r='A';f.ledger.frames[109].cards[0].corners=[[0,0],[0,0],[0,0],[0,0]];
 const b=await pending,at=b.present(109);assert.equal(at.moving[0].card.r,'Q');assert.deepEqual(at.moving[0].corners,corners);assert(Object.isFrozen(at.moving[0].card));assert.throws(()=>{at.moving[0].card.r='A';},TypeError);
});
test('four explicit deliveries may overlap feeding and slide while landed cards persist',async()=>{
 const f=await fixture();f.deliveries=[];f.ledger.deliveries=[];f.targets=[];
 for(let i=0;i<4;i++){
  const cardId=`card-${i}`,seatId=`seat-${i}`,targetId=`target-${i}`,q=corners.map(([x,y])=>[x+i*100,y]);
  f.deliveries.push({cardId,seatId,targetId,faceDown:i===3,...(i===3?{}:{card:{r:'2',s:'♣'}})});
  f.targets.push({seatId,targetId,corners:q});f.ledger.deliveries.push({cardId,seatId,targetId,targetCorners:q,pickup:i*20+1,release:i*20+22,land:i*20+25});
 }
 f.ledger.frames=Array.from({length:90},(_,frame)=>({frame,cards:f.ledger.deliveries.filter(d=>frame>=d.pickup&&frame<d.land).map(d=>({cardId:d.cardId,corners:d.targetCorners,faceUp:true}))}));await resign(f);
 const b=await bindAstridSequence(f);assert.equal(b.present(21).moving.length,2);const middle=b.present(45);assert.equal(middle.landed.length,2);assert.equal(middle.moving[0].cardId,'card-2');
 const last=b.present(85);assert.equal(last.landed.length,4);assert.equal(last.newLandings.length,2);assert.equal(last.landed[3].card,undefined);
});
test('declaring far-left IDs and target corners cannot bind a middle endpoint',async()=>{
 const f=await fixture(),left=corners.map(([x,y])=>[x-600,y]);
 f.deliveries[0].seatId=f.ledger.deliveries[0].seatId=f.targets[0].seatId='far-left';
 f.deliveries[0].targetId=f.ledger.deliveries[0].targetId=f.targets[0].targetId='far-left-first';
 f.targets[0].corners=left;f.ledger.deliveries[0].targetCorners=left;await resign(f);
 await assert.rejects(bindAstridSequence(f),/teleport rejected/);
});
test('small endpoint mismatch also fails without explicit source-bound calibration',async()=>{
 const f=await fixture();f.ledger.frames[111].cards[0].corners=corners.map(([x,y])=>[x+1,y]);await resign(f);await assert.rejects(bindAstridSequence(f),/teleport rejected/);
});
test('bounded tolerance must bind source, final moving frame and exact pose evidence',async()=>{
 const f=await fixture();f.ledger.frames[111].cards[0].corners=corners.map(([x,y])=>[x+1,y]);
 const c={cardId:'fourth',units:'canonical-pixels',sourceSha256:f.ledger.sourceSha256,frame:111,sourceCorners:f.ledger.frames[111].cards[0].corners,maxCornerErrorPixels:1,evidence:'synthetic measured uncertainty fixture'};
 c.sha256=await ledgerDigest(c);f.landingCalibrations=[c];f.ledger.deliveries[0].landingCalibrationSha256=c.sha256;await resign(f);
 assert.equal((await bindAstridSequence(f)).present(112).newLandings.length,1);
 c.evidence='changed';await assert.rejects(bindAstridSequence(f),/calibration changed/);
});
test('invented large allowance and calibration for wrong source frame reject',async()=>{
 const f=await fixture();const c={cardId:'fourth',units:'canonical-pixels',sourceSha256:f.ledger.sourceSha256,frame:110,sourceCorners:corners,maxCornerErrorPixels:1,evidence:'synthetic wrong-frame evidence'};c.sha256=await ledgerDigest(c);f.landingCalibrations=[c];f.ledger.deliveries[0].landingCalibrationSha256=c.sha256;await resign(f);await assert.rejects(bindAstridSequence(f),/actual endpoint/);
 c.frame=111;c.maxCornerErrorPixels=700;delete c.sha256;c.sha256=await ledgerDigest(c);f.ledger.deliveries[0].landingCalibrationSha256=c.sha256;await resign(f);await assert.rejects(bindAstridSequence(f),/bounded landing/);
});
test('one immutable reviewed slot digest reuses distinct issued identities',async()=>{
 const f=await fixture(),digest=f.ledger.review.payloadSha256;
 for(const draw of ['shoeA:17','shoeB:93']){const b=await bindAstridSequence({...f,deliveries:[{...f.deliveries[0],cardId:draw,faceDown:true}],slotBindings:[{slotId:'fourth',cardId:draw}]});assert.equal(b.ledgerSha256,digest);assert.equal(b.present(109).moving[0].cardId,draw);assert.equal(b.present(112).newLandings[0].cardId,draw);assert.equal(b.present(114).landed[0].cardId,draw);}
 assert.equal(await ledgerDigest(f.ledger),digest);
});
test('slot mapping rejects unknown slot/issued ID and mismatched target',async()=>{
 const f=await fixture();await assert.rejects(bindAstridSequence({...f,slotBindings:[{slotId:'unknown',cardId:'fourth'}]}),/Unknown slot/);await assert.rejects(bindAstridSequence({...f,slotBindings:[{slotId:'fourth',cardId:'unknown'}]}),/Unknown slot/);
 await assert.rejects(bindAstridSequence({...f,deliveries:[{...f.deliveries[0],targetId:'different'}],slotBindings:[{slotId:'fourth',cardId:'fourth'}]}),/exact seat/);
});
test('slot mapping cannot alias two slots or two issued cards',async()=>{
 const f=await fixture();f.deliveries.push({...f.deliveries[0],cardId:'other'});f.ledger.deliveries.push({...f.ledger.deliveries[0],cardId:'other'});for(const row of f.ledger.frames)if(row.cards.length)row.cards.push({...row.cards[0],cardId:'other'});await resign(f);
 for(const slotBindings of [[{slotId:'fourth',cardId:'fourth'},{slotId:'fourth',cardId:'other'}],[{slotId:'fourth',cardId:'fourth'},{slotId:'other',cardId:'fourth'}]])await assert.rejects(bindAstridSequence({...f,slotBindings}),/Duplicate slot or issued/);
});
test('slot snapshot is immutable during asynchronous digest validation',async()=>{
 const f=await fixture();f.deliveries[0].cardId='shoe:1';f.deliveries[0].faceDown=true;const slotBindings=[{slotId:'fourth',cardId:'shoe:1'}];const pending=bindAstridSequence({...f,slotBindings});slotBindings[0].cardId='attacker';f.deliveries[0].faceDown=false;const b=await pending;assert.equal(b.present(109).moving[0].cardId,'shoe:1');assert.equal(b.present(110).moving[0].card,undefined);
});
