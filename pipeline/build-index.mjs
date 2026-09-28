#!/usr/bin/env node
// Build streams/index.json from a directory of raw Annex-B .h264 files.
// Output schema for the stream index:
//   { version, codec, width, height,
//     clips: { "<group>/<cat>/<name>": { file, fps, frameCount, frames: [[offset,size],...] } } }
//
// Access units are split on AUD NALs (type 9) — encode.sh sets aud=1.
// Usage: node build-index.mjs <in-dir> <out-dir> [--codec avc1.4D4028] [--wh 1440]
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) { console.error('usage: build-index.mjs <in-dir> <out-dir>'); process.exit(1); }
const indexPath = join(outDir, 'streams', 'index.json');
const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
const codec = argOf('--codec') ?? previous.codec ?? 'avc1.4D4028';
const wh = Number(argOf('--wh') ?? previous.width ?? 1440);
const height = Number(argOf('--h') ?? previous.height ?? wh);
const hash = buf => createHash('sha256').update(buf).digest('hex');
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
// Partial rebuilds must retain other takes. Validate every input before any
// deployed stream is replaced, and never carry calibration to different bytes.
const clips = { ...previous.clips };
const copies = [];
for (const f of readdirSync(inDir).filter(f => f.endsWith('.h264')).sort()) {
  const buf = readFileSync(join(inDir, f));
  const bounds = auBoundaries(buf);
  if (bounds.length === 0 || bounds[0] !== 0) {
    throw new Error(`${f}: no AUD at offset 0 — re-encode with aud=1`);
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
  const old = previous.clips?.[key];
  const oldPath = old && join(outDir, 'streams', old.file);
  const unchanged = oldPath && existsSync(oldPath) && hash(readFileSync(oldPath)) === hash(buf);
  if (old?.audioDelayMs !== undefined && !unchanged) {
    throw new Error(`${key}: replacing a calibrated take requires a separately staged asset set and new calibration. Existing files were not changed.`);
  }
  clips[key] = { ...(unchanged ? old : {}), file: f, fps: old?.fps ?? 24, frameCount: frames.length, frames };
  copies.push([join(inDir, f), join(outDir, 'streams', f)]);
  console.log(`${key}: ${frames.length} frames, ${buf.length} bytes, IDR=${frames[0][1]}b`);
}
for (const [source, destination] of copies) if (source !== destination) copyFileSync(source, destination);
writeFileSync(indexPath,
  JSON.stringify({ ...previous, version: previous.version ?? 1, codec, width: wh, height, clips }));
console.log(`wrote ${Object.keys(clips).length} clips -> ${join(outDir, 'streams/index.json')}`);
