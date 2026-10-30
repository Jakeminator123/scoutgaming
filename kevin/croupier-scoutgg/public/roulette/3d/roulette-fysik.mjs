// Roulettesnurren som fysiksimulering (inget three-beroende). Kulan är en sfär (radie BR) med tyngd, luftmotstånd,
// rullmotstånd, friktion och spinn, på hjulets riktiga geometri ur roulette-hjul-v2.html: kulbanans vägg och golv,
// nedre lutningen, de 8 avvisarna, rotorns kant, sifferringen, fickornas golv och de 37 fackväggarna. Rotordelar
// räknas i rotorns rörliga system. Inget manus: banfas, fall, avvisarträffar, studsar och vila följer av fysiken.
//   import { planera } from "./roulette-fysik.mjs";
//   const p = planera({ mal: 17, rotorStart: 0, impulsMs: 2500, slappMs: 4200, slappTheta: 210, slappFart: 400, seed: 7 });
//   p.vid(tMs) -> { rotorGrader, boll: { theta, r, y } | null, fas }
// Exakt utfall utan fusk: rotorns startvinkel är låst (förra numret vid θ 205) och rotorn är 37-symmetrisk, så
// landningsfickan relativt rotorn beror bara på startvillkoren. Sökningen provar startvillkor (rotorns fart och
// kulans släppfart inom ±5 % av slappFart) tills simuleringen landar i målfickan. När kulan ligger still väljs
// rotorns utrullning (jämn inbromsning) så att målfickan stannar exakt vid θ 205; kulan följer då bara med.
// Simuleringen använder bara + − × ÷ √ och egna sin/cos/atan2, så den ger samma bitar i alla JS-motorer.
// tMs = tid på dealerklippets tidslinje. Vinklar i grader som hjulfilen: θ medurs sett ovanifrån, 0 = mot kameran.
// Fickan med index i i WHEEL sitter vid θ = rotorGrader + i·STEG. Rotorn snurrar medurs, kulan moturs.

export const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
export const N = 37, STEG = 360 / N;
export const UPPHAMT = 205;                       // P: där dealern plockar kulan, målfickan stannar här
const mod = (x, m) => ((x % m) + m) % m;
export const fickaVid = (rotorGrader, theta) => WHEEL[mod(Math.round((theta - rotorGrader) / STEG), N)];

// ---------- deterministisk matematik (bara + − × ÷ √, Math.round/floor/abs) ----------
const PI = 3.141592653589793, HP = 1.5707963267948966, HP_LO = 6.123233995736766e-17, GRAD = PI / 180, TAU = 2 * PI;
let SIN = 0, COS = 0;
function sincos(x) {                              // sätter SIN, COS
  const k = Math.round(x / HP), r = (x - k * HP) - k * HP_LO, r2 = r * r;
  const s = r * (1 + r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040 + r2 * (1 / 362880 + r2 * (-1 / 39916800 + r2 * (1 / 6227020800)))))));
  const c = 1 + r2 * (-1 / 2 + r2 * (1 / 24 + r2 * (-1 / 720 + r2 * (1 / 40320 + r2 * (-1 / 3628800 + r2 * (1 / 479001600 + r2 * (-1 / 87178291200)))))));
  const q = ((k % 4) + 4) % 4;
  if (q === 0) { SIN = s; COS = c; } else if (q === 1) { SIN = c; COS = -s; } else if (q === 2) { SIN = -s; COS = -c; } else { SIN = -c; COS = s; }
}
function atanLiten(z) {                           // 0 <= z <= 1
  let off = 0;
  if (z > 0.2679491924311227) { z = (z - 0.5773502691896257) / (1 + 0.5773502691896257 * z); off = 0.5235987755982988; }
  const z2 = z * z;
  let s = 1 / 21;
  for (let n = 9; n >= 0; n--) s = 1 / (2 * n + 1) - z2 * s;
  return off + z * s;
}
function atan2D(y, x) {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax === 0 && ay === 0) return 0;
  let a = ay <= ax ? atanLiten(ay / ax) : HP - atanLiten(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}
const thetaAv = (x, z) => atan2D(-x, z);          // θ (rad) för en punkt: x = −r·sin θ, z = r·cos θ

// ---------- geometrin, avskriven ur roulette-hjul-v2.html (prov kontrollerar att raderna finns kvar där) ----------
export const HJULKALLA = [
  "mjuk([[0.905, -0.007], [0.899, -0.02], [0.894, -0.036], [0.889, -0.05], [0.879, -0.058], [0.865, -0.062]], 30)",
  "[[0.865, -0.062], [0.80, -0.083], [0.765, -0.095], [0.760, -0.098]]",
  "[[0.760, -0.098], [0.758, -0.104], [0.757, -0.18]]",
  "[0.96, 0.0], [0.93, 0.0], ...bage(0.912, -0.007, 0.007, 90, 180, 6)",
  "const th = k * 45 + 22.5, [x, z] = polar(0.815, th);",
  "geo.scale(lang ? 0.05 : 0.016, 0.011, lang ? 0.016 : 0.045);",
  "d.rotation.z = lut; d.position.y = 0.002;",
  "const lut = Math.atan(0.035 / 0.105);",
  "const ytaY = (r) => -0.062 - (0.865 - r) * (0.036 / 0.105);",
  "const R_F0 = 0.648, R_F1 = 0.558, Y_F = -0.147;",
  "mjuk([[0.754, -0.114], [0.754, -0.105], [0.749, -0.1005], [0.744, -0.1005], [0.740, -0.104]], 24)",
  "[[0.740, -0.104], [0.652, -0.116]]",
  "[[0.652, -0.116], [0.649, -0.118], [R_F0, -0.143]]",
  "[[R_F0, -0.143], [0.626, -0.1465], [0.603, -0.147], [0.58, -0.1465], [R_F1, -0.143]]",
  "mjuk([[R_F1, -0.143], [0.556, -0.121], [0.552, -0.1165], [0.546, -0.116], [0.542, -0.118]], 24)",
  "mjuk([[0.542, -0.118], [0.45, -0.106], [0.33, -0.09], [0.2, -0.072], [0.13, -0.06], [0.124, -0.058]], 60)",
  "fretForm.moveTo(R_F1 + 0.001, Y_F - 0.004); fretForm.lineTo(R_F0 + 0.0005, Y_F - 0.004); fretForm.lineTo(R_F0 + 0.0005, -0.1175);",
  "fretForm.quadraticCurveTo(0.62, -0.1165, 0.59, -0.1185); fretForm.quadraticCurveTo(0.566, -0.12, R_F1 + 0.001, -0.1215);",
  "{ depth: 0.0026, bevelEnabled: true, bevelThickness: 0.0011, bevelSize: 0.0011,",
  "f.rotation.y = -rad((i + 0.5) * STEG + 90)",
  "const BR = 0.024;",
];
export const BR = 0.024;
const R_F0 = 0.648, R_F1 = 0.558, Y_F = -0.147;
export const R_FICKA = 0.603;                     // fickgolvets lägsta punkt
const Y_VILA = Y_F + BR;                          // kulans centrum i vila i en ficka
export const SPAR_R_KULA = 0.866;                 // kulans radie på banan (för skärm → θ)
export const Y_SPAR = -0.062 + BR * 1.02;
export const ytaY = (r) => -0.062 - (0.865 - r) * (0.036 / 0.105);
const LUT_S = 0.035 / Math.sqrt(0.035 * 0.035 + 0.105 * 0.105), LUT_C = 0.105 / Math.sqrt(0.035 * 0.035 + 0.105 * 0.105);

function mjuk(pts, n) {                           // THREE.SplineCurve(...).getPoints(n): Catmull–Rom, likformig
  const cr = (t, p0, p1, p2, p3) => { const v0 = (p2 - p0) * 0.5, v1 = (p3 - p1) * 0.5, t2 = t * t, t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1; };
  const ut = [], L = pts.length;
  for (let d = 0; d <= n; d++) {
    const p = (L - 1) * (d / n), i = Math.floor(p), w = p - i;
    const a = pts[i === 0 ? i : i - 1], b = pts[i], c = pts[i > L - 2 ? L - 1 : i + 1], e = pts[i > L - 3 ? L - 1 : i + 2];
    ut.push([Math.max(0.0001, cr(w, a[0], b[0], c[0], e[0])), cr(w, a[1], b[1], c[1], e[1])]);
  }
  return ut;
}
const bage = (cr, cy, rr, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { sincos((a0 + (a1 - a0) * i / n) * GRAD); return [cr + rr * COS, cy + rr * SIN]; });
const kvad = (p0, c, p1, n) => Array.from({ length: n }, (_, i) => { const t = (i + 1) / n, u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });

// profiler [r, y] för rotationsytorna
const STATISK = [[0.96, 0.0], [0.93, 0.0], ...bage(0.912, -0.007, 0.007, 90, 180, 6),
  ...mjuk([[0.905, -0.007], [0.899, -0.02], [0.894, -0.036], [0.889, -0.05], [0.879, -0.058], [0.865, -0.062]], 30),
  [0.80, -0.083], [0.765, -0.095], [0.760, -0.098], [0.758, -0.104], [0.757, -0.18]];
const ROTOR = [...mjuk([[0.754, -0.114], [0.754, -0.105], [0.749, -0.1005], [0.744, -0.1005], [0.740, -0.104]], 24),
  [0.652, -0.116], [0.649, -0.118], [R_F0, -0.143], [0.626, -0.1465], [0.603, -0.147], [0.58, -0.1465],
  ...mjuk([[R_F1, -0.143], [0.556, -0.121], [0.552, -0.1165], [0.546, -0.116], [0.542, -0.118]], 24),
  ...mjuk([[0.542, -0.118], [0.45, -0.106], [0.33, -0.09], [0.2, -0.072], [0.13, -0.06], [0.124, -0.058]], 60).slice(1)];
// fackväggens kontur (radiell u, höjd y) och tjocklek: kärna ±0,0013 plus fasning 0,0011 runt om
const FRET = (() => {
  const A = [R_F1 + 0.001, Y_F - 0.004], B = [R_F0 + 0.0005, Y_F - 0.004], C = [R_F0 + 0.0005, -0.1175];
  const D = [0.59, -0.1185], E = [R_F1 + 0.001, -0.1215];
  return [A, B, C, ...kvad(C, [0.62, -0.1165], D, 8), ...kvad(D, [0.566, -0.12], E, 8)];
})();
const FRET_KARNA = 0.0013, FRET_FAS = 0.0011;
// avvisarna: oktaeder med halvaxlar a (radiellt), 0,011 (höjd), b (tangentiellt), lutade som ytan
const AVV = Array.from({ length: 8 }, (_, k) => {
  const th = (k * 45 + 22.5) * GRAD; sincos(th);
  const lang = k % 2 === 0, cx = -0.815 * SIN, cz = 0.815 * COS;
  return { k, grader: k * 45 + 22.5, cx, cy: ytaY(0.815), cz, er: [-SIN, COS], et: [-COS, -SIN], A: lang ? 0.05 : 0.016, C: 0.011, B: lang ? 0.016 : 0.045 };
});

const segment = (prof) => {                       // r0, y0, r1, y1, rmin, rmax, ymin, ymax
  const s = [];
  for (let i = 0; i + 1 < prof.length; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    if (r0 === r1 && y0 === y1) continue;
    s.push([r0, y0, r1, y1, Math.min(r0, r1), Math.max(r0, r1), Math.min(y0, y1), Math.max(y0, y1)]);
  }
  return s;
};
const SEG_S = segment(STATISK), SEG_R = segment(ROTOR), SEG_F = segment([...FRET, FRET[0]]);

// ---------- material och konstanter ----------
const G = 22.4;                                   // tyngd i enheter/s² (kulan 21 mm = 0,048 enheter, 1 enhet ≈ 0,44 m)
const K_LUFT = 0.0071;                            // luftmotstånd per enhet (6 g kula, Cd 0,47)
const C_RR = 0.016;                               // rullmotstånd
let BANA_F = 1;                                   // valfri faktor på luft- och rullmotståndet på banan (planera({ banFriktion })), 1 = standard
const V_STUDS = 0.12;                             // under denna normalfart: vilande kontakt i stället för studs
const MAT = {                                     // studskoefficient e, friktion my
  tra: { e: 0.3, my: 0.25 }, rotor: { e: 0.4, my: 0.2 }, fack: { e: 0.5, my: 0.15 }, avv: { e: 0.5, my: 0.15 },
};
const DT = 0.0005, DELSTEG_ROTOR = 2;            // 0,5 ms; två delsteg per steg nära rotorn
const REC = 0.001;                                // inspelning var 1 ms
const RHO_ROTOR = 0.79;                           // innanför: rotorn kan nås
const E_LAS = 0.06;                               // under denna relativa energi i en ficka kan kulan inte ta sig ur (fackvägg kräver ≈ 0,6)

// ---------- kontakter ----------
// närmaste punkt på en profil; sätter K_D (avstånd), K_NR, K_NY (normal mot kulans centrum)
let K_D = 0, K_NR = 0, K_NY = 0;
function profilAvstand(seg, r, y, rad) {
  let bast = Infinity, nr = 0, ny = 0;
  for (let i = 0; i < seg.length; i++) {
    const s = seg[i];
    if (r < s[4] - rad || r > s[5] + rad || y < s[6] - rad || y > s[7] + rad) continue;
    const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy;
    let t = ((r - s[0]) * dx + (y - s[1]) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = r - (s[0] + t * dx), py = y - (s[1] + t * dy), d2 = px * px + py * py;
    if (d2 < bast) { bast = d2; nr = px; ny = py; }
  }
  if (bast === Infinity) { K_D = Infinity; return; }
  const d = Math.sqrt(bast); K_D = d; K_NR = d > 0 ? nr / d : 0; K_NY = d > 0 ? ny / d : 1;
}
function inutiPolygon(u, y) {
  let inne = false;
  for (let i = 0, j = FRET.length - 1; i < FRET.length; j = i++) {
    const [ui, yi] = FRET[i], [uj, yj] = FRET[j];
    if ((yi > y) !== (yj > y) && u < ((uj - ui) * (y - yi)) / (yj - yi) + ui) inne = !inne;
  }
  return inne;
}
// närmaste punkt på triangel (Ericson); sätter T_X, T_Y, T_Z
let T_X = 0, T_Y = 0, T_Z = 0;
function triangelPunkt(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { T_X = ax; T_Y = ay; T_Z = az; return; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { T_X = bx; T_Y = by; T_Z = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); T_X = ax + v * abx; T_Y = ay + v * aby; T_Z = az + v * abz; return; }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { T_X = cx; T_Y = cy; T_Z = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); T_X = ax + w * acx; T_Y = ay + w * acy; T_Z = az + w * acz; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); T_X = bx + w * (cx - bx); T_Y = by + w * (cy - by); T_Z = bz + w * (cz - bz); return; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  T_X = ax + abx * v + acx * w; T_Y = ay + aby * v + acy * w; T_Z = az + abz * v + acz * w;
}

// djupaste kontakten för kulan i (x, y, z) med rotorn i vinkel fi (rad); sätter C_PEN, C_NX/NY/NZ, C_ROT (1 = rotordel), C_MAT
let C_PEN = 0, C_NX = 0, C_NY = 0, C_NZ = 0, C_ROT = 0, C_MAT = MAT.tra, C_TYP = 0;   // typ: 0 trä, 1 rotor, 2 fack, 3 avvisare
function kontakt(x, y, z, fi, medRotor) {
  C_PEN = 0;
  const rho = Math.sqrt(x * x + z * z), ux = rho > 0 ? x / rho : 0, uz = rho > 0 ? z / rho : 1;
  // skålen
  profilAvstand(SEG_S, rho, y, BR);
  if (BR - K_D > C_PEN) { C_PEN = BR - K_D; C_NX = K_NR * ux; C_NY = K_NY; C_NZ = K_NR * uz; C_ROT = 0; C_MAT = MAT.tra; C_TYP = 0; }
  // avvisarna
  if (rho > 0.74 && rho < 0.89 && y < -0.03) for (let k = 0; k < 8; k++) {
    const a = AVV[k], dx = x - a.cx, dy = y - a.cy - 0.002, dz = z - a.cz;
    if (dx * dx + dz * dz > (0.05 + BR) * (0.05 + BR)) continue;
    const gx = dx * a.er[0] + dz * a.er[1], gz = dx * a.et[0] + dz * a.et[1];   // grupplokalt: x radiellt, z tangentiellt
    const lx = gx * LUT_C + dy * LUT_S, ly = -gx * LUT_S + dy * LUT_C, lz = gz;  // ångra lutningen
    const sx = lx < 0 ? -1 : 1, sy = ly < 0 ? -1 : 1, sz = lz < 0 ? -1 : 1;
    let qx, qy, qz;
    const l1 = Math.abs(lx) / a.A + Math.abs(ly) / a.C + Math.abs(lz) / a.B;
    if (l1 <= 1) { qx = lx; qy = ly; qz = lz; }
    else { triangelPunkt(lx, ly, lz, sx * a.A, 0, 0, 0, sy * a.C, 0, 0, 0, sz * a.B); qx = T_X; qy = T_Y; qz = T_Z; }
    let nx = lx - qx, ny = ly - qy, nz = lz - qz, d = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l1 <= 1 || d === 0) {                     // inne i avvisaren (ska inte hända): ut längs sidoplanets normal
      nx = sx / a.A; ny = sy / a.C; nz = sz / a.B; const L = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= L; ny /= L; nz /= L; d = -(1 - l1) / L;
    } else { nx /= d; ny /= d; nz /= d; }
    const pen = BR - d;
    if (pen > C_PEN) {
      const wx = nx * LUT_C - ny * LUT_S, wy = nx * LUT_S + ny * LUT_C;     // tillbaka till världen
      C_PEN = pen; C_NX = wx * a.er[0] + nz * a.et[0]; C_NY = wy; C_NZ = wx * a.er[1] + nz * a.et[1]; C_ROT = 0; C_MAT = MAT.avv; C_TYP = 3;
    }
  }
  if (!medRotor || rho > 0.785) return;
  // rotorns rotationsytor
  profilAvstand(SEG_R, rho, y, BR);
  if (BR - K_D > C_PEN) { C_PEN = BR - K_D; C_NX = K_NR * ux; C_NY = K_NY; C_NZ = K_NR * uz; C_ROT = 1; C_MAT = MAT.rotor; C_TYP = 1; }
  // närmaste fackvägg (i rotorns system)
  if (rho > R_F1 - BR - 0.01 && rho < R_F0 + BR + 0.01 && y < -0.085) {
    const rel = thetaAv(x, z) - fi, STEGR = STEG * GRAD;
    const f = Math.round(rel / STEGR - 0.5), alfa = (f + 0.5) * STEGR + fi;
    sincos(alfa);
    const erx = -SIN, erz = COS, etx = -COS, etz = -SIN;
    const u = x * erx + z * erz, t = x * etx + z * etz;
    if (Math.abs(t) < BR + FRET_KARNA + FRET_FAS) {
      let d2 = 0, nu = 0, nv = 0;
      if (!inutiPolygon(u, y)) {
        let bast = Infinity;
        for (let i = 0; i < SEG_F.length; i++) {
          const s = SEG_F[i], dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy;
          let q = ((u - s[0]) * dx + (y - s[1]) * dy) / L2; q = q < 0 ? 0 : q > 1 ? 1 : q;
          const px = u - (s[0] + q * dx), py = y - (s[1] + q * dy), dd = px * px + py * py;
          if (dd < bast) { bast = dd; nu = px; nv = py; }
        }
        d2 = Math.sqrt(bast);
      }
      const dt = Math.abs(t) > FRET_KARNA ? Math.abs(t) - FRET_KARNA : 0, st = t < 0 ? -1 : 1;
      const L = Math.sqrt(d2 * d2 + dt * dt), pen = BR - (L - FRET_FAS);
      if (pen > C_PEN && L > 0) {
        const a = nu / L, b = nv / L, c = (st * dt) / L;   // nu, nv är redan d2 · enhetsnormal
        C_PEN = pen; C_NX = a * erx + c * etx; C_NY = b; C_NZ = a * erz + c * etz; C_ROT = 1; C_MAT = MAT.fack; C_TYP = 2;
      }
    }
  }
}

// ---------- rotorns rörelse ----------
// före vila: vridningen accelererar på 0,45 s (smoothstep) till w0, sedan jämn inbromsning d (lagerfriktion)
function rotorFore(startRad, tImp, w0, d) {
  const ta = 0.45;
  const vinkel = (t) => {
    const x = t - tImp;
    if (x <= 0) return startRad;
    if (x < ta) { const u = x / ta; return startRad + w0 * ta * (u * u * u - (u * u * u * u) / 2); }
    const y = x - ta, tStopp = w0 / d;
    const yy = y < tStopp ? y : tStopp;
    return startRad + w0 * ta / 2 + w0 * yy - (d * yy * yy) / 2;
  };
  const fart = (t) => {
    const x = t - tImp;
    if (x <= 0) return 0;
    if (x < ta) { const u = x / ta; return w0 * u * u * (3 - 2 * u); }
    const v = w0 - d * (x - ta); return v > 0 ? v : 0;
  };
  return { vinkel, fart };
}

// ---------- simuleringen ----------
// tillstånd: t, p (x,y,z), v, w (spinn); inspelning i rec (t, x, y, z) var REC s
function nyttTillstand(t, x, y, z, vx, vy, vz, wx, wy, wz) { return { t, x, y, z, vx, vy, vz, wx, wy, wz }; }
function kopiera(s) { return { ...s }; }

// ett steg: tyngd + luft, förflyttning, kontakter (djupaste först, upp till 4 varv). Returnerar största studsfart mot fackvägg/avvisare.
let STEG_STUDS_FACK = 0, STEG_STUDS_AVV = 0, STEG_KONTAKT = false, MAX_PEN = 0;
function steg(s, h, rot, medRotor) {
  const kf = medRotor ? 1 : BANA_F;               // banans faktor gäller bara före rotorn (banfasen och fallet)
  const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz), luft = 1 - K_LUFT * kf * sp * h;
  s.vx *= luft; s.vy = s.vy * luft - G * h; s.vz *= luft;
  s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.t += h;
  const fi = rot.vinkel(s.t), om = rot.fart(s.t);
  STEG_STUDS_FACK = 0; STEG_STUDS_AVV = 0; STEG_KONTAKT = false;
  for (let varv = 0; varv < 4; varv++) {
    kontakt(s.x, s.y, s.z, fi, medRotor);
    if (C_PEN <= 1e-9) break;
    STEG_KONTAKT = true;
    const nx = C_NX, ny = C_NY, nz = C_NZ;
    s.x += nx * C_PEN; s.y += ny * C_PEN; s.z += nz * C_PEN;
    // ytans fart i kontaktpunkten (rotordelar: om × r)
    const cx = s.x - nx * BR, cz = s.z - nz * BR;
    const ux = C_ROT ? -om * cz : 0, uz = C_ROT ? om * cx : 0;
    let rx = s.vx - ux, ry = s.vy, rz = s.vz - uz;
    const vn = rx * nx + ry * ny + rz * nz;
    if (vn >= 0) continue;
    const studs = -vn > V_STUDS, jn = studs ? -(1 + C_MAT.e) * vn : -vn;
    if (studs && C_TYP === 2) STEG_STUDS_FACK = Math.max(STEG_STUDS_FACK, -vn);
    if (studs && C_TYP === 3) STEG_STUDS_AVV = Math.max(STEG_STUDS_AVV, -vn);
    rx += nx * jn; ry += ny * jn; rz += nz * jn;
    // glidning i kontaktpunkten: v + w × (−n·BR) − u, tangentiellt
    let sx = rx - BR * (s.wy * nz - s.wz * ny), sy = ry - BR * (s.wz * nx - s.wx * nz), sz = rz - BR * (s.wx * ny - s.wy * nx);
    const sn = sx * nx + sy * ny + sz * nz; sx -= sn * nx; sy -= sn * ny; sz -= sn * nz;
    const sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (sl > 1e-12) {
      const k = Math.min(2 / 7, (C_MAT.my * jn) / sl), jx = -sx * k, jy = -sy * k, jz = -sz * k;   // friktionsimpuls
      rx += jx; ry += jy; rz += jz;
      s.wx -= (2.5 * (ny * jz - nz * jy)) / BR; s.wy -= (2.5 * (nz * jx - nx * jz)) / BR; s.wz -= (2.5 * (nx * jy - ny * jx)) / BR;
    }
    if (!studs) {                                 // rullmotstånd i vilande kontakt: N = jn/h
      let tx = rx - (rx * nx + ry * ny + rz * nz) * nx, ty = ry - (rx * nx + ry * ny + rz * nz) * ny, tz = rz - (rx * nx + ry * ny + rz * nz) * nz;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz), dv = Math.min(C_RR * kf * (jn / h) * h, tl);
      if (tl > 1e-12) {
        const ax = (-tx / tl) * dv, ay = (-ty / tl) * dv, az = (-tz / tl) * dv;
        rx += ax; ry += ay; rz += az;
        s.wx += (ny * az - nz * ay) / BR; s.wy += (nz * ax - nx * az) / BR; s.wz += (nx * ay - ny * ax) / BR;
      }
    }
    s.vx = rx + ux; s.vy = ry; s.vz = rz + uz;
  }
  if (C_PEN > MAX_PEN) MAX_PEN = C_PEN;           // kvarvarande inträngning efter lösningen
}

// relativ energi mot rotorn (per massenhet) och om kulan ligger i en ficka
function relEnergi(s, om) {
  const rx = s.vx + om * s.z, rz = s.vz - om * s.x;
  return 0.5 * (rx * rx + s.vy * s.vy + rz * rz) + G * (s.y - Y_VILA);
}

// banfasen och fallet (bara skålen och avvisarna): till dess kulan kan nå rotorn
function simuleraStatisk(s, rec, tMax) {
  const tom = { vinkel: () => 0, fart: () => 0 };
  let nasta = rec.n ? rec.t[rec.n - 1] + REC : s.t, lamna = null, avvTraffar = 0;
  while (s.t < tMax) {
    steg(s, DT, tom, false);
    if (STEG_STUDS_AVV > 0) avvTraffar++;
    const rho = Math.sqrt(s.x * s.x + s.z * s.z);
    if (lamna === null && rho < 0.857) lamna = s.t;
    if (s.y > 0.03 || rho > 0.93) return { fel: "kulan for ur hjulet (för hög fart för banan)" };
    if (s.t >= nasta) { spela(rec, s); nasta += REC; }
    if (rho < RHO_ROTOR) return { lamna, avvTraffar };
  }
  return { fel: "kulan lämnade aldrig banan" };
}
// studsfasen med rotorn: till vila (energin räcker inte för att ta sig ur fickan) eller tidsgräns
function simuleraRotor(s, rec, rot, tMax) {
  let nasta = rec.n ? rec.t[rec.n - 1] + REC : s.t, fackStudsar = 0, avvTraffar = 0, kontakt0 = null, kant = 0;
  const h = DT / DELSTEG_ROTOR;
  while (s.t < tMax) {
    for (let i = 0; i < DELSTEG_ROTOR; i++) {
      steg(s, h, rot, true);
      if (STEG_STUDS_FACK > 0.15) fackStudsar++;
      if (STEG_STUDS_AVV > 0) avvTraffar++;
    }
    const rho = Math.sqrt(s.x * s.x + s.z * s.z);
    if (kontakt0 === null && rho < 0.775) kontakt0 = s.t;
    if (s.t >= nasta) { spela(rec, s); nasta += REC; }
    if (rho > 0.93 || s.y > 0.03) return { fel: "kulan for ur hjulet" };
    // fastkilad mellan skålens innerkant och rotorns ytterkant (glipan i modellen): förkastas direkt
    if (rho > 0.735 && s.y > -0.09 && kontakt0 !== null) { if ((kant += DT) > 0.6) return { fel: "fastnade på rotorkanten" }; } else kant = 0;
    if (rho > R_F1 + 0.012 && rho < R_F0 - 0.012 && s.y < -0.112) {
      const om = rot.fart(s.t);
      if (relEnergi(s, om) < E_LAS) return { vila: s.t, fackStudsar, avvTraffar, kontakt0 };
    }
  }
  return { fel: "kulan kom aldrig till vila" };
}
function spela(rec, s) {
  if (rec.n === rec.t.length) for (const k of ["t", "x", "y", "z"]) { const a = new Float64Array(rec[k].length * 2); a.set(rec[k]); rec[k] = a; }
  rec.t[rec.n] = s.t; rec.x[rec.n] = s.x; rec.y[rec.n] = s.y; rec.z[rec.n] = s.z; rec.n++;
}
const nyInspelning = () => ({ n: 0, t: new Float64Array(16384), x: new Float64Array(16384), y: new Float64Array(16384), z: new Float64Array(16384) });

// kulan på banan i jämvikt för vinkelfarten w (rad/s, moturs): där väggens lutning bär centripetalkraften
export function banStart(thetaGrader, w) {
  const track = SEG_S.filter((s) => s[4] >= 0.864 && s[5] <= 0.906);
  let val = track[track.length - 1];
  for (const s of track) {                        // uppifrån och ned: första segment som är flackt nog
    const lut = (s[1] - s[3]) / (s[0] - s[2]);     // dy/dr (positiv: väggen stiger utåt)
    const rc = (s[0] + s[2]) / 2 - BR * 0.9, behov = (w * w * rc) / G;
    if (lut <= behov) { val = s; break; }
  }
  const dr = val[2] - val[0], dy = val[3] - val[1], L = Math.sqrt(dr * dr + dy * dy);
  let nr = -dy / L, ny = dr / L; if (ny < 0) { nr = -nr; ny = -ny; }
  const r = (val[0] + val[2]) / 2 + nr * BR, y = (val[1] + val[3]) / 2 + ny * BR;
  sincos(thetaGrader * GRAD);
  const x = -r * SIN, z = r * COS, v = w * r;
  const vx = COS * v, vz = SIN * v;                // moturs: θ minskar
  // rullande: w = n × v / BR (n = normal i kontakten, pekar mot kulan)
  const nx = nr * -SIN, nz = nr * COS;
  return nyttTillstand(0, x, y, z, vx, 0, vz, (ny * vz) / BR, (nz * vx - nx * vz) / BR, (-ny * vx) / BR);
}

function slumpkalla(seed) {                       // mulberry32, seed = tal eller sträng
  let s = typeof seed === "number" ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// rotorns utrullning efter vila: Hermite-fart från (omV, −broms) till 0 med målfickan exakt vid 205.
// Vinkeln är given (mod 360); varvtalet väljs så att tiden hamnar i utr[0]–utr[1] s, annars förkastas villkoret.
function utrulla(rot, tV, iMal, dB, utr) {
  const fiV = rot.vinkel(tV), omV = rot.fart(tV), STEGR = STEG * GRAD;
  if (omV < 15 * GRAD) return null;
  const bas = mod(UPPHAMT * GRAD - iMal * STEGR - fiV, TAU), onskad = (omV * (utr[0] + utr[1])) / 4;
  let n = Math.max(0, Math.round((onskad - bas) / TAU)), Delta = bas + TAU * n;
  if (Delta < 0.05) Delta += TAU;
  // ∫v = omV·T/2 − d·T²/12 = Delta; d sänks om det behövs för att lösningen ska finnas
  let dE = Math.min(dB, (3 * omV * omV) / (4 * Delta) * 0.999), Tu;
  if (dE <= 1e-9) { dE = 0; Tu = (2 * Delta) / omV; }
  else Tu = (omV / 2 - Math.sqrt(omV * omV / 4 - (dE * Delta) / 3)) / (dE / 6);
  if (Tu < utr[0] || Tu > utr[1]) return null;
  return { Delta, Tu, dE, fiV, omV };
}

// rotorn hela vägen: före vila som simulerat, efter vila Hermite-utrullningen, stilla från tV + Tu
function helRotor(rot, tV, ut) {
  const { fiV, omV, dE, Tu, Delta } = ut;
  const vinkel = (t) => {
    if (t <= tV) return rot.vinkel(t);
    if (t >= tV + Tu) return fiV + Delta;
    const q = (t - tV) / Tu, q2 = q * q, q3 = q2 * q, q4 = q3 * q;
    return fiV + Tu * (omV * (q - q3 + q4 / 2) - dE * Tu * (q2 / 2 - (2 * q3) / 3 + q4 / 4));
  };
  const fart = (t) => {
    if (t <= tV) return rot.fart(t);
    if (t >= tV + Tu) return 0;
    const q = (t - tV) / Tu, q2 = q * q, q3 = q2 * q;
    return omV * (2 * q3 - 3 * q2 + 1) - dE * Tu * (q3 - 2 * q2 + q);
  };
  return { vinkel, fart };
}
// vila: samma fysik i fickan medan rotorn rullar ut; kulan måste stanna i målfickan (annars fel)
function simuleraVila(s, rec, rot, iMal, tStopp) {
  let nasta = rec.t[rec.n - 1] + REC, stilla = 0;
  const STEGR = STEG * GRAD, h = DT / DELSTEG_ROTOR;
  while (s.t < tStopp + 3) {
    for (let i = 0; i < DELSTEG_ROTOR; i++) steg(s, h, rot, true);
    if (s.t >= nasta) { spela(rec, s); nasta += REC; }
    const rel = thetaAv(s.x, s.z) - rot.vinkel(s.t), rho = Math.sqrt(s.x * s.x + s.z * s.z);
    if (mod(Math.round(rel / STEGR), N) !== iMal || s.y > -0.105 || rho < R_F1 || rho > R_F0) return { fel: "lämnade fickan" };
    if (s.t > tStopp) {
      const v2 = s.vx * s.vx + s.vy * s.vy + s.vz * s.vz;
      if (v2 < 1e-6) { if ((stilla += DT) > 0.05) break; } else stilla = 0;
    }
  }
  spela(rec, s);
  return {};
}

// ---------- planera ----------
// slappFart: kulans vinkelfart vid släppet i °/s (moturs); sökningen håller sig inom ±tolerans (standard 5 %).
// rotorFart: intervall för rotorns toppfart i °/s; rotorBroms: rotorns inbromsning i °/s² före vila.
// banFriktion: valfri faktor på luft- och rullmotståndet före rotorn (standard 1 = oförändrat); under 1 går kulan fler varv.
export function planera(arg = {}) {
  BANA_F = arg.banFriktion ?? 1;
  try { return planeraInre(arg); } finally { BANA_F = 1; }
}
function planeraInre({ mal, rotorStart = 0, impulsMs = 0, slappMs = 1700, slappTheta = 210, slappFart, tolerans = 0.05, seed = 1,
  plockMs, rotorFart = [120, 200], rotorBroms = 4, utrullning = [2, 6], maxForsok = 1500 } = {}) {
  if (!WHEEL.includes(mal)) throw Error("ogiltigt målnummer");
  if (!(slappMs >= impulsMs)) throw Error("släppet före impulsen");
  const t0 = performance.now(), rng = slumpkalla(seed);
  const fartMal = slappFart ?? 340 + 40 * rng();
  const iMal = WHEEL.indexOf(mal), I = impulsMs / 1000, R = slappMs / 1000, startRad = rotorStart * GRAD, STEGR = STEG * GRAD;
  let forsok = 0, hittad = null, statiskaKorningar = 0, vilaFel = 0;
  const fartFel = [];
  for (let fi = 0; fi < 25 && !hittad && forsok < maxForsok; fi++) {
    // kulans släppfart: först exakt målet, sedan slumpade avvikelser inom toleransen
    const f = fi === 0 ? 1 : 1 + tolerans * (2 * rng() - 1), w = fartMal * f * GRAD;
    const rec = nyInspelning(), s = banStart(slappTheta, w); s.t = R;
    spela(rec, s); MAX_PEN = 0;
    const st = simuleraStatisk(s, rec, R + 40); statiskaKorningar++;
    if (st.fel) { fartFel.push(st.fel); continue; }
    const nStat = rec.n, ogonblick = kopiera(s), penStat = MAX_PEN;
    for (let k = 0; k < 80 && !hittad && forsok < maxForsok; k++, forsok++) {
      const w0 = (rotorFart[0] + (rotorFart[1] - rotorFart[0]) * rng()) * GRAD, rot = rotorFore(startRad, I, w0, rotorBroms * GRAD);
      const s2 = kopiera(ogonblick); rec.n = nStat; MAX_PEN = penStat;
      const r = simuleraRotor(s2, rec, rot, s2.t + 4.5);   // längre studsfas (kulan åker runt på ringen) förkastas
      if (r.fel) continue;
      const rel = thetaAv(s2.x, s2.z) - rot.vinkel(r.vila), ficka = mod(Math.round(rel / STEGR), N);
      if (ficka !== iMal) continue;
      const ut = utrulla(rot, r.vila, iMal, rotorBroms * GRAD, utrullning);
      if (!ut) continue;
      // efter vila: fortsätt simulera i fickan med rotorns verkliga utrullning; lämnar kulan fickan förkastas villkoret
      const rotHel = helRotor(rot, r.vila, ut), v = simuleraVila(s2, rec, rotHel, iMal, r.vila + ut.Tu);
      if (v.fel) { vilaFel++; continue; }
      hittad = { f, w0, rot: rotHel, rec, st, r, s: s2, ficka, rel, ut, v, maxPen: MAX_PEN };
    }
  }
  if (!hittad) throw Error("ingen bana till målfickan hittades" + (fartFel.length ? ": " + fartFel[0] : ""));
  const { rot, rec, r, f, w0, ut } = hittad;
  const sokMs = performance.now() - t0;
  const tV = r.vila, tStopp = tV + ut.Tu, Delta = ut.Delta, rotorVinkel = rot.vinkel;

  // ---- uppspelning ----
  const iForra = mod(Math.round((UPPHAMT - rotorStart) / STEG), N), plock = (plockMs ?? impulsMs) / 1000;
  const grader = (r) => (r * 180) / Math.PI;
  const vid = (tMs) => {
    const t = tMs / 1000, fi = rotorVinkel(t), rotorGrader = mod(grader(fi), 360);
    if (t < plock) return { rotorGrader, boll: { theta: mod(grader(fi) + iForra * STEG, 360), r: R_FICKA, y: Y_VILA }, fas: "ficka" };
    if (t < R) return { rotorGrader, boll: null, fas: "hand" };
    let lo = 0, hi = rec.n - 1;
    if (t >= rec.t[hi]) lo = hi; else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rec.t[m] <= t) lo = m; else hi = m; }
    const j = Math.min(lo + 1, rec.n - 1), w = j === lo ? 0 : (t - rec.t[lo]) / (rec.t[j] - rec.t[lo]);
    const x = rec.x[lo] + (rec.x[j] - rec.x[lo]) * w, y = rec.y[lo] + (rec.y[j] - rec.y[lo]) * w, z = rec.z[lo] + (rec.z[j] - rec.z[lo]) * w;
    const rho = Math.hypot(x, z);
    const fas = t >= tStopp ? "stilla" : t >= tV ? "vila" : rho > 0.857 ? "bana" : rho > 0.775 ? "lutning" : "studs";
    return { rotorGrader, boll: { theta: mod(grader(Math.atan2(-x, z)), 360), r: rho, y }, fas };
  };
  const ms = (x) => Math.round(x * 1000);
  const banVarv = (() => {                        // kulans varv på banan (fram till den lämnar banan)
    let v = 0, forr = null;
    for (let i = 0; i < rec.n && rec.t[i] <= (hittad.st.lamna ?? R); i++) {
      const th = Math.atan2(-rec.x[i], rec.z[i]); if (forr !== null) v += Math.abs(((th - forr + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); forr = th;
    }
    return v / (2 * Math.PI);
  })();
  return {
    vid,
    inspelning: rec, rotorVinkel,
    info: { mal, seed, impulsMs, slappMs, slappTheta, slappFartMal: +fartMal.toFixed(1), slappFart: +(fartMal * f).toFixed(1),
      fartAvvikelse: +((f - 1) * 100).toFixed(2) + " %", rotorToppfart: +grader(w0).toFixed(1), plockMs: ms(plock),
      lamnaBanaMs: ms(hittad.st.lamna), kontaktMs: ms(r.kontakt0 ?? r.vila), vilaMs: ms(tV), stoppMs: ms(tStopp),
      studsfasMs: ms(tV - (r.kontakt0 ?? tV)), kulVarvBana: +banVarv.toFixed(2), avvisarTraffar: hittad.st.avvTraffar + r.avvTraffar,
      fackStudsar: r.fackStudsar, rotorUtrullningGrader: +grader(Delta).toFixed(1), maxIntrangning: +hittad.maxPen.toExponential(2), vilaFel,
      forsok, statiskaKorningar, sokMs: Math.round(sokMs) },
  };
}

export const _intern = { banStart, simuleraStatisk, simuleraRotor, rotorFore, nyInspelning, kopiera, thetaAv, GRAD };

// minsta avstånd från kulans yta till hjulet (negativt = inträngning), rotorn i vinkel fiGrader; för prov
export function frigang(x, y, z, fiGrader) {
  kontakt(x, y, z, fiGrader * GRAD, true);
  return -C_PEN;
}
