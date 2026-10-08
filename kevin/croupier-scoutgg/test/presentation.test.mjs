import test from 'node:test';
import assert from 'node:assert/strict';
import {createThemeBoundary} from '../public/game-presentation.js';
import {catalogEventForStep} from '../public/runtime-event-links.js';
import {createPresentationReader} from '../server/presentation.mjs';
test('publishing or changing brand during a hand waits for the next betting boundary',()=>{
 const applied=[],b=createThemeBoundary(v=>applied.push(v.revision));
 b.offer({revision:'scout-1'});assert.equal(applied.length,0);b.state({phase:'bets'});b.state({phase:'round'});b.offer({revision:'scout-2'});b.offer({revision:'fjord-1'});
 b.state({phase:'settled'});assert.deepEqual(applied,['scout-1']);assert.equal(b.pending(),true);
 b.state({phase:'bets'});assert.deepEqual(applied,['scout-1','fjord-1']);assert.equal(b.pending(),false);
 b.offer({revision:'fjord-1'});assert.equal(applied.length,2);
});
test('catalogue identities preserve all seven destinations, hidden deal and reveal without card inputs',()=>{
 assert.deepEqual([1,2,3,4,5,6,7].map(seat=>catalogEventForStep({kind:'deal',seat})),['left','left','centre','centre','centre','right','right'].map(s=>'deal.player.'+s));
 assert.equal(catalogEventForStep({kind:'deal',seat:'dealer'}),'deal.dealer');
 assert.equal(catalogEventForStep({kind:'reveal'}),'reveal.dealer');
 assert.equal(catalogEventForStep({kind:'speech',clip:{event:'double'}}),'speak.double');
});
test('published design reader restricts the service origin and never forwards arbitrary brands',async()=>{
 assert.throws(()=>createPresentationReader({base:'https://outside.test'}));
 let calls=0;const read=createPresentationReader({fetcher:async url=>{calls++;assert.equal(url.pathname,'/api/bo/published-design');return {ok:true,json:async()=>({schema:1,brand:'scout',revision:'one',theme:{}})};}});
 await assert.rejects(read('../../secret'));assert.equal(calls,0);
 assert.equal((await read('scout')).revision,'one');await read('scout');assert.equal(calls,1);
});
