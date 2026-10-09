// Integrated loudness (EBU R128 / ITU-R BS.1770: K-weighting, 400 ms blocks with 75 % overlap, -70 LUFS absolute
// and -10 LU relative gates) and a fixed-gain normaliser. Emil's lip-sync recipe: every voice clip at -16 LUFS with
// one gain per clip (no compressor), peaks kept under -0.5 dBFS, because MuseTalk moves the mouth with the level.

// K-weighting as two biquads, designed for any sample rate (pre-filter shelf + RLB high-pass, as in BS.1770).
function kWeights(rate) {
  const shelf = (() => { const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    const K = Math.tan(Math.PI * f0 / rate), Vh = 10 ** (G / 20), Vb = Vh ** 0.4996667741545416, a0 = 1 + K / Q + K * K;
    return { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] }; })();
  const hp = (() => { const f0 = 38.13547087602444, Q = 0.5003270373238773, K = Math.tan(Math.PI * f0 / rate), a0 = 1 + K / Q + K * K;
    return { b: [1, -2, 1], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] }; })();
  return [shelf, hp];
}
function filter(x, { b, a }) {
  const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}

/** Integrated loudness in LUFS of mono float samples (-1..1). -Infinity for silence or audio under one block. */
export function integratedLoudness(x, rate) {
  let k = Float64Array.from(x); for (const f of kWeights(rate)) k = filter(k, f);
  const block = Math.round(0.4 * rate), hop = Math.round(0.1 * rate), z = [];
  for (let i = 0; i + block <= k.length; i += hop) { let e = 0; for (let j = i; j < i + block; j++) e += k[j] * k[j]; z.push(e / block); }
  const L = e => -0.691 + 10 * Math.log10(e), mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  let g = z.filter(e => L(e) > -70); if (!g.length) return -Infinity;
  g = g.filter(e => L(e) > L(mean(g)) - 10); return g.length ? L(mean(g)) : -Infinity;
}

/** 16-bit little-endian mono PCM -> the same PCM at `target` LUFS with one fixed gain, peaks under `ceiling` dBFS. */
export function normalizePcm16(pcm, rate, { target = -16, ceiling = -0.5 } = {}) {
  const n = Math.floor(pcm.length / 2), x = new Float64Array(n); let peak = 0;
  for (let i = 0; i < n; i++) { x[i] = pcm.readInt16LE(i * 2) / 32768; peak = Math.max(peak, Math.abs(x[i])); }
  const lufs = integratedLoudness(x, rate);
  if (!Number.isFinite(lufs) || peak === 0) return { pcm, lufs, gainDb: 0 };
  const gain = Math.min(10 ** ((target - lufs) / 20), 10 ** (ceiling / 20) / peak), out = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * gain * 32768))), i * 2);
  return { pcm: out, lufs, gainDb: 20 * Math.log10(gain) };
}
