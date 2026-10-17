import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DRAGAN_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import {validateFilmedDealProfile,resolveFilmedDealTake,filmedFaceAtTime,filmedDealTarget} from '../packages/presentation/contracts/filmed-profile.mjs';
const player={type:'deal',to:'box',box:0,shoeDraw:1};
const take=key=>profile.takes.find(t=>t.key===key);

test('Kevin runtime profile binds all 35 exact take hashes and 17 frame tracks without declaring acceptance',()=>{
  assert.equal(validateFilmedDealProfile(profile),profile);
  assert.equal(profile.source.commit,'f15b2af16ea7113d451f5c5da14fda031901392a');
  assert.equal(createHash('sha256').update(JSON.stringify(profile)).digest('hex'),'11cd828ab58d55f3e931c8d07b2bcdb52f3280abdf83d9e39963005d73d31a09');
  assert.equal(profile.takes.length,35);assert.equal(Object.keys(profile.tracks).length,17);
  assert.equal(new Set(profile.takes.map(t=>t.sha256)).size,35);
  assert.equal(profile.source.sources.find(s=>s.path.endsWith('v2/meta.json')).sha256,'4e0cb4fb901db874bbef18094608049787e0bcdcdca27ae9c3f56857550c9822');
  assert.equal(profile.source.sources.find(s=>s.path.endsWith('dealer-card-tracks-dragge.js')).sha256,'d077cc95818c2439bbc9c3e076ed46a9a684db9b61b94722e8f456c5851a08d9');
  assert.deepEqual(profile.plane,{width:1080,height:1920,fps:24});assert.deepEqual(profile.card,{width:78,height:106});
  assert.deepEqual(profile.positions['1'],{cx:110,cy:1025});
  assert.equal(take('1:base').landFrame,29); // Effective runtime override, raw meta has 25.
  assert.equal(take('flip:base').landFrame,23); // Raw meta has 15.
  assert.ok(!('approved' in profile));assert.ok(!('releaseFrame' in take('1:base')));
});

test('take selection requires both an exact SHA and matching server event including hidden/reveal distinction',()=>{
  assert.equal(resolveFilmedDealTake(profile,{sha256:take('1:i').sha256,event:player}),take('1:i'));
  assert.equal(resolveFilmedDealTake(profile,{sha256:take('1:i').sha256,event:{...player,box:1}}),null);
  assert.equal(resolveFilmedDealTake(profile,{sha256:'0'.repeat(64),event:player}),null);
  assert.equal(resolveFilmedDealTake(profile,{sha256:take('hole:base').sha256,event:{type:'deal',to:'dealer',faceDown:true}}),take('hole:base'));
  assert.equal(resolveFilmedDealTake(profile,{sha256:take('hole:base').sha256,event:{type:'reveal',to:'dealer'}}),null);
  assert.equal(resolveFilmedDealTake(profile,{sha256:take('flip:base').sha256,event:{type:'reveal',to:'dealer'}}),take('flip:base'));
  assert.equal(filmedDealTarget({type:'deal',to:'dealer'}),null);
  for(const box of [-1,7,1.5,'0'])assert.equal(filmedDealTarget({...player,box}),null);
});

test('variant pre-roll is subtracted once using decoded frames and terminal tracks stay distinct',()=>{
  const opening=take('1:i'),single=take('1:iv');
  assert.equal(opening.offsetFrames,27);assert.equal(opening.firstFaceFrame,51);
  assert.equal(filmedFaceAtTime(profile,opening,50/24),null);
  assert.equal(filmedFaceAtTime(profile,opening,51/24),profile.tracks['1'].frames[0]);
  assert.equal(filmedFaceAtTime(profile,opening,51.9/24),profile.tracks['1'].frames[0]);
  assert.equal(filmedFaceAtTime(profile,opening,52/24),profile.tracks['1'].frames[1]);
  assert.equal(single.track,'1v');assert.equal(single.firstFaceFrame,48);
  assert.equal(filmedFaceAtTime(profile,single,48/24),profile.tracks['1v'].frames[0]);
  assert.equal(filmedFaceAtTime(profile,single,300),profile.tracks['1v'].frames.at(-1));
  assert.equal(filmedFaceAtTime(profile,{...opening,offsetFrames:0},51/24),profile.tracks['1'].frames[0]);
  assert.equal(filmedFaceAtTime(profile,{...opening,sha256:'0'.repeat(64)},51/24),null);
  assert.equal(filmedFaceAtTime(profile,opening,NaN),null);
});

test('hole stays face down without a fabricated track and flip starts at its own VILA frame',()=>{
  const hole=take('hole:i'),flip=take('flip:base');
  assert.equal(hole.startPose,'VILA');assert.equal(hole.endPose,'VILA');
  assert.equal(filmedFaceAtTime(profile,hole,60/24),null);
  assert.equal(flip.offsetFrames,0);assert.equal(flip.startPose,'VILA');assert.equal(flip.endPose,'VILA');
  assert.equal(filmedFaceAtTime(profile,flip,14/24),null);
  assert.equal(filmedFaceAtTime(profile,flip,15/24),profile.tracks.flip.frames[0]);
});

test('malformed geometry, hash aliases and impossible source timing fail closed',()=>{
  for(const mutate of [
    p=>p.takes.push({...p.takes[0]}),p=>p.takes[0].sha256='not-a-hash',
    p=>p.takes[0].offsetFrames=p.takes[0].frames,p=>p.takes[0].clearFrame=p.takes[0].frames,
    p=>p.takes[0].firstFaceFrame++,p=>p.plane.fps=0,p=>p.positions['1'].cx=Infinity,
    p=>p.tracks['1'].frames[0].q[0][0]=NaN,p=>p.tracks['1'].frames[0].paper[0]=300,
    p=>p.takes[0].repositoryPath='../wrong',p=>p.accepted=true,
  ]){const changed=structuredClone(profile);mutate(changed);assert.throws(()=>validateFilmedDealProfile(changed));}
});

test('a later explicitly reviewed release cue is optional and cannot leave the actual take',()=>{
  const changed=structuredClone(profile),first=changed.takes[0];first.releaseFrame=first.clearFrame+1;
  assert.equal(validateFilmedDealProfile(changed),changed);
  for(const value of [NaN,first.firstFaceFrame-1,first.frames-1,1.5]){
    first.releaseFrame=value;assert.throws(()=>validateFilmedDealProfile(changed));
  }
  assert.ok(profile.takes.every(take=>!Object.hasOwn(take,'releaseFrame')));
});
