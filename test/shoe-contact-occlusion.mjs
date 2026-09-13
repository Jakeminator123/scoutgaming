import test from 'node:test';import assert from 'node:assert/strict';
import {projectShoeMouth,clipExtractingCard} from '../web/public/shoe-contact-occlusion.mjs';
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],c=Math.SQRT1_2;
function registration(){return {viewport:{width:1280,height:720},camera:{type:'orthographic',world:[1,0,0,0,0,c,-c,0,0,c,c,0,0,2000,2000,1],projection:[2/1280,0,0,0,0,2/720,0,0,0,0,-2/9999,0,0,0,-10001/9999,1]},shoe:{matrix:[...I]}};}
const fit={x:0,y:0,width:1280,height:720};
const quad=()=>[{position:[0,0,0],uv:[0,0]},{position:[1,0,0],uv:[1,0]},{position:[1,1,0],uv:[1,1]},{position:[0,1,0],uv:[0,1]}];
const opts={mouth:{plane:[0,1,-.5]},frame:3,pickupFrame:2,fullyExtractedFrame:5};
test('partial card clipping preserves physical positions and interpolates UV at lip',()=>{const original=quad(),r=clipExtractingCard(original,opts);assert.equal(r.vertices.length,4);assert.ok(r.vertices.every(v=>v.position[1]>=.5));assert.deepEqual(r.vertices.map(v=>v.uv),[[1,.5],[1,1],[0,1],[0,.5]]);assert.deepEqual(original,quad());});
test('inside card is hidden; fully outside card is untouched',()=>{assert.equal(clipExtractingCard(quad(),{...opts,mouth:{plane:[0,1,-2]}}).vertices.length,0);assert.deepEqual(clipExtractingCard(quad(),{...opts,mouth:{plane:[0,1,1]}}).vertices,quad());});
test('measured frame window disables clipping exactly at full extraction',()=>{for(const frame of [1,5,8])assert.deepEqual(clipExtractingCard(quad(),{...opts,frame}),{active:false,vertices:quad()});assert.equal(clipExtractingCard(quad(),{...opts,frame:2}).active,true);});
test('lip projects from actual model dimensions with external side preserved',()=>{const r=registration(),mouth=projectShoeMouth({size:100,registration:r,fit});const expectedY=(720/2+(88*.46+4-6.5)*c)/720;assert.ok(Math.abs(mouth.edge[0][0]-(640-37*.75/2)/1280)<1e-12);assert.ok(Math.abs(mouth.edge[0][1]-expectedY)<1e-12);assert.ok(mouth.plane[0]*mouth.outside[0]+mouth.plane[1]*mouth.outside[1]+mouth.plane[2]>0);});
test('source fit offsets and sizes are applied once, including portrait crop',()=>{const r=registration(),a=projectShoeMouth({size:100,registration:r,fit}),b=projectShoeMouth({size:100,registration:r,fit:{x:-100,y:80,width:1500,height:900}});for(let i=0;i<2;i++){assert.ok(Math.abs(b.edge[i][0]-(a.edge[i][0]*1280+100)/1500)<1e-12);assert.ok(Math.abs(b.edge[i][1]-(a.edge[i][1]*720-80)/900)<1e-12);}});
test('shoe matrix rotation and translation are projected instead of hardcoded outlet',()=>{const r=registration(),base=projectShoeMouth({size:100,registration:r,fit});r.shoe.matrix[12]=100;const translated=projectShoeMouth({size:100,registration:r,fit});assert.ok(Math.abs(translated.edge[0][0]-base.edge[0][0]-100/1280)<1e-12);r.shoe.matrix=[0,0,-1,0,0,1,0,0,1,0,0,0,100,0,0,1];const rotated=projectShoeMouth({size:100,registration:r,fit});assert.ok(Math.abs(rotated.edge[0][0]-rotated.edge[1][0])<1e-12);assert.notEqual(rotated.edge[0][1],rotated.edge[1][1]);});
test('invalid source timing, matrix and perspective camera fail closed',()=>{assert.throws(()=>clipExtractingCard(quad(),{...opts,fullyExtractedFrame:2}));const r=registration();r.camera.type='perspective';assert.throws(()=>projectShoeMouth({size:100,registration:r,fit}));r.camera.type='orthographic';r.camera.world[0]=2;assert.throws(()=>projectShoeMouth({size:100,registration:r,fit}));});
test('diagonal lip may produce five vertices and interpolates depth without stretching',()=>{const card=quad();card[0].position[2]=2;card[1].position[2]=4;card[2].position[2]=6;card[3].position[2]=4;const r=clipExtractingCard(card,{...opts,mouth:{plane:[1,1,-.5]}});assert.equal(r.vertices.length,5);const cut=r.vertices.filter(v=>Math.abs(v.position[0]+v.position[1]-.5)<1e-12);assert.equal(cut.length,2);for(const v of cut){assert.equal(v.position[2],3);assert.equal(v.uv[0]+v.uv[1],.5);}});
test('corners exactly on lip are emitted once for every winding start',()=>{
  const card=quad();
  for(let start=0;start<4;start++){
    const rotated=card.slice(start).concat(card.slice(0,start));
    const result=clipExtractingCard(rotated,{...opts,mouth:{plane:[1,1,-1]}}).vertices;
    assert.equal(result.length,3);
    assert.equal(new Set(result.map(v=>JSON.stringify(v))).size,3);
    for(const vertex of result)assert.ok(card.some(original=>JSON.stringify(original)===JSON.stringify(vertex)));
    const [a,b,c]=result.map(v=>v.position);
    assert.ok(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>0);
  }
});
test('tangent corner and tangent edge have no repeated closing vertices',()=>{
  const corner=clipExtractingCard(quad(),{...opts,mouth:{plane:[1,1,-2]}}).vertices;
  assert.deepEqual(corner,[quad()[2]]);
  const edge=clipExtractingCard(quad(),{...opts,mouth:{plane:[0,1,-1]}}).vertices;
  assert.deepEqual(edge,[quad()[2],quad()[3]]);
});
