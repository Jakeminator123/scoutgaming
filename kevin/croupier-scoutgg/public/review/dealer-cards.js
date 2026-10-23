// Card track review for a ready dealer (?dealer=paow): his take frame by frame through the game's own keyed dealer layer
// and card renderer, the way a player sees it. A corner dragged here is a fix for that frame (Mocha's stop and fix);
// "Download fixes" saves them for review/2026-10-10-card-tracking/fit_silhouette.py --fixes, which re-fits from there.
import { createGameCards } from '/game-cards.js';
import { createDealerLayer } from '/dealer-layer.js';
import { faceAtTime, firstFaceTime } from '/card-face-projection.js';
import { dealer } from '/dealers.js';

const $ = s => document.querySelector(s), film = $('#film'), stage = $('#stage'), edit = $('#edit');
if (!dealer.ready) { $('#frame').textContent = 'Open this page with ?dealer=paow (or dragge, astrid2).'; throw Error('not a ready dealer'); }
const clips = await (await fetch('/api/clips')).json();
const manifest = { ...clips, kort_storlek: { bredd: dealer.ready.card[0], hojd: dealer.ready.card[1] } };
const at = Object.fromEntries(clips.deal.map(d => [d.id.replace('deal_pos', '').replace('deal_', ''), [d.kort.cx, d.kort.cy]]));
at.dealer = at.dealer ?? [540, 895]; at.hole = [540, 895];
stage.querySelector('.still').src = dealer.still;
createDealerLayer({ stage, still: dealer.keyed.still, land: dealer.land, cardAt: t => at[t], faceAt: faceAtTime, scale: dealer.layerScale ?? .8,
  inFrames: dealer.ready.in, finished: true, keyHalf: [Math.ceil(dealer.ready.card[0] / 2) + 4, Math.ceil(dealer.ready.card[1] / 2) + 4] });
const cards = createGameCards($('#gameCards'), manifest);

const tracks = dealer.faceTracks, original = JSON.parse(JSON.stringify(tracks)), fixes = {};
for (const k of Object.keys(tracks)) $('#take').append(new Option(k === 'flip' ? 'Hole card turn' : k.startsWith('dealer') ? `Dealer ${k === 'dealer' ? 'up card' : 'hit'}` : `Box ${k[0]}${k.endsWith('v') ? ' hit' : ''}`, k));
let track, seat, draw, round, centre;
const fileOf = k => k === 'flip' ? 'flip' : (k.startsWith('dealer') ? 'posdealer' : 'pos' + k[0]) + (k.endsWith('v') ? '-v' : '');
const frameOf = t => Math.floor(t * 24 + 1e-5);

function setup() {
  film.pause(); track = $('#take').value;
  seat = track === 'flip' || track.startsWith('dealer') ? 'dealer' : track[0];
  // the dealer layer keys his card at the seat his take is named after (flip has its own spot)
  centre = at[track === 'flip' ? 'flip' : track.startsWith('dealer') ? 'dealer' : track[0]];
  draw = track === 'flip' ? 2 : track.endsWith('v') ? 3 : 1;
  const hand = Array.from({ length: draw }, (_, i) => ({ r: ['K', '7', 'A', '3'][i], s: ['♥', '♠', '♦', '♣'][i], shoeDraw: i + 1 }));
  round = { phase: 'decisions', active: 0, dealer: seat === 'dealer' ? hand : [], holeDraw: track === 'flip' ? 2 : null,
    hands: seat === 'dealer' ? [] : [{ box: Number(seat) - 1, cards: hand }] };
  cards.sourceStarted(); cards.beginDeal(seat, draw, track);
  const url = dealer.clips + fileOf(track) + '.mp4';
  film.dataset.source = url; film.src = `${url}?review=${performance.timeOrigin}`;   // always the clip on disk (the server caches media a day)
  film.addEventListener('loadeddata', () => { $('#scrub').max = Math.round(film.duration * 24) - 1; seek(tracks[track].firstFrame); }, { once: true });
}
function update(t) {
  const visible = new Set(Array.from({ length: draw - 1 }, (_, i) => i + 1));
  if (track === 'flip' || t + 1e-6 >= firstFaceTime(track)) visible.add(draw);
  cards.advanceDeal(t);
  cards.render(round, visible, track === 'flip' ? t + 1e-6 >= firstFaceTime('flip') : true, 0);
  const f = frameOf(t), tr = tracks[track], i = f - tr.firstFrame, q = tr.frames[i]?.q, land = dealer.land[track];
  $('#scrub').value = f;
  $('#frame').textContent = `Frame ${f} · face from ${tr.firstFrame} · rests at ${land}${fixes[track]?.[f] ? ' · fixed here' : ''}`;
  const abs = q && f < land ? q.map(([x, y]) => [centre[0] + x, centre[1] + y]) : null;
  const [cx, cy] = abs ? abs.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]) : centre;
  stage.style.setProperty('--cx', `${cx / 1080 * 100}%`); stage.style.setProperty('--cy', `${cy / 1920 * 100}%`);
  $('#quad').setAttribute('points', abs && ($('#outline').checked || $('#editing').checked) ? abs.map(p => p.join(',')).join(' ') : '');
  $('#handles').replaceChildren(...(abs ? abs.map(([x, y], j) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    Object.entries({ cx: x, cy: y, r: 5, 'data-corner': j }).forEach(([a, v]) => c.setAttribute(a, v)); return c;
  }) : []));
}
// Seek to the middle of a frame; a tiny offset forces the dealer layer to redraw when the frame stays the same.
let nudge = 0;
function seek(f) { film.pause(); nudge = nudge ? 0 : 1e-4; film.currentTime = (f + .5) / 24 + nudge; }
function tick(_n, m) { update(m.mediaTime); film.requestVideoFrameCallback(tick); }
film.requestVideoFrameCallback(tick);
film.addEventListener('seeked', () => update(film.currentTime));

// Mocha's stop and fix: drag a corner of this frame's track; both the cut-out and the face follow it at once.
let dragging = null;
edit.addEventListener('pointerdown', e => { if (e.target.dataset.corner == null) return; dragging = Number(e.target.dataset.corner); edit.setPointerCapture(e.pointerId); });
edit.addEventListener('pointermove', e => {
  if (dragging == null) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(edit.getScreenCTM().inverse());
  const f = frameOf(film.currentTime), tr = tracks[track], fr = tr.frames[f - tr.firstFrame];
  if (!fr) return;
  const q = fr.q.map(c => [...c]); q[dragging] = [Math.round((p.x - centre[0]) * 100) / 100, Math.round((p.y - centre[1]) * 100) / 100];
  fr.q = q; fr.p = q.map(c => [...c]); fr.body = q.map(c => [...c]);
  (fixes[track] ??= {})[f] = q;
  cards.sourceStarted(); cards.beginDeal(seat, draw, track); seek(f); showFixes();
});
edit.addEventListener('pointerup', () => { dragging = null; });
function showFixes() {
  $('#fixes').textContent = Object.entries(fixes).flatMap(([k, fs]) => Object.keys(fs).map(f => `${k} frame ${f}`)).join('\n');
}
$('#reset').onclick = () => {
  const f = frameOf(film.currentTime), tr = tracks[track], i = f - tr.firstFrame;
  if (!tr.frames[i]) return;
  tr.frames[i] = JSON.parse(JSON.stringify(original[track].frames[i]));
  delete fixes[track]?.[f]; cards.sourceStarted(); cards.beginDeal(seat, draw, track); seek(f); showFixes();
};
$('#download').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ dealer: dealer.id, fixes }, null, 1)], { type: 'application/json' }));
  a.download = `${dealer.id}-card-fixes.json`; a.click();
};
$('#take').onchange = setup;
$('#scrub').oninput = () => seek(Number($('#scrub').value));
$('#prev').onclick = () => seek(frameOf(film.currentTime) - 1);
$('#next').onclick = () => seek(frameOf(film.currentTime) + 1);
$('#play').onclick = () => { if (film.currentTime >= film.duration - .05) film.currentTime = 0; film.play(); };
$('#half').onclick = () => { film.playbackRate = film.playbackRate === 1 ? .5 : 1; $('#half').textContent = film.playbackRate === 1 ? 'Half speed' : 'Normal speed'; };
$('#detail').onchange = () => stage.classList.toggle('detail', $('#detail').checked);
$('#outline').onchange = $('#editing').onchange = () => { edit.classList.toggle('on', $('#editing').checked); update(film.currentTime); };
stage.classList.add('detail');
setup();
