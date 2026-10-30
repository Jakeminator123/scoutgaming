// Dealern: grönt klipp eller grön stillbild, nycklad i en fragment-shader och ritad över hjulet (förmultiplicerad alfa).
// Nyckeln är metodik/videoklipp/skript/greenscreen/linjar-nyckel.py översatt rad för rad:
//   d = g − max(r, b);  D = samma för skärmen S;  dF = min(minsta d inom FG px, 0);  nära = något d > 0,3 inom FG px
//   a = nära ? (D − T1 − d) / (D − T1 − (dF + T0)) : 1   (klämt, < 0,02 → 0, > 0,98 → 1)
//   P = I − (1 − a)·S, P_g ≤ max(P_r, P_b), P ≤ a        (förmultiplicerad förgrund)
// Python tar min/max över hela 9×9-rutan; här 16 grannar på 2 och 4 px avstånd (verktyg/jamfor-nyckel.mjs mäter skillnaden).
// Därefter rumsgraderingen F' = lift + F·(gain − lift), förmultiplicerat: lift·a + P·(gain − lift).
// Klippen är 1920×1088: rad y i bilden (1080) hämtas från rad y + beskarTopp i klippet, pixel för pixel (texelFetch).
// Två källor (A och B) blandas med uMix, så att byten vila ↔ kast kan tonas över några rutor.

const FRAG = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D uA, uB;
uniform ivec2 uMaxA, uMaxB;
uniform int uOffA, uOffB;
uniform vec3 uSA, uSB, uLift, uGain;
uniform float uMix, uSynlig;
const float T0 = 0.03, T1 = 0.05;
float dOf(vec3 c) { return c.g - max(c.r, c.b); }
vec4 nyckel(sampler2D t, ivec2 p, ivec2 mx, vec3 S) {
  vec3 I = texelFetch(t, clamp(p, ivec2(0), mx), 0).rgb;
  float d = dOf(I), dmin = d;
  bool nara = d > 0.3;
  for (int r = 2; r <= 4; r += 2) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    float dn = dOf(texelFetch(t, clamp(p + ivec2(i, j) * r, ivec2(0), mx), 0).rgb);
    dmin = min(dmin, dn); nara = nara || dn > 0.3;
  }
  float D = S.g - max(S.r, S.b), dF = min(dmin, 0.0);
  float a = nara ? clamp((D - T1 - d) / max(D - T1 - (dF + T0), 1e-3), 0.0, 1.0) : 1.0;
  a = a < 0.02 ? 0.0 : (a > 0.98 ? 1.0 : a);
  vec3 P = clamp(I - (1.0 - a) * S, 0.0, 1.0);
  P.g = min(P.g, max(P.r, P.b));
  P = min(P, vec3(a));
  return vec4(uLift * a + P * (uGain - uLift), a);
}
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  vec4 c = vec4(0.0);
  if (uMix < 1.0) c += (1.0 - uMix) * nyckel(uA, q + ivec2(0, uOffA), uMaxA, uSA);
  if (uMix > 0.0) c += uMix * nyckel(uB, q + ivec2(0, uOffB), uMaxB, uSB);
  gl_FragColor = c * uSynlig;
}`;

export function skapaDealer(H, GRAD) {                                  // GRAD: rummets {lift, gain}
  const { THREE } = H;
  const tom = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); tom.needsUpdate = true;
  const u = {
    uA: { value: tom }, uB: { value: tom }, uMaxA: { value: new THREE.Vector2(0, 0) }, uMaxB: { value: new THREE.Vector2(0, 0) },
    uOffA: { value: 0 }, uOffB: { value: 0 }, uSA: { value: new THREE.Vector3(34 / 255, 202 / 255, 68 / 255) },
    uSB: { value: new THREE.Vector3(34 / 255, 202 / 255, 68 / 255) }, uLift: { value: new THREE.Vector3(...GRAD.lift) },
    uGain: { value: new THREE.Vector3(...GRAD.gain) }, uMix: { value: 0 }, uSynlig: { value: 1 },
  };
  // ivec2-uniformer: three skickar Vector2 som ivec2 när shadern deklarerar ivec2
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: FRAG, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scen = new THREE.Scene(); scen.add(quad);
  const kam = new THREE.Camera();

  const satt = (sida, kalla) => {
    const k = sida === "A" ? "A" : "B";
    u["u" + k].value = kalla.tex;
    u["uMax" + k].value.set(1919, kalla.hojd - 1);
    u["uOff" + k].value = kalla.hojd - 1080 - kalla.beskarTopp;   // flipY: texturens rad = gl_FragCoord.y + (hojd − 1080 − beskarTopp)
    u["uS" + k].value.set(...kalla.skarm.map((v) => v / 255));
  };
  return {
    material: mat, uniforms: u,
    // visa en källa, eller tona från nuvarande A till ny källa (mix 0 → 1 sköts av anroparen)
    visa(kalla) { satt("A", kalla); u.uMix.value = 0; this.a = kalla; this.b = null; },
    tonaTill(kalla) { satt("B", kalla); this.b = kalla; },
    mix(v) { u.uMix.value = v; if (v >= 1 && this.b) { const b = this.b; this.visa(b); } },
    rita(renderer) { const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(scen, kam); renderer.autoClear = ac; },
  };
}

// källor
export function videoKalla(H, fil, { hojd = 1088, beskarTopp = 4, skarm = [34, 202, 68], loop = false } = {}) {
  const { THREE } = H;
  const v = document.createElement("video");
  Object.assign(v, { src: fil, muted: true, playsInline: true, preload: "auto", loop, crossOrigin: "anonymous" });
  const tex = new THREE.VideoTexture(v);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace;
  const klar = new Promise((ok, fel) => { v.addEventListener("loadeddata", ok, { once: true }); v.addEventListener("error", () => fel(Error("video: " + fil)), { once: true }); });
  v.load();
  return { typ: "video", video: v, tex, hojd, beskarTopp, skarm, klar };
}
export function bildKalla(H, fil, { hojd = 1080, beskarTopp = 0, skarm = [34, 202, 68] } = {}) {
  const { THREE } = H;
  const klar = new Promise((ok, fel) => new THREE.TextureLoader().load(fil, (t) => {
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; ok(t);
  }, undefined, () => fel(Error("bild: " + fil))));
  const k = { typ: "bild", tex: null, hojd, beskarTopp, skarm, klar: klar.then((t) => { k.tex = t; }) };
  return k;
}
