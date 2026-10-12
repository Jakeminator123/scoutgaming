// Kevin and Emil 12 Oct: on Astrid's tables the printed felt brand lay over her filmed hands and arms when she dealt to the
// middle boxes (the cards did not). The brand is drawn above her video, and the cards' hand tracks (dealer-hand-tracks.js)
// end at y 939, above the brand. So the video's own pixels are drawn back over the brand's rectangle wherever they differ
// from the empty table (her still, startbild.png, is the same camera and size): her hand, her black sleeve, a card in her
// hand. The bare felt stays transparent and the brand shows. Keyed dealers are drawn above the felt and need nothing.
import { DEALERS, isAlternative } from './dealers.js';

const LOW = 26, HIGH = 52;   // colour distance to the empty table: below LOW is felt (transparent), above HIGH is her (opaque)

export function keepHandsOverFeltBrand(brand = document.querySelector('#feltBrand')) {
  if (isAlternative || !brand) return;
  const stage = brand.parentElement, art = brand.querySelector(':scope > g');
  if (!stage || !art) return;
  const still = new Image(); still.src = DEALERS.astrid.still;
  const canvas = document.createElement('canvas'); canvas.className = 'felt-brand-hands'; canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true;
  brand.after(canvas);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const ref = document.createElement('canvas'), rctx = ref.getContext('2d', { willReadFrequently: true });
  let refKey = '', refData = null;
  function draw() {
    requestAnimationFrame(draw);
    const video = stage.querySelector('video.v.on');
    if (brand.hasAttribute('hidden') || !still.complete || !still.naturalWidth || !video || video.readyState < 2 || !video.videoWidth) { canvas.hidden = true; return; }
    const s = stage.getBoundingClientRect(), r = art.getBoundingClientRect(), pad = 4;
    // the video (and the still) are object-fit: contain, top centre, in the stage
    const vw = video.videoWidth, vh = video.videoHeight, dw = Math.min(s.width, s.height * vw / vh), k = vw / dw, vx = s.left + (s.width - dw) / 2, vy = s.top;
    const x = r.left - pad, y = r.top - pad, w = r.width + 2 * pad, h = r.height + 2 * pad;
    if (w < 4 || h < 4) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    const src = [(x - vx) * k, (y - vy) * k, w * k, h * k];
    const key = `${cw}x${ch}:${src.map(n => n.toFixed(1)).join(',')}`;
    if (key !== refKey) {   // the empty table under the brand, once per layout
      ref.width = canvas.width = cw; ref.height = canvas.height = ch;
      rctx.drawImage(still, ...src.map(n => n * still.naturalWidth / vw), 0, 0, cw, ch); refData = rctx.getImageData(0, 0, cw, ch).data; refKey = key;
      Object.assign(canvas.style, { left: `${x - s.left}px`, top: `${y - s.top}px`, width: `${w}px`, height: `${h}px` });
    }
    try { ctx.drawImage(video, ...src, 0, 0, cw, ch); } catch { return; }
    const img = ctx.getImageData(0, 0, cw, ch), p = img.data;
    let any = false;
    for (let i = 0; i < p.length; i += 4) {
      const d = Math.max(Math.abs(p[i] - refData[i]), Math.abs(p[i + 1] - refData[i + 1]), Math.abs(p[i + 2] - refData[i + 2]));
      const a = d <= LOW ? 0 : d >= HIGH ? 255 : Math.round((d - LOW) / (HIGH - LOW) * 255);
      p[i + 3] = a; if (a) any = true;
    }
    if (any) ctx.putImageData(img, 0, 0); else ctx.clearRect(0, 0, cw, ch);
    canvas.hidden = false;
  }
  requestAnimationFrame(draw);
}
