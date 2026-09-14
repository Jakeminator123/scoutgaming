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
