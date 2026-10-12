import { REST_TAKES } from './dealers.js';

// Keyed dealer layer for a green-screen dealer: drawn ABOVE the game cards, so
// his hands and arms always lie over every card. The room is the still below the
// cards; this canvas shows only him, keyed live from whichever clip is on screen
// (or his green start image between clips). After his filmed white card comes to
// rest, it is keyed out inside its landing spot so the game's valued card shows.
const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = vec2((p.x + 1.0) * .5, (1.0 - p.y) * .5); gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision mediump float; uniform float S0; varying vec2 uv; uniform sampler2D tex;
uniform vec4 card; uniform float cardOn; uniform vec2 qa, qb, qc, qd; uniform float quadOn;
uniform vec2 skin;   // his skin hue and saturation (0..1), picked from his rest image
uniform vec3 lift, gain;   // the room's grade on him: its black point, and a nudge toward its light
uniform float finished;   // Emil's KLARA plates: already graded and despilled, so none of the clean-up below runs on them
uniform sampler2D lipTex; uniform vec4 lipRect; uniform float lipOn;   // his talking mouth (lip-layer.js): colour above, mask below
// How much of a source pixel is HIM (1) versus green screen (0). A wide band keeps
// see-through hair strands soft instead of cutting them out.
float gx(vec2 t){ vec3 k = texture2D(tex, t).rgb; return k.g - max(k.r, k.b); }
// Keylight-style matte: a wide soft band (hair edges keep partial alpha), then clip black/white so
// faint green noise in the suit or hair never turns see-through.
float solid(vec2 t){ return clamp((1. - smoothstep(.015, .24, gx(t)) - .04) / .92, 0., 1.); }
vec3 hsv(vec3 c){ vec4 K = vec4(0., -1. / 3., 2. / 3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6. * d + 1e-4)), d / (q.x + 1e-4), q.x); }   // 1e-4: mediump is fp16 on phones
vec3 rgb(vec3 h){ return h.z * mix(vec3(1.), clamp(abs(fract(h.xxx + vec3(1., 2. / 3., 1. / 3.)) * 6. - 3.) - 1., 0., 1.), h.y); }
// Spill to skin (the Hue vs Hue curve trick): green cast that survives the key (motion-blurred fingers,
// see-through edges) takes his skin hue at its own brightness, so it reads as skin instead of turning
// grey. Only hues where green leads (past yellow, up to cyan); saturation capped at his skin's, so no orange fringe.
vec3 unspill(vec3 c){ vec3 h = hsv(c); float band = smoothstep(.17, .22, h.x) * (1. - smoothstep(.45, .50, h.x));
  return mix(c, rgb(vec3(skin.x, min(h.y, skin.y), h.z)), band); }
// Signed distance of p inside edge a->b of a clockwise (screen, y down) quad.
float edge(vec2 p, vec2 a, vec2 b){ vec2 e = b - a; return (e.x * (p.y - a.y) - e.y * (p.x - a.x)) / max(length(e), 1e-3); }
void main(){
  // Bring him to Astrid's size and seat: everything above the table edge (y 715),
  // arms included, is scaled to S0 about the table centre (1 = the plate is already at her size). Widths ease back to 1.0
  // only below his resting hands (760-900), so every card he lays on the seats
  // (y 895 and lower) stays exactly where it was filmed.
  vec2 q = uv * vec2(1080., 1920.);
  float s = mix(S0, 1., smoothstep(760., 900., q.y));
  vec2 src = vec2(540. + (q.x - 540.) / s, q.y < 715. ? 715. - (715. - q.y) / S0 : q.y);
  vec2 suv = src / vec2(1080., 1920.);
  if (suv.x < 0. || suv.x > 1. || suv.y < 0. || suv.y > 1.) { gl_FragColor = vec4(0.); return; }
  vec3 c = texture2D(tex, suv).rgb;
  // Speaking over a clip: the mouth patch for this very frame goes in before anything reads his colours (rorlig-lipsync.mjs).
  vec2 lu = (src - lipRect.xy) / lipRect.zw;
  if (lipOn > .5 && lu.x > 0. && lu.x < 1. && lu.y > 0. && lu.y < 1.)
    c = mix(c, texture2D(lipTex, vec2(lu.x, lu.y * .5)).rgb, clamp(texture2D(lipTex, vec2(lu.x, .5 + lu.y * .5)).r, 0., 1.));
  // Green = green clearly above both red and blue, at any brightness (catches the
  // dark green shading of the table rim too). Skin, white shirt and black suit are not.
  // The matte is softened ~1.5 px (a 5-tap cross) so edges blend instead of stair-stepping.
  vec2 d = vec2(1.5 / 1080., 1.5 / 1920.);
  float a = .4 * solid(suv) + .15 * (solid(suv + vec2(d.x, 0.)) + solid(suv - vec2(d.x, 0.)) + solid(suv + vec2(0., d.y)) + solid(suv - vec2(0., d.y)));
  // Skin (his fingers) stays in front of the game's card; anything else on the moving card goes.
  float skin = step(.2, c.r) * step(c.g, c.r) * step(.06, c.r - c.b) * step(.42 * c.r, c.g);
  // Kevin compared the game with Emil's own composite: on his finished plates the spill and rim clean-up below left a
  // pink edge round the fingers and hollowed the hair and finger edges, so they keep their own pixels.
  // Spill: where he is see-through (hair, edges) any green cast left from the screen goes, on every plate.
  float edgeW = 1. - smoothstep(.75, 1., a);
  if (finished > .5) c.g = min(c.g, max(c.r, c.b) + .02 * (1. - edgeW));
  if (finished < .5) {
  c = unspill(c);
  c.g = min(c.g, mix(max(c.r, c.b) + .02, (c.r + c.b) * .5, edgeW));
  // Edge decontamination (Keylight): the plates carry a 1-3 px dark rim between hair and green with no
  // green in it, so no key removes it. Any pixel within 3 px of the screen takes the colour from 6 px
  // further inside instead.
  vec2 rim = vec2(0.);
  for (int i = 0; i < 8; i++) {
    float an = float(i) * .7853982;
    vec2 dir = vec2(cos(an), sin(an));
    rim += dir * step(.1, gx(suv + dir * vec2(3. / 1080., 3. / 1920.)));
  }
  float near = clamp(length(rim) / 2., 0., 1.);
  if (a > .01 && near > 0.) {
    vec2 inward = -normalize(rim);
    vec2 iuv = suv + inward * vec2(6. / 1080., 6. / 1920.);
    vec3 inner = texture2D(tex, iuv).rgb;
    inner = unspill(inner);
    c = mix(c, inner, near * (1. - smoothstep(.02, .08, gx(iuv))));
    a *= 1. - .3 * near;   // choke the outermost pixel a little, like Keylight's screen shrink
  }
  }
  // He stands BEHIND the table: the room's rail (y 714-726) must cover his torso, but his plate's own rail sits ~26 px
  // lower (738-756), so his jacket showed over the room's rail and hung onto the felt. In the band from the room's
  // rail down to his plate's rail he is hidden wherever his plate's rail (y 746) is clear green in that column, i.e.
  // nothing of him is in front of the table there; where an arm crosses his rail it crosses the room's too and stays.
  float railBand = smoothstep(710., 714., q.y) * (1. - smoothstep(735., 739., q.y));
  vec2 ruv = vec2(suv.x, 746. / 1920.), rdx = vec2(3. / 1080., 0.);
  float front = max(solid(ruv), max(solid(ruv + rdx), solid(ruv - rdx)));
  // KLARA plates share the room's table pixels (rooms v2), so no offset to hide: the band showed the room's rail between his arms.
  a *= 1. - railBand * (1. - front) * (1. - finished);
  // His landed white prop: neutral and bright inside the seat's card spot.
  vec2 px = uv * vec2(1080., 1920.);
  float inCard = step(abs(px.x - card.x), card.z) * step(abs(px.y - card.y), card.w);
  float paper = smoothstep(.62, .72, min(min(c.r, c.g), c.b)) * (1. - smoothstep(.06, .12, max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b)));
  a *= 1. - cardOn * inCard * paper;
  // His card in motion: the game draws the real card along the same track underneath.
  float inQuad = step(-3., min(min(edge(px, qa, qb), edge(px, qb, qc)), min(edge(px, qc, qd), edge(px, qd, qa))));
  a *= 1. - quadOn * inQuad * (1. - skin);
  // Last, after the card checks read his real colours: sit him in the room (its blacks, its light).
  gl_FragColor = vec4((lift + c * (gain - lift)) * a, a);
}`;

// Like the eyedropper on normal skin: median hue and saturation of the pixels the shader calls skin
// (warm, red above green, not the greenish ones) in his rest image.
function pickSkin(img) {
  const w = 270, h = 480, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const px = x.getImageData(0, 0, w, h).data, hues = [], sats = [];
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    if (r < .2 || g > r || r - b < .06 || g < .42 * r) continue;
    const d = r - Math.min(g, b);
    hues.push(((g - b) / d / 6 + 1) % 1); sats.push(d / r);
  }
  if (hues.length < 50) return [.07, .45];
  const mid = a => a.sort((p, q) => p - q)[a.length >> 1];
  return [mid(hues), mid(sats)];
}

// Match him to the room behind him, as compositors do: its black point (darkest 2% of the room above
// the table) lifts his blacks, and its average colour nudges his white balance at the same brightness.
const ROOM_GRADE = .2;
function roomGrade(img) {
  const w = 135, h = 240, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const px = x.getImageData(0, Math.round(h * 150 / 1920), w, Math.round(h * 550 / 1920)).data, all = [];
  for (let i = 0; i < px.length; i += 4) all.push([px[i] / 255, px[i + 1] / 255, px[i + 2] / 255]);
  const lum = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const avg = list => [0, 1, 2].map(k => list.reduce((t, c) => t + c[k], 0) / list.length);
  const dark = [...all].sort((p, q) => lum(p) - lum(q)).slice(0, Math.max(1, Math.round(all.length * .02)));
  const mean = avg(all);
  return { lift: avg(dark), gain: mean.map(v => 1 + ROOM_GRADE * (v / lum(mean) - 1)) };
}

export function createDealerLayer({ stage, still, land, cardAt, faceAt, scale = .8, inFrames = 0, keyHalf = [38, 48], finished = false, lips = null }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dealer-layer'; canvas.width = 1080; canvas.height = 1920;
  canvas.setAttribute('aria-hidden', 'true');
  stage.querySelector('#gameCards').after(canvas);
  stage.classList.add('keyed-dealer');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const uCard = gl.getUniformLocation(prog, 'card'), uCardOn = gl.getUniformLocation(prog, 'cardOn');
  const uQuad = ['qa', 'qb', 'qc', 'qd'].map(n => gl.getUniformLocation(prog, n)), uQuadOn = gl.getUniformLocation(prog, 'quadOn');
  gl.uniform1f(gl.getUniformLocation(prog, 'S0'), scale);
  gl.uniform1f(gl.getUniformLocation(prog, 'finished'), finished ? 1 : 0);
  const uSkin = gl.getUniformLocation(prog, 'skin');
  gl.uniform2f(uSkin, .07, .45);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const uLift = gl.getUniformLocation(prog, 'lift'), uGain = gl.getUniformLocation(prog, 'gain');
  gl.uniform3f(uLift, 0, 0, 0); gl.uniform3f(uGain, 1, 1, 1);
  // The mouth patch lives on texture unit 1; the clip stays on unit 0.
  gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'lipTex'), 1);
  const uLipRect = gl.getUniformLocation(prog, 'lipRect'), uLipOn = gl.getUniformLocation(prog, 'lipOn');
  gl.uniform1f(uLipOn, 0);
  const lipTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lipTexture);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.activeTexture(gl.TEXTURE0);
  let lipKey = '';
  // The room is the still under the cards; it changes when the player picks another room.
  const room = stage.querySelector('.still');
  const regrade = () => {
    if (finished || !room?.complete || !room.naturalWidth) return;   // finished plates are graded already: no lift on their blacks
    const g = roomGrade(room); gl.uniform3fv(uLift, g.lift); gl.uniform3fv(uGain, g.gain); lastStamp = ''; lastSource = '';
  };
  room?.addEventListener('load', regrade);
  const img = new Image();
  // The stage waits dark (index.html, .pending) until the room and this dealer can both be drawn: then show it, two frames later.
  const reveal = () => { if (room?.complete && room.naturalWidth && img.complete && img.naturalWidth) requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('pending'))); };
  room?.addEventListener('load', reveal);
  img.onload = () => { gl.uniform2fv(uSkin, pickSkin(img)); lastStamp = ''; lastSource = ''; reveal(); };
  img.src = still;
  const videos = [...stage.querySelectorAll('video')];
  let lastStamp = '', lastSource = '';
  const lipDebug = /[?&]lipdebug=1/.test(location.search) ? (globalThis.__lip = { frames: 0, hits: 0, misses: [] }) : null;
  function draw() {
    const v = videos.find(x => x.classList.contains('on') && x.readyState >= 2);
    const src = v ?? (img.complete && img.naturalWidth ? img : null);
    // Only redraw when something new is on screen: a new video frame or a switch
    // between clip and still. Uploading 1080x1920 every animation frame is wasteful.
    // While he speaks over his clips, the patch for this frame is part of what is on screen: a new patch redraws too,
    // also on a still or a held last frame (the mouth moves while the body waits).
    const name = v ? /\/([a-z0-9]+(?:-[iuv]+)?)\.mp4/.exec(v.dataset.source || v.currentSrc || '')?.[1] : null;
    const raw = v ? Math.floor(v.currentTime * 24 + 1e-5) : 0;
    const atEnd = v && (v.ended || (Number.isFinite(v.duration) && v.currentTime >= v.duration - .05));
    // He rests on his still, or on the last frame of a clip that ends at rest: every clip but a deal take that ends in REDO.
    const rest = !v || (atEnd && !/^pos[a-z0-9]+(-i)?$/.test(name ?? ''));
    const lip = lips?.active() ? lips.at(name, raw, rest) : null;
    // ?lipdebug=1: how many drawn frames while he speaks got their mouth, and which take/frame missed (QA only)
    if (lipDebug && lips?.active()) { lipDebug.frames++; if (lip) lipDebug.hits++; else if (lips.silentNow?.()) lipDebug.silent = (lipDebug.silent ?? 0) + 1; else if (lipDebug.misses.length < 80) lipDebug.misses.push(`${name}:${raw}:${rest ? 'vila' : ''} [${lips.why?.(name, raw)}]`); }
    const stamp = (v ? `${v.currentSrc}@${v.currentTime}` : src ? 'still' : '') + (lip ? `|${lip.key}` : '');
    if (src && stamp !== lastStamp) {
      lastStamp = stamp;
      if (lip && lip.key !== lipKey) {
        gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lip.bitmap); gl.activeTexture(gl.TEXTURE0);
        lipKey = lip.key;
      }
      if (lip) gl.uniform4f(uLipRect, ...lip.rect);
      gl.uniform1f(uLipOn, lip ? 1 : 0);
      if (stamp.split('|')[0] !== lastSource) { lastSource = stamp.split('|')[0]; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
      // Which take and frame is on screen decides whether his landed card is keyed out.
      // -v / -iv: the take that ends at rest (a hit, the dealer drawing more): its own track ('4v', 'dealerv') and
      // landing, at the same seat. These were missed before, so his white prop covered the hit card's face (Kevin, 10 Oct).
      const m = v ? /\/([a-z0-9]+)(?:-([iuv]+))?\.mp4/.exec(v.dataset.source || v.currentSrc || '') : null;   // playback is a blob URL; the preloader keeps the real one
      const take = m?.[1], seat = take === 'posdealer' ? 'dealer' : take?.replace('pos', ''), track = seat && (m?.[2]?.includes('v') ? `${seat}v` : seat);
      const lead = m?.[2]?.includes('i') && !REST_TAKES.includes(track) ? inFrames : 0;   // a ready dealer's -i variant starts with his in-transition (not a take from rest)
      const at = seat && cardAt(seat);
      const frame = v ? Math.floor(v.currentTime * 24 + 1e-5) - lead : 0;
      const on = at && frame >= (land[track] ?? Infinity);
      // Follow his card frame by frame (the same track the game projects on), and once it rests keep cutting it out on its
      // resting outline: the game's card may lie a step beside it (its own place in the hand), so his prop's grey edge
      // and shadow must go too, not only its white (Kevin 11 Oct: "the second card was transparent for a second").
      const face = at ? faceAt?.(track, v.currentTime - lead / 24) : null;
      (face?.q ?? [[0, 0], [0, 0], [0, 0], [0, 0]]).forEach(([x, y], i) => gl.uniform2f(uQuad[i], (at?.[0] ?? 0) + x, (at?.[1] ?? 0) + y));
      gl.uniform1f(uQuadOn, face ? 1 : 0);
      gl.uniform4f(uCard, at?.[0] ?? 0, at?.[1] ?? 0, keyHalf[0], keyHalf[1]);   // half-size of his resting prop, plus a margin
      gl.uniform1f(uCardOn, on ? 1 : 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  regrade();
  return canvas;
}
