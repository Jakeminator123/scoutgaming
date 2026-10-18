import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAGAN_KEVIN_PROFILE as profile } from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import { filmedFaceAtTime } from '../packages/presentation/contracts/filmed-profile.mjs';
import { filmedTableBinding, filmedTransferTiming, projectFilmedFace } from '../services/game/public/card-presentation/filmed-table-projection.mjs';

function projection(boxes = [0,1,2,3,4,5,6]) {
  return {x:40,y:320,scale:.4,adjusted:true,boxes,
    positions:{dealer:{cx:700,cy:120},...Object.fromEntries(boxes.map(box=>[String(box+1),{cx:100+box*180,cy:350}]))},
    filmedLayout:{profileId:profile.id,tableId:'oak',layout:boxes.length===3?'mobile':'desktop',sourcePlane:{x:150,y:40,scale:.7}}};
}
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('filmed binding requires an explicit exact profile, source plane and complete visible board seats',()=>{
  const p=projection();assert.ok(filmedTableBinding(profile,p));
  for(const edit of [p=>delete p.filmedLayout,p=>p.filmedLayout.profileId='other',p=>p.filmedLayout.layout='wide',
    p=>p.filmedLayout.sourcePlane.scale=0,p=>p.scale=NaN,p=>delete p.positions['7'],p=>p.boxes=[0,0],
    p=>p.geometryWarning='Bordet ryms inte',p=>p.boxes=[],p=>p.boxes.pop(),p=>p.offsets={'4':NaN}]){
    const invalid=structuredClone(p);edit(invalid);assert.equal(filmedTableBinding(profile,invalid),null);
  }
  const mobile=projection([4,5,6]);assert.ok(filmedTableBinding(profile,mobile));
  assert.deepEqual(Object.keys(filmedTableBinding(profile,mobile).positions),['5','6','7','dealer']);
});

test('changing source framing, board identity, seats or projection revokes the old binding',()=>{
  const p=projection(),key=filmedTableBinding(profile,p).key;
  for(const edit of [p=>p.filmedLayout.tableId='other',p=>p.filmedLayout.sourcePlane.x++,p=>p.filmedLayout.sourcePlane.scale*=2,
    p=>p.positions['4'].cy++,p=>p.x++,p=>p.y++,p=>p.scale*=2,p=>p.boxes.reverse(),p=>p.offsets={'4':1}]){
    const changed=structuredClone(p);edit(changed);assert.notEqual(filmedTableBinding(profile,changed).key,key);
  }
  assert.equal(filmedTableBinding(profile,structuredClone(p)).key,key);
});

test('every exact tracked take stays on dealer film before release even when board, card size and split anchor move',()=>{
  for(const take of profile.takes.filter(t=>profile.tracks[t.track])){
    const p=projection(),binding=filmedTableBinding(profile,p),time=take.firstFaceFrame/24;
    const face=filmedFaceAtTime(profile,take,time),pose={x:913,y:682};
    const projected=projectFilmedFace(profile,take,face,binding,pose,time,63,85);
    assert.ok(projected,take.key);
    const origin=profile.positions[take.target==='flip'?'dealer':take.target];
    for(const kind of ['q','p','body'])for(let i=0;i<face[kind].length;i++)for(let axis=0;axis<2;axis++){
      const dimension=axis?'y':'x',centre=axis?'cy':'cx';
      close(p[dimension]+(pose[dimension]+projected[kind][i][axis])*p.scale,
        binding.source[dimension]+(origin[centre]+face[kind][i][axis])*binding.source.scale);
    }
  }
});

test('release cue freezes the final source quad and settles at the selected table card by the exact final frame',()=>{
  const take=profile.takes.find(t=>t.key==='4:base'),binding=filmedTableBinding(profile,projection()),pose={x:640,y:350};
  const timing=filmedTransferTiming(profile,take),face=filmedFaceAtTime(profile,take,timing.release/24);
  const start=projectFilmedFace(profile,take,face,binding,pose,timing.release/24,63,85);
  const almost=projectFilmedFace(profile,take,face,binding,pose,(timing.end-1)/24,63,85);
  const target=[[-31.5,-42.5],[31.5,-42.5],[31.5,42.5],[-31.5,42.5]];
  assert.deepEqual(start.q,start.p);assert.deepEqual(start.q,start.body);
  for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(almost.q[i][axis]-target[i][axis])<Math.abs(start.q[i][axis]-target[i][axis]));
  assert.equal(projectFilmedFace(profile,take,face,binding,pose,timing.end/24,63,85),null);
  assert.equal(filmedTransferTiming(profile,{...take,clearFrame:take.frames-1}),null);
  assert.equal(projectFilmedFace(profile,take,{...face,q:[[NaN,0]]},binding,pose,1,63,85),null);
});

test('card view invalidates a filmed binding and flattens only the post-release destination',()=>{
  const p=projection(),raised=filmedTableBinding(profile,p);p.cardView='table';const flat=filmedTableBinding(profile,p);
  assert.notEqual(flat.key,raised.key);
  const take=profile.takes.find(t=>t.key==='4:base'),timing=filmedTransferTiming(profile,take),pose={x:640,y:350};
  const face=filmedFaceAtTime(profile,take,timing.release/24);
  const before=projectFilmedFace(profile,take,face,flat,pose,(timing.release-1)/24,63,85,.62);
  assert.deepEqual(before,projectFilmedFace(profile,take,face,flat,pose,(timing.release-1)/24,63,85,1));
  const almost=projectFilmedFace(profile,take,face,flat,pose,(timing.end-1)/24,63,85,.62);
  const initial=projectFilmedFace(profile,take,face,flat,pose,timing.release/24,63,85,.62);
  const target=[[-31.5,-26.35],[31.5,-26.35],[31.5,26.35],[-31.5,26.35]];
  for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(almost.q[i][axis]-target[i][axis])<Math.abs(initial.q[i][axis]-target[i][axis]));
});
