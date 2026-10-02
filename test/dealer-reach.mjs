import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deliveryReach,shiftCard} from '../web/public/dealer-reach.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../media/dealers/astrid/runtime/indexed/performance/manifest.json',import.meta.url)));
const targets=JSON.parse(fs.readFileSync(new URL('../media/game/staging/2026-09-13/per-seat-video/targets.json',import.meta.url))).rows;
test('seven destinations preserve pickup and rest and place the attached release at the target',()=>{
  for(const take of manifest.takes.filter(t=>!t.continuation&&t.action!=='deal-dealer'))for(const target of targets){
    const end=target.cards[0].corners.map(p=>[...p,0]),e=take.events;
    assert.deepEqual(deliveryReach(take,e.pickup,end).delta.map(x=>x||0),[0,0]);
    assert.deepEqual(deliveryReach(take,e.rest,end).delta.map(x=>x||0),[0,0]);
    const card=take.frames[e.release].card,shifted=shiftCard(card,deliveryReach(take,e.release,end).delta);
    for(let k=0;k<2;k++)assert.ok(Math.abs(shifted.corners.reduce((a,p)=>a+p[k]/4,0)-end.reduce((a,p)=>a+p[k]/4,0))<1e-10);
    for(let i=1;i<4;i++)for(let k=0;k<3;k++)assert.ok(Math.abs((shifted.corners[i][k]-shifted.corners[0][k])-(card.corners[i][k]-card.corners[0][k]))<1e-10);
    assert.notStrictEqual(shifted,card);
  }
});
