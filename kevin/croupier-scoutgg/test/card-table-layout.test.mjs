import test from 'node:test';
import assert from 'node:assert/strict';
import { DEAL_CONTACT, DEAL_FPS, SLIDE_SECONDS, cardPose, feltMatrix, splitHandAnchor } from '../public/card-table-layout.js';
import { firstFaceTime, faceAtTime, triangleMatrices } from '../public/card-face-projection.js';
import { CARD_FACE_TRACKS } from '../public/card-face-tracks.js';

const anchor = { cx: 540, cy: 1115 };
const pose = (index, count, time, incomingIndex = count - 1) => cardPose({ index, count, anchor, time, incomingIndex, contact: DEAL_CONTACT[4].contact });

test('first card slides diagonally up-left from contact; landing and scale stay fixed', () => {
  const t=DEAL_CONTACT[4].contact;
  assert.deepEqual(pose(0,2,0),anchorPose());
  assert.deepEqual(pose(0,2,t),anchorPose());
  const mid=pose(0,2,t+SLIDE_SECONDS/2);
  assert.ok(mid.x<540 && mid.x>510);assert.ok(mid.y<1115 && mid.y>1089);
  assert.deepEqual(pose(0,2,t+SLIDE_SECONDS),{x:510,y:1089});
  assert.deepEqual(pose(1,2,t+.1),anchorPose());
});
function anchorPose(){return {x:540,y:1115};}

test('dealer cards stay below her hands and above player seats, through every contact frame',()=>{
  const anchor={cx:540,cy:895},contact=DEAL_CONTACT.dealer.contact;
  // Stress beyond ordinary dealer hands; bound the complete 63 x 85 card.
  for(let count=1;count<=22;count++)for(let frame=0;frame<=75;frame++) {
    const time=frame/24;
    for(let index=0;index<count;index++) {
      const p=cardPose({index,count,anchor,seat:'dealer',incomingIndex:count-1,time,contact});
      assert.ok(p.x-31.5>=328.5 && p.x+31.5<=571.5);
      assert.equal(p.y-42.5,852.5);assert.equal(p.y+42.5,937.5);
      if(index===count-1)assert.deepEqual(p,{x:540,y:895});
      else if(time<=contact)assert.deepEqual(p,cardPose({index,count:count-1,anchor,seat:'dealer'}));
      else if(time>=contact+SLIDE_SECONDS)assert.ok(Math.abs(p.x-cardPose({index,count,anchor,seat:'dealer'}).x)<1e-6);
    }
  }
});

test('long diagonal hands remain within their seat and never cross neighboring hands',()=>{
  const seats=[110,253,396,540,684,827,970];
  for(let count=2;count<=12;count++){
    let previousRight=0;
    for(const cx of seats){
      const cards=Array.from({length:count},(_,index)=>cardPose({index,count,anchor:{cx,cy:1115}}));
      const left=Math.min(...cards.map(c=>c.x))-31.5;
      const right=Math.max(...cards.map(c=>c.x))+31.5;
      assert.ok(left>previousRight+10);assert.ok(right<1080);
      assert.ok(Math.min(...cards.map(c=>c.y))>=1005);
      assert.deepEqual(cards.at(-1),{x:cx,y:1115});
      previousRight=right;
    }
  }
});

test('subsequent cards continue from the preceding layout without a reveal jump',()=>{
  const t=DEAL_CONTACT[4].contact;
  for(let count=3;count<=12;count++)for(let index=0;index<count-1;index++){
    const previous=cardPose({index,count:count-1,anchor});
    assert.deepEqual(pose(index,count,t),previous);
    const final=pose(index,count,t+1),rest=cardPose({index,count,anchor});
    assert.ok(Math.abs(final.x-rest.x)<1e-6 && Math.abs(final.y-rest.y)<1e-6);
    assert.ok(pose(index,count,t+.1).y<=previous.y);
    assert.ok(pose(index,count,t+.1).x<=previous.x);
  }
});

test('pause, seek and repeated callbacks do not accumulate movement',()=>{
  const t=DEAL_CONTACT[4].contact+.15,before=pose(0,3,t);
  for(let i=0;i<30;i++)assert.deepEqual(pose(0,3,t),before);
  pose(0,3,t+.4);assert.deepEqual(pose(0,3,t),before);
});

test('already projected source dimensions do not receive perspective twice',()=>{
  assert.deepEqual(feltMatrix(),[1,0,0,1,0,0]);
});

test('split lanes retain the landing and stay separate from neighboring seats, including four hands',()=>{
  const seats=[110,253,396,540,684,827,970];
  for(const splitCount of [2,3,4])for(const count of [2,4,8,12]) {
    let previousRight=0;
    for(const cx of seats) {
      const lanes=Array.from({length:splitCount},(_,slot)=> {
        const a=splitHandAnchor({cx,cy:1115},slot);
        const poses=Array.from({length:count},(_,index)=>cardPose({index,count,anchor:a,splitCount}));
        return {left:a.cx-31.5,right:a.cx+31.5,top:Math.min(...poses.map(p=>p.y))-42.5,bottom:a.cy+42.5};
      });
      assert.ok(Math.min(...lanes.map(l=>l.left))>previousRight+5);
      assert.ok(Math.max(...lanes.map(l=>l.right))<1080);
      for(let i=0;i<lanes.length;i++)for(let j=i+1;j<lanes.length;j++) {
        const a=lanes[i],b=lanes[j];
        assert.ok(a.right<b.left || b.right<a.left || a.bottom<b.top || b.bottom<a.top);
      }
      assert.deepEqual(splitHandAnchor({cx,cy:1115},0),{cx,cy:1115});
      previousRight=Math.max(...lanes.map(l=>l.right));
    }
  }
});

test('every source starts face artwork at its first white frame, before hand-clear',()=>{
  for(const [seat,track] of Object.entries(CARD_FACE_TRACKS)){
    assert.equal(firstFaceTime(seat),track.firstFrame/DEAL_FPS);
    assert.equal(faceAtTime(seat,(track.firstFrame-1)/24),null);
    assert.equal(faceAtTime(seat,Number((track.firstFrame/24).toFixed(6))),track.frames[0]);
    assert.ok(firstFaceTime(seat)<DEAL_CONTACT[seat].clear);
    assert.ok(DEAL_CONTACT[seat].contact<firstFaceTime(seat));
    for(const f of track.frames){
      assert.equal(f.q.length,4);assert.ok(f.p.length>=3);assert.ok(f.body.length>=3);
      assert.equal(f.paper.length,3);assert.ok(f.paper.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
      for(const point of [...f.q,...f.p])for(const coord of point)assert.ok(Number.isFinite(coord)&&Math.abs(coord)<250);
    }
  }
});

test('both projected triangles hit all four measured corners, sharing the diagonal',()=>{
  const w=63,h=85;
  for(const track of Object.values(CARD_FACE_TRACKS))for(const f of track.frames){
    const matrices=triangleMatrices(f.q,w,h);
    const local=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
    for(const [i,indices] of [[0,[0,1,2]],[1,[0,2,3]]])for(const j of indices){
      const [a,b,c,d,e,g]=matrices[i],[x,y]=local[j];
      assert.ok(Math.abs(a*x+c*y+e-f.q[j][0])<1e-6);
      assert.ok(Math.abs(b*x+d*y+g-f.q[j][1])<1e-6);
    }
  }
});

// In these measured frames the hand occludes the corner, but the card's top
// edge stays essentially fixed. A thumb notch must not yank the printed face.
test('dealer thumb occlusion does not become a jumping card corner',()=>{
  const track=CARD_FACE_TRACKS.dealer;
  const frames=track.frames.slice(43-track.firstFrame,49-track.firstFrame);
  const right=frames.map(f=>f.q[1][0]);
  assert.ok(Math.max(...right)-Math.min(...right)<3);
  for(let i=1;i<frames.length;i++)for(let corner=0;corner<4;corner++){
    assert.ok(Math.hypot(...[0,1].map(d=>frames[i].q[corner][d]-frames[i-1].q[corner][d]))<3);
  }
});
