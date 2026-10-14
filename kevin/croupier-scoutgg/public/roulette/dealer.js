// Paow at the roulette wheel (Kevin 14 Oct: "lägg till en astrid eller paow som snurrar"). Her green-screen plates from
// blackjack (media/dealers/paow), keyed live like dealer-layer.js does and drawn BEHIND the table artwork, so the wheel and
// the table's rim cover her hands: she stands behind the wheel. Between rounds she plays her idle loops (idle-v2, rest to
// rest); when bets close she plays a spin take, then rests again.
// PLACEHOLDER: there is no roulette take of her yet. SPIN_CLIP is her blackjack deal to the dealer's spot (v2/posdealer),
// the nearest gesture that reaches toward the wheel. Emil is filming a real one (rest → spins the wheel, releases the ball
// → rest); swap the file name here when it lands.
const SPIN_CLIP = 'v2/posdealer.mp4';
const IDLES = [['breath', 40], ['glance', 12], ['smile', 4]];   // weights as the blackjack table (dealers.js idlesFor)
// Her part of the 1080 × 1920 plate: head to hands, left of the blackjack shoe and the rail's end at the right (x > 775).
export const CROP = Object.freeze({ x: 270, y: 120, w: 505, h: 780 });

const VERT = `attribute vec2 p; varying vec2 uv; uniform vec4 crop;
void main(){ vec2 t = vec2((p.x + 1.) * .5, (1. - p.y) * .5); uv = (crop.xy + t * crop.zw) / vec2(1080., 1920.); gl_Position = vec4(p, 0., 1.); }`;
// The blackjack key (dealer-layer.js gx/solid): green clearly above red and blue goes, with a soft band for hair; the
// green spill left on see-through edges is pulled down to the brighter of red and blue.
const FRAG = `precision mediump float; varying vec2 uv; uniform sampler2D tex;
float gx(vec2 t){ vec3 k = texture2D(tex, t).rgb; return k.g - max(k.r, k.b); }
float solid(vec2 t){ return clamp((1. - smoothstep(.015, .24, gx(t)) - .04) / .92, 0., 1.); }
void main(){
  vec2 d = vec2(1.5 / 1080., 1.5 / 1920.);
  float a = .4 * solid(uv) + .15 * (solid(uv + vec2(d.x, 0.)) + solid(uv - vec2(d.x, 0.)) + solid(uv + vec2(0., d.y)) + solid(uv - vec2(0., d.y)));
  vec3 c = texture2D(tex, uv).rgb; c.g = min(c.g, max(c.r, c.b) + .02 * a);
  gl_FragColor = vec4(c * a, a);
}`;

export function mountDealer(host, { base = '/media/dealers/paow/' } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = CROP.w; canvas.height = CROP.h;
  canvas.className = 'rl-dealer'; canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
  if (!gl) return null;   // no WebGL: the table plays without her
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform4f(gl.getUniformLocation(prog, 'crop'), CROP.x, CROP.y, CROP.w, CROP.h);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.clearColor(0, 0, 0, 0);
  const draw = src => { try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } catch {} };

  // her rest image until the first loop plays, and whenever a clip cannot
  const rest = new Image(); rest.onload = () => { if (!playing) draw(rest); }; rest.src = base + 'v2/vila.png';
  // two players: the next clip loads in the other while one plays, so a switch never shows an empty frame
  const players = [0, 1].map(() => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('playsinline', ''); v.className = 'rl-dealer-src'; host.append(v); return v; });
  let current = 0, playing = null, spinWanted = false, closed = false, onSpinDone = null;
  const pickIdle = () => { let r = Math.random() * IDLES.reduce((n, [, w]) => n + w, 0); for (const [name, w] of IDLES) if ((r -= w) < 0) return name; return 'breath'; };
  function play(file) {
    const v = players[current = 1 - current]; v.src = base + file; playing = v;
    v.play().catch(() => { playing = null; draw(rest); setTimeout(next, 3000); });
  }
  function next() {
    if (closed) return;
    if (playing?.dataset.spin) { playing.dataset.spin = ''; const done = onSpinDone; onSpinDone = null; done?.(); }
    if (spinWanted) { spinWanted = false; play(SPIN_CLIP); playing.dataset.spin = '1'; return; }
    play(`idle-v2/${pickIdle()}.mp4`);
  }
  for (const v of players) v.addEventListener('ended', () => { if (v === playing) next(); });
  const frame = () => { if (closed) return; if (playing && playing.readyState >= 2) draw(playing); requestAnimationFrame(frame); };
  host.prepend(canvas); next(); requestAnimationFrame(frame);   // first in the table: the artwork and the wheel paint over her
  return {
    canvas,
    // bets closed: she spins as soon as the loop she is in comes back to rest (every clip starts and ends there)
    spin() { spinWanted = true; return new Promise(resolve => { onSpinDone = resolve; }); },
    close() { closed = true; for (const v of players) { v.pause(); v.remove(); } canvas.remove(); },
  };
}
