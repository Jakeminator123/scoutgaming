// Server-side image helpers for Dealer Forge (sharp). No video decoding here:
// clip posters are the pose anchors that seeded the generation, and the matrix
// previews the real MP4 through the private media route.
import { createHash } from 'node:crypto';
import { FORGE_CANVAS, FORGE_CARD } from './dealer-forge-catalog.mjs';

const GREEN = { r: 0, g: 255, b: 0, alpha: 1 };
const fail = (message, status = 422, code = 'forge_invalid_image') => { throw Object.assign(new Error(message), { statusCode: status, code }); };

async function sharpModule() {
  try { return (await import('sharp')).default; }
  catch { fail('Bildbehandling (sharp) är inte tillgänglig här.', 503, 'forge_sharp_unavailable'); }
}

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function imageInfo(bytes) {
  const sharp = await sharpModule();
  let meta;
  try { meta = await sharp(bytes, { limitInputPixels: 64_000_000 }).metadata(); } catch { fail('Filen kunde inte läsas som bild.'); }
  if (!meta.width || !meta.height || !['png', 'jpeg', 'webp'].includes(meta.format)) fail('Ankaret ska vara PNG, JPEG eller WebP.');
  return { width: meta.width, height: meta.height, format: meta.format };
}

/** Letterbox any portrait photo onto the green 1080x1920 master canvas as PNG. */
export async function normalizeAnchor(bytes) {
  const sharp = await sharpModule();
  const info = await imageInfo(bytes);
  if (info.width > info.height) fail('Grundposen ska vara en stående bild (9:16 eller högre).');
  const png = await sharp(bytes, { limitInputPixels: 64_000_000 }).rotate()
    .resize(FORGE_CANVAS.width, FORGE_CANVAS.height, { fit: 'contain', background: GREEN, kernel: 'lanczos3' })
    .flatten({ background: GREEN }).png({ compressionLevel: 9 }).toBuffer();
  return { bytes: png, width: FORGE_CANVAS.width, height: FORGE_CANVAS.height, contentType: 'image/png', sha256: sha256(png), size: png.byteLength, source: info };
}

const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
const polygon = points => points.map(([x, y]) => `${x},${y}`).join(' ');

/** Paint a blank white card at the target so the last keyframe tells the model where the card lands. */
export async function markCardTarget(anchorPng, point, { faceDown = false } = {}) {
  const sharp = await sharpModule();
  const x = point.cx - FORGE_CARD.width / 2, y = point.cy - FORGE_CARD.height / 2;
  const fill = faceDown ? '#1b1f3a' : '#ffffff';
  const overlay = svg(FORGE_CANVAS.width, FORGE_CANVAS.height, `<rect x="${x}" y="${y}" width="${FORGE_CARD.width}" height="${FORGE_CARD.height}" rx="5" fill="${fill}" stroke="#d8d8d8" stroke-width="2"/>`);
  return sharp(anchorPng).composite([{ input: overlay }]).png().toBuffer();
}

/** Table geometry guide on magenta: silhouette, front edge and the eight landing marks. */
export async function tableGuide(profile) {
  const sharp = await sharpModule();
  const { width, height } = FORGE_CANVAS;
  const marks = Object.entries(profile.positions).map(([name, p]) => `<rect x="${p.cx - FORGE_CARD.width / 2}" y="${p.cy - FORGE_CARD.height / 2}" width="${FORGE_CARD.width}" height="${FORGE_CARD.height}" fill="none" stroke="#eed392" stroke-width="3"/>`
    + `<text x="${p.cx - 20}" y="${p.cy + FORGE_CARD.height / 2 + 28}" font-family="sans-serif" font-size="22" fill="#f0f0f0">${name}</text>`).join('');
  const body = `<rect width="${width}" height="${height}" fill="#ff00ff"/>`
    + `<polygon points="${polygon(profile.table.outline)}" fill="#3e454f"/>`
    + `<polyline points="${polygon(profile.table.frontLine)}" fill="none" stroke="#d5b972" stroke-width="8"/>` + marks;
  return sharp(svg(width, height, body)).png().toBuffer();
}

/** Composition guide for an empty room: dark plate with the dealer-safe region. */
export async function backgroundGuide() {
  const sharp = await sharpModule();
  const width = 1920, height = 1080, scale = height / 1080, ox = (width - 1080 * scale) / 2, oy = -108 * scale;
  const [x1, y1, x2, y2] = [250, 115, 870, 940];
  const body = `<rect width="${width}" height="${height}" fill="#1c202a"/>`
    + `<rect x="${ox + x1 * scale}" y="${oy + y1 * scale}" width="${(x2 - x1) * scale}" height="${(y2 - y1) * scale}" fill="none" stroke="#aabece" stroke-width="3"/>`
    + `<text x="35" y="48" font-family="sans-serif" font-size="26" fill="#ebebeb">COMPOSITION GUIDE: empty room, no table, calm central dealer area</text>`;
  return sharp(svg(width, height, body)).png().toBuffer();
}

/** Key the magenta separation background to alpha and garbage-matte outside the table outline. Lossless WebP. */
export async function tableLayerFromMagenta(bytes, profile, { size = [1080, 1920] } = {}) {
  const sharp = await sharpModule();
  const [width, height] = size;
  const { data, info } = await sharp(bytes, { limitInputPixels: 64_000_000 }).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) fail('Bordsbilden kunde inte avkodas.');
  const alpha = Buffer.alloc(width * height);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 3) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const dominance = Math.min(r, b) - g; // magenta: high R and B, low G
    const a = 1 - Math.min(1, Math.max(0, (dominance - 40) / 60));
    alpha[i] = Math.round(a * 255);
  }
  const sx = width / FORGE_CANVAS.width, sy = height / FORGE_CANVAS.height;
  const mask = await sharp(svg(width, height, `<rect width="${width}" height="${height}" fill="#000"/><polygon points="${polygon(profile.table.outline.map(([x, y]) => [x * sx, y * sy]))}" fill="#fff"/>`)).greyscale().raw().toBuffer();
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(alpha[i] * mask[i] / 255);
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0, q = 0; i < alpha.length; i++, p += 3, q += 4) { rgba[q] = data[p]; rgba[q + 1] = data[p + 1]; rgba[q + 2] = data[p + 2]; rgba[q + 3] = alpha[i]; }
  const webp = await sharp(rgba, { raw: { width, height, channels: 4 } }).webp({ lossless: true }).toBuffer();
  return { bytes: webp, width, height, contentType: 'image/webp', sha256: sha256(webp), size: webp.byteLength };
}

/** Cover-fit a generated room plate to the landscape master. */
export async function backgroundLayer(bytes, { size = [1920, 1080] } = {}) {
  const sharp = await sharpModule();
  const [width, height] = size;
  const webp = await sharp(bytes, { limitInputPixels: 64_000_000 }).resize(width, height, { fit: 'cover', kernel: 'lanczos3' }).removeAlpha().webp({ quality: 92 }).toBuffer();
  return { bytes: webp, width, height, contentType: 'image/webp', sha256: sha256(webp), size: webp.byteLength };
}

/** Generated pose stills are normalized exactly like uploaded anchors. */
export async function poseFromGenerated(bytes) { return normalizeAnchor(bytes); }

/** Small poster for the matrix. */
export async function poster(bytes, width = 270) {
  const sharp = await sharpModule();
  return sharp(bytes, { limitInputPixels: 64_000_000 }).resize(width, null, { kernel: 'lanczos3' }).webp({ quality: 80 }).toBuffer();
}
