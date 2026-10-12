import { createGameCards } from './card-presentation/game-cards.js';
import { firstFaceTime } from './card-presentation/card-face-projection.js';
import { DEAL_CONTACT } from './card-presentation/card-table-layout.js';
import { calibration } from './card-presentation/calibration.mjs';
import { svgNode } from './card-presentation/renderer-support.js';

// Render only server-issued cards. Visibility is a separate presentation cursor:
// a committed round may already contain cards that have not been dealt on screen.
export function createCardCursor(renderer, {canTrack=()=>true}={}) {
  let round = null, revealed = false, focus, pending = null, serial = 0;
  const visible = new Set();
  const render = () => renderer.render(round, visible, revealed, focus);
  const known = draw => round && (draw === round.holeDraw || round.dealer.some(c => c.shoeDraw === draw)
    || round.hands.some(h => h.cards.some(c => c.shoeDraw === draw)));
  return {
    sync(value, hand = value?.active) { round = value; focus = hand; render(); },
    reproject() { if(pending?.calibrated&&!canTrack()){pending.calibrated=false;renderer.endDeal();} render(); },
    clear() { ++serial; pending = null; round = null; revealed = false; visible.clear(); renderer.endDeal(); render(); },
    restore(value) {
      this.clear(); round = value;
      if (round) {
        for (const c of [...round.dealer, ...round.hands.flatMap(h => h.cards)]) visible.add(c.shoeDraw);
        if (round.holeDraw != null) visible.add(round.holeDraw);
        revealed = round.dealer.some(c => c.shoeDraw === round.holeDraw);
      }
      render();
    },
    begin(video, event) {
      const token = ++serial;
      renderer.sourceStarted();
      const seat = event?.to === 'dealer' ? 'dealer' : String(event?.box + 1);
      const track = event?.type === 'reveal' ? 'flip' : event?.faceDown ? 'hole' : seat;
      const asset = calibration.videos.find(v => v.sha256 === video?.sha256 && v.track === track);
      const calibrated = Boolean(asset && known(event.shoeDraw) && canTrack(video));
      focus = event?.handIndex ?? round?.active;
      pending = { token, draw: event?.shoeDraw, calibrated, seat, track, framed: false };
      // A failed variant may have shown frames before a standard retry starts.
      // Restart this draw's visibility with the new film, retaining older cards.
      if (track === 'flip') revealed = false;
      else visible.delete(pending.draw);
      render();
      if (calibrated) renderer.beginDeal(seat, pending.draw, track);
      return token;
    },
    frame(token, time) {
      if(pending?.token===token&&pending.calibrated&&!canTrack()){
        pending.calibrated=false;renderer.endDeal();
      }
      if (pending?.token !== token || !pending.calibrated || !Number.isFinite(time) || time < 0) return;
      if (time + 1e-6 >= firstFaceTime(pending.track) && (!visible.has(pending.draw) || pending.track === 'flip' && !revealed)) {
        if (pending.track === 'flip') revealed = true;
        visible.add(pending.draw); render();
      }
      renderer.advanceDeal(time);
      if (time >= DEAL_CONTACT[pending.track].contact) pending.framed = true;
    },
    finish(token, draw, completed) {
      if (pending?.token !== token) return false;
      const calibrated = Boolean(completed && pending.calibrated && pending.framed && canTrack());
      if (known(draw)) visible.add(draw);
      if (pending.track === 'flip') revealed = true;
      pending = null; renderer.endDeal(); render();
      return calibrated;
    },
    // Selection failure still needs a coherent static result from server state.
    show(draw) { if (known(draw)) { visible.add(draw); render(); } },
    reveal(value) { round = value; revealed = true; render(); },
  };
}

export function createLocalCardOverlay(host) {
  const svg = svgNode('svg', { id: 'local-card-overlay', class: 'local-card-overlay', viewBox: '0 0 1080 1920',
    preserveAspectRatio: 'xMidYMid meet', 'aria-label': 'Cards on the recorded table' });
  const plane=svgNode('g',{id:'local-card-plane'}),visibility=svgNode('style');svg.append(visibility,plane);
  const renderer = createGameCards(plane, {
    deal: Object.entries(calibration.positions).map(([id, kort]) => ({ id: `deal_pos${id}`, kort })),
    kort_storlek: { bredd: calibration.width, hojd: calibration.height },
  });
  host.append(svg); host.dataset.localCardOverlay = 'true';
  let projection=null;
  const cursor = createCardCursor(renderer,{canTrack:()=>!projection?.adjusted});
  return { ...cursor,
    setProjection(value,width,height){
      projection=value;
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      plane.setAttribute('transform',`translate(${value.x} ${value.y}) scale(${value.scale})`);
      renderer.setSeatOffsets(value.offsets??{});
      visibility.textContent=Array.from({length:7},(_,i)=>i).filter(i=>value.boxes&&!value.boxes.includes(i))
        .map(i=>`#local-card-plane [data-seat="${i+1}"]{display:none}`).join('');
      cursor.reproject();
    },
    close() { cursor.clear(); svg.remove(); delete host.dataset.localCardOverlay; } };
}
