import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DEALER_HAND_TRACKS } from '../public/dealer-hand-tracks.js';
import { dealerHandClip } from '../public/dealer-hand-occlusion.js';

function inside([x,y], polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [a,b]=polygon[i],[c,d]=polygon[j];
    if((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a)result=!result;
  }
  return result;
}
const covered=(frame,point)=>DEALER_HAND_TRACKS.dealer[frame].some(p=>inside(point,p));

test('hand contour covers the filmed fingers without hiding exposed card paper',()=>{
  // Source-frame probes from the reported overlap, not card layout bounds.
  assert.ok(covered(32,[520,865]));assert.ok(covered(32,[525,893]));
  assert.ok(!covered(32,[475,900]));
  assert.ok(covered(48,[554,863]));assert.ok(!covered(48,[540,910]));
  assert.ok(covered(51,[573,853]),'hand tracking continues after the face locks');
  assert.ok(!covered(56,[520,865]),'card is uncovered after the hand withdraws');
});

test('all dealing tracks match the exact source media and stay in the dealer region',()=>{
  const root=new URL('../',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('public/media/manifest.json',root)));
  const metrics=JSON.parse(readFileSync(new URL('review/2026-09-28-hand-occlusion/measurements.json',root)));
  for(const clip of manifest.deal) {
    const seat=({'deal_hole':'hole','deal_flip':'flip'})[clip.id]??clip.id.replace('deal_pos',''),frames=DEALER_HAND_TRACKS[seat];
    assert.equal(frames.length,metrics[seat].frames);assert.equal(metrics[seat].fps,24);
    assert.equal(createHash('sha256').update(readFileSync(new URL('public'+clip.url,root))).digest('hex'),metrics[seat].sha256);
    for(const polygons of frames)for(const p of polygons) {
      assert.ok(p.length>=3);
      for(const [x,y] of p)assert.ok(x>=326&&x<575&&y>=850&&y<940);
    }
  }
});

test('source frame selection is deterministic on pause, seek, restart and missing clips',()=>{
  const empty=dealerHandClip();
  for(const [seat,frames] of Object.entries(DEALER_HAND_TRACKS)) {
    for(let f=0;f<frames.length;f++) {
      const path=dealerHandClip(seat,f/24);
      assert.equal(dealerHandClip(seat,(f+.9)/24),path);
      assert.ok(path.startsWith(empty));
    }
    assert.equal(dealerHandClip(seat,1e6),dealerHandClip(seat,(frames.length-1)/24));
  }
  for(const time of [undefined,NaN,-1,Infinity])assert.equal(dealerHandClip('dealer',time),empty);
  assert.equal(dealerHandClip('idle',1),empty);
});
