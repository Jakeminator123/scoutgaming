import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAstridSingleSeat} from '../single-seat/adapter.mjs';
const ledger=JSON.parse(fs.readFileSync(new URL('./ledger.json',import.meta.url)));
const target=JSON.parse(fs.readFileSync(new URL('./target.json',import.meta.url)));
const delivery={cardId:'tableVersion:test:shoeDraw:42',seatId:'seat1',targetId:'box1',faceDown:false,card:{r:'K',s:'♣'}};
test('new box1 source retains every native sample and hands actual issued identity to same target once',async()=>{
 const events=[],plans=[];let disposed=0;
 const adapter=await createAstridSingleSeat({delivery,ledger,target,slotBindings:[{slotId:'box1-first',cardId:delivery.cardId}],surface:{render:p=>plans.push(p),dispose:()=>disposed++},onLand:e=>events.push(e)});
 for(let frame=0;frame<97;frame++)await adapter.present(frame);
 assert.equal((await adapter.ended()).state,'complete');assert.equal(disposed,1);assert.equal(events.length,1);
 assert.equal(events[0].landFrame,64);assert.deepEqual(events[0].card,delivery.card);assert.deepEqual(events[0].corners,target.corners);
 assert.equal(plans[8].moving.length,0);assert.equal(plans[9].moving[0].cardId,delivery.cardId);
 assert.equal(plans[63].moving[0].phase,'released');assert.deepEqual(plans[63].moving[0].corners,target.corners);
 assert.equal(plans[64].moving.length,0);assert.deepEqual(ledger.frames.map(f=>f.native),Array.from({length:97},(_,i)=>i));
});
test('box1 cannot be silently bound to another seat or leak hidden rank',async()=>{
 const opts={ledger,target,slotBindings:[{slotId:'box1-first',cardId:delivery.cardId}],surface:{render(){},dispose(){}}};
 await assert.rejects(createAstridSingleSeat({...opts,delivery:{...delivery,seatId:'seat0'}}),/exact seat binding/);
 const plans=[],hidden=await createAstridSingleSeat({...opts,delivery:{...delivery,faceDown:true},surface:{render:p=>plans.push(p),dispose(){}}});
 await hidden.present(12);assert.equal(plans[0].moving[0].face,'back');assert.equal(plans[0].moving[0].card,undefined);hidden.cancel();
});
