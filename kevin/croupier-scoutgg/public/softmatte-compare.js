// Review-only page: same source frame, same cards, two occlusion methods.
import { DEALER_HAND_TRACKS } from './dealer-hand-tracks.js';
import { createHandMask } from './dealer-hand-occlusion.js';
import { svgNode } from './table-boxes.js';

const CLIPS = { dealer: '/media/deal/posdealer.mp4', hole: '/media/deal/hole.mp4', '2': '/media/deal/pos2.mp4', flip: '/media/deal/flip.mp4' };
const SHOTS = new URLSearchParams(location.search).get('shots')?.split(',').map(x => x.split(':')).map(([t, f]) => [t, +f])
  ?? [['dealer', 28], ['dealer', 32], ['dealer', 44], ['dealer', 48], ['dealer', 51], ['2', 40], ['flip', 40]];
const CROP = { x: 300, y: 820, scale: 3 };

function polygonPath(track, frame) {
  const polys = DEALER_HAND_TRACKS[track]?.[frame] ?? [];
  return 'M0 0H1080V1920H0Z' + polys.map(p => `M${p.map(v => v.join(' ')).join('L')}Z`).join('');
}

function cards(layer) {
  // Three dealt cards on the dealer's landing row, like a fanned dealer hand.
  for (const [i, dx] of [0, -66, -132].entries()) {
    const g = svgNode('g', { transform: `translate(${540 + dx} 895)` });
    g.append(svgNode('rect', { x: -31.5, y: -42.5, width: 63, height: 85, rx: 4, fill: '#eaf1f2', stroke: '#c9c3af' }),
      svgNode('text', { x: -18, y: -20, 'font-size': 17, 'font-family': 'Arial', 'font-weight': 700, fill: i ? '#111' : '#b3261e' }, i ? 'K♠' : 'A♥'),
      svgNode('text', { y: 14, 'text-anchor': 'middle', 'font-size': 32, 'font-family': 'Georgia', fill: i ? '#111' : '#b3261e' }, i ? '♠' : '♥'));
    layer.append(g);
  }
}

function panel(track, frame, soft) {
  const box = document.createElement('div'); box.className = 'panel';
  const stage = document.createElement('div'); stage.className = 'stage';
  stage.style.transform = `scale(${CROP.scale}) translate(${-CROP.x}px, ${-CROP.y}px)`;
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = CLIPS[track];
  video.addEventListener('loadeddata', () => { video.currentTime = (frame + 0.5) / 24; }, { once: true });
  const svg = svgNode('svg', { viewBox: '0 0 1080 1920' });
  const defs = svgNode('defs'), layer = svgNode('g');
  const id = `m-${track}-${frame}-${soft}`;
  if (soft) {
    const m = createHandMask(id); defs.append(m.mask); m.set(track, frame / 24);
    layer.setAttribute('mask', `url(#${id})`);
  } else {
    const clip = svgNode('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
    clip.append(svgNode('path', { 'clip-rule': 'evenodd', d: polygonPath(track, frame) })); defs.append(clip);
    layer.setAttribute('clip-path', `url(#${id})`);
  }
  cards(layer); svg.append(defs, layer);
  stage.append(video, svg);
  const cap = document.createElement('div'); cap.className = 'cap';
  cap.textContent = `${soft ? 'soft matte' : 'polygon'} · ${track} frame ${frame}`;
  box.append(stage, cap);
  return box;
}

const rows = document.getElementById('rows');
for (const [track, frame] of SHOTS) {
  const row = document.createElement('div'); row.className = 'row'; row.dataset.shot = `${track}-${frame}`;
  const label = document.createElement('div'); label.className = 'label'; label.textContent = `${track} f${frame}`;
  row.append(label, panel(track, frame, false), panel(track, frame, true));
  rows.append(row);
}
