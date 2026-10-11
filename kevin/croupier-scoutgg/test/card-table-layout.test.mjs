import test from 'node:test';
import assert from 'node:assert/strict';
import { DEAL_CONTACT, DEAL_FPS, SLIDE_SECONDS, cardPose, feltMatrix, splitHandAnchor } from '../public/card-table-layout.js';
import { firstFaceTime, faceAtTime, faceTriangles, GRID, triangleMatrices } from '../public/card-face-projection.js';
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

test('the corner-pin mesh hits all four measured corners and its triangles meet without seams',()=>{
  const w=63,h=85,local=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
  const at=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  for(const track of Object.values(CARD_FACE_TRACKS))for(const f of track.frames){
    const matrices=triangleMatrices(f.q,w,h),triangles=faceTriangles(w,h),seen=new Map();
    assert.equal(matrices.length,2*GRID*GRID);
    triangles.forEach((t,i)=>t.forEach(p=>{
      const q=at(matrices[i],p),key=p.join(),j=local.findIndex(c=>c.join()===key);
      if(j>=0)assert.ok(Math.hypot(q[0]-f.q[j][0],q[1]-f.q[j][1])<1e-6);
      if(seen.has(key))assert.ok(Math.hypot(q[0]-seen.get(key)[0],q[1]-seen.get(key)[1])<1e-6);else seen.set(key,q);
    }));
  }
});

test('a card held in perspective is pinned by its homography, not bent along one diagonal',()=>{
  const w=78,h=106,q=[[-30,-40],[30,-40],[45,55],[-45,55]];   // a trapezoid: the top edge is further away
  const m=triangleMatrices(q,w,h),mid=faceTriangles(w,h).findIndex(t=>t[0][0]<0&&t[2][0]>0&&t[0][1]<0&&t[2][1]>0);
  // The card's centre (0,0 local) lies where the quad's diagonals cross, (0,-2); two affine triangles put it at (7.5,7.5).
  assert.ok(Math.hypot(m[mid][4],m[mid][5]+2)<1.5,`centre at ${m[mid][4]},${m[mid][5]}`);
  assert.ok(Math.hypot(m[mid][4]-7.5,m[mid][5]-7.5)>8);
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

// Keyed ready dealers (John 11 Oct: "the cards move without the hand moving them"): fixed places, nothing shifts.
test('ready dealers: a card that is down never moves; the incoming one leans from her fingers into its place as it travels', () => {
  for (const seat of ['4', 'dealer']) for (let count = 2; count <= 6; count++) {
    const rest = Array.from({ length: count }, (_, index) => cardPose({ index, count, anchor, seat, fixed: true }));
    for (let step = 0; step <= 20; step++) {
      const lean = step / 20;
      for (let index = 0; index < count - 1; index++) if (!(seat === 'dealer' && index === 0 && count === 2))   // Emil #7: her upcard makes room for the hole card (tested below)
        assert.deepEqual(cardPose({ index, count, anchor, seat, fixed: true, incomingIndex: count - 1, lean }), rest[index]);
    }
    const incoming = lean => cardPose({ index: count - 1, count, anchor, seat, fixed: true, incomingIndex: count - 1, lean });
    assert.deepEqual(incoming(0), { x: anchor.cx, y: anchor.cy });   // on its filmed track while she picks it up
    assert.deepEqual(incoming(1), rest[count - 1]);
  }
});

test('ready dealers: her hole card keeps the filmed spot; her up card and extra cards spread sideways', () => {
  const a = { cx: 540, cy: 895 };
  assert.deepEqual(cardPose({ index: 1, count: 2, anchor: a, seat: 'dealer', fixed: true }), { x: 540, y: 895 });
  const xs = Array.from({ length: 5 }, (_, index) => cardPose({ index, count: 5, anchor: a, seat: 'dealer', fixed: true }).x);
  assert.ok(xs[0] < 540 && xs.slice(1).every((x, i, all) => i === 0 || x > all[i - 1]));
});

test('ready dealers: three-card hands keep the first index readable and stay clear of the next seat', () => {
  const seats = [110, 253, 396, 540, 684, 827, 970];
  for (const cx of seats) {
    const cards = Array.from({ length: 3 }, (_, index) => cardPose({ index, count: 3, anchor: { cx, cy: 1115 }, fixed: true }));
    assert.ok(cards[1].x - cards[0].x >= 24);                     // the first card's corner index shows
    assert.ok(Math.max(...cards.map(c => c.x)) + 39 < cx + 143 - 39); // the neighbour's first card starts beyond it
    assert.ok(Math.max(...cards.map(c => c.x)) + 39 <= 1080);
  }
});

test("Emil #7: her upcard stays on its filmed spot until the hole card slides in, then moves aside with it", () => {
  const a = { cx: 540, cy: 895 }, up = (count, incomingIndex, lean) => cardPose({ index: 0, count, anchor: a, seat: 'dealer', fixed: true, incomingIndex, lean });
  const slot = cardPose({ index: 0, count: 2, anchor: a, seat: 'dealer', fixed: true });
  assert.deepEqual(up(1, 0, 1), { x: 540, y: 895 });                  // alone: where the film laid it, even after it rests
  assert.deepEqual(up(1, -1, 1), { x: 540, y: 895 });
  assert.deepEqual(up(2, 1, 0), { x: 540, y: 895 });                  // the hole card has not moved yet
  const half = up(2, 1, .5); assert.ok(half.x < 540 && half.x > slot.x); // moving aside with the hole card
  assert.deepEqual(up(2, 1, 1), slot);                                 // in its slot when the hole card rests
  assert.deepEqual(up(3, 2, 0), slot);                                 // and stays there for every later card
  assert.ok(slot.x < 540);
});
