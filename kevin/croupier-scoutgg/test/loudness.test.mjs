import test from 'node:test';
import assert from 'node:assert/strict';
import { integratedLoudness, normalizePcm16 } from '../server/loudness.mjs';

const RATE = 24000;
const sine = (hz, dbfs, secs, rate = RATE) => Float64Array.from({ length: Math.round(secs * rate) }, (_, i) => 10 ** (dbfs / 20) * Math.sin(2 * Math.PI * hz * i / rate));
const pcm16 = x => { const b = Buffer.alloc(x.length * 2); x.forEach((v, i) => b.writeInt16LE(Math.round(v * 32767), i * 2)); return b; };

test('BS.1770 reference: a 1 kHz sine at -20 dBFS reads -23.0 LUFS (-0.691 + 10·log10(0.005) + 0.69 dB of K-weighting at 1 kHz)', () => {
  const l = integratedLoudness(sine(1000, -20, 5), RATE);
  assert.ok(Math.abs(l - -23.0) < 0.1, `got ${l}`);
});

test('a quiet voice-level clip is raised to -16 LUFS with one fixed gain, and silence is left alone', () => {
  const { pcm, lufs, gainDb } = normalizePcm16(pcm16(sine(300, -30, 3)), RATE);
  assert.ok(lufs < -30 && gainDb > 10);
  const x = Float64Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2) / 32768);
  assert.ok(Math.abs(integratedLoudness(x, RATE) - -16) < 0.3);
  const quiet = Buffer.alloc(RATE * 2);
  assert.equal(normalizePcm16(quiet, RATE).gainDb, 0);
});

test('a loud, peaky clip is held under -0.5 dBFS instead of clipping (it may land under -16 LUFS)', () => {
  const x = sine(300, -20, 3); x[1000] = 0.99;   // one near-full-scale peak
  const { pcm } = normalizePcm16(pcm16(x), RATE);
  let peak = 0; for (let i = 0; i < pcm.length; i += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)) / 32768);
  assert.ok(20 * Math.log10(peak) <= -0.45, `peak ${20 * Math.log10(peak)} dBFS`);
});
