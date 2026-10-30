// Spelet: en hel runda med Astrid. Lager bakifrån: rum (scenens bakgrund) → 3D-hjulet → nycklad dealer → UI (HTML).
// Rundans tidslinje är kastklippets: t = 0 när klippet startar, rotorn får sin impuls vid wheelImpulseMs och 3D-kulan tar över
// vid ballReleaseMs. Kulans och rotorns rörelse kommer från roulette-fysik.mjs (planeras i en Web Worker innan SPELA).
// Kameran som en TV-sändning: S1 (dealern) tills kulan gått ca 1,5 varv → övertoning till S3 (hela hjulet) → åkning i 3D ned
// till en närbild som följer kulan genom fallet, studsarna och vilan → övertoning till S1 med pjäsen och vinsten.
// Övertoningarna görs i WebGL med en kopia av förra bilden. Mellan rundorna spelar idle-klippen (js/vila.mjs).
//   ?mal=17         tvingar utfallet (bara för test och inspelning); ?seed=N gör snurren reproducerbar
//   ?inspelning=1   egen klocka: verktyg/spela-in.mjs stegar tiden och läser bilden ruta för ruta
//   ?fps=1          visar bildtakten; ?idle=mapp/ tar idle-klippen ur en annan mapp; ?stilla=1 visar startbilden i stället
//   ?slapp=ms&inkast=x,y&inkastMs=ms   provar en annan övertagning ur handen (annars kastklippets json)
import * as K from "./konfig.mjs";
import { laddaBord } from "./bord.mjs";
import { laddaHjul, stallKamera, stallRum } from "./hjul.mjs";
import { skapaDealer, videoKalla, bildKalla } from "./dealer.mjs";
import { skapaVila } from "./vila.mjs";
import { skapaLjud } from "./ljud.mjs";
import { renderaPjas } from "./pjas.mjs";
import { skapaUI } from "./ui.mjs";
import { dra, WHEEL } from "./regler.mjs";

const Q = new URLSearchParams(location.search);
const INSPELNING = Q.get("inspelning") === "1";
// lokalt (localhost) skickas fel och en status var 5:e sekund till servern (/api/logg), så att felsökningen ser spelarens webbläsare
const LOGGA = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !INSPELNING && !navigator.webdriver;
const logga = (typ, data) => { if (LOGGA) fetch("/api/logg", { method: "POST", body: JSON.stringify({ typ, ...data }), keepalive: true }).catch(() => {}); };
if (LOGGA) {
  logga("start", { ua: navigator.userAgent, url: location.search, skarm: `${innerWidth}x${innerHeight}@${devicePixelRatio}` });
  addEventListener("error", (e) => logga("fel", { msg: e.message, var: `${e.filename}:${e.lineno}` }));
  addEventListener("unhandledrejection", (e) => logga("fel", { msg: String(e.reason?.stack ?? e.reason) }));
  const ce = console.error.bind(console);
  console.error = (...a) => { ce(...a); logga("konsol", { msg: a.map((x) => x?.stack ?? (typeof x === "object" ? JSON.stringify(x) : String(x))).join(" ").slice(0, 1500) }); };
}
const TVINGA = Q.has("mal") ? Q.get("mal").split(",").map(Number) : null;   // ?mal=17 eller ?mal=17,5,0 (en per runda)
let rundNr = 0;
const UPPHAMT = 205, STEG = 360 / 37;

// ---------- klockan ----------
let virt = 0;
const klocka = () => (INSPELNING ? virt : performance.now());
const uppgifter = new Set();                       // körs varje bildruta tills de returnerar true
const nar = (f) => uppgifter.add(f);

// ---------- scenen skalas till fönstret ----------
const scen = document.getElementById("scen");
let ui = null;
function skala() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  scen.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
}
addEventListener("resize", () => { skala(); ui?.passa(); });
skala();
const laddText = document.querySelector("#laddar .txt"), laddStapel = document.querySelector("#laddar .stapel i");
const laddSteg = { rum: 0, astrid: 0, klipp: 0, hjul: 0 }, VIKT_STEG = { rum: 10, astrid: 15, klipp: 35, hjul: 40 };
function steg(namn, del, txt) {                                        // del 0..1; listan på laddningsskärmen bockas av
  laddSteg[namn] = Math.max(laddSteg[namn], del);
  const e = document.querySelector(`#laddar [data-steg="${namn}"]`);
  if (e) { e.classList.toggle("pagar", laddSteg[namn] > 0 && laddSteg[namn] < 1); e.classList.toggle("klar", laddSteg[namn] >= 1); }
  laddStapel.style.width = Object.entries(VIKT_STEG).reduce((a, [k, v]) => a + v * laddSteg[k], 0) + "%";
  if (txt) laddText.textContent = txt;
}
// klippen hämtas hela i förväg (blob-adresser), så att första rundan inte väntar på nätet
async function hamta(url) {
  const r = await fetch(url); if (!r.ok) throw Error(url);
  return URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: "video/mp4" }));
}

// ---------- laddning ----------
steg("rum", 0.2, "Opening the studio");
const BORD = await laddaBord(Q);                                       // katalogen + bordets val (dealer, hjul, rum, gränser)
document.title = `${BORD.namn} · ${BORD.dealer.namn}`;
console.log("bord:", JSON.stringify(BORD.val), BORD.slug ?? "(inget sparat bord)");
const KASTFIL = Q.get("kast") ?? BORD.dealer.kast;                    // ?kast=/media/dealers/astrid2/roulette/kast/kast_s7104.json provar ett annat klipp
const kastCfg = await (await fetch(KASTFIL)).json();
const kastBas = new URL(KASTFIL, location.href);
const IDLE = BORD.dealer.idle, idleBas = new URL(IDLE.mapp, location.href);
const idleFiler = Q.has("stilla") ? [] : IDLE.klipp.filter((f) => !Object.hasOwn(IDLE.uteslutna ?? {}, f));   // ?stilla=1: bara startbilden (studions förhandsbilder)
const klippUrl = {};
const klippen = (async () => {                                         // parallellt med hjulets texturer
  const lista = [[kastCfg.klipp, new URL(kastCfg.klipp, kastBas).href], ...idleFiler.map((f) => [f, new URL(f, idleBas).href])];
  let klara = 0;
  await Promise.all(lista.map(async ([f, url]) => { klippUrl[f] = await hamta(url).catch(() => url); steg("klipp", ++klara / lista.length); }));
})();
steg("hjul", 0.1, "Wheel");
const H = await laddaHjul(BORD);
steg("hjul", 1); steg("rum", 1);
const { THREE, renderer, scene, cam, rotor, boll, polar, rad, konst } = H;
scen.prepend(renderer.domElement);
renderer.domElement.style.width = "1920px"; renderer.domElement.style.height = "1080px";
steg("astrid", 0.3, "Dealer");
await klippen;
const dealer = skapaDealer(H, BORD.room.grad);
const kast = videoKalla(H, klippUrl[kastCfg.klipp], { hojd: kastCfg.hojd, beskarTopp: kastCfg.beskarTopp, skarm: kastCfg.skarm });
// vilan: dealerns idle-klipp i följd, annars stillbilden
const stillbild = bildKalla(H, new URL(BORD.dealer.vila.fil, location.href).href, BORD.dealer.vila);
const slump = Q.has("seed") ? (() => { let a = +Q.get("seed") * 7919 >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })() : Math.random;
const vila = skapaVila(H, { filer: idleFiler, bas: idleBas, adress: (f) => klippUrl[f], stillbild, inspelning: INSPELNING, slump, skarm: IDLE.skarm });
await Promise.all([kast.klar, stillbild.klar]);
if (vila.finns) await vila.borja(klocka());
dealer.visa(vila.kalla);
console.log("idle-klipp:", idleFiler.length);
addEventListener("pointerdown", () => vila.vacka(), { capture: true });
if (LOGGA) setInterval(() => { try { logga("status", { vila: vila.status(), visar: dealer.a?.typ ?? null, runda: R ? { t: Math.round(R.t), t0: R.t0 !== null } : null,
  kast: { t: +kast.video.currentTime.toFixed(2), paus: kast.video.paused, rs: kast.video.readyState, fel: kast.video.error?.code ?? null }, dold: document.hidden }); } catch {} }, 5000);
steg("astrid", 1);
const KONTRAKT = { ...kastCfg.kontrakt }, SP = structuredClone(kastCfg.spel);
if (Q.has("slapp")) KONTRAKT.ballReleaseMs = +Q.get("slapp");
if (Q.has("inkast")) SP.inkast.xy = Q.get("inkast").split(",").map(Number);
if (Q.has("inkastMs")) SP.inkast.ms = +Q.get("inkastMs");
if (Q.has("inkastT")) SP.inkast.t = +Q.get("inkastT");

// ---------- fysiken i en worker ----------
laddText.textContent = "Physics";
const worker = new Worker(new URL("./fysik-worker.mjs", import.meta.url), { type: "module" });
const vantar = new Map(); let planNr = 0;
worker.onmessage = ({ data }) => { const v = vantar.get(data.id); vantar.delete(data.id); data.fel ? v.fel(Error(data.fel)) : v.ok(data); };
worker.onerror = (e) => console.error("fysik-worker", e.message);
function planera(mal, forra) {
  const id = ++planNr, seed = Q.has("seed") ? +Q.get("seed") + id - 1 : (crypto.getRandomValues(new Uint32Array(1))[0] % 100000) + 1;
  return new Promise((ok, fel) => {
    vantar.set(id, { ok, fel });
    worker.postMessage({ id, mal, forra, impulsMs: KONTRAKT.wheelImpulseMs, slappMs: KONTRAKT.ballReleaseMs, slappTheta: SP.slappTheta, slappFart: SP.slappFart, banFriktion: SP.banFriktion, seed });
  });
}
// utfallet dras och planeras medan spelaren satsar (motorn drar sitt på servern vid spin; här finns inget svar att vänta på)
let nasta = null;
function forbered(forra) {
  const mal = TVINGA ? TVINGA[rundNr++ % TVINGA.length] : dra();
  nasta = { mal, forra, plan: planera(mal, forra) };
  nasta.plan.then((p) => console.log(`plan ${mal}: ${p.planMs} ms`, p.info)).catch((e) => console.error("planera", e));
}
const rotorVid = (P, t) => { const x = Math.max(0, t) / 2, i = Math.floor(x); if (i >= P.rotor.length - 1) return P.rotor[P.rotor.length - 1]; const u = x - i; return P.rotor[i] * (1 - u) + P.rotor[i + 1] * u; };
const bollVid = (P, t, ut) => {
  const n = P.boll.length / 3, x = Math.min(Math.max(0, t - P.b0), n - 1), i = Math.min(Math.floor(x), n - 2), u = x - i, b = P.boll;
  for (let k = 0; k < 3; k++) ut[k] = b[i * 3 + k] * (1 - u) + b[i * 3 + 3 + k] * u;
  return ut;
};

// ---------- kamerorna ----------
const KAM = { S1: { ...H.KAM.S1 }, S3: { ...H.KAM.S3 } };
const P205 = (() => { const [x, z] = polar(konst.R_FICKA, UPPHAMT); return new THREE.Vector3(x, konst.Y_F + konst.BR, z); })();
const NARA = { fov: 30, cx: 960, cy: 640, dist: 1.05, elev: 46 };     // närbilden ser kulan över hjulet (siffrorna läses därifrån)
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const easeIO = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const lerp = (a, b, u) => a + (b - a) * u;
const lerpVinkel = (a, b, u) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;
const vinkel = (x, z) => (Math.atan2(-x, z) * 180) / Math.PI;
// regin: när kameran klipper, ur planen (ms från klippets start)
function tider(P) {
  const I = P.info, sl = KONTRAKT.ballReleaseMs, b = [0, 0, 0];
  // S1 tills kulan gått 1,5 varv på banan (då har man sett den gå runt bakom tornet), men inte före klippets sista rutor
  let varv = 0, forr = null, tS3 = sl + 3500;
  for (let t = sl; t < sl + 3500; t += 10) {
    bollVid(P, t, b); const v = vinkel(b[0], b[2]);
    if (forr !== null) varv += Math.abs((((v - forr) % 360) + 540) % 360 - 180) / 360;
    forr = v; if (varv >= 1.5) { tS3 = t; break; }
  }
  tS3 = Math.max(tS3, KONTRAKT.durationMs - 150) + (SP.s1Extra ?? 2000);   // Emil: 2 s längre med Astrid i bild medan kulan snurrar
  const RYTM = Q.get("rytm") ?? K.KAMERA_RYTM;
  const tFolj = RYTM === "zooma_tidigt"
    ? Math.max(tS3 + 1400, I.kontaktMs - (SP.foljForeKontakt ?? 5400))   // närbilden börjar tidigt: kulan följs de sista varven
    : Math.max(tS3 + 1400, I.vilaMs + 250);                             // S3 tills kulan ligger i fickan, sedan åker kameran in
  const tBricka = RYTM === "zooma_tidigt" ? Math.max(tFolj + 2200, I.vilaMs + 800) : tFolj + FOLJ_MS + 250;
  const tTillbaka = Math.max(tBricka + 2600, Math.min(I.stoppMs + 400, tBricka + 3200));
  return { tS3, tFolj, tNara: tFolj, tBricka, tTillbaka, tPjas: tTillbaka + 800, tVinst: tTillbaka + 1950,
    tKlar: Math.max(tTillbaka + 2750, I.stoppMs + 100) };
}
// kulan sedd lite i efterhand och lite i förväg (±180 ms): kameran följer den mjukt utan att ligga efter
function foljKula(P, t, ut) {
  let sx = 0, sz = 0, sr = 0, sy = 0, n = 0;
  const b = [0, 0, 0];
  for (let d = -180; d <= 180; d += 30) { bollVid(P, t + d, b); const r = Math.hypot(b[0], b[2]); sx += b[0] / r; sz += b[2] / r; sr += r; sy += b[1]; n++; }
  const th = vinkel(sx, sz), r = sr / n;
  const [x, z] = polar(r, th);
  ut.mal.set(x, sy / n, z); ut.th = th;
  return ut;
}
const folj = { mal: new THREE.Vector3(), th: 0 };
function bild(t, R) {
  const T = R?.T;
  if (!T || t < T.tS3) return { id: "S1", k: KAM.S1 };
  const s3 = (tt) => { const u = Math.min(1, (tt - T.tS3) / Math.max(1, T.tFolj - T.tS3)); return { ...KAM.S3, az: lerp(-9, 3, u), dist: lerp(3.3, 3.1, u), elev: lerp(53, 51, u), cy: 455 }; };   // hela hjulet i bild, långsamt närmare
  if (t < T.tFolj) return { id: "S3", k: s3(t) };                    // S3 med långsam åkning: lite runt och lite närmare
  if (t < T.tTillbaka) {                                               // åkning från S3 ned till närbilden, som sedan följer kulan
    foljKula(R.plan, t, folj);
    const u = easeIO((t - T.tFolj) / FOLJ_MS), a = s3(T.tFolj), mal = new THREE.Vector3().copy(folj.mal).multiplyScalar(u);
    const ut = { fov: 30, mal };
    for (const k of ["elev", "dist", "cx", "cy"]) ut[k] = lerp(a[k], NARA[k], u);
    ut.dist *= lerp(1, 0.94, ease((t - T.tFolj - FOLJ_MS) / 4000));     // och sakta närmare
    ut.az = lerpVinkel(a.az, folj.th - 180, u);
    return { id: "S3", namn: "folj", k: ut };                          // samma scen: ingen övertoning
  }
  return { id: "S1", k: KAM.S1 };
}
const FOLJ_MS = 1800;

// ---------- övertoningen: kopia av förra bilden över den nya ----------
const snap = new THREE.FramebufferTexture(1920, 1080);
snap.minFilter = snap.magFilter = THREE.LinearFilter;
const tonU = { uT: { value: snap }, uA: { value: 0 }, uZ: { value: 1 } };
const tonScen = new THREE.Scene(), tonKam = new THREE.Camera();
tonScen.add(Object.assign(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: tonU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: "uniform sampler2D uT; uniform float uA, uZ; varying vec2 vUv; void main(){ vec3 c = texture2D(uT, (vUv - 0.5) / uZ + 0.5).rgb; gl_FragColor = vec4(c * uA, uA); }",
})), { frustumCulled: false }));
const TON_MS = 650;
let ton = null;                                                        // { t0, fran }

// ---------- UI ----------
laddText.textContent = "Table";
const ROT = document.getElementById("ui");
if (Q.get("ren") === "1") ROT.style.visibility = "hidden";             // ?ren=1: bara rum, hjul och dealer (studions förhandsbilder)
const ljud = skapaLjud({ inspelning: INSPELNING, klocka });
const pjasBild = renderaPjas(THREE, { rum: H.rumS1 });                  // guldpjäsen renderas en gång till en bild
ui = skapaUI(ROT, { saldo: BORD.limit.balance, historik: K.START_HISTORIK, nar, klocka, ljud, pjasBild, spela: (insatser) => starta(insatser),
  bordVal: { granser: BORD.granser, chips: BORD.limit.chips, balance: BORD.limit.balance, namn: BORD.namn, dealerNamn: BORD.dealer.namn, lang: BORD.lang },
  kvalitet: (niva) => satKvalitet(niva) });
await document.fonts.ready;
ui.passa();

// ---------- rundan ----------
let R = null;                                                          // aktiv runda
let vilaRotor = UPPHAMT - WHEEL.indexOf(K.START_HISTORIK[0]) * STEG;   // förra numret i fickan vid P
const vilaBoll = (() => { const [x, z] = polar(konst.R_FICKA, UPPHAMT); return [x, konst.Y_F + konst.BR * 0.98, z]; })();
// kulan i handen: skärmläget xy vid tiden inkast.t (sista rutan där klippets kula syns), och samma skärmfart som 3D-kulan
// har på banan vid släppet. Punkten läggs på höjden inkast.hojd i S1. Därifrån glider kulan över i fysikens bana.
const S1kam = cam.clone(); { const c = cam; stallKamera(H, KAM.S1); S1kam.copy(c); S1kam.projectionMatrix.copy(c.projectionMatrix); S1kam.projectionMatrixInverse.copy(c.projectionMatrixInverse); }
const tillSkarm = (v) => { const p = new THREE.Vector3(...v).project(S1kam); return [(p.x + 1) * 960, (1 - p.y) * 540]; };
function franSkarm(x, y, hojd, ut) {
  const p = new THREE.Vector3(x / 960 - 1, 1 - y / 540, 0.5).unproject(S1kam), o = S1kam.position;
  const d = p.sub(o).normalize(), s = (hojd - o.y) / d.y;
  return ut.copy(o).addScaledVector(d, s);
}
const handPunkt = new THREE.Vector3();
function handVid(R, t) {
  if (!R.handFart) {                                                   // 3D-kulans skärmfart de första 20 ms
    const a = tillSkarm(bollVid(R.plan, KONTRAKT.ballReleaseMs, [0, 0, 0])), b = tillSkarm(bollVid(R.plan, KONTRAKT.ballReleaseMs + 20, [0, 0, 0]));
    R.handFart = [(b[0] - a[0]) / 0.02, (b[1] - a[1]) / 0.02];
  }
  const dt = (t - (SP.inkast.t ?? KONTRAKT.ballReleaseMs)) / 1000;
  return franSkarm(SP.inkast.xy[0] + R.handFart[0] * dt, SP.inkast.xy[1] + R.handFart[1] * dt, SP.inkast.hojd, handPunkt);
}
forbered(K.START_HISTORIK[0]);

async function starta(insatser) {
  const runda = nasta;
  let plan;
  try { plan = await runda.plan; } catch (e) {                         // ytterst ovanligt: planera om samma utfall
    console.error(e); runda.plan = planera(runda.mal, runda.forra); plan = await runda.plan;
  }
  R = { mal: runda.mal, plan, insatser, T: tider(plan), gjort: new Set(), t0: null, t: 0, studsar: studsar(plan), ljudT: -1 };
  ljud.spela("stopp");
  // Astrid avslutar en pågående gest (klippet slutar i vilan) innan hon kastar; andas/blinka bryts med en kort övertoning
  const nu = klocka();
  R.lugn = vila.kanBrytas();
  R.startVid = R.lugn ? nu : nu + Math.max(0, vila.kvarMs(nu) - 20);
  console.log("runda", R.mal, R.T, R.lugn ? "startar direkt" : `väntar ${Math.round(R.startVid - nu)} ms på gestens slut`);
}
async function borjaKast() {
  vila.pausa(); vila.lugn(true);
  kast.video.currentTime = 0;
  if (INSPELNING) { await sokKast(0); R.t0 = virt; }
  else {                                                                // avvisas play() går rundan ändå (tidslinjen på egen klocka)
    try { await kast.video.play(); } catch (e) { console.error("kastklippet startar inte:", e.name, e.message); }
    R.t0 = klocka() - kast.video.currentTime * 1000;
  }
  if (R.lugn) { dealer.tonaTill(kast); R.dealerTon = { t0: 0, ms: 160 }; } else dealer.visa(kast);
}
// studsarna för ljudet: där kulans fart ändras tvärt (avvisare, fackkanter), ur fysikens bana (vid(t) samplad var 1 ms)
function studsar(P) {
  const I = P.info, v = (t) => { const a = bollVid(P, t - 2, [0, 0, 0]), b = bollVid(P, t + 2, [0, 0, 0]); return [(b[0] - a[0]) / 0.004, (b[1] - a[1]) / 0.004, (b[2] - a[2]) / 0.004]; };
  const d = [];
  for (let t = I.lamnaBanaMs - 300; t < I.vilaMs; t++) { const a = v(t - 3), b = v(t + 3); d.push([t, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])]); }
  const ut = []; let sist = -1e9;
  for (let i = 1; i < d.length - 1; i++) {
    const [t, x] = d[i];
    if (x > 0.35 && x >= d[i - 1][1] && x >= d[i + 1][1] && t - sist > 30) { ut.push([t, Math.min(1, x / 3)]); sist = t; }
  }
  return ut;
}
// händelser på rundans tidslinje
function handelser(t) {
  const T = R.T, en = (namn, vid, f) => { if (t >= vid && !R.gjort.has(namn)) { R.gjort.add(namn); f(); } };
  en("vilaIgen", KONTRAKT.durationMs - 350, () => {                  // klippets sista rutor glider mot vilan: tona över 350 ms
    const k = vila.borja(klocka());
    const tona = () => { dealer.tonaTill(vila.kalla); R.dealerTon = { t0: R.t, ms: Math.max(80, KONTRAKT.durationMs - R.t) }; };
    k?.then ? k.then(tona) : tona();
  });
  en("bricka", T.tBricka, () => ui.bricka(R.mal));
  en("brickaBort", T.tTillbaka + 500, () => ui.brickaBort());
  en("sager", T.tTillbaka, () => ui.sagNummer(R.mal));                 // tillbaka hos Astrid: hon säger numret
  en("pjas", T.tPjas, () => ui.landat(R.mal));
  en("klonk", R.plan.info.vilaMs, () => ljud.spela("klonk"));
  en("vinst", T.tVinst, () => {
    const r = ui.vinst(R.mal); console.log("avräkning", r); vila.lugn(false);
    if (r.vinst > 0) { vila.koa(["le_valkommen", "nick"]); ljud.spela("vinst"); }
  });
  en("klar", T.tKlar, () => {
    ui.klar();
    vilaRotor = rotorVid(R.plan, 1e9); bollVid(R.plan, 1e9, vilaBoll);
    forbered(R.mal); R = null;
  });
}

// ---------- varje bildruta ----------
const bollTmp = [0, 0, 0];
let forraBild = { id: "S1", k: KAM.S1 };
function satt(t) {
  if (!R || R.t0 === null) {                                          // mellan rundorna (och medan en gest avslutas)
    ljud.ram(0, 0, 0);
    rotor.rotation.y = -rad(vilaRotor);
    boll.visible = true; boll.position.set(...vilaBoll);
    return bild(-1, null);
  }
  const P = R.plan;
  rotor.rotation.y = -rad(rotorVid(P, t));
  const sl = KONTRAKT.ballReleaseMs;
  if (t < sl) boll.visible = false;
  else {
    boll.visible = true;
    bollVid(P, t, bollTmp);
    const u = (t - sl) / SP.inkast.ms;
    if (u < 1) { const e = ease(u), h = handVid(R, t); boll.position.set(lerp(h.x, bollTmp[0], e), lerp(h.y, bollTmp[1], e), lerp(h.z, bollTmp[2], e)); }
    else boll.position.set(...bollTmp);
  }
  // ljudet: rotorns fart, kulans fart och om den rullar (banan, lutningen) eller studsar
  const rf = (rotorVid(P, t + 20) - rotorVid(P, t - 20)) / 0.04;
  let kf = 0, rull = 0;
  if (t >= sl) {
    const a = bollVid(P, t - 8, [0, 0, 0]), b = bollVid(P, t + 8, [0, 0, 0]);
    kf = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.016;
    const fas = P.fas[Math.min(P.fas.length - 1, Math.max(0, Math.round(t - P.b0)))];
    rull = [0, 0, 1, 0.8, 0.3, 0, 0][fas] ?? 0;
  }
  ljud.ram(rf, kf, rull);
  for (const [ts, st] of R.studsar) if (ts > R.ljudT && ts <= t && t - ts < 120) ljud.spela("studs", { s: st });
  R.ljudT = t;
  if (R.dealerTon && R.t0 !== null) { const d = R.dealerTon, u = Math.min(1, (t - d.t0) / d.ms); dealer.mix(Math.max(0, u)); if (u >= 1) R.dealerTon = null; }
  return bild(t, R);
}
function rita(b) {
  stallRum(H, b.id === "S1" ? "S1" : "hjul");
  stallKamera(H, b.k);
  renderer.render(scene, cam);
  if (b.id === "S1") dealer.rita(renderer);
}
// fliken dold mitt i kastet eller snurret: klipp, fysik och kamera hoppar fram till resultatet i S1 (inget hinner ur synk)
function hoppaTillResultat(nu) {
  if (!R || R.t0 === null || R.gjort.has("sager")) return;           // resultatet visas redan: inget att hoppa över
  kast.video.pause();
  R.t0 = nu - (R.T.tTillbaka - 100); R.t = R.T.tTillbaka - 100; R.ljudT = R.t;
  if (R.dealerTon) { dealer.mix(1); R.dealerTon = null; }
  console.log("fliken var dold: hoppar till resultatet");
}
let doldSedan = null;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { doldSedan = performance.now(); ljud.tyst(true); return; }
  ljud.tyst(false);
  if (!INSPELNING && doldSedan !== null && performance.now() - doldSedan > 600) hoppaTillResultat(performance.now());
  doldSedan = null;
});
function ruta(nu) {
  if (R && R.t0 === null && !R.startar && nu >= R.startVid) { R.startar = true; borjaKast(); }
  if (vila.uppdatera(nu) && (!R || (R.t0 !== null && R.gjort.has("vilaIgen") && !R.dealerTon))) dealer.visa(vila.kalla);
  if (R && R.t0 !== null) {
    if (!INSPELNING && !kast.video.paused && !kast.video.ended && R.t < KONTRAKT.durationMs) {   // följ videons klocka (mjukt) medan klippet spelar
      const mal = nu - kast.video.currentTime * 1000; R.t0 += (mal - R.t0) * 0.15;
    }
    R.t = nu - R.t0;
  }
  const t = R && R.t0 !== null ? R.t : -1;
  const b = satt(t);
  if (b.id !== forraBild.id) {                                         // klipp: förra bilden kopieras och tonas ut över den nya
    rita(forraBild); renderer.copyFramebufferToTexture(snap);
    ton = { t0: nu }; ui.vy(b.id === "S1" ? "S1" : "hjul");
  }
  rita(b);
  if (ton) {
    const u = (nu - ton.t0) / TON_MS;
    if (u >= 1) ton = null;
    else { tonU.uA.value = 1 - ease(u); tonU.uZ.value = 1 + 0.035 * u; const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(tonScen, tonKam); renderer.autoClear = ac; }
  }
  forraBild = b;
  if (R && R.t0 !== null) handelser(R.t);
  for (const f of uppgifter) if (f(nu)) uppgifter.delete(f);
}

// bildkvalitet (inställningarna): hög = skuggor (karta 1024), låg = utan skuggor för svagare datorer
function satKvalitet(niva) {
  const pa = niva !== "lag";
  if (renderer.shadowMap.enabled === pa) return;
  renderer.shadowMap.enabled = pa;
  scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
}
// ---------- uppvärmning: alla shaders kompileras före första bilden ----------
laddText.textContent = "Studio";
for (const b of [bild(-1, null), { id: "S3", k: KAM.S3 }, { id: "S3", k: { ...NARA, az: UPPHAMT - 180, mal: P205 } }]) { satt(-1); rita(b); }
dealer.tonaTill(kast); dealer.mix(0.5); rita({ id: "S1", k: KAM.S1 }); dealer.visa(vila.kalla);
renderer.copyFramebufferToTexture(snap); tonU.uA.value = 0.01; renderer.autoClear = false; renderer.render(tonScen, tonKam); renderer.autoClear = true;

// ---------- inspelningsläget: klippet spolas till rätt ruta innan bilden ritas ----------
function sokRuta(kalla, f, fps) {
  if (f === kalla.ruta) return Promise.resolve();
  kalla.ruta = f;
  return new Promise((ok) => {
    const v = kalla.video;
    v.addEventListener("seeked", () => { kalla.tex.needsUpdate = true; v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => ok()) : ok(); }, { once: true });
    setTimeout(ok, 400);                                               // aldrig hänga om spolningen uteblir
    v.currentTime = (f + 0.5) / fps;
  });
}
const sokKast = (tMs) => sokRuta(kast, Math.max(0, Math.min(kastCfg.rutor - 1, Math.floor((tMs / 1000) * kastCfg.fps))), kastCfg.fps);
const sokVila = (nu) => (vila.cur && !vila.pausad ? sokRuta(vila.cur, vila.ruta(nu), 24) : Promise.resolve());

const fpsEl = Q.get("fps") === "1" ? Object.assign(document.createElement("div"), { id: "fps" }) : null;
if (fpsEl) scen.append(fpsEl);
const ftid = [];
window.__spel = {
  H, ui, dealer, kast, vila, kastCfg, KAM, BORD, handPunkt, KONTRAKT, SP, bild, ljud, hoppaTillResultat, satKvalitet, pjasBild,
  // kulbanan i skärmkoordinater för en kamera (prov av att bordet inte skymmer kulan)
  banaPaSkarm(k, r = 0.866, yy = -0.038) { stallKamera(H, k); cam.updateMatrixWorld(); const ut = []; for (let th = 0; th < 360; th += 5) { const [x, z] = polar(r, th), p = new THREE.Vector3(x, yy, z).project(cam); ut.push([th, (p.x + 1) * 960, (1 - p.y) * 540]); } return ut; },
  get runda() { return R; }, get nasta() { return nasta; }, ftid,
  // prov av nyckeln: kastklippets ruta n nycklad över svart och över vitt (verktyg/jamfor-nyckel.mjs jämför med Python)
  async provNyckel(n) {
    await sokKast((n + 0.01) * 1000 / kastCfg.fps); dealer.visa(kast);
    const ut = [];
    for (const f of [0x000000, 0xffffff]) { renderer.setClearColor(f, 1); renderer.clear(); dealer.rita(renderer); ut.push(renderer.domElement.toDataURL("image/png")); }
    renderer.setClearColor(0x000000, 0); dealer.visa(vila.kalla);
    return ut;
  },
  // kostnad per bild utan vsync: rita n gånger och vänta in GPU:n (readPixels av 1 px) efter varje
  provKostnad(id, n = 240) {
    const gl = renderer.getContext(), px = new Uint8Array(4), b = id === "S1" ? { id, k: KAM.S1 } : id === "S3" ? { id, k: KAM.S3 } : { id, k: { ...NARA, az: UPPHAMT - 180, mal: P205 } };
    const tid = [];
    for (let i = 0; i < n + 20; i++) {
      const t = performance.now(); rotor.rotation.y = -rad(i * 3); rita(b); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (i >= 20) tid.push(performance.now() - t);
    }
    tid.sort((a, b) => a - b);
    return { median: +tid[n >> 1].toFixed(2), p95: +tid[Math.floor(n * 0.95)].toFixed(2) };
  },
  // inspelning: sätt klockan och rita (await före skärmdump)
  async steg(nu) {
    virt = nu;
    if (R && R.t0 !== null && R.t0 + 0 <= nu && nu - R.t0 < KONTRAKT.durationMs + 200) await sokKast(nu - R.t0);
    if (R && R.t0 === null && !R.startar && nu >= R.startVid) { R.startar = true; await borjaKast(); }
    vila.uppdatera(nu) && (!R || (R.t0 !== null && R.gjort.has("vilaIgen") && !R.dealerTon)) && dealer.visa(vila.kalla);
    await sokVila(nu);
    ruta(nu);
    for (const a of document.getAnimations()) {                          // CSS-animationer följer den egna klockan
      if (a.__v0 === undefined) { a.__v0 = nu; a.pause(); }
      a.currentTime = nu - a.__v0;
    }
  },
};
laddStapel.style.width = "100%"; laddText.textContent = "Welcome";
document.getElementById("laddar").classList.add("klar");
document.body.dataset.spel = "klar";
if (!INSPELNING) {
  let forr = performance.now(), n = 0, acc = 0;
  const loop = (nu) => {
    const dt = nu - forr; forr = nu;
    if (dt > 1500) hoppaTillResultat(nu);                              // datorn sov eller fliken frystes
    ftid.push([dt, forraBild.namn ?? forraBild.id, R && R.t0 !== null ? Math.round(R.t) : -1]); if (ftid.length > 20000) ftid.shift();
    if (fpsEl) { acc += dt; n++; if (acc > 500) { fpsEl.textContent = `${(1000 * n / acc).toFixed(1)} fps`; acc = 0; n = 0; } }
    ruta(nu);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
