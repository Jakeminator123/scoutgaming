// Renderer regression cases adapted from Kevin review commit 0d12b7a559d328a333598b7e583b980e88d7925c; see card-presentation/README.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calibration } from '../web/public/card-presentation/calibration.mjs';
import { createCardCursor, createLocalCardOverlay } from '../web/public/local-card-overlay.mjs';
import { firstFaceTime } from '../web/public/card-presentation/card-face-projection.js';

test('all ten calibrations remain bound to the actual local MP4 bytes', () => {
  assert.equal(calibration.videos.length, 10);
  for (const video of calibration.videos) {
    const bytes = readFileSync(new URL(`../media/dealers/astrid/runtime/presentation/${video.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), video.sha256, video.path);
  }
});

test('cursor exposes only presented draws, preserves hole privacy, and rejects stale/replaced clips', () => {
  const { svg, cards } = setup(), cursor = createCardCursor(cards), round = fixture();
  cursor.sync(round);
  const video = calibration.videos.find(v => v.track === '4');
  const event = { to: 'box', box: 3, shoeDraw: 1, handIndex: 0 };
  const token = cursor.begin(video, event);
  cursor.frame(token, firstFaceTime('4') - 1/24); assert.equal(draw(svg, 1), undefined);
  cursor.frame(token, firstFaceTime('4')); assert.ok(draw(svg, 1)); assert.equal(draw(svg, 3), undefined);
  cursor.frame(token, DEAL_CONTACT['4'].clear);
  assert.equal(cursor.finish(token, 1, true), true);
  const alternate = cursor.begin({ sha256: 'not-the-measured-video' }, { ...event, shoeDraw: 3 });
  cursor.frame(token, 4); cursor.frame(alternate, 4); assert.equal(draw(svg, 3), undefined);
  assert.equal(cursor.finish(alternate, 3, true), false); assert.ok(draw(svg, 3));
  const hidden = cursor.begin(calibration.videos.find(v => v.track === 'dealer'), { to: 'dealer', shoeDraw: 4, faceDown: true });
  cursor.frame(hidden, 4); assert.equal(draw(svg, 4), undefined);
  assert.equal(cursor.finish(hidden, 4, true), false); assert.equal(draw(svg, 4).attrs['data-card'], 'hidden');
  cursor.clear(); cursor.frame(hidden, 10); cursor.finish(hidden, 4, true); assert.equal(draw(svg, 4), undefined);
});

test('restore, split and revealed hole follow the server snapshot without exposing new split draws', () => {
  const { svg, cards } = setup(), cursor = createCardCursor(cards);
  cursor.restore(fixture()); assert.ok(draw(svg, 1)); assert.equal(draw(svg, 4).attrs['data-card'], 'hidden');
  const split = splitFixture(); cursor.sync(split, 0);
  assert.ok(draw(svg, 1)); assert.ok(draw(svg, 3)); assert.equal(draw(svg, 5), undefined); assert.equal(draw(svg, 6), undefined);
  split.dealer.push(card('K', '♥', 4)); cursor.reveal(split); assert.equal(draw(svg, 4).attrs['data-card'], 'K♥');
  cursor.restore(split); assert.ok(draw(svg, 5)); assert.ok(draw(svg, 6)); assert.equal(draw(svg, 4).attrs['data-card'], 'K♥');
});

test('hole and flip use their exact measured frames without exposing the committed hidden value early', () => {
  const { svg, cards } = setup(), cursor = createCardCursor(cards), round = fixture();
  cursor.restore(round);
  const hole = cursor.begin(calibration.videos.find(v => v.track === 'hole'), { type: 'deal', to: 'dealer', faceDown: true, shoeDraw: 4 });
  cursor.frame(hole, 44 / 24); assert.equal(draw(svg, 4), undefined);
  cursor.frame(hole, 45 / 24); assert.equal(draw(svg, 4).attrs['data-card'], 'hidden');
  assert.equal(cursor.finish(hole, 4, true), true);
  round.dealer.push(card('K', '♥', 4)); cursor.sync(round);
  assert.equal(draw(svg, 4).attrs['data-card'], 'hidden');
  const flip = cursor.begin(calibration.videos.find(v => v.track === 'flip'), { type: 'reveal', to: 'dealer', shoeDraw: 4 });
  cursor.frame(flip, 30 / 24); assert.equal(draw(svg, 4).attrs['data-card'], 'hidden');
  cursor.frame(flip, 31 / 24); assert.equal(draw(svg, 4).attrs['data-card'], 'K♥');
  assert.equal(cursor.finish(flip, 4, true), true);
});

test('a retried film hides its half-presented incoming face and ignores the old frames', () => {
  const { svg, cards } = setup(), cursor = createCardCursor(cards);
  cursor.sync(fixture());
  const video = calibration.videos.find(v => v.track === '4'), event = { to: 'box', box: 3, shoeDraw: 1 };
  const first = cursor.begin(video, event); cursor.frame(first, 2); assert.ok(draw(svg, 1));
  const retry = cursor.begin(video, event); assert.equal(draw(svg, 1), undefined);
  cursor.frame(first, 3); assert.equal(draw(svg, 1), undefined);
  cursor.frame(retry, 2); assert.ok(draw(svg, 1));
  assert.equal(cursor.finish(first, 1, true), false); assert.equal(cursor.finish(retry, 1, true), true);
});
import { createGameCards } from '../web/public/card-presentation/game-cards.js';
import { DEAL_CONTACT } from '../web/public/card-presentation/card-table-layout.js';
import { dealerHandClip } from '../web/public/card-presentation/dealer-hand-occlusion.js';
import { totalLabel } from '../web/public/card-presentation/renderer-support.js';

test('soft totals display both values until 21, with no extra ace value on hard or busted hands', () => {
  const cards = (...ranks) => ranks.map(r => ({ r }));
  for (const [ranks, label] of [
    [['A', '6'], '7/17'], [['A', 'A'], '2/12'], [['A', '2', '3'], '6/16'],
    [['A', 'A', '9'], '21'], [['A', 'K'], '21'], [['K', '7'], '17'],
    [['A', '6', '9'], '16'], [['K', '9', '5'], '24'], [[], '0'],
  ]) assert.equal(totalLabel(cards(...ranks)), label);
});

// Minimal SVG tree: records removals, including re-appending an existing node.
// This tests renderer lifetime/occlusion, not browser paint or video decoding.
class Node {
  constructor(tag) { this.tag=tag; this.attrs={}; this.children=[]; this.style={}; this.removals=0; }
  setAttribute(k,v) { this.attrs[k]=String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  append(...nodes) { for(const n of nodes) this.insertBefore(n,null); }
  insertBefore(n,next) {
    if(n.parent) n.remove();
    const i=next?this.children.indexOf(next):this.children.length;
    this.children.splice(i,0,n); n.parent=this;
  }
  remove() {
    if(this.parent) { this.parent.children.splice(this.parent.children.indexOf(this),1); this.parent=null; this.removals++; }
  }
  replaceChildren(...nodes) { for(const n of [...this.children])n.remove(); this.append(...nodes); }
  cloneNode(deep) {
    const n=new Node(this.tag); n.attrs={...this.attrs};n.textContent=this.textContent;
    if(deep)n.append(...this.children.map(c=>c.cloneNode(true))); return n;
  }
}
globalThis.document={createElementNS:(_ns,tag)=>new Node(tag)};
const manifest={deal:Object.entries(calibration.positions).map(([id,kort])=>({id:`deal_pos${id}`,kort})),kort_storlek:{bredd:calibration.width,hojd:calibration.height}};
const all=n=>[n,...n.children.flatMap(all)];
const card=(r,s,shoeDraw)=>({r,s,shoeDraw});
const fixture=()=>({phase:'decisions',active:0,holeDraw:4,dealer:[card('6','♣',2)],hands:[{box:3,cards:[card('4','♥',1),card('7','♠',3)]}]});
function setup(){const svg=new Node('svg');svg.id='test';return {svg,cards:createGameCards(svg,manifest)};}
test('rendered badges use only visible cards, fit soft split totals and keep dealer fan clearance', () => {
  const { svg, cards } = setup(), round = splitFixture();
  round.dealer = [card('A', '♣', 2), card('K', '♥', 4)];
  round.hands[0].cards = [card('A', '♥', 1), card('6', '♣', 5)];
  const visible = new Set([1, 2, 3, 4, 5, 6]);
  cards.render(round, visible, false, 0);
  const badges = () => all(svg).filter(node => node.attrs['aria-label']);
  const dealer = badges().find(node => node.attrs['data-seat'] === 'dealer');
  assert.equal(dealer.children[1].textContent, '1/11', 'the hidden king must not affect the total');
  assert.match(dealer.attrs['aria-label'], /: 1\/11$/);
  const dealerRight = Number(dealer.attrs.transform.match(/translate\(([-\d.]+)/)[1]) + Number(dealer.children[0].attrs.width) / 2;
  round.dealer[0] = card('6', '♣', 2);
  cards.render(round, visible, false, 0);
  const hardDealer = badges().find(node => node.attrs['data-seat'] === 'dealer');
  assert.equal(Number(hardDealer.attrs.transform.match(/translate\(([-\d.]+)/)[1]) + Number(hardDealer.children[0].attrs.width) / 2, dealerRight);
  const player = badges().find(node => node.attrs['data-seat'] === '4' && node.attrs['data-hand'] === '0');
  assert.equal(player.children[1].textContent, 'HAND 1');
  assert.equal(player.children[2].textContent, '7/17');
  assert.match(player.attrs['aria-label'], /7\/17, active hand$/);
  assert.ok(Number(player.children[0].attrs.width) >= '10/20'.length * 20 * .6 + 8);
  round.dealer[0] = card('A', '♣', 2);
  cards.render(round, visible, true, 0);
  assert.equal(badges().find(node => node.attrs['data-seat'] === 'dealer').children[1].textContent, '21');
});

test('two to four split total badges do not overlap after focus changes or compact seat offsets', () => {
  const bounds = node => {
    const [x, y] = node.attrs.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const rect = node.children[0];
    return { x: x + Number(rect.attrs.x), y: y + Number(rect.attrs.y), width: Number(rect.attrs.width), height: Number(rect.attrs.height) };
  };
  for (const count of [2, 3, 4]) for (const offset of [0, 120]) {
    const { svg, cards } = setup();
    const round = { ...fixture(), hands: Array.from({ length: count }, (_, index) => ({ box: 3,
      cards: [card('A', '♥', 10 + index * 2), card('9', '♣', 11 + index * 2)] })) };
    const visible = new Set([2, 4, ...round.hands.flatMap(hand => hand.cards.map(card => card.shoeDraw))]);
    cards.setSeatOffsets({ '4': offset });
    for (let focus = 0; focus < count; focus++) {
      round.active = focus;
      cards.render(round, visible, false, focus);
      const badges = all(svg).filter(node => node.attrs['data-seat'] === '4' && node.attrs['aria-label']);
      assert.equal(badges.length, count);
      for (let i = 0; i < badges.length; i++) {
        const a = bounds(badges[i]);
        assert.equal(badges[i].children[2].textContent, '10/20');
        for (let j = i + 1; j < badges.length; j++) {
          const b = bounds(badges[j]);
          assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
            `${count} split hands, focus ${focus}, offset ${offset}: badges ${i + 1}/${j + 1} overlap`);
        }
      }
    }
  }
});
test('resize during a calibrated deal revokes contact while preserving the server draw',()=>{
  const {svg,cards}=setup();let aligned=true;
  const cursor=createCardCursor(cards,{canTrack:()=>aligned});cursor.sync(fixture());
  const token=cursor.begin(calibration.videos.find(v=>v.track==='4'),{to:'box',box:3,shoeDraw:1,handIndex:0});
  cursor.frame(token,DEAL_CONTACT[4].contact);aligned=false;cursor.reproject();
  cursor.frame(token,DEAL_CONTACT[4].clear);assert.equal(cursor.finish(token,1,true),false);
  assert.ok(draw(svg,1));assert.equal(draw(svg,1).children[1].attrs.visibility,'hidden');
});
test('mobile card reflow retains exact draws, split hands and hidden hole through desktop restoration',()=>{
  const host=new Node('div');host.dataset={};const overlay=createLocalCardOverlay(host),round=splitFixture();overlay.restore(round);
  const svg=host.children[0],original=draw(svg,1),hole=draw(svg,4);
  const projection={x:0,y:100,scale:.5,adjusted:true,offsets:{'4':120},boxes:[2,3,4]};
  overlay.setProjection(projection,390,844);
  assert.equal(draw(svg,1),original);assert.equal(hole.attrs['data-card'],'hidden');
  assert.equal(draw(svg,5).attrs.transform,'translate(660.000 1115.000)');
  assert.notEqual(draw(svg,6).attrs.transform,draw(svg,5).attrs.transform);
  overlay.setProjection({x:0,y:0,scale:1,adjusted:false,offsets:{},boxes:[0,1,2,3,4,5,6]},1920,1080);
  assert.equal(draw(svg,1),original);assert.equal(draw(svg,5).attrs.transform,'translate(540.000 1115.000)');
  assert.equal(hole.attrs['data-card'],'hidden');overlay.close();assert.equal(host.children.length,0);
});
const draw=(svg,id)=>all(svg).find(n=>n.attrs['data-draw']===String(id));

test('filmed hand clips every existing card and keeps moving after the incoming face locks',()=>{
  const {svg,cards}=setup(),round=fixture(),visible=new Set([1,2,3,4]);
  cards.render(round,visible,false,0);
  const layer=all(svg).find(n=>n.attrs.class==='card-layer');
  const clip=all(svg).find(n=>n.attrs.id==='test-felt-hands');
  const path=clip.children[0],first=draw(svg,2);
  assert.equal(layer.attrs['clip-path'],'url(#test-felt-hands)');
  assert.equal(path.attrs['clip-rule'],'evenodd');
  for(const seat of ['dealer','1','4','7']) {
    cards.beginDeal(seat,4);
    for(const f of [24,32,48,51,52,56,32]) {
      cards.advanceDeal(f/24);
      assert.equal(path.attrs.d,dealerHandClip(seat,f/24));
      assert.equal(draw(svg,2),first);assert.equal(first.removals,0);
    }
    cards.endDeal();assert.equal(path.attrs.d,dealerHandClip());
    cards.beginDeal(seat,4);cards.advanceDeal(32/24);
    cards.sourceStarted('idle');assert.equal(path.attrs.d,dealerHandClip());
  }
  cards.beginDeal('dealer',4);cards.advanceDeal(32/24);
  cards.render(null,new Set(),false,null);
  assert.equal(path.attrs.d,dealerHandClip());
});

test('existing opening-round cards are never detached when later draws arrive or a hole is revealed',()=>{
  const {svg,cards}=setup(),round=fixture();
  cards.render(round,new Set([1]),false,0);const first=draw(svg,1);
  cards.render(round,new Set([1,2]),false,0);const dealer=draw(svg,2);
  cards.render(round,new Set([1,2,3]),false,0);
  cards.render(round,new Set([1,2,3,4]),false,0);const hole=draw(svg,4);
  for(let i=0;i<10;i++)cards.render(round,new Set([1,2,3,4]),false,0);
  round.dealer.push(card('9','♦',4));cards.render(round,new Set([1,2,3,4]),true,0);
  for(const n of [first,dealer,hole])assert.equal(n.removals,0);
  const layer=all(svg).find(n=>n.attrs.class==='card-layer');
  assert.deepEqual(layer.children.map(n=>n.attrs['data-draw']),['2','4','1','3']);
});

test('hidden card matches the filmed opaque Scout back, without exposing its value',()=>{
  const {svg,cards}=setup(),round=fixture();
  cards.render(round,new Set([1,2,3,4]),false,0);
  const hole=draw(svg,4),face=hole.children[0];
  assert.equal(face.children[0].tag,'rect');
  assert.equal(face.children[0].attrs.fill,'#050404');
  assert.equal(face.children[0].attrs.width,'63');assert.equal(face.children[0].attrs.height,'85');
  assert.equal(face.children[1].tag,'image');
  assert.equal(face.children[1].attrs.href,'/media/game/runtime/cards/back-scout.png');
  assert.ok(!all(hole).some(n=>n.tag==='text'));
});

test('actual renderer keeps dealer upcard, hole and later draws on the felt after reveal and reload',()=>{
  const {svg,cards}=setup(),round=fixture(),visible=new Set([1,2,3]);
  const xy=n=>n.attrs.transform.match(/-?\d+\.\d+/g).map(Number);
  cards.render(round,visible,false,0);
  const first=draw(svg,2),playerPosition=draw(svg,1).attrs.transform;
  for(const id of [4,5,6,7,8]) {
    if(id!==4)round.dealer.push(card('A','♦',id));
    cards.render(round,visible,id!==4,0);
    cards.beginDeal('dealer',id);
    cards.advanceDeal(DEAL_CONTACT.dealer.contact+.2);
    visible.add(id);cards.render(round,visible,id!==4,0);
    cards.advanceDeal(DEAL_CONTACT.dealer.clear);cards.endDeal();
    assert.deepEqual(xy(draw(svg,id)),[540,895]);
    if(id===4) {
      round.dealer.push(card('2','♣',4));cards.render(round,visible,true,0);
      assert.equal(draw(svg,4).attrs['data-card'],'2♣');
    }
    for(const c of round.dealer)assert.equal(xy(draw(svg,c.shoeDraw))[1],895);
    const left=Math.min(...round.dealer.map(c=>xy(draw(svg,c.shoeDraw))[0]))-31.5;
    const badge=all(svg).find(n=>n.attrs['aria-label']?.startsWith('Astrid:'));
    const badgeX=Number(badge.attrs.transform.match(/translate\(([-\d.]+)/)[1]);
    assert.ok(badgeX+29<left,'dealer total remains clear of the wider fan');
    assert.equal(draw(svg,1).attrs.transform,playerPosition);
    assert.equal(first.removals,0);
  }
  const reloaded=setup();cards.sourceStarted();
  reloaded.cards.render(round,visible,true,0);
  for(const c of round.dealer)assert.deepEqual(xy(draw(reloaded.svg,c.shoeDraw)),xy(draw(svg,c.shoeDraw)));
  cards.render(null,new Set(),false,null);
  assert.ok(!draw(svg,2));
});

test('each card locks on finger-release and stays identical through the final frame and source handoff',()=>{
  for(const seat of ['1','2','3','4','5','6','7','dealer']){
    const {svg,cards}=setup(),hidden=seat==='dealer';
    const hand=[card('K','♥',1)];
    const round={phase:'decisions',active:0,holeDraw:hidden?1:null,dealer:[],hands:hidden?[]:[{box:Number(seat)-1,cards:hand}]};
    cards.beginDeal(seat,1);cards.advanceDeal(DEAL_CONTACT[seat].clear-1/24);
    cards.render(round,new Set([1]),!hidden,0);const n=draw(svg,1);
    assert.equal(n.children[1].attrs.visibility,'visible');
    cards.advanceDeal(DEAL_CONTACT[seat].clear);
    // Compare just the face attributes/geometry to avoid parent cycles.
    const snapshot=()=>JSON.stringify(all(n.children[0]).map(e=>({tag:e.tag,attrs:e.attrs})));
    const expected=snapshot();
    assert.equal(n.children[0].attrs.visibility,'visible');assert.equal(n.children[1].attrs.visibility,'hidden');
    for(let f=DEAL_CONTACT[seat].clearFrame+1;f<=90;f++){
      cards.advanceDeal(f/24);assert.equal(snapshot(),expected);
      assert.equal(n.children[1].attrs.visibility,'hidden');
    }
    cards.endDeal();cards.sourceStarted('idle');assert.equal(snapshot(),expected);
  }
});

function splitFixture() {
  return { ...fixture(), hands:[
    {box:3,cards:[card('8','♥',1),card('3','♣',5)]},
    {box:3,cards:[card('8','♠',3),card('2','♦',6)]},
  ] };
}

test('split retains every original and new card while focus, active hand and settlement change',()=>{
  const {svg,cards}=setup(),before=fixture(),visible=new Set([1,2,3,4]);
  cards.render(before,visible,false,0);
  const originals=[draw(svg,1),draw(svg,3)];
  const round=splitFixture();
  cards.render(round,visible,false,0);
  assert.equal(draw(svg,1),originals[0]);assert.equal(draw(svg,3),originals[1]);
  visible.add(5);visible.add(6);
  for(const focus of [0,1,null,1,0]) {
    round.active=focus===1?1:0;
    cards.render(round,visible,false,focus);
    assert.equal(all(svg).filter(n=>n.attrs.class==='playing-card').length,6);
    for(const id of [1,2,3,4,5,6])assert.ok(draw(svg,id),`draw ${id} remains on table`);
    assert.notEqual(draw(svg,5).attrs.transform,draw(svg,6).attrs.transform);
  }
  round.phase='settled';cards.render(round,visible,false,null);
  assert.equal(all(svg).filter(n=>n.attrs.class==='playing-card').length,6);
  for(const n of originals)assert.equal(n.removals,0);
});

test('a split deal moves only its receiving hand; the other hand stays visible and still',()=>{
  const {svg,cards}=setup(),round=splitFixture(),visible=new Set([1,2,3,4]);
  cards.render(round,visible,false,0);
  const other=draw(svg,3),position=other.attrs.transform;
  cards.beginDeal('4',5);cards.advanceDeal(DEAL_CONTACT[4].contact+.2);
  assert.equal(draw(svg,3),other);assert.equal(other.attrs.transform,position);
  visible.add(5);cards.render(round,visible,false,0);
  const incoming=draw(svg,5);
  assert.equal(incoming.attrs.transform,'translate(540.000 1115.000)');
  cards.advanceDeal(DEAL_CONTACT[4].clear);cards.endDeal();
  assert.equal(draw(svg,3),other);assert.equal(other.attrs.transform,position);
});

test('four split hands survive reload, hand changes and collection with separate full-size cards',()=>{
  const round={...splitFixture(),hands:Array.from({length:4},(_,i)=>({box:3,cards:[card('8','♥',10+i*2),card('3','♣',11+i*2)]}))};
  const visible=new Set([2,4,...round.hands.flatMap(h=>h.cards.map(c=>c.shoeDraw))]);
  for(const focus of [0,1,2,3,null]) {
    const {svg,cards}=setup();cards.render(round,visible,false,focus);
    assert.equal(all(svg).filter(n=>n.attrs.class==='playing-card').length,10);
    assert.equal(new Set(round.hands.map(h=>draw(svg,h.cards.at(-1).shoeDraw).attrs.transform)).size,4);
    for(const hand of round.hands)for(const c of hand.cards){
      const face=draw(svg,c.shoeDraw).children[0].children[0];
      assert.equal(face.attrs.width,'63');assert.equal(face.attrs.height,'85');
    }
    round.phase='settled';cards.render(round,visible,false,focus);
    assert.equal(all(svg).filter(n=>n.attrs.class==='playing-card').length,10);
    cards.render(null,new Set(),false,null);
    assert.equal(all(svg).filter(n=>n.attrs.class==='playing-card').length,0);
  }
});

 test('flip hides the drawn back until reveal and never slides or reserves a new dealer slot',()=>{
 const {svg,cards}=setup(),round=fixture(),visible=new Set([1,2,3,4]);cards.render(round,visible,false,0);
 const up=draw(svg,2),hole=draw(svg,4),start=up.attrs.transform;
 assert.equal(start,'translate(474.000 895.000)');cards.beginDeal('dealer',4,'flip');
 for(const frame of [0,10,20,30]){cards.advanceDeal(frame/24);assert.equal(hole.attrs.display,'none');assert.equal(up.attrs.transform,start);}
 round.dealer.push(card('10','♣',4));cards.render(round,visible,true,0);cards.advanceDeal(31/24);
 assert.equal(hole.attrs.display,'inline');assert.equal(hole.attrs['data-card'],'10♣');assert.equal(up.attrs.transform,start);
 });
