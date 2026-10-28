// The desktop table's widened room takes the table's felt colour too (desk.css, desk-mode.js). In the frame the felt is
// recoloured by table-style.js's shader; the room around the frame is a still, so it is recoloured here once per colour,
// with the same arithmetic: the Table Studio's 'color' blend, then 'soft-light' at .55, only on the dark, warm felt
// (skin, cards, acrylic, chrome and the black armrest keep their own colour). Without it a coloured felt ended at the
// frame's edges.
const html = document.documentElement, stage = document.querySelector('#stage');
const lum = (r, g, b) => .3 * r + .59 * g + .11 * b;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function setLum(c, l) {
  const d = l - lum(...c); let [r, g, b] = c.map(v => v + d);
  const L = lum(r, g, b), n = Math.min(r, g, b), x = Math.max(r, g, b);
  if (n < 0) [r, g, b] = [r, g, b].map(v => L + (v - L) * L / Math.max(L - n, 1e-4));
  if (x > 1) [r, g, b] = [r, g, b].map(v => L + (v - L) * (1 - L) / Math.max(x - L, 1e-4));
  return [r, g, b];
}
const soft = (b, s) => s <= .5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * ((b <= .25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(Math.max(b, 0))) - b);

let done = '', job = 0;
async function recolour() {
  const color = stage?.dataset.feltColor || '';
  const src = html.dataset.roomWide || '';
  const want = html.classList.contains('desk') && src && /^#[0-9a-f]{6}$/i.test(color) ? `${src}|${color}` : '';
  if (want === done) return;
  done = want; const mine = ++job;
  if (!want) { if (src) html.style.setProperty('--room', `url("${src}")`); return; }
  const img = new Image(); img.decoding = 'async'; img.src = src;
  try { await img.decode(); } catch { return; }
  if (mine !== job) return;
  const W = img.naturalWidth, H = img.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, W, H), d = data.data;
  const tint = color.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16) / 255);
  // room px -> frame px: the frame's (0, 90) is the room's (740, 0) (KLARA_DESKTOP layout); felt between the far rail
  // (frame y 733-744) and the front of the WIDE table: Emil 28 Oct, the phone table's front (frame y 1694) lies under the
  // wide room's armrest, whose warm sheen took the felt's colour too. Its edge, fitted on the wide rooms (they share the
  // table): room row 1138.5 - 16 u^2 - 90.8 u^4, u = (room x - 1280) / 1280.
  const edge = new Float32Array(W).map((_, x) => { const u = (x * 2560 / W - 1280) / 1280, u2 = u * u; return 1138.5 - 16 * u2 - 90.8 * u2 * u2; });
  for (let y = 0; y < H; y++) {
    const ry = y * 1440 / H, top = ss(733, 744, ry + 90);
    if (top <= 0 || ry > 1150) continue;
    for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
      const mask = top * (1 - ss(edge[x] - 10, edge[x] - 2, ry));
      if (mask <= 0) continue;
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, hi = Math.max(r, gg, b), lo = Math.min(r, gg, b);
      const key = ss(.055, .10, hi) * (1 - ss(.25, .34, hi)) * (1 - ss(.042, .09, hi - lo)) * ss(-.008, .012, r - gg);
      const a = mask * key;
      if (a <= 0) continue;
      const c = setLum(tint, lum(r, gg, b));
      for (let k = 0; k < 3; k++) {
        const shaded = c[k] + (soft(c[k], tint[k]) - c[k]) * .55;
        d[i + k] = Math.round((shaded * a + [r, gg, b][k] * (1 - a)) * 255);
      }
    }
    if (y % 120 === 119) { await new Promise(r => setTimeout(r)); if (mine !== job) return; }   // keep the page responsive
  }
  g.putImageData(data, 0, 0);
  // a data: URL, not a blob: the page's CSP allows images from 'self' and data: only
  const url = cv.toDataURL('image/jpeg', .9);
  if (mine !== job) return;
  html.style.setProperty('--room', `url("${url}")`);
}
if (stage) new MutationObserver(recolour).observe(stage, { attributes: true, attributeFilter: ['data-felt-color'] });
new MutationObserver(recolour).observe(html, { attributes: true, attributeFilter: ['class', 'data-room-wide'] });
recolour();
