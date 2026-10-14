import { createGameCards } from './card-presentation/game-cards.js';
import { firstFaceTime } from './card-presentation/card-face-projection.js';
import { DEAL_CONTACT } from './card-presentation/card-table-layout.js';
import { calibration } from './card-presentation/calibration.mjs';
import { svgNode } from './card-presentation/renderer-support.js';
import { resolveFilmedDealTake } from './card-presentation/filmed-profile.mjs';
import { filmedTableBinding, filmedTransferTiming } from './card-presentation/filmed-table-projection.mjs';

// Render only server-issued cards. Visibility is a separate presentation cursor:
// a committed round may already contain cards that have not been dealt on screen.
export function createCardCursor(renderer, {canTrack=()=>true, filmedProfile=null, filmedBinding=()=>null}={}) {
  let round = null, revealed = false, focus, pending = null, serial = 0;
  const visible = new Set();
  const render = () => renderer.render(round, visible, revealed, focus);
  const known = draw => round && (draw === round.holeDraw || round.dealer.some(c => c.shoeDraw === draw)
    || round.hands.some(h => h.cards.some(c => c.shoeDraw === draw)));
  const tracking = () => canTrack() && (!pending?.filmed || filmedBinding()?.key === pending.filmed.binding.key);
  return {
    sync(value, hand = value?.active) { round = value; focus = hand; render(); },
    reproject() { if(pending?.calibrated&&!tracking()){pending.calibrated=false;renderer.endDeal();} render(); },
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
      const asset = !filmedProfile && calibration.videos.find(v => v.sha256 === video?.sha256 && v.track === track);
      let take = null;
      // A stale or malformed opt-in must retain authoritative static cards.
      try { take = filmedProfile && resolveFilmedDealTake(filmedProfile, {sha256:video?.sha256, event}); } catch {}
      // Only the server's complete pose-chain selection grants filmed contact.
      // A generic saved clip may have the same bytes without that sequence.
      if (take && (video?.filmedTake?.profileId !== filmedProfile.id || video.filmedTake.takeKey !== take.key)) take = null;
      const binding = take && filmedBinding(), timing = take && filmedTransferTiming(filmedProfile, take);
      const filmed = take && binding && timing && filmedProfile.tracks[take.track] && binding.positions[seat]
        ? {profile:filmedProfile, take, binding, timing} : null;
      const calibrated = Boolean((asset || filmed) && known(event?.shoeDraw) && canTrack(video));
      focus = event?.handIndex ?? round?.active;
      pending = { token, draw: event?.shoeDraw, calibrated, seat, track, framed: false, filmed };
      // A failed variant may have shown frames before a standard retry starts.
      // Restart this draw's visibility with the new film, retaining older cards.
      if (track === 'flip') revealed = false;
      else visible.delete(pending.draw);
      render();
      if (calibrated) renderer.beginDeal(seat, pending.draw, track, filmed);
      return token;
    },
    frame(token, time) {
      if(pending?.token===token&&pending.calibrated&&!tracking()){
        pending.calibrated=false;renderer.endDeal();
      }
      if (pending?.token !== token || !pending.calibrated || !Number.isFinite(time) || time < 0) return;
      const first = pending.filmed ? pending.filmed.take.firstFaceFrame / pending.filmed.timing.fps : firstFaceTime(pending.track);
      if (time + 1e-6 >= first && (!visible.has(pending.draw) || pending.track === 'flip' && !revealed)) {
        if (pending.track === 'flip') revealed = true;
        visible.add(pending.draw); render();
      }
      renderer.advanceDeal(time);
      const complete = pending.filmed ? pending.filmed.timing.end / pending.filmed.timing.fps : DEAL_CONTACT[pending.track].contact;
      if (time + 1e-6 >= complete) pending.framed = true;
    },
    finish(token, draw, completed) {
      if (pending?.token !== token) return false;
      const calibrated = Boolean(completed && pending.calibrated && pending.framed && tracking());
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

export function createLocalCardOverlay(host,{dealerLabel='Dealer',filmedProfile=null}={}) {
  const svg = svgNode('svg', { id: 'local-card-overlay', class: 'local-card-overlay', viewBox: '0 0 1080 1920',
    preserveAspectRatio: 'xMidYMid meet', 'aria-label': `Kort på bordet · ${dealerLabel}` });
  const plane=svgNode('g',{id:'local-card-plane'}),visibility=svgNode('style');svg.append(visibility,plane);
  const renderer = createGameCards(plane, {
    deal: Object.entries(calibration.positions).map(([id, kort]) => ({ id: `deal_pos${id}`, kort })),
    kort_storlek: { bredd: calibration.width, hojd: calibration.height },
  },{dealerLabel,filmedProfile});
  host.append(svg); host.dataset.localCardOverlay = 'true';
  let projection=null;
  const cursor = createCardCursor(renderer,{filmedProfile,
    filmedBinding:()=>filmedTableBinding(filmedProfile,projection),
    canTrack:()=>Boolean(filmedProfile)||!projection?.adjusted});
  return { ...cursor,
    setProjection(value,width,height){
      projection=value;
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      plane.setAttribute('transform',`translate(${value.x} ${value.y}) scale(${value.scale})`);
      renderer.setSeatOffsets(value.offsets??{},value.positions);
      visibility.textContent=Array.from({length:7},(_,i)=>i).filter(i=>value.boxes&&!value.boxes.includes(i))
        .map(i=>`#local-card-plane [data-seat="${i+1}"]{display:none}`).join('');
      cursor.reproject();
    },
    close() { cursor.clear(); svg.remove(); delete host.dataset.localCardOverlay; } };
}
