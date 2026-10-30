// Ljudet, helt procedurellt i WebAudio (inga ljudfiler): marker, rotorns sus, kulan på banan, studsar, klonket i facket
// och en diskret vinstton. Allt går genom en kompressor/limiter på mastern, så inget klipper.
// Samma graf byggs i en vanlig AudioContext (live) och i en OfflineAudioContext (inspelningen): i inspelningsläget
// loggas varje händelse och varje bildrutas parametrar med spelets klocka, och renderaLogg() gör en WAV av loggen.
const NYCKEL = "roulette.ljud";
const MASTER = 2.6;   // ca +7 dB mot första versionen (den låg på -31 dB i medel); limitern tar topparna
const las = () => { try { return JSON.parse(localStorage.getItem(NYCKEL)) ?? {}; } catch { return {}; } };
const spara = (v) => { try { localStorage.setItem(NYCKEL, JSON.stringify(v)); } catch {} };

// grafen: master → kompressor → ut, plus två loopade brusröster (rotorn och kulan)
function bygg(c) {
  const sr = c.sampleRate, n = sr * 2;
  const vitt = c.createBuffer(1, n, sr), brunt = c.createBuffer(1, n, sr);
  { const v = vitt.getChannelData(0), b = brunt.getChannelData(0); let s = 0, x = 12345;
    for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; const w = x / 2147483648 - 1; v[i] = w; s = (s + 0.02 * w) / 1.02; b[i] = s * 3.5; } }
  const komp = c.createDynamicsCompressor();
  komp.threshold.value = -16; komp.knee.value = 8; komp.ratio.value = 12; komp.attack.value = 0.002; komp.release.value = 0.25;
  const master = c.createGain(); master.gain.value = 0;
  master.connect(komp); komp.connect(c.destination);
  const loop = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0); return s; };
  const lfoTill = (param, frek, djup) => {
    const o = c.createOscillator(); o.frequency.value = frek; const g = c.createGain(); g.gain.value = djup;
    o.connect(g); g.connect(param); o.start(0); return o;
  };
  // rotorn: ett luftigt sus (brunt brus i ett brett band) som sveper en gång per varv, plus lagrets låga mummel
  const rBp = c.createBiquadFilter(); rBp.type = "bandpass"; rBp.frequency.value = 160; rBp.Q.value = 0.8;
  const rLp = c.createBiquadFilter(); rLp.type = "lowpass"; rLp.frequency.value = 90; rLp.Q.value = 0.7;
  const rG = c.createGain(); rG.gain.value = 0;
  const rSvep = c.createGain(); rSvep.gain.value = 1;
  const rSrc = loop(brunt); rSrc.connect(rBp); rSrc.connect(rLp); rBp.connect(rG); rLp.connect(rG); rG.connect(rSvep); rSvep.connect(master);
  const rLfo = lfoTill(rSvep.gain, 0.5, 0.22);
  const rLuft = c.createBiquadFilter(); rLuft.type = "bandpass"; rLuft.frequency.value = 1800; rLuft.Q.value = 0.6;
  const rLuftG = c.createGain(); rLuftG.gain.value = 0;
  loop(vitt).connect(rLuft); rLuft.connect(rLuftG); rLuftG.connect(rSvep);
  const rOsc = c.createOscillator(); rOsc.type = "sine"; rOsc.frequency.value = 40; const rOg = c.createGain(); rOg.gain.value = 0;
  rOsc.connect(rOg); rOg.connect(master); rOsc.start(0);
  // kulan: en rullande textur (mikrostötar genom träskålens och kulans resonanser, se rullTextur) som tonhöjds-
  // förskjuts med farten, mörknar när den saktar in och pulserar en gång per varv (kulan passerar avvisarzonen)
  const kSrc = c.createBufferSource(); kSrc.buffer = rullTextur(c); kSrc.loop = true; kSrc.start(0);
  const kLp = c.createBiquadFilter(); kLp.type = "lowpass"; kLp.frequency.value = 3000; kLp.Q.value = 0.5;
  const kHp = c.createBiquadFilter(); kHp.type = "highpass"; kHp.frequency.value = 90; kHp.Q.value = 0.5;
  const kG = c.createGain(); kG.gain.value = 0;
  const trem = c.createGain(); trem.gain.value = 1;
  kSrc.connect(kHp); kHp.connect(kLp); kLp.connect(kG); kG.connect(trem); trem.connect(master);
  const lfo = lfoTill(trem.gain, 1, 0.28);
  return { c, master, vitt, rBp, rLp, rG, rLfo, rLuftG, rOsc, rOg, kSrc, kLp, kG, lfo };
}

// Kulans rullningsljud som loopbar buffert: mikrostötar (Poisson, ~1 800/s, exponentiell styrka) genom en bank av
// dämpade resonatorer (träskålen och kulan). Filtren körs två varv över samma excitation så att slutet går över i
// början utan skarv.
function rullTextur(c) {
  const sr = c.sampleRate, n = Math.round(sr * 2.5), e = new Float32Array(n);
  let x = 987654;
  const slump = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  for (let i = 0; i < n; i++) {
    e[i] = (slump() - 0.5) * 0.04;                                         // svagt friktionsbrus
    if (slump() < 1800 / sr) e[i] += (slump() < 0.5 ? -1 : 1) * -Math.log(1 - slump() * 0.999) * 0.5;
  }
  const MOD = [[190, 0.09, 0.5], [360, 0.07, 0.8], [640, 0.05, 1], [1010, 0.035, 0.85], [1480, 0.025, 0.6],
    [2250, 0.016, 0.42], [3300, 0.011, 0.26], [4700, 0.007, 0.14]];
  const ut = new Float32Array(n);
  for (const [f, tau, g] of MOD) {
    const r = Math.exp(-1 / (tau * sr)), a1 = 2 * r * Math.cos((2 * Math.PI * f) / sr), a2 = -r * r, k = g * (1 - r);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < 2 * n; i++) {
      const y = a1 * y1 + a2 * y2 + k * e[i % n];
      y2 = y1; y1 = y;
      if (i >= n) ut[i - n] += y;
    }
  }
  let topp = 0; for (let i = 0; i < n; i++) topp = Math.max(topp, Math.abs(ut[i]));
  const buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (ut[i] / topp) * 0.9;
  return buf;
}

// engångsljud: g = graf, t = tid i grafens klocka
const kuvert = (c, g, t, topp, ned, a = 0.002) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(topp, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + ned); };
function brusStot(G, t, frek, q, topp, ned, typ = "bandpass") {
  const { c } = G, s = c.createBufferSource(); s.buffer = G.vitt; s.playbackRate.value = 1;
  const f = c.createBiquadFilter(); f.type = typ; f.frequency.value = frek; f.Q.value = q;
  const g = c.createGain(); kuvert(c, g, t, topp, ned);
  s.connect(f); f.connect(g); g.connect(G.master); s.start(t, Math.random() * 1.5); s.stop(t + ned + 0.05);
}
function ton(G, t, frek, topp, ned, typ = "sine", a = 0.002) {
  const { c } = G, o = c.createOscillator(); o.type = typ; o.frequency.value = frek;
  const g = c.createGain(); kuvert(c, g, t, topp, ned, a); o.connect(g); g.connect(G.master); o.start(t); o.stop(t + a + ned + 0.05);
}
const ENGANG = {
  // marker av lera/keramik: två korta klick, ljusare för större valörer
  marker(G, t, { valor = 25 }) {
    const f = 2300 + Math.log10(Math.max(1, valor)) * 550;
    brusStot(G, t, f, 7, 0.32, 0.035); ton(G, t, f * 0.8, 0.05, 0.03);
    brusStot(G, t + 0.022, f * 1.15, 9, 0.16, 0.025);
  },
  // ångra och rensa: mjukt svep
  mjuk(G, t) { brusStot(G, t, 900, 0.8, 0.10, 0.16, "lowpass"); brusStot(G, t + 0.03, 1400, 3, 0.04, 0.12); },
  // studs mot avvisare eller fackkant: tickande klick, styrkan efter stöten (0..1)
  studs(G, t, { s = 0.5 }) {
    const st = Math.min(1, Math.max(0.05, s));
    brusStot(G, t, 3200 + 900 * st, 5, 0.06 + 0.32 * st, 0.018 + 0.02 * st); ton(G, t, 2100 + 500 * st, 0.02 + 0.08 * st, 0.03);
  },
  // kulan lägger sig i facket
  klonk(G, t) { ton(G, t, 150, 0.22, 0.16, "sine", 0.003); brusStot(G, t, 700, 2, 0.12, 0.08); ton(G, t + 0.004, 1900, 0.03, 0.05); },
  // vinst: tre mjuka toner (E-dur), klockliknande
  vinst(G, t) { [659.25, 830.61, 987.77].forEach((f, i) => { ton(G, t + i * 0.13, f, 0.07, 1.4, "triangle", 0.02); ton(G, t + i * 0.13, f * 2, 0.012, 0.9, "sine", 0.02); }); },
  // inga fler insatser: en dämpad ton
  stopp(G, t) { ton(G, t, 392, 0.035, 0.6, "triangle", 0.015); },
};

export function skapaLjud({ inspelning = false, klocka } = {}) {
  const inst = { pa: true, volym: 0.7, ...las() };
  let G = null;
  const logg = []; let loggT0 = null;
  const masterNiva = () => (inst.pa ? MASTER * inst.volym : 0);
  function vakna() {                                                  // först vid användarens första klick (autoplay-regeln)
    if (G || inspelning) return;
    try { const c = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" }); G = bygg(c); G.master.gain.value = masterNiva(); c.resume(); } catch {}
  }
  addEventListener("pointerdown", vakna, { capture: true }); addEventListener("keydown", vakna, { capture: true });
  const nuG = () => (G ? G.c.currentTime + 0.005 : 0);
  const logga = (typ, data) => { if (inspelning && loggT0 !== null) logg.push([klocka() - loggT0, typ, data]); };
  const api = {
    get pa() { return inst.pa; }, get volym() { return inst.volym; },
    satt({ pa, volym }) {
      if (pa !== undefined) inst.pa = pa; if (volym !== undefined) inst.volym = volym;
      spara(inst); if (G) G.master.gain.setTargetAtTime(masterNiva(), G.c.currentTime, 0.05);
    },
    spela(typ, data = {}) { logga(typ, data); if (G && inst.pa) ENGANG[typ](G, nuG(), data); },
    // varje bildruta: rotorns fart (°/s), kulans fart (enheter/s) och hur mycket den rullar (0..1)
    ram(rotorFart, kulFart, rull) {
      logga("ram", [rotorFart, kulFart, rull]);
      if (G) satt(G, G.c.currentTime, rotorFart, kulFart, rull, 0.05);
    },
    tyst(ja) { if (G) { if (ja) G.c.suspend(); else G.c.resume(); } },
    // inspelningen: loggen börjar vid första bildrutan
    borjaLogg() { logg.length = 0; loggT0 = klocka(); },
    async renderaLogg(sek) {
      const sr = 48000, c = new OfflineAudioContext(2, Math.ceil(sek * sr), sr), O = bygg(c);
      O.master.gain.value = MASTER * 0.7;
      for (const [t, typ, d] of logg) {
        const ts = t / 1000; if (ts < 0 || ts > sek) continue;
        if (typ === "ram") satt(O, ts, d[0], d[1], d[2], 0.03); else ENGANG[typ](O, ts + 0.001, d);
      }
      const buf = await c.startRendering();
      return wavBase64(buf);
    },
    get logg() { return logg; },
  };
  return api;
}
function satt(G, t, rotorFart, kulFart, rull, tau) {
  const r = Math.min(1, Math.abs(rotorFart) / 200);
  G.rG.gain.setTargetAtTime(0.045 * r, t, tau * 2);
  G.rBp.frequency.setTargetAtTime(120 + 220 * r, t, tau * 2);
  G.rLp.frequency.setTargetAtTime(70 + 120 * r, t, tau * 2);
  G.rLuftG.gain.setTargetAtTime(0.003 * r * r, t, tau * 2);
  G.rLfo.frequency.setTargetAtTime(Math.max(0.05, Math.abs(rotorFart) / 360), t, tau * 2);   // ett svep per varv
  G.rOsc.frequency.setTargetAtTime(32 + 30 * r, t, tau * 2);
  G.rOg.gain.setTargetAtTime(0.02 * r, t, tau * 2);
  // kulan: kulFart i världsenheter/s (banans radie ≈ 0,64 → 4,6 ≈ 410 °/s)
  const v = Math.min(1.1, kulFart / 4.6);
  G.kG.gain.setTargetAtTime(0.3 * Math.pow(v, 0.8) * rull, t, tau);
  G.kSrc.playbackRate.setTargetAtTime(0.55 + 0.55 * v, t, tau);
  G.kLp.frequency.setTargetAtTime(900 + 5200 * v * v, t, tau);
  G.lfo.frequency.setTargetAtTime(Math.max(0.2, kulFart / 4.02), t, tau);                 // ett varv per puls
}
function wavBase64(buf) {
  const n = buf.length, ch = buf.numberOfChannels, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); data.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVEfmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, ch, true); data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, "data"); data.setUint32(40, n * ch * 2, true);
  const kan = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let k = 0; k < ch; k++) { const s = Math.max(-1, Math.min(1, kan[k][i])); data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  const u8 = new Uint8Array(data.buffer); let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
