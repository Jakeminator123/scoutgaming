import test from 'node:test';import assert from 'node:assert/strict';import {eligible,sourceFit,canonicalCorners,assertTarget,once} from './harness/game-contract.mjs';
const ok={hostname:'astridsingleseat.localhost',port:'4190',query:'review',dealer:'astrid',box:0,index:0,split:false};
test('actualgame dispatch fails closed outside isolated firstbox0 optin',()=>{assert.equal(eligible(ok),true);for(const change of [{port:'4173'},{hostname:'127.0.0.1'},{query:null},{dealer:'mei'},{box:1},{index:1},{split:true}])assert.equal(eligible({...ok,...change}),false);});
test('one DOM reveal even when land then cancellation both run',()=>{let visible=false,count=0;const reveal=once(()=>{visible=true;count++;});assert.equal(reveal(),true);assert.equal(reveal(),false);assert.equal(visible,true);assert.equal(count,1);});
test('failure/cancel before land restores DOMonce',()=>{let count=0;const reveal=once(()=>count++);reveal();reveal();assert.equal(count,1);});
test('source calibrated mapping roundtrip and target mismatch refuses teleport',()=>{const fit=sourceFit({scale:(720-136)/720,x:(1280-1280*((720-136)/720))/2,y:0});assert.ok(Math.abs(fit.scale-.5421688741883204)<1e-12);const target=[[422,644],[497,682],[447,742],[372,704]],screen=target.map(([x,y])=>[x*fit.scale+fit.x,y*fit.scale+fit.y]);assertTarget(canonicalCorners(screen,fit),target);screen[0][0]+=1;assert.throws(()=>assertTarget(canonicalCorners(screen,fit),target),/target differs/);});

import {responsiveHandMatrix} from './harness/game-contract.mjs';
test('responsive hand preserves seat anchor and uniformly scales all four local card corners',()=>{
 const input={matrix:[.919436,.393239,-.326147,.534834,0,0],left:78.82,top:-19.01,origin:[62,103],ratio:1.050851883561644};
 const apply=(m,p)=>[input.left+input.origin[0]+m[0]*(p[0]-input.origin[0])+m[2]*(p[1]-input.origin[1])+m[4],input.top+input.origin[1]+m[1]*(p[0]-input.origin[0])+m[3]*(p[1]-input.origin[1])+m[5]];
 const out=responsiveHandMatrix(input);for(const p of [[-44,0],[2,0],[2,66.0078],[-44,66.0078]]){const old=apply(input.matrix,p),next=apply(out,p);next.forEach((v,i)=>assert.ok(Math.abs(v-(60+input.ratio*(old[i]-60)))<1e-10));}
 assert.deepEqual(responsiveHandMatrix({...input,ratio:1}),input.matrix);assert.throws(()=>responsiveHandMatrix({...input,ratio:NaN}));
});

test('measured CSS rounding allowed but real endpoint displacement rejected',()=>{const q=[[1,2],[3,2],[3,4],[1,4]];assert.doesNotThrow(()=>assertTarget(q.map(([x,y])=>[x+.000521,y+.003462]),q));assert.throws(()=>assertTarget(q.map(([x,y])=>[x+.020001,y]),q),/target differs/);});
import {basisChange} from './harness/game-contract.mjs';
test('new photographed basis changes shape around unchanged card center',()=>{const a=[[0,0],[3,1],[2,5],[-1,4]],b=[[0,0],[4,2],[2,5],[-2,3]],m=basisChange(a,b);for(const i of [1,3]){assert.ok(Math.abs(m[0]*a[i][0]+m[2]*a[i][1]-b[i][0])<1e-10);assert.ok(Math.abs(m[1]*a[i][0]+m[3]*a[i][1]-b[i][1])<1e-10);}assert.throws(()=>basisChange([[0,0],[0,0],[0,0],[0,0]],b),/Degenerate/);});
import {centerCalibration} from './harness/game-contract.mjs';
test('box1 requires its exact optin and rejects other seat and split',()=>{assert.equal(eligible({...ok,box:1,candidateBox:1}),true);for(const change of [{box:0},{box:2,candidateBox:2},{index:1},{split:true},{query:null},{port:'4173'}])assert.equal(eligible({...ok,box:1,candidateBox:1,...change}),false);});
test('box1 center correction is bounded in native coordinates independently of card basis',()=>{const q=[[0,0],[80,20],[60,90],[-20,70]],target=q.map(([x,y])=>[x-.179,y+2.738]);const fit=centerCalibration(q,target);assert.ok(Math.abs(fit.distance-Math.hypot(.179,2.738))<1e-10);assert.throws(()=>centerCalibration(q,q.map(([x,y])=>[x+4.0001,y])),/exceeds4/);assert.throws(()=>centerCalibration(q,target,100),/Invalid/);assert.throws(()=>centerCalibration(q,[[NaN,0],...q.slice(1)]),/Invalid/);});

import {reviewQuery} from './harness/game-contract.mjs';
test('existing user review link includes newly integrated box1 without another optin flag',()=>{
 const params=new URLSearchParams('dealer=astrid&astridBox0=review&astridVariant=v6');
 assert.equal(eligible({...ok,box:1,candidateBox:1,query:reviewQuery(params,1)}),true);
 params.set('astridBox1','off');assert.equal(eligible({...ok,box:1,candidateBox:1,query:reviewQuery(params,1)}),false);
 assert.equal(reviewQuery(new URLSearchParams('dealer=astrid'),1),null);
});
import {sourceActorTransform} from './harness/game-contract.mjs';
test('box3 stays off under existing review links; requires contact plus review and first unsplit slot',()=>{for(const query of ['astridBox0=review','astridBox3=contact','astridBox0=review&astridBox3=review'])assert.equal(reviewQuery(new URLSearchParams(query),3),null);const query=reviewQuery(new URLSearchParams('astridBox0=review&astridBox3=contact'),3);assert.equal(eligible({...ok,query,box:3,candidateBox:3}),true);assert.equal(eligible({...ok,query,box:3,candidateBox:3,index:1}),false);assert.equal(eligible({...ok,query,box:3,candidateBox:3,split:true}),false);});
test('actor registration admits only explicit uniform transform and never local shear',()=>{assert.equal(sourceActorTransform(null),undefined);assert.deepEqual(sourceActorTransform({scale:1,translation:[0,0]}),{scale:1,translation:[0,0],rotation:0});for(const t of [{scale:1,translation:[0,0],scaleX:2},{scale:0,translation:[0,0]},{scale:1,translation:[NaN,0]}])assert.throws(()=>sourceActorTransform(t),/uniform/);});
import {shoeOcclusionContract,sourceShoeOccluded} from './harness/game-contract.mjs';
test('box3 shoe contract requires exact fixed asset hash/range and native gate excludes prefix',()=>{const v={src:'/astrid-box3/shoe-allowed-canonical.png',sha256:'a'.repeat(64),startSource:38,endSource:48},m={shoeMaskSHA256:v.sha256};assert.equal(shoeOcclusionContract({shoeOcclusion:v},m),v);for(const n of [null,37,49])assert.equal(sourceShoeOccluded(n,v),false);for(const n of [38,45,48])assert.equal(sourceShoeOccluded(n,v),true);for(const change of [{src:'/other'},{sha256:'b'.repeat(64)},{endSource:49}])assert.throws(()=>shoeOcclusionContract({shoeOcclusion:{...v,...change}},m),/mismatch/);});
