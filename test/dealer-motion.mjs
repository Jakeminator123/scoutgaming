import test from 'node:test';
import assert from 'node:assert/strict';
import {solveArm,sampleDelivery,sampleTwoHandDelivery,seatTarget} from '../web/public/dealer-motion.mjs';
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
test('arm solver retains bone lengths across reachable, singular and unreachable targets',()=>{
  for(const target of [[.3,.9,.2],[0,1.4,0],[0,.8,0],[2,0,2]]){
    const shoulder=[0,1.4,0],s=solveArm(shoulder,target,.30,.27,[.2,1,-.2]);
    assert.ok(Math.abs(distance(shoulder,s.elbow)-.3)<1e-7);
    assert.ok(Math.abs(distance(s.elbow,s.wrist)-.27)<1e-7);
    assert.ok(s.wrist.every(Number.isFinite));
    if(distance(shoulder,target)<.57&&distance(shoulder,target)>.03)assert.ok(s.error<1e-7);
    else assert.ok(s.error>0);
  }
});
test('every seat and split releases in place and the empty hand never retrieves the card',()=>{
  for(let seat=0;seat<7;seat++)for(let split=0;split<4;split++)for(let n=0;n<6;n++){
    const config={outlet:[-.38,.95,-.1],rest:[-.2,1.01,-.08],target:seatTarget(seat,n,split)};
    for(let f=0;f<=100;f++){
      const s=sampleDelivery(f/100,config);
      if(s.phase==='carry')assert.deepEqual(s.hand,s.card);
      if(s.released)assert.deepEqual(s.card,config.target);
      assert.ok(s.card[1]>=config.target[1]-1e-6);
    }
    const end=sampleDelivery(1,config);
    assert.deepEqual(end.hand,config.rest);assert.equal(end.grip,0);
  }
});

test('two-hand transfer is continuous and keeps the released card stationary',()=>{
  const config={outlet:[.56,.935,.11],target:seatTarget(6)};
  for(const boundary of [.2,.24,.39,.57,.69,.75,1]){
    const before=sampleTwoHandDelivery(boundary-1e-7,config),after=sampleTwoHandDelivery(boundary+1e-7,config);
    for(const key of ['left','right','card'])assert.ok(distance(before[key],after[key])<1e-5,`${key} jumps at ${boundary}`);
  }
  const transfer=sampleTwoHandDelivery(.39,config);
  assert.deepEqual(transfer.left,transfer.card);assert.deepEqual(transfer.right,transfer.card);
  for(let f=69;f<=100;f++)assert.deepEqual(sampleTwoHandDelivery(f/100,config).card,config.target);
  const end=sampleTwoHandDelivery(1,config);assert.equal(end.leftGrip+end.rightGrip,0);
});
