import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectGreenTake,shouldUseGreenBoxCard,shouldUseGreenDealerCard,greenRestCardQuad} from '../../web/public/astrid-green-dealer.mjs';
import {validateContactTake,uniformRegistration,contactFrame,dealingCardSample} from '../../packages/presentation/contracts/performance-contact.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const reviewDir=path.resolve(dir,'../../media/dealers/astrid/runtime/composited/astrid-table-v2');
const read=file=>JSON.parse(fs.readFileSync(path.join(reviewDir,file)));
const dealerTake=read('take.json');
// A synthetic box take mirrors the composed shape without depending on which
// box take is installed right now (Kevin moved the target from box 6 to box 5).
const syntheticBox=box=>({...dealerTake,id:`synthetic-box${box}`,action:'deal-right',box,tracking:{...dealerTake.tracking,scope:`first-card-of-box${box}-only`}});
const boxTake=syntheticBox(5);
const takes=[dealerTake,boxTake];
const base={dealer:'astrid',enabled:true,containerId:'',box:5,split:false,faceDown:false,existingCards:0};
const blueTake=JSON.parse(fs.readFileSync(path.resolve(reviewDir,'../astrid-blue-box4/take.json')));
const repeatDealer=JSON.parse(fs.readFileSync(path.resolve(reviewDir,'../astrid-blue-box4/dealer-take.json')));

test('opted-in Box 4 take covers opening cards, hits, doubles and split hands',()=>{
  assert.deepEqual(validateContactTake(blueTake),[]);
  for(const split of [false,true])for(const existingCards of [0,1,2,3,7])assert.equal(selectGreenTake([dealerTake,boxTake,blueTake],{...base,box:4,split,existingCards}),blueTake);
  for(const existingCards of [-1,1.5,undefined,'2'])assert.equal(selectGreenTake([blueTake],{...base,box:4,existingCards}),null);
  for(const override of [{box:5},{faceDown:true},{dealer:'mei'},{enabled:false}])assert.equal(selectGreenTake([blueTake],{...base,box:4,existingCards:1,...override}),null);
  assert.equal(selectGreenTake([dealerTake,boxTake],{...base,box:4,existingCards:1}),null);
});

test('opted-in dealer take covers the hidden hole card and later draws without consuming player cards',()=>{
  assert.deepEqual(validateContactTake(repeatDealer),[]);
  for(const existingCards of [0,1,2,3,6])for(const faceDown of [false,true])assert.equal(selectGreenTake([repeatDealer,blueTake],{...base,containerId:'dealer-cards',box:null,existingCards,faceDown}),repeatDealer);
  for(const box of [0,1,2,3,5,6])assert.equal(selectGreenTake([repeatDealer,blueTake],{...base,box,existingCards:2}),null);
  assert.equal(selectGreenTake([dealerTake],{...base,containerId:'dealer-cards',box:null,existingCards:2}),null,'ordinary table keeps its first-upcard-only route');
});

test('two to four split fans remain separate and on the same table plane',()=>{
  const quad=[[0,0],[72,0],[72,103],[0,103]],p=blueTake.tracking.presentation;
  for(const hands of [2,3,4]){
    let previousRight=-Infinity;
    for(let hand=0;hand<hands;hand++){
      const cards=Array.from({length:6},(_,i)=>greenRestCardQuad(quad,i,p,hand,hands));
      const left=Math.min(...cards.flat().map(p=>p[0])),right=Math.max(...cards.flat().map(p=>p[0]));
      assert.ok(left>previousRight,'split hands do not overlap');previousRight=right;
      assert.ok(cards.flat().every(p=>p[1]>=0&&p[1]<135),'cards stay near the original felt depth');
    }
  }
});

test('settled presentation enlarges the table plane without changing pickup or the first slot',()=>{
  const quad=[[0,0],[72,0],[72,103],[0,103]];
  const first=greenRestCardQuad(quad,0,blueTake.tracking.presentation);
  const second=greenRestCardQuad(quad,1,blueTake.tracking.presentation);
  assert.equal(first[1][0]-first[0][0],90);
  assert.equal(first[3][1]-first[0][1],128.75);
  assert.ok(second[0][0]>first[0][0]&&second[0][0]<first[1][0],'readable overlapping fan');
  assert.deepEqual(greenRestCardQuad(quad,0,blueTake.tracking.presentation),first,'first slot is independent of the second');
  for(const sample of blueTake.frames)assert.deepEqual(contactFrame(blueTake,sample.frame/blueTake.media.fps).card,sample.card,`dealing frame ${sample.frame} retains its original size`);
  assert.equal(blueTake.events.land,56,'no extra animation after filmed placement');
  assert.equal(blueTake.tracking.presentation.scope,'settled-only');
});

test('resting-card size cannot opt into a dealing resize animation',()=>{
  for(const presentation of [{scope:'settled-only',scale:2,fanStep:.48},{scope:'settled-only',scale:1.25,fanStep:.48,settleFrames:8},{scale:1.25,fanStep:.48}]){
    assert.ok(validateContactTake({...blueTake,tracking:{...blueTake.tracking,presentation}}).includes('Invalid settled-card presentation'));
  }
});

test('Box 4 moving cards stay 20% smaller at every frame with the grip fixed',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
  const grip=c=>c.corners[0].map((v,k)=>v+(c.corners[3][k]-v)*.25);
  for(const f of blueTake.frames){
    const card=dealingCardSample(blueTake,f.card);
    if(!f.card){assert.equal(card,null);continue;}
    assert.ok(distance(grip(card),grip(f.card))<1e-12,`frame ${f.frame}: fixed finger contact`);
    for(let edge=0;edge<4;edge++)assert.ok(Math.abs(distance(card.corners[edge],card.corners[(edge+1)%4])/distance(f.card.corners[edge],f.card.corners[(edge+1)%4])-.8)<1e-12,`frame ${f.frame}: uniform scale`);
    assert.equal(card.faceUp,f.card.faceUp);
    assert.equal(dealingCardSample(boxTake,f.card),f.card,'other takes stay unchanged');
  }
  assert.equal(blueTake.tracking.presentation.scale,1.25,'laid cards retain their larger size');
});

test('only the FIRST card of the configured box selects the box take',()=>{
  assert.equal(selectGreenTake(takes,base),boxTake);
  for(const box of [0,1,2,3,4,6,null,undefined])assert.equal(selectGreenTake(takes,{...base,box}),null,`box ${box}`);
  for(const existingCards of [1,2,3])assert.equal(selectGreenTake(takes,{...base,existingCards}),null);
  assert.equal(selectGreenTake(takes,{...base,split:true}),null);
  assert.equal(selectGreenTake(takes,{...base,faceDown:true}),null);
  assert.equal(selectGreenTake(takes,{...base,dealer:'vera'}),null);
  assert.equal(selectGreenTake([dealerTake],base),null,'without a box take the box keeps its ordinary path');
  assert.equal(selectGreenTake([dealerTake,syntheticBox(6)],base),null,'a take bound to another box never answers');
});

test('the dealer upcard keeps its own take and never the box take',()=>{
  const dealer={...base,containerId:'dealer-cards',box:null};
  assert.equal(selectGreenTake(takes,dealer),dealerTake);
  assert.equal(shouldUseGreenDealerCard(dealer),true);
  assert.equal(shouldUseGreenBoxCard(boxTake,dealer),false);
  assert.equal(selectGreenTake(takes,{...dealer,existingCards:1}),null);
  assert.equal(selectGreenTake(takes,{...dealer,faceDown:true}),null);
});

test('a box take keeps the filmed landing like the dealer take; the contract still rejects giving it up',()=>{
  assert.deepEqual(validateContactTake(boxTake),[]);
  assert.ok(validateContactTake({...boxTake,tracking:{...boxTake.tracking,keepSourceLanding:false}}).some(e=>e.includes('filmed landing')));
  assert.deepEqual(validateContactTake(dealerTake),[]);
});

test('every installed review take validates and shares the plate registration',()=>{
  const list=fs.existsSync(path.join(reviewDir,'takes.json'))?read('takes.json').takes:['take.json'];
  assert.ok(list.includes('take.json'));
  for(const file of list){
    const take=read(file);
    assert.deepEqual(validateContactTake(take),[],file);
    assert.deepEqual(take.camera.placement,dealerTake.camera.placement,file);
    if(Number.isInteger(take.box)){
      assert.equal(take.tracking.keepSourceLanding,true,file);
      assert.equal(take.events.land,take.events.release+1,`${file}: the DOM card takes over right after fingertip separation`);
      assert.match(take.id,new RegExp(`first-card-box${take.box}-`));
      const e=take.events;
      assert.ok(e.pickup<e.release&&e.release<e.land&&e.land<e.rest&&e.rest===take.media.frames-1,file);
      assert.equal(take.frames.filter(f=>f.card).length,e.land-e.pickup+1,file);
      for(const f of take.frames)if(f.card)for(const [u,v] of f.card.corners)assert.ok(u>=0&&u<=1&&v>=0&&v<=1,`${file} frame ${f.frame} inside crop`);
      for(const viewport of [{width:1280,height:720},{width:1200,height:674},{width:706,height:837}]){
        const a=uniformRegistration(dealerTake.camera,viewport),b=uniformRegistration(take.camera,viewport);
        assert.ok(Math.abs(a.scale-b.scale)<1e-9&&Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9,'same crop origin and scale');
      }
    }
  }
});
