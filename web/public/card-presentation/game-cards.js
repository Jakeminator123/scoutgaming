import {suitColor} from './renderer-support.js';
import { svgNode } from './renderer-support.js';
import { total } from './renderer-support.js';
import { faceAtTime, triangleMatrices } from './card-face-projection.js';
import { DEAL_CONTACT, cardPose, feltMatrix, dealerFanOffset, splitHandAnchor } from './card-table-layout.js';
import { dealerHandClip } from './dealer-hand-occlusion.js';

// One stable SVG node per server-issued draw. Motion is driven by source frames.
export function createGameCards(svg, manifest) {
  const positions = new Map(manifest.deal.map(d => [d.id.replace('deal_pos', ''), d.kort]));
  const { bredd: width, hojd: height } = manifest.kort_storlek;
  const prefix = `${svg.id || 'cards'}-felt`;
  const defs = svgNode('defs');
  const faceClip = svgNode('clipPath', {id: `${prefix}-face`, clipPathUnits:'userSpaceOnUse'});
  faceClip.append(svgNode('rect', {x:-width/2+1,y:-height/2+1,width:width-2,height:height-2,rx:3}));
  defs.append(faceClip);
  // Local triangle clips are shared; per-card visible-paper clips exclude fingers.
  for (const [i, points] of [
    [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2]],
    [[-width/2,-height/2],[width/2,height/2],[-width/2,height/2]],
  ].entries()) {
    const clip = svgNode('clipPath', {id: `${prefix}-triangle-${i}`, clipPathUnits:'userSpaceOnUse'});
    clip.append(svgNode('polygon', {points: points.map(p=>p.join(',')).join(' ')})); defs.append(clip);
  }
  const handClip = svgNode('clipPath', {id:`${prefix}-hands`,clipPathUnits:'userSpaceOnUse'});
  const handPath = svgNode('path', {'clip-rule':'evenodd',d:dealerHandClip()});
  handClip.append(handPath);defs.append(handClip);
  const cardLayer = svgNode('g', { class: 'card-layer', 'clip-path':`url(#${prefix}-hands)` }), badges = svgNode('g', { class: 'card-totals' });
  svg.replaceChildren(defs, cardLayer, badges);
  const nodes = new Map();
  let hands = [], pending = null;
  let handClipPath = dealerHandClip();

  function face(card, inkOnly = false) {
    const group = svgNode('g', { class: 'card-face' });
    if (!card.r) {
      // Match Emil's filmed back at the hole/flip handoff, in every brand.
      group.append(svgNode('rect',{x:-width/2,y:-height/2,width,height,rx:3,fill:'#050404',stroke:'#050404','stroke-width':1}));
      group.append(svgNode('image',{href:'/media/game/runtime/cards/back-scout.png',x:-width/2,y:-height/2,width,height,'aria-label':'Black Scout card back'}));
      return group;
    }
    if (!inkOnly) group.append(svgNode('rect', { x: -width/2, y: -height/2, width, height, rx: 4,
      fill: '#eaf1f2', stroke: '#c9c3af', 'stroke-width': .8 }));
    const color = suitColor(card.s);
    const ink = svgNode('g', {'clip-path': `url(#${prefix}-face)`});
    const corner = svgNode('g', { fill: color, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-weight': '700' });
    corner.append(svgNode('text', { x: -19, y: -22, 'font-size': 17 }, card.r), svgNode('text', { x: -19, y: -7, 'font-size': 16 }, card.s));
    ink.append(corner);
    const inverted = corner.cloneNode(true); inverted.setAttribute('transform', 'rotate(180)'); ink.append(inverted);
    ink.append(svgNode('text', { y: 11, 'text-anchor': 'middle', fill: color, 'font-family': 'Georgia', 'font-size': 32 }, card.s));
    group.append(ink);
    return group;
  }
  function move() {
    // Mask the complete layer in source coordinates, including already dealt
    // cards. A mask on only the incoming face leaves old cards over her fingers.
    // Keep tracking past face release until the filmed hand has withdrawn.
    const path = dealerHandClip(pending?.track, pending?.time);
    if (path !== handClipPath) { handPath.setAttribute('d', path); handClipPath = path; }
    for (const hand of hands) {
      const anchor = hand.anchor;
      const deal = pending?.track !== 'flip' && pending?.seat === hand.seat && hand.draws.has(pending.draw) ? pending : null;
      const incoming = deal ? hand.cards.findIndex(c => c.shoeDraw === deal.draw) : -1;
      // Before the incoming card becomes visible, reserve its eventual last slot.
      const count = hand.cards.length + (deal && incoming < 0 ? 1 : 0);
      hand.cards.forEach((card, index) => {
        const pose = cardPose({ index, count, anchor, width,
          incomingIndex: deal ? (incoming < 0 ? count - 1 : incoming) : -1,
          time: deal?.time, contact: deal?.contact, splitCount: hand.splitCount, seat: hand.seat });
        const entry = nodes.get(card.shoeDraw);
        const layoutKey = `${anchor.cx}:${anchor.cy}:${hand.splitCount}`;
        if (entry.pose && entry.layoutKey !== layoutKey) {
          entry.shift?.cancel();
          entry.shift = entry.group.animate?.([
            {transform:`translate(${entry.pose.x}px, ${entry.pose.y}px)`},
            {transform:`translate(${pose.x}px, ${pose.y}px)`},
          ], {duration:220,easing:'ease-out'});
        }
        entry.pose = pose; entry.layoutKey = layoutKey;

        // The prop is stationary once the fingers release it. Stop thresholding
        // its paper then: the dealer clip's neutral final frame has a broken
        // white mask, which otherwise punches flashing holes in the black back.
        const tracked = deal?.draw === card.shoeDraw && deal.time + 1e-6 < deal.clear
          ? faceAtTime(deal.track, deal.time) : null;
        const turning = pending?.track === 'flip' && pending.draw === card.shoeDraw && entry.signature === 'hidden';
        const motionKey=`${turning}:${pose.x.toFixed(3)}:${pose.y.toFixed(3)}:${tracked ? Math.floor(deal.time*24+1e-5) : 'rest'}:${entry.signature}`;
        if(entry.motionKey===motionKey)return;
        entry.motionKey=motionKey;
        entry.group.setAttribute('display', turning ? 'none' : 'inline');
        entry.group.setAttribute('transform', `translate(${pose.x.toFixed(3)} ${pose.y.toFixed(3)})`);
        entry.face.setAttribute('visibility', tracked ? 'hidden' : 'visible');
        entry.projected.setAttribute('visibility', tracked ? 'visible' : 'hidden');
        entry.group.style.filter = tracked ? 'none' : '';
        if (tracked) {
          // Source video lies below ALL game cards. Opaque visible paper must
          // cover older card ink, while its contour leaves the filmed fingers intact.
          entry.body.setAttribute('points', tracked.body.map(p=>p.join(',')).join(' '));
          const paperColor = card.r ? `rgb(${tracked.paper.join(' ')})` : '#050404';
          entry.body.setAttribute('fill', paperColor);
          // Cover the subpixel white fringe of the source prop, especially
          // visible against the black back. Artwork/finger contours stay sharp.
          entry.body.setAttribute('stroke', paperColor);
          entry.body.setAttribute('stroke-width', card.r ? .5 : 1);
          entry.paper.setAttribute('points', tracked.p.map(p=>p.join(',')).join(' '));
          triangleMatrices(tracked.q, width, height).forEach((m, i) => entry.pieces[i].setAttribute('transform', `matrix(${m.join(' ')})`));
        }
      });
    }
  }
  function sync() {
    const keep = new Set(), ordered = []; badges.replaceChildren();
    for (const hand of hands) {
      const { cx, cy } = hand.anchor;
      hand.cards.forEach(card => {
        keep.add(card.shoeDraw);
        const signature = card.r ? card.r + card.s : 'hidden';
        let entry = nodes.get(card.shoeDraw);
        if (!entry) {
          const group = svgNode('g', { class: 'playing-card', 'data-draw': card.shoeDraw });
          const clip = svgNode('clipPath', {id:`${prefix}-paper-${card.shoeDraw}`,clipPathUnits:'userSpaceOnUse'});
          const paper = svgNode('polygon');clip.append(paper);defs.append(clip);
          const projected = svgNode('g', {visibility:'hidden'});
          const body = svgNode('polygon', {class:'card-paper','stroke-linejoin':'round'});
          const ink = svgNode('g', {'clip-path':`url(#${prefix}-paper-${card.shoeDraw})`});
          projected.append(body, ink);
          entry = { group, clip, paper, projected, body, ink }; nodes.set(card.shoeDraw, entry);
        }
        if (entry.signature !== signature) {
          entry.face = face(card); entry.signature = signature;
          entry.pieces = [0,1].map(i=>{
            const piece=svgNode('g'), local=svgNode('g',{'clip-path':`url(#${prefix}-triangle-${i})`});
            local.append(face(card,true));piece.append(local);return piece;
          });
          entry.ink.replaceChildren(...entry.pieces);
          entry.group.replaceChildren(entry.face,entry.projected);
          entry.group.setAttribute('data-card', signature);
        }
        entry.group.setAttribute('data-seat', hand.seat);
        entry.group.setAttribute('data-hand', hand.index ?? 'dealer');
        entry.face.setAttribute('transform', `matrix(${feltMatrix(positions.get(hand.seat)).join(' ')})`);
        ordered.push(entry.group);
      });
      if (!hand.cards.length) continue;
      const dealer = hand.seat === 'dealer';
      const x = dealer ? cx + dealerFanOffset(0, hand.cards.length).x - 73 : cx;
      const split = hand.splitCount > 1;
      const y = dealer ? cy : cy + (split && hand.splitCount > 2 ? 32 : 60);
      const value = total(hand.cards.filter(c => c.r));
      const badge = svgNode('g', { transform: `translate(${x} ${y})`, 'data-hand':hand.index ?? 'dealer', 'data-active':Boolean(hand.active),
        'aria-label': `${dealer ? 'Astrid' : `Box ${hand.seat}${split ? ` hand ${hand.number}` : ''}`}: ${value}${hand.active ? ', active hand' : ''}` });
      badge.append(svgNode('rect', { x: -36, y: split ? -16 : -22, width: 72, height: split ? 32 : 44, rx: 22, fill: hand.active ? '#dec68e' : '#17231fe0' }),
        svgNode('text', { y: split ? 6 : 9, 'text-anchor': 'middle', fill: hand.active ? '#17231f' : '#faf4e4', 'font-size': split ? 20 : 29, 'font-family':'JetBrains Mono', 'font-weight': 500 }, `${split ? `${hand.number} · ` : ''}${value}${value > 21 ? ' ×' : ''}`));
      badges.append(badge);
    }
    for (const [draw, entry] of nodes) if (!keep.has(draw)) { entry.group.remove(); entry.clip.remove(); nodes.delete(draw); }
    // Insert only a new/out-of-order draw. Re-appending every existing SVG group
    // on each reveal invalidates its image/filter layer during the opening deal.
    ordered.forEach((group, index) => {
      if (cardLayer.children[index] !== group) cardLayer.insertBefore(group, cardLayer.children[index] ?? null);
    });
    move();
  }
  return {
    sourceStarted() { pending = null; move(); },
    beginDeal(seat, draw, track = seat) {
      seat = String(seat);
      pending = { seat, draw, track: String(track), time: 0, ...DEAL_CONTACT[track] };
      move();
    },
    advanceDeal(time) {
      if (!pending) return;
      pending.time = time; move();
    },
    endDeal() { pending = null; move(); },
    render(round, visible, revealed, focusHand) {
      hands = [];
      if (!round) {
        pending = null; sync(); return;
      }
      const dealerCards = round.dealer.filter(c => visible.has(c.shoeDraw) && (c.shoeDraw !== round.holeDraw || revealed));
      if (visible.has(round.holeDraw) && !revealed) dealerCards.push({ shoeDraw: round.holeDraw });
      hands.push({ cards: dealerCards, draws: new Set([...round.dealer.map(c=>c.shoeDraw),round.holeDraw]), seat: 'dealer', anchor: positions.get('dealer'), splitCount:1 });
      for (let seat = 0; seat < 7; seat++) {
        const indices = round.hands.map((h,i) => h.box === seat ? i : -1).filter(i => i >= 0);
        const chosen = indices.includes(focusHand) ? focusHand : indices.includes(round.active) ? round.active : indices.at(-1);
        if (chosen == null) continue;
        const slots = [chosen, ...indices.filter(i=>i!==chosen)];
        for (const [number,index] of indices.entries()) {
          const h = round.hands[index], seatId = String(seat + 1);
          hands.push({ cards: h.cards.filter(c => visible.has(c.shoeDraw)), draws: new Set(h.cards.map(c=>c.shoeDraw)),
            seat: seatId, index, number:number+1, splitCount:indices.length,
            anchor:splitHandAnchor(positions.get(seatId),slots.indexOf(index)),
            active:index === round.active && round.phase === 'decisions' });
        }
      }
      sync();
    },
  };
}
