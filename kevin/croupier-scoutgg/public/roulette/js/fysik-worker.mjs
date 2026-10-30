// Planerar snurren i en Web Worker (sökningen tar 0,1–4 s) med metodik/design/3d/roulette-fysik.mjs, som inte ändras här.
// planera() ger en funktion vid(tMs); den kan inte skickas mellan trådar, så banan samplas: rotorn var 2 ms (avlindad vinkel),
// kulan var 1 ms från släppet (x, y, z i hjulets koordinater). Huvudtråden interpolerar linjärt.
import { planera, WHEEL, STEG, UPPHAMT } from "../3d/roulette-fysik.mjs";   // kopian i public/roulette/3d/ (original: metodik/design/3d/)

const polar = (r, th) => [-r * Math.sin((th * Math.PI) / 180), r * Math.cos((th * Math.PI) / 180)];
const FAS = ["ficka", "hand", "bana", "lutning", "studs", "vila", "stilla"];

onmessage = ({ data: a }) => {
  const t0 = performance.now();
  let p = null, fel = null, seed = a.seed;
  for (let i = 0; i < 6 && !p; i++, seed += 7919) {
    try {
      p = planera({ mal: a.mal, rotorStart: UPPHAMT - WHEEL.indexOf(a.forra) * STEG, impulsMs: a.impulsMs, slappMs: a.slappMs,
        slappTheta: a.slappTheta, slappFart: a.slappFart, banFriktion: a.banFriktion, seed });
    } catch (e) { fel = e.message; }
  }
  if (!p) { postMessage({ id: a.id, fel }); return; }
  const slut = p.info.stoppMs + 1000;
  const nR = Math.ceil(slut / 2) + 1, rotor = new Float64Array(nR);
  let forr = null, varv = 0;
  for (let i = 0; i < nR; i++) {
    const g = p.vid(i * 2).rotorGrader;
    if (forr !== null) { const d = g - forr; if (d < -180) varv += 360; else if (d > 180) varv -= 360; }
    rotor[i] = g + varv; forr = g;
  }
  const b0 = a.slappMs, nB = Math.ceil(slut - b0) + 1, boll = new Float32Array(nB * 3), fas = new Uint8Array(nB);
  for (let i = 0; i < nB; i++) {
    const s = p.vid(b0 + i);
    if (!s.boll) { boll.fill(NaN, i * 3, i * 3 + 3); continue; }
    const [x, z] = polar(s.boll.r, s.boll.theta);
    boll[i * 3] = x; boll[i * 3 + 1] = s.boll.y; boll[i * 3 + 2] = z;
    fas[i] = Math.max(0, FAS.indexOf(s.fas));
  }
  postMessage({ id: a.id, mal: a.mal, forra: a.forra, info: p.info, seed, rotor, boll, fas, b0, planMs: Math.round(performance.now() - t0) },
    [rotor.buffer, boll.buffer, fas.buffer]);
};
