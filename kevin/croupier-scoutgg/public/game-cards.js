import {suitColor} from './game-presentation.js';
import { svgNode } from './table-boxes.js';
import { total, totalLabel } from './game-events.js';
import { faceAtTime, faceTriangles, firstFaceTime, flipFace, triangleMatrices } from './card-face-projection.js';
import { DEAL_CONTACT, FIXED_LAYOUT, cardPose, feltMatrix, dealerFanOffset, splitHandAnchor, trackLean } from './card-table-layout.js';
import { TABLE_LAYOUT, dealerRow, layoutPlayers, placeTotals } from './table-layout.js';
import { dealerHandClip } from './dealer-hand-occlusion.js';
import { dealer as chosenDealer } from './dealers.js';

// One stable SVG node per server-issued draw. Motion is driven by source frames.
export function createGameCards(svg, manifest, { fixed = FIXED_LAYOUT } = {}) {
  const positions = new Map(manifest.deal.map(d => [d.id.replace('deal_pos', ''), d.kort]));
  const { bredd: width, hojd: height } = manifest.kort_storlek;
  const prefix = `${svg.id || 'cards'}-felt`;
  const defs = svgNode('defs');
  const faceClip = svgNode('clipPath', {id: `${prefix}-face`, clipPathUnits:'userSpaceOnUse'});
  faceClip.append(svgNode('rect', {x:-width/2+1,y:-height/2+1,width:width-2,height:height-2,rx:3}));
  defs.append(faceClip);
  // Local triangle clips (the corner-pin mesh) are shared; per-card visible-paper clips exclude fingers.
  const triangles = faceTriangles(width, height);
  for (const [i, points] of triangles.entries()) {
    const clip = svgNode('clipPath', {id: `${prefix}-triangle-${i}`, clipPathUnits:'userSpaceOnUse'});
    clip.append(svgNode('polygon', {points: points.map(p=>p.join(',')).join(' ')})); defs.append(clip);
  }
  const handClip = svgNode('clipPath', {id:`${prefix}-hands`,clipPathUnits:'userSpaceOnUse'});
  const handPath = svgNode('path', {'clip-rule':'evenodd',d:dealerHandClip()});
  handClip.append(handPath);defs.append(handClip);
  const cardLayer = svgNode('g', { class: 'card-layer', 'clip-path':`url(#${prefix}-hands)` }), badges = svgNode('g', { class: 'card-totals' });
  svg.replaceChildren(defs, cardLayer, badges);
  const nodes = new Map();
  const linkLayer = svgNode('g', { class: 'split-links' }), links = new Map();   // the lines tying a split box's totals to its ring
  let hands = [], pending = null;
  let handClipPath = dealerHandClip();

  function face(card, inkOnly = false) {
    const group = svgNode('g', { class: 'card-face' });
    if (!card.r) {
      // Match Emil's filmed back at the hole/flip handoff, in every brand.
      group.append(svgNode('rect',{x:-width/2,y:-height/2,width,height,rx:3,fill:'#050404',stroke:'#050404','stroke-width':1}));
      group.append(svgNode('image',{href:'/media/cards/back-scout.png',x:-width/2,y:-height/2,width,height,'aria-label':'Black Scout card back'}));
      return group;
    }
    if (!inkOnly) group.append(svgNode('rect', { x: -width/2, y: -height/2, width, height, rx: 4,
      fill: '#eaf1f2', stroke: '#c9c3af', 'stroke-width': .8 }));
    const color = suitColor(card.s);
    const ink = svgNode('g', {'clip-path': `url(#${prefix}-face)`});
    if (fixed) {
      // Emil 16 Oct: the index tight in the corners, rank and suit on one line, upright both top left and bottom right (a
      // card turned half a turn reads a 6 as a 9): in a hand only a strip of each card shows, and the strip holds its index.
      const font = { fill: color, 'font-family': '"Roboto Condensed", "Arial Narrow", sans-serif-condensed, Arial, sans-serif', 'font-weight': 700, 'letter-spacing': -.3 };
      const index = (x, y, anchor, rank, suit) => {
        const t = svgNode('text', { ...font, x, y, 'text-anchor': anchor, 'font-size': rank });
        t.append(svgNode('tspan', {}, card.r), svgNode('tspan', { 'font-size': suit, dx: 1.5 }, card.s));
        return t;
      };
      // Emil 16 Oct: the rank 15 % bigger (23 -> 26.5 top, 21 -> 24 bottom), the suit as it was
      ink.append(index(-width / 2 + 4, -height / 2 + 22.5, 'start', 26.5, 17), index(width / 2 - 4, height / 2 - 5, 'end', 24, 15),
        svgNode('text', { y: 13, 'text-anchor': 'middle', fill: color, 'font-family': 'Georgia', 'font-size': 36 }, card.s));
      group.append(ink);
      return group;
    }
    const corner = svgNode('g', { fill: color, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-weight': '700' });
    corner.append(svgNode('text', { x: -19, y: -22, 'font-size': 17 }, card.r), svgNode('text', { x: -19, y: -7, 'font-size': 16 }, card.s));
    ink.append(corner);
    const inverted = corner.cloneNode(true); inverted.setAttribute('transform', 'rotate(180)'); ink.append(inverted);
    ink.append(svgNode('text', { y: 11, 'text-anchor': 'middle', fill: color, 'font-family': 'Georgia', 'font-size': 32 }, card.s));
    group.append(ink);
    return group;
  }
  // A ready dealer's table (table-layout.js): every card's place from the whole table at once. While a card is dealt the
  // rest of the table goes from the layout without it to the layout with it: the players' cards glide over half a second
  // from just before it touches down (its face shows only for the last few frames of the throw, too short a move to read
  // as a glide), her upcard moves aside as far as her hole card has travelled (Emil #7); the incoming card leans from
  // her fingers into its place, as before.
  const size = [width, height], GLIDE_LEAD = .25, GLIDE_SECONDS = .5;
  const anchorOf = seat => { const p = positions.get(seat); return { cx: p.cx, cy: p.cy }; };
  function fixedLayout() {
    const deal = pending && pending.track !== 'flip' ? pending : null;
    const lean = deal ? trackLean(deal.track, deal.time) : 1;
    const dealHand = deal ? hands.find(h => h.seat === deal.seat && h.draws.has(deal.draw)) : null;
    const reserve = dealHand && !dealHand.cards.some(c => c.shoeDraw === deal.draw) ? 1 : 0;
    const count = (h, without = false) => h.cards.length + (h === dealHand ? reserve - (without ? 1 : 0) : 0);
    const seats = {};
    for (const h of hands) if (h.seat !== 'dealer') (seats[h.seat] ??= []).push(h);
    const anchors = Object.fromEntries(Object.keys(seats).map(k => [k, anchorOf(k)]));
    const active = Object.fromEntries(Object.entries(seats).map(([k, hs]) => [k, hs.findIndex(h => h.active)]).filter(([, i]) => i >= 0));
    const boxes = without => Object.fromEntries(Object.entries(seats).map(([k, hs]) => [k, hs.map(h => Math.max(0, count(h, without)))]));
    const widths = Object.fromEntries(Object.entries(seats).filter(([, hs]) => hs.length > 1).map(([k, hs]) => [k, hs.map(h => h.badge?.width ?? 58)]));
    const now = layoutPlayers(boxes(false), anchors, size, active, widths);
    const before = deal && dealHand && dealHand.seat !== 'dealer' ? layoutPlayers(boxes(true), anchors, size, active, widths) : now;
    const poses = new Map(), rects = [];
    const ease = t => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
    const glide = !deal ? 1 : dealHand?.seat === 'dealer' ? lean : ease((deal.time - (deal.contact ?? 0) + GLIDE_LEAD) / GLIDE_SECONDS);
    const lerp = (b, n) => ({ x: b.x + (n.x - b.x) * glide, y: b.y + (n.y - b.y) * glide });
    const place = (h, offsNow, offsBefore, a) => h.cards.forEach((c, i) => {
      const n = offsNow[i] ?? { x: 0, y: 0 };
      const o = !deal ? n : c.shoeDraw === deal.draw ? { x: n.x * lean, y: n.y * lean } : lerp(offsBefore?.[i] ?? n, n);
      poses.set(c.shoeDraw, { x: a.cx + o.x, y: a.cy + o.y });
    });
    for (const [k, hs] of Object.entries(seats)) hs.forEach((h, j) => {
      const a = anchors[k], n = now[k]?.[j]?.cards ?? [];
      for (const o of n) rects.push([a.cx + o.x - width / 2, a.cx + o.x + width / 2, a.cy + o.y - height / 2]);
      place(h, n, before[k]?.[j]?.cards, a);
    });
    const dealer = hands.find(h => h.seat === 'dealer');
    if (dealer) {
      const a = anchorOf('dealer'), n = count(dealer);
      place(dealer, dealerRow(n, a, size, rects), dealHand === dealer ? dealerRow(n - 1, a, size, rects) : null, a);
    }
    return { poses, dealing: Boolean(deal), seats, now };
  }

  // The totals (Emil 16 Oct): a hand's total under its first card; a split box's totals all at full size on one line
  // tied to its ring, a total that would meet its neighbour lifted onto its own cards' bottom edge.
  function placeBadges({ poses, seats, now }) {
    const { dy, splitDy, h: pillH } = TABLE_LAYOUT.pill, taken = [];
    const at = (b, x, y) => { b.x = x; b.y = y; b.node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); };
    const first = h => poses.get(h.cards[0]?.shoeDraw);
    for (const hand of hands) {
      if (!hand.badge || !first(hand)) continue;
      const { cx, cy } = anchorOf(hand.seat);
      // hers stays where it always was, left of her upcard's slot (table-layout keeps the players' cards below it)
      if (hand.seat === 'dealer') { at(hand.badge, cx + dealerRow(2, { cx, cy }, size)[0].x - 73 - (hand.badge.width - 76) / 2, cy); continue; }
      if (hand.splitCount > 1) continue;
      const x0 = first(hand).x;
      at(hand.badge, Math.min(Math.max(cx, x0 - 10), x0 + 30), cy + dy);
      taken.push({ x: hand.badge.x, y: hand.badge.y, w: hand.badge.width });
    }
    for (const [k, hs] of Object.entries(seats)) {
      const link = links.get(k);
      if (hs.length < 2) continue;
      const { cx, cy } = anchorOf(k), base = cy + splitDy;
      const front = hs.filter((h, j) => h.badge && first(h) && (now[k]?.[j]?.row ?? 0) === 0);
      const ys = placeTotals(front.map(h => ({ x: first(h).x, w: h.badge.width })), base, taken);
      front.forEach((h, i) => { at(h.badge, first(h).x, ys[i]); taken.push({ x: h.badge.x, y: ys[i], w: h.badge.width }); });
      hs.forEach(h => {
        if (!h.badge || !first(h) || front.includes(h)) return;
        const top = poses.get(h.cards.at(-1).shoeDraw);
        at(h.badge, top.x, top.y - height / 2 - pillH / 2 - 2);
      });
      if (!link || !front.length) continue;
      const xs = front.map(h => h.badge.x), lo = Math.min(...xs), hi = Math.max(...xs);
      link.setAttribute('d', `M${lo.toFixed(1)} ${base}H${hi.toFixed(1)}M${Math.min(Math.max(cx, lo), hi).toFixed(1)} ${base}L${cx} ${cy + 78}`
        + front.filter(h => h.badge.y < base).map(h => `M${h.badge.x.toFixed(1)} ${base}V${h.badge.y.toFixed(1)}`).join(''));
    }
  }

  function move() {
    // Mask the complete layer in source coordinates, including already dealt
    // cards. A mask on only the incoming face leaves old cards over her fingers.
    // Keep tracking past face release until the filmed hand has withdrawn.
    const path = dealerHandClip(pending?.track, pending?.time);
    if (path !== handClipPath) { handPath.setAttribute('d', path); handClipPath = path; }
    const table = fixed ? fixedLayout() : null;
    for (const hand of hands) {
      const anchor = hand.anchor;
      const deal = pending?.track !== 'flip' && pending?.seat === hand.seat && hand.draws.has(pending.draw) ? pending : null;
      const incoming = deal ? hand.cards.findIndex(c => c.shoeDraw === deal.draw) : -1;
      // Before the incoming card becomes visible, reserve its eventual last slot.
      const count = hand.cards.length + (deal && incoming < 0 ? 1 : 0);
      hand.cards.forEach((card, index) => {
        const pose = table ? table.poses.get(card.shoeDraw) : cardPose({ index, count, anchor, width,
          incomingIndex: deal ? (incoming < 0 ? count - 1 : incoming) : -1,
          time: deal?.time, contact: deal?.contact, lean: deal ? trackLean(deal.track, deal.time) : 1, splitCount: hand.splitCount, seat: hand.seat });
        const entry = nodes.get(card.shoeDraw);
        const layoutKey = `${anchor.cx}:${anchor.cy}:${hand.splitCount}`;
        // A ready dealer's card that moves while nothing is dealt (a split, a hand settling) glides to its new place.
        if (table && !table.dealing && entry.pose && Math.hypot(entry.pose.x - pose.x, entry.pose.y - pose.y) > .5) {
          entry.shift?.cancel();
          entry.shift = entry.group.animate?.([
            { transform: `translate(${entry.pose.x}px, ${entry.pose.y}px)` },
            { transform: `translate(${pose.x}px, ${pose.y}px)` },
          ], { duration: 260, easing: 'ease-out' });
        } else if (!table && entry.pose && entry.layoutKey !== layoutKey) {
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
        // Emil turns the hole card on film (every dealer's flip is filmed now), so the game hides its own meanwhile.
        const turning = pending?.track === 'flip' && pending.draw === card.shoeDraw && entry.signature === 'hidden';
        // #9: once face-up on film, the face takes the filmed card's tracked shape as it settles (filmed flips only)
        const flipping = !chosenDealer.ready && pending?.track === 'flip' && pending.draw === card.shoeDraw && !turning
          ? flipFace(pending.time ?? 0, width, height) : null;
        // A ready dealer's turned card is corner-pinned on its filmed track until it rests, like a dealt one.
        // The table may show the card a frame before the video presents its first face-up frame (wall clock vs
        // video): it is pinned to that first pose then, never drawn at rest beside his hand.
        const turned = chosenDealer.ready && pending?.track === 'flip' && pending.draw === card.shoeDraw && !turning && pending.time + 1e-6 < pending.clear
          ? faceAtTime('flip', Math.max(pending.time, firstFaceTime('flip'))) : null;
        const tracked = deal?.draw === card.shoeDraw && deal.time + 1e-6 < deal.clear
          ? faceAtTime(deal.track, Math.max(deal.time, firstFaceTime(deal.track))) : flipping ?? turned;
        const px = pose.x, py = pose.y;
        const motionKey=`${turning}:${px.toFixed(3)}:${py.toFixed(3)}:${flipping ? 'flip' + flipping.frame : tracked ? Math.floor(pending.time*24+1e-5) : 'rest'}:${entry.signature}`;
        if(entry.motionKey===motionKey)return;
        entry.motionKey=motionKey;
        entry.group.setAttribute('display', turning ? 'none' : 'inline');
        entry.group.setAttribute('transform', `translate(${px.toFixed(3)} ${py.toFixed(3)})`);
        entry.face.setAttribute('visibility', tracked ? 'hidden' : 'visible');
        entry.projected.setAttribute('visibility', tracked ? 'visible' : 'hidden');
        entry.group.style.filter = tracked ? 'none' : '';
        // The mesh's artwork copies exist only while the card is pinned to the film (one card at a time).
        if (!tracked && entry.pieces) { entry.ink.replaceChildren(); entry.pieces = null; }
        if (tracked && !entry.pieces) {
          entry.pieces = triangles.map((_, i)=>{
            const piece=svgNode('g'), local=svgNode('g',{'clip-path':`url(#${prefix}-triangle-${i})`});
            local.append(face(card,true));piece.append(local);return piece;
          });
          entry.ink.replaceChildren(...entry.pieces);
        }
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
    if (table) placeBadges(table);
  }
  function sync() {
    const keep = new Set(), owner = new Map(); let ordered = []; badges.replaceChildren(); links.clear();
    if (fixed) badges.append(linkLayer);
    linkLayer.replaceChildren();
    for (const hand of hands) {
      const { cx, cy } = hand.anchor;
      // a split hand is a ladder: its newest card lies behind the older ones (Emil 16 Oct, split D)
      (fixed && hand.splitCount > 1 ? [...hand.cards].reverse() : hand.cards).forEach(card => {
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
          entry.pieces = null; entry.ink.replaceChildren(); entry.motionKey = null;
          entry.group.replaceChildren(entry.face,entry.projected);
          entry.group.setAttribute('data-card', signature);
        }
        entry.group.setAttribute('data-seat', hand.seat);
        entry.group.setAttribute('data-hand', hand.index ?? 'dealer');
        entry.face.setAttribute('transform', `matrix(${feltMatrix(positions.get(hand.seat)).join(' ')})`);
        ordered.push(entry.group); owner.set(entry.group, hand);
      });
      if (!hand.cards.length) continue;
      const dealer = hand.seat === 'dealer';
      if (fixed) {
        // full-size totals for every hand, split or not; placeBadges puts them where the layout has room
        const shown = hand.cards.filter(c => c.r), value = total(shown), label = totalLabel(shown), text = `${label}${value > 21 ? ' ×' : ''}`;
        // a split hand's total: the same type and height, its width fitted to the number so the totals fit side by side
        const w = hand.splitCount > 1 ? Math.max(58, Math.ceil(text.length * 34 * .6) + 20) : Math.max(76, Math.ceil(text.length * 34 * .6) + 28);
        const node = svgNode('g', { 'data-hand': hand.index ?? 'dealer', 'data-active': Boolean(hand.active),
          'aria-label': `${dealer ? chosenDealer.name : `Box ${hand.seat}${hand.splitCount > 1 ? ` hand ${hand.number}` : ''}`}: ${label}${hand.active ? ', active hand' : ''}` });
        node.append(svgNode('rect', { x: -w / 2, y: -24, width: w, height: 48, rx: 24, fill: hand.active ? '#dec68e' : '#17231fe0' }),
          svgNode('text', { y: 11, 'text-anchor': 'middle', fill: hand.active ? '#17231f' : '#faf4e4', 'font-size': 34, 'font-family': 'JetBrains Mono', 'font-weight': 500 }, text));
        badges.append(node);
        hand.badge = { node, width: w, x: cx, y: cy };
        if (hand.splitCount > 1 && !links.has(hand.seat)) {
          const link = svgNode('path', { class: 'split-link', fill: 'none', stroke: '#dec68e', 'stroke-opacity': .6, 'stroke-width': 2, d: '' });
          linkLayer.append(link); links.set(hand.seat, link);
        }
        continue;
      }
      const x = dealer ? cx + dealerFanOffset(0, hand.cards.length).x - 73 : cx;
      const split = hand.splitCount > 1;
      const y = dealer ? cy : cy + (split && hand.splitCount > 2 ? 32 : 60);
      const shown = hand.cards.filter(c => c.r), value = total(shown), label = totalLabel(shown);
      const text = `${split ? `${hand.number} · ` : ''}${label}${value > 21 ? ' ×' : ''}`;
      // A soft total ("7/17") is wider than a plain one: grow the pill to fit (mono glyph ≈ 0.6 em); the dealer's grows leftwards, away from its fan.
      const width = Math.max(split ? 72 : 76, Math.ceil(text.length * (split ? 20 : 34) * .6) + (split ? 20 : 28)), grow = width - (split ? 72 : 76);
      const badge = svgNode('g', { transform: `translate(${dealer ? x - grow / 2 : x} ${y})`, 'data-hand':hand.index ?? 'dealer', 'data-active':Boolean(hand.active),
        'aria-label': `${dealer ? chosenDealer.name : `Box ${hand.seat}${split ? ` hand ${hand.number}` : ''}`}: ${label}${hand.active ? ', active hand' : ''}` });
      badge.append(svgNode('rect', { x: -width / 2, y: split ? -16 : -24, width, height: split ? 32 : 48, rx: split ? 16 : 24, fill: hand.active ? '#dec68e' : '#17231fe0' }),
        svgNode('text', { y: split ? 6 : 11, 'text-anchor': 'middle', fill: hand.active ? '#17231f' : '#faf4e4', 'font-size': split ? 20 : 34, 'font-family':'JetBrains Mono', 'font-weight': 500 }, text));
      badges.append(badge);
    }
    for (const [draw, entry] of nodes) if (!keep.has(draw)) { entry.group.remove(); entry.clip.remove(); nodes.delete(draw); }
    if (fixed) {
      // a split box in two rows (the rare fallback): its back row lies under the front one
      const { now, seats } = fixedLayout(), row = h => h.seat === 'dealer' ? 0 : now[h.seat]?.[seats[h.seat].indexOf(h)]?.row ?? 0;
      const runs = [];
      for (const g of ordered) { const h = owner.get(g); if (runs.at(-1)?.h !== h) runs.push({ h, gs: [] }); runs.at(-1).gs.push(g); }
      const blocks = [];   // a seat's hands lie next to each other: sort each seat's hands, back row first (stable)
      for (const run of runs) { if (blocks.at(-1)?.[0].h.seat !== run.h.seat) blocks.push([]); blocks.at(-1).push(run); }
      ordered = blocks.flatMap(b => b.map((run, i) => [run, i]).sort(([x, i], [y, j]) => row(y.h) - row(x.h) || i - j)).flatMap(([run]) => run.gs);
    }
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
            anchor:fixed?positions.get(seatId):splitHandAnchor(positions.get(seatId),slots.indexOf(index)),
            active:index === round.active && round.phase === 'decisions' });
        }
      }
      sync();
    },
  };
}
