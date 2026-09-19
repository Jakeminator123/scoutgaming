import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectGreenTake,shouldUseGreenBoxCard,shouldUseGreenDealerCard,greenRestCardQuad} from '../web/public/astrid-green-dealer.mjs';
import {validateContactTake,uniformRegistration,presentationLandFrame,settledContactCard} from '../web/public/performance-contact.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const reviewDir=path.resolve(dir,'../web/public/review/astrid-table-v2');
const read=file=>JSON.parse(fs.readFileSync(path.join(reviewDir,file)));
const dealerTake=read('take.json');
// A synthetic box take mirrors the composed shape without depending on which
// box take is installed right now (Kevin moved the target from box 6 to box 5).
const syntheticBox=box=>({...dealerTake,id:`synthetic-box${box}`,action:'deal-right',box,tracking:{...dealerTake.tracking,scope:`first-card-of-box${box}-only`}});
const boxTake=syntheticBox(5);
const takes=[dealerTake,boxTake];
const base={dealer:'astrid',enabled:true,containerId:'',box:5,split:false,faceDown:false,existingCards:0};
const blueTake=JSON.parse(fs.readFileSync(path.resolve(reviewDir,'../astrid-blue-box4/take.json')));

test('only the opted-in Box 4 opening pair reuses the blue take',()=>{
  assert.deepEqual(validateContactTake(blueTake),[]);
  for(const existingCards of [0,1])assert.equal(selectGreenTake([dealerTake,boxTake,blueTake],{...base,box:4,existingCards}),blueTake);
  for(const existingCards of [-1,2,3,1.5])assert.equal(selectGreenTake([blueTake],{...base,box:4,existingCards}),null);
  for(const override of [{box:5},{split:true},{faceDown:true},{dealer:'mei'},{enabled:false}])assert.equal(selectGreenTake([blueTake],{...base,box:4,existingCards:1,...override}),null);
  assert.equal(selectGreenTake([dealerTake,boxTake],{...base,box:4,existingCards:1}),null);
});

test('settled presentation enlarges the table plane without changing pickup or the first slot',()=>{
  const quad=[[0,0],[72,0],[72,103],[0,103]];
  const first=greenRestCardQuad(quad,0,blueTake.tracking.presentation);
  const second=greenRestCardQuad(quad,1,blueTake.tracking.presentation);
  assert.equal(first[1][0]-first[0][0],90);
  assert.equal(first[3][1]-first[0][1],128.75);
  assert.ok(second[0][0]>first[0][0]&&second[0][0]<first[1][0],'readable overlapping fan');
  assert.deepEqual(greenRestCardQuad(quad,0,blueTake.tracking.presentation),first,'first slot is independent of the second');
  const end=greenRestCardQuad(blueTake.frames[blueTake.events.land].card.corners,1,blueTake.tracking.presentation).map(p=>[...p,0]);
  for(const sample of blueTake.frames.slice(0,blueTake.events.land+1))assert.deepEqual(settledContactCard(blueTake,sample,end),sample.card,`source frame ${sample.frame}`);
  const at=presentationLandFrame(blueTake);
  assert.deepEqual(settledContactCard(blueTake,blueTake.frames[at],end).corners,end,'canvas reaches the exact DOM quad');
  assert.equal(presentationLandFrame(boxTake),boxTake.events.land,'other takes do not change');
});

test('presentation cannot begin during contact or extend past the return',()=>{
  for(const presentation of [{scale:2,fanStep:.48,settleFrames:8},{scale:1.25,fanStep:.48,settleFrames:50}]){
    assert.ok(validateContactTake({...blueTake,tracking:{...blueTake.tracking,presentation}}).includes('Invalid settled-card presentation'));
  }
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
