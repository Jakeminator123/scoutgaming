#!/usr/bin/env node
// Build streams/index.json from a directory of raw Annex-B .h264 files.
// Output schema matches the audited demo (reference/sunny-streams-index.json):
//   { version, codec, width, height,
//     clips: { "<group>/<cat>/<name>": { file, fps, frameCount, frames: [[offset,size],...] } } }
//
// Access units are split on AUD NALs (type 9) — encode.sh sets aud=1.
// Usage: node build-index.mjs <in-dir> <out-dir> [--codec avc1.4D4028] [--wh 1440]
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) { console.error('usage: build-index.mjs <in-dir> <out-dir>'); process.exit(1); }
const codec = argOf('--codec') ?? 'avc1.4D4028';
const wh = Number(argOf('--wh') ?? 1440);
function argOf(k) { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; }

// Return byte offsets of every start code whose NAL is an AUD (type 9).
function auBoundaries(buf) {
  const out = [];
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] !== 0) continue;
    let s = -1;
    if (buf[i + 1] === 0 && buf[i + 2] === 1) s = i + 3;
    else if (buf[i + 1] === 0 && buf[i + 2] === 0 && buf[i + 3] === 1) s = i + 4;
    if (s < 0 || s >= buf.length) continue;
    const nalType = buf[s] & 0x1f;
    if (nalType === 9) out.push(i);
    i = s; // skip past the start code we just classified
  }
  return out;
}

mkdirSync(join(outDir, 'streams'), { recursive: true });
const clips = {};
for (const f of readdirSync(inDir).filter(f => f.endsWith('.h264')).sort()) {
  const buf = readFileSync(join(inDir, f));
  const bounds = auBoundaries(buf);
  if (bounds.length === 0 || bounds[0] !== 0) {
    console.error(`SKIP ${f}: no AUD at offset 0 — re-encode with aud=1`);
    continue;
  }
  const frames = bounds.map((off, i) =>
    [off, (i + 1 < bounds.length ? bounds[i + 1] : buf.length) - off]);
  // clip key "idle-1/idle/idle-breathe" from file "idle-1_idle_idle-breathe.h264"
  const stem = basename(f, '.h264');
  // key is group/category/name, so only the FIRST TWO underscores are
  // separators - a clip name may itself contain underscores (fair_rng), and
  // splitting on every one silently produced a four-part key nothing matched
  const bits = stem.split('_');
  const key = bits.length > 3
    ? [bits[0], bits[1], bits.slice(2).join('_')].join('/')
    : bits.join('/');
  clips[key] = { file: f, fps: 24, frameCount: frames.length, frames };
  copyFileSync(join(inDir, f), join(outDir, 'streams', f));
  console.log(`${key}: ${frames.length} frames, ${buf.length} bytes, IDR=${frames[0][1]}b`);
}
writeFileSync(join(outDir, 'streams', 'index.json'),
  JSON.stringify({ version: 1, codec, width: wh, height: wh, clips }));
console.log(`wrote ${Object.keys(clips).length} clips -> ${join(outDir, 'streams/index.json')}`);
