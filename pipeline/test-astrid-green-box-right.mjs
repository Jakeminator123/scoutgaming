import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectGreenTake,shouldUseGreenBoxCard,shouldUseGreenDealerCard} from '../web/public/astrid-green-dealer.mjs';
import {validateContactTake,uniformRegistration} from '../web/public/performance-contact.mjs';

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
