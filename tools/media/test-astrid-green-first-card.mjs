import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldUseGreenDealerCard, greenShoeOutlet } from '../../web/public/astrid-green-dealer.mjs';
import {uniformRegistration} from '../../web/public/performance-contact.mjs';

const firstUpcard = {
  dealer: 'astrid', enabled: true, containerId: 'dealer-cards',
  faceDown: false, existingCards: 0,
};

test('approved green action owns only the first face-up Astrid dealer card', () => {
  assert.equal(shouldUseGreenDealerCard(firstUpcard), true);
  assert.equal(shouldUseGreenDealerCard({ ...firstUpcard, enabled: false }), false);
  assert.equal(shouldUseGreenDealerCard({ ...firstUpcard, faceDown: true }), false);
  for (const existingCards of [1, 2, 3, 5]) {
    assert.equal(shouldUseGreenDealerCard({ ...firstUpcard, existingCards }), false,
      `later card index ${existingCards} must retain its existing path`);
  }
});

test('player cards and other dealers cannot consume the approved upcard action', () => {
  for (const dealer of ['vera', 'amira', 'mei']) {
    assert.equal(shouldUseGreenDealerCard({ ...firstUpcard, dealer }), false);
  }
  for (const containerId of ['', 'cards', 'player-cards', ...Array.from({ length: 7 }, (_, i) => `box${i}`)]) {
    assert.equal(shouldUseGreenDealerCard({ ...firstUpcard, containerId }), false);
  }
});

test('missing or non-numeric card counts do not accidentally enable the action', () => {
  for (const existingCards of [undefined, null, -1, 0.5, NaN, '0']) {
    assert.equal(shouldUseGreenDealerCard({ ...firstUpcard, existingCards }), false);
  }
});

test('shoe registration follows the selected take and cropped source placement', () => {
  const take={camera:{width:960,height:760,shoeOutlet:[.7,.8],placement:{width:1920,height:1080,scale:1,x:560,y:20}}};
  const point=greenShoeOutlet(take,{width:1920,height:1216});
  assert.deepEqual(point,{x:1232,y:628});
  const other={camera:{...take.camera,shoeOutlet:[.5,.5]}};
  assert.deepEqual(greenShoeOutlet(other,{width:1920,height:1216}),{x:1040,y:400});
  assert.deepEqual(greenShoeOutlet(take,{width:960,height:676}),{x:616,y:314});
});

test('pulling back the shot keeps the filmed shoe and Blender table in the same frame',()=>{
  const placement={width:1920,height:1080,scale:1,x:560,y:0,framingScale:.85};
  const take={camera:{width:960,height:760,shoeOutlet:[(1265.5-560)/960,673.5/760],placement}};
  for(const viewport of [{width:1280,height:720},{width:1117,height:837},{width:706,height:837}]){
    const actorOutlet=greenShoeOutlet(take,viewport);
    const table=uniformRegistration({width:1920,height:1080,framingScale:.85},viewport);
    assert.ok(Math.abs(actorOutlet.x-(table.x+1265.5*table.scale))<1e-8);
    assert.ok(Math.abs(actorOutlet.y-(table.y+673.5*table.scale))<1e-8);
    const full=uniformRegistration({width:1920,height:1080},viewport);
    assert.ok(Math.abs(table.scale/full.scale-.85)<1e-8);
  }
});
