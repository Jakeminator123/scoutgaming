// An operator logo at the table, prepared ONCE here for both Table Studio's preview and the game (Emil 14 Oct: the header
// showed a dark logo as a white box, and the preview showed something else than the game):
//  - its plate (a solid background, white or coloured) is keyed out by colour with soft edges, and the margins trimmed;
//  - header: the logo in its own colours; a dark one (it would vanish on the header's dark scrim) sits on a light badge
//    instead of being turned into a white silhouette, and a logo on a coloured plate keeps that plate as a rounded badge;
//  - felt: one ink colour cut from the logo's shape, so any logo reads like the table's own printed lettering.

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
export const FELT_INK = [239, 227, 194];   // scout-ui.css --felt-ink
const BADGE = '#f5f2ea';

/** Pure: RGBA pixels -> {alpha (0..255), rgb (the logo's own colours, plate removed), dark, box [x0,y0,x1,y1], plate}.
 *  A logo on a solid plate (four opaque corners of about one colour) inks whatever differs from the plate in colour;
 *  a transparent logo inks its own alpha. Edge pixels get the plate's tint taken out of their colour. */
export function inkOf(d, w, h) {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(i => i * 4);
  const bg = [0, 1, 2].map(c => corners.reduce((n, i) => n + d[i + c], 0) / 4);
  const dist = i => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]) / 441.7;
  const plate = corners.every(i => d[i + 3] > 230 && dist(i) < 0.12);
  const alpha = new Uint8ClampedArray(w * h), rgb = new Uint8ClampedArray(w * h * 3);
  let ink = 0, sum = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const a = plate ? Math.min(1, Math.max(0, (dist(i) - 0.04) / 0.14)) : d[i + 3] / 255;
    alpha[p] = Math.round(a * 255);
    for (let c = 0; c < 3; c++) rgb[p * 3 + c] = plate && a > 0 ? (d[i + c] - (1 - a) * bg[c]) / a : d[i + c];
    if (a > 0.5) { ink++; sum += lum(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]); }
    if (a > 0.08) { const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // a coloured plate (red, blue …) is part of the brand: the header keeps it, as a rounded badge
  const branded = plate && Math.max(...bg) > 50 && (Math.max(...bg) - Math.min(...bg)) / Math.max(...bg) > 0.3;
  return { alpha, rgb, dark: ink > 0 && sum / ink < 0.25, box: x1 < 0 ? [0, 0, w - 1, h - 1] : [x0, y0, x1, y1], plate, branded };
}

/** Loads a logo (data URL) -> {header, felt, dark}: data URLs for the header image and the felt's ink (cream, alpha = ink).
 *  Null if unreadable. */
export function prepareLogo(src, size = 600) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const k = Math.min(1, size / Math.max(img.naturalWidth || size, img.naturalHeight || size));
        const w = Math.max(1, Math.round((img.naturalWidth || size) * k)), h = Math.max(1, Math.round((img.naturalHeight || size) * k));
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const g = canvas.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
        const { alpha, rgb, dark, box, branded } = inkOf(g.getImageData(0, 0, w, h).data, w, h);
        const [bx0, by0, bx1, by1] = box, pad = Math.round(Math.max(bx1 - bx0, by1 - by0) * .02);
        const X = Math.max(0, bx0 - pad), Y = Math.max(0, by0 - pad), W = Math.min(w, bx1 + pad + 1) - X, H = Math.min(h, by1 + pad + 1) - Y;
        const layer = ink => {   // the trimmed logo: its own colours, or one ink colour
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const cg = c.getContext('2d'), out = cg.createImageData(W, H);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const p = (y + Y) * w + x + X, o = (y * W + x) * 4;
            out.data.set(ink ?? [rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]], o); out.data[o + 3] = alpha[p];
          }
          cg.putImageData(out, 0, 0);
          return c;
        };
        const own = layer(null);
        let header = own;
        if (branded) {   // its own coloured plate, corners rounded
          const b = document.createElement('canvas'); b.width = w; b.height = h;
          const bg = b.getContext('2d'); bg.beginPath(); bg.roundRect(0, 0, w, h, Math.round(Math.min(w, h) * .18)); bg.clip(); bg.drawImage(img, 0, 0, w, h);
          header = b;
        } else if (dark) {   // a light badge around it, the logo in its own colours
          const py = Math.round(H * .22), px = Math.round(H * .3), b = document.createElement('canvas');
          b.width = W + 2 * px; b.height = H + 2 * py;
          const bg = b.getContext('2d'), r = Math.min(b.height / 2, Math.round(b.height * .28));
          bg.fillStyle = BADGE; bg.beginPath(); bg.roundRect(0, 0, b.width, b.height, r); bg.fill();
          bg.drawImage(own, px, py);
          header = b;
        }
        resolve({ header: header.toDataURL('image/png'), felt: layer(FELT_INK).toDataURL('image/png'), dark });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The felt's ink only (kept for older callers): {mask, dark}. */
export async function readLogo(src) {
  const p = await prepareLogo(src);
  return p && { mask: p.felt, dark: p.dark };
}
