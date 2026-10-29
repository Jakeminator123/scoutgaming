// Landing check for AI proposals: is the felt where cards land (seven betting
// boxes and the dealer spot) calm and does it give the box outline contrast?
// For a background the same check covers the area behind the dealer and the
// strip a phone shows. It only warns (Jakob 2026-10-29): the person still picks
// a proposal with "Använd", and the warning names the worst zone.
//
// Measured on the model's image after it is fitted to the template and before
// the server draws the boxes, so the drawn outlines never count as detail.

// Mean local luminance spread (standard deviation in 32 px tiles, 0-255).
// Woven felt and film grain stay around 3-10; a pattern, lettering or painted
// shapes the size of a card's index reach 30 or more. Above 18 (about 7 % of
// full range) the felt starts to compete with the card's corner index.
export const LANDING_LOCAL_SPREAD_MAX = 18;
// A gradient step of 24 levels (about 10 % luminance) is roughly the smallest
// edge a viewer still reads as a line on a compressed video stream.
export const LANDING_EDGE_STEP = 24;
// Share of pixels with such an edge. Calm felt has almost none; one or two
// stray lines across a box stay near 1-3 %; rings, text or a checkered
// pattern pass 5 %.
export const LANDING_EDGE_DENSITY_MAX = .05;
// WCAG 2.2 SC 1.4.11 (non-text contrast): a graphical outline needs 3:1
// against what is next to it. Here: the box stroke over the felt's mean colour.
export const LANDING_STROKE_CONTRAST_MIN = 3;
// Tile edge for the local spread; about a quarter of a box at the default canvas.
const TILE = 32;
// Upper part of the background's centre column: head and shoulders. Below it
// the table graphic and the dealer's hands cover the background.
export const BACKGROUND_TABLE_TOP = 400;

const round = (value, digits = 3) => Math.round(value*10**digits)/10**digits;
const luminance = (r, g, b) => .2126*r+.7152*g+.0722*b;
const linear = channel => { const value = channel/255; return value<=.04045?value/12.92:((value+.055)/1.055)**2.4; };
const relative = ([r, g, b]) => .2126*linear(r)+.7152*linear(g)+.0722*linear(b);
const contrastRatio = (one, two) => { const [high, low] = [relative(one), relative(two)].sort((a, b) => b-a); return (high+.05)/(low+.05); };

// "rgba(r,g,b,a)" or "#rrggbb" as [r,g,b,a]; anything else is null.
export function parseStroke(value) {
  const rgba = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/.exec(String(value ?? '').trim());
  if (rgba) { const rgb = rgba.slice(1, 4).map(Number); return rgb.every(channel => channel<=255)?[...rgb, rgba[4]===undefined?1:Number(rgba[4])]:null; }
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(value ?? '').trim());
  return hex?[...hex.slice(1).map(part => parseInt(part, 16)), 1]:null;
}

// Zones in image pixels. A box is measured inside its outline (inset by twice
// the stroke width), which is the felt under and around a landed card.
export function tableLandingZones(template) {
  const stroke = Math.max(3, template.card.width*.05), inset = 2*stroke;
  const inner = box => ({x: box.x+inset, y: box.y+inset, width: box.width-2*inset, height: box.height-2*inset});
  return [...template.seats.map(seat => ({zone: `box-${seat.id}`, rect: inner(seat.box)})), {zone: 'dealer', rect: inner(template.dealer.box)}];
}
// frame: {dealer:[x0,x1], phone:[x0,x1]} in background pixels.
export function backgroundLandingZones(frame, size) {
  return [
    {zone: 'dealer', rect: {x: frame.dealer[0], y: 0, width: frame.dealer[1]-frame.dealer[0], height: Math.min(BACKGROUND_TABLE_TOP, size.height)}},
    {zone: 'phone', rect: {x: frame.phone[0], y: 0, width: frame.phone[1]-frame.phone[0], height: size.height}},
  ];
}

function clip(rect, width, height) {
  const x0 = Math.max(0, Math.floor(rect.x)), y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x+rect.width)), y1 = Math.min(height, Math.ceil(rect.y+rect.height));
  return x1-x0>=3&&y1-y0>=3?{x0, y0, x1, y1}:null;
}

// Measures one zone of a raw RGB(A) buffer.
function measure(data, info, rect, stroke) {
  const box = clip(rect, info.width, info.height);
  if (!box) return null;
  const {x0, y0, x1, y1} = box, w = x1-x0, h = y1-y0, channels = info.channels;
  const lum = new Float64Array(w*h), mean = [0, 0, 0];
  for (let y = 0; y<h; y++) for (let x = 0; x<w; x++) {
    const at = ((y0+y)*info.width+x0+x)*channels, r = data[at], g = data[at+1], b = data[at+2];
    lum[y*w+x] = luminance(r, g, b); mean[0] += r; mean[1] += g; mean[2] += b;
  }
  const felt = mean.map(sum => sum/(w*h));
  // Mean of the per-tile standard deviation: a smooth light falloff across the
  // zone is not detail, a pattern inside each tile is.
  const columns = Math.max(1, Math.round(w/TILE)), rows = Math.max(1, Math.round(h/TILE));
  let spread = 0;
  for (let row = 0; row<rows; row++) for (let column = 0; column<columns; column++) {
    const tx0 = Math.floor(column*w/columns), tx1 = Math.floor((column+1)*w/columns), ty0 = Math.floor(row*h/rows), ty1 = Math.floor((row+1)*h/rows);
    let sum = 0, square = 0, count = 0;
    for (let y = ty0; y<ty1; y++) for (let x = tx0; x<tx1; x++) { const value = lum[y*w+x]; sum += value; square += value*value; count++; }
    spread += Math.sqrt(Math.max(0, square/count-(sum/count)**2));
  }
  spread /= rows*columns;
  // Sobel on the interior; divided by 4 so a step of n levels gives n.
  let edges = 0, total = 0;
  for (let y = 1; y<h-1; y++) for (let x = 1; x<w-1; x++) {
    const at = y*w+x, a = lum[at-w-1], b = lum[at-w], c = lum[at-w+1], d = lum[at-1], f = lum[at+1], g = lum[at+w-1], k = lum[at+w], l = lum[at+w+1];
    const gx = (c+2*f+l-a-2*d-g)/4, gy = (g+2*k+l-a-2*b-c)/4;
    if (gx*gx+gy*gy>LANDING_EDGE_STEP**2) edges++;
    total++;
  }
  const density = total?edges/total:0;
  let contrast = null;
  if (stroke) {
    const [r, g, b, alpha] = stroke, drawn = [r, g, b].map((channel, index) => alpha*channel+(1-alpha)*felt[index]);
    contrast = contrastRatio(drawn, felt);
  }
  // The score is the worst ratio to its limit; above 1 is a warning.
  const parts = [['busy', spread/LANDING_LOCAL_SPREAD_MAX], ['edges', density/LANDING_EDGE_DENSITY_MAX]];
  if (contrast!==null) parts.push(['low_contrast', LANDING_STROKE_CONTRAST_MIN/contrast]);
  const [reason, score] = parts.reduce((worst, part) => part[1]>worst[1]?part:worst);
  return {spread: round(spread, 2), edges: round(density, 4), contrast: contrast===null?null:round(contrast, 2), score: round(score), reason};
}

// Floor line (Jakob 2026-10-29): a background shot from the dealer camera has
// a wall above the camera contract's floor line and a floor below it, so the
// two bands next to the line differ in colour or brightness. A room seen from
// above (floor on both sides of the line) or a flat backdrop (no floor) does
// not, and the table graphic then floats. Measured in the outer columns only:
// the table graphic covers the centre column there.
// Band height on each side of the line, and the gap left around it because
// the model's line is not pixel-exact (shares of the image height).
export const FLOOR_BAND = .1;
export const FLOOR_GAP = .02;
// Distance between the bands' mean sRGB colours (0-441). 16 is about 4 % of the
// full range and 9 grey levels: grain, an even wall and a soft top-to-bottom
// light falloff (one level per 20 px) stay under it; a floor that differs from
// the wall by about a tenth in brightness or tone is over it.
export const FLOOR_DIFFERENCE_MIN = 16;
export const NO_FLOOR_MESSAGE = 'Bakgrunden saknar synligt golv – bordet kommer att sväva';

function meanColour(data, info, rect) {
  const box = clip(rect, info.width, info.height);
  if (!box) return null;
  const sum = [0, 0, 0];
  for (let y = box.y0; y<box.y1; y++) for (let x = box.x0; x<box.x1; x++) {
    const at = (y*info.width+x)*info.channels; sum[0] += data[at]; sum[1] += data[at+1]; sum[2] += data[at+2];
  }
  const count = (box.x1-box.x0)*(box.y1-box.y0);
  return sum.map(value => value/count);
}

/**
 * Floor check for a background (a sharp instance at size). frame.dealer is the
 * centre column [x0, x1]; floorLine a share of the height.
 * Returns {ok, code:'no_floor'|null, message, sides:[{side, difference}]}.
 * Both sides need a clear line: the table stands in the middle of the floor.
 */
export async function floorCheck(image, frame, size, {floorLine}) {
  const {data, info} = await image.toColourspace('srgb').raw().toBuffer({resolveWithObject: true});
  const line = floorLine*size.height, band = FLOOR_BAND*size.height, gap = FLOOR_GAP*size.height;
  const sides = [['left', 0, frame.dealer[0]], ['right', frame.dealer[1], size.width]].map(([side, x0, x1]) => {
    const above = meanColour(data, info, {x: x0, y: line-gap-band, width: x1-x0, height: band});
    const below = meanColour(data, info, {x: x0, y: line+gap, width: x1-x0, height: band});
    if (!above||!below) throw Error('no_floor_zone');
    return {side, difference: round(Math.hypot(...above.map((value, index) => value-below[index])), 2)};
  });
  const ok = sides.every(side => side.difference>=FLOOR_DIFFERENCE_MIN);
  return {ok, code: ok?null:'no_floor', message: ok?null:NO_FLOOR_MESSAGE, sides};
}

/**
 * Checks the zones of one image (a sharp instance at the zones' pixel size).
 * Returns {ok, worst:{zone, score, reason}, zones:[{zone, ok, score, reason, spread, edges, contrast}]}.
 * reason: 'busy' (local spread), 'edges' (edge density) or 'low_contrast' (stroke against felt).
 */
export async function landingCheck(image, zones, {stroke = null} = {}) {
  // sRGB keeps three colour channels also for a greyscale image.
  const {data, info} = await image.toColourspace('srgb').raw().toBuffer({resolveWithObject: true});
  const colour = stroke===null?null:parseStroke(stroke);
  if (stroke!==null&&!colour) throw Error('invalid_landing_stroke');
  const rows = zones.map(({zone, rect}) => { const result = measure(data, info, rect, colour); return result?{zone, ok: result.score<=1, ...result}:null; }).filter(Boolean);
  if (!rows.length) throw Error('no_landing_zone');
  const worst = rows.reduce((one, two) => two.score>one.score?two:one);
  return {ok: rows.every(row => row.ok), worst: {zone: worst.zone, score: worst.score, reason: worst.reason}, zones: rows};
}
