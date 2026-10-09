// An operator logo printed on the felt: one ink colour cut from the logo's shape, so any logo (dark, light,
// coloured, with or without a background) reads like the table's own lettering. The same pass tells the header
// whether the logo is dark, so it can be shown light against the header's dark scrim.

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Pure: RGBA pixels -> {alpha (0..255 per pixel), dark}. A logo on a solid plate (all four corners opaque)
 *  inks whatever differs from the plate; a transparent logo inks its own alpha. */
export function inkOf(d, w, h) {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(i => i * 4);
  const plate = corners.every(i => d[i + 3] > 230);
  const bg = plate ? corners.reduce((n, i) => n + lum(d[i], d[i + 1], d[i + 2]), 0) / 4 : 0;
  const alpha = new Uint8ClampedArray(w * h);
  let ink = 0, sum = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const l = lum(d[i], d[i + 1], d[i + 2]);
    const a = plate ? Math.min(1, Math.abs(l - bg) * 3) : d[i + 3] / 255;
    alpha[p] = Math.round(a * 255);
    if (a > 0.5) { ink++; sum += l; }
  }
  return { alpha, dark: ink > 0 && sum / ink < 0.4 };
}

/** Loads a logo (data URL) and resolves {mask, dark}: mask is a white PNG whose alpha is the ink. Null if unreadable. */
export function readLogo(src, size = 512) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const g = canvas.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
        const image = g.getImageData(0, 0, w, h), { alpha, dark } = inkOf(image.data, w, h);
        for (let p = 0; p < w * h; p++) image.data.set([255, 255, 255, alpha[p]], p * 4);
        g.putImageData(image, 0, 0);
        resolve({ mask: canvas.toDataURL('image/png'), dark });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
