#!/usr/bin/env node
// Validates the dealer video stream pipeline:
//  1. frames array non-empty, frameCount === frames.length
//  2. frames contiguous, first offset 0, last end === file byte size
//  3. First AU: AUD(9) + SPS(7) + PPS(8) + IDR(5); every later AU: non-IDR slice(1)
//  4. No AU except the first contains an IDR
//  5. Frame count cross-checked against ffprobe -count_frames
//  6. Per-clip stats: frames, bytes, IDR size, mean P-frame size

import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STREAMS_DIR = join(__dirname, "..", "web", "public", "dealer", "streams");
const INDEX_PATH = join(STREAMS_DIR, "index.json");
const FFPROBE = "/opt/homebrew/bin/ffprobe";

const errors = [];
const warnings = [];
const stats = [];

function err(clip, msg) {
  errors.push(`[${clip}] ${msg}`);
}

// Extract NAL unit types from an Annex-B byte range (one access unit).
function nalTypes(buf, start, end) {
  const types = [];
  let i = start;
  while (i < end - 3) {
    // find start code 00 00 01 (optionally preceded by an extra 00)
    if (buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1) {
      const header = buf[i + 3];
      types.push(header & 0x1f);
      i += 3;
    } else {
      i++;
    }
  }
  return types;
}

function ffprobeFrameCount(file) {
  const out = execFileSync(
    FFPROBE,
    [
      "-v", "error",
      "-count_frames",
      "-select_streams", "v:0",
      "-show_entries", "stream=nb_read_frames",
      "-of", "csv=p=0",
      file,
    ],
    { encoding: "utf8" }
  ).trim();
  const n = parseInt(out, 10);
  if (!Number.isFinite(n)) throw new Error(`unparseable ffprobe output: ${JSON.stringify(out)}`);
  return n;
}

const index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
const clipNames = Object.keys(index.clips ?? {});
if (clipNames.length === 0) {
  errors.push("[index] index.json contains no clips");
}

for (const name of clipNames) {
  const clip = index.clips[name];
  const filePath = join(STREAMS_DIR, clip.file);

  // Normalize frames: entries are [offset, size] pairs (or {offset, size} objects).
  const frames = (clip.frames ?? []).map((f) =>
    Array.isArray(f) ? { offset: f[0], size: f[1] } : f
  );

  // --- Check 1: non-empty + frameCount consistency
  if (frames.length === 0) {
    err(name, "frames array is empty");
    continue;
  }
  if (clip.frameCount !== frames.length) {
    err(name, `frameCount=${clip.frameCount} but frames.length=${frames.length}`);
  }

  // --- Check 2: contiguity + file size
  let fileSize;
  try {
    fileSize = statSync(filePath).size;
  } catch {
    err(name, `file missing on disk: ${filePath}`);
    continue;
  }
  if (frames[0].offset !== 0) {
    err(name, `first frame offset is ${frames[0].offset}, expected 0`);
  }
  for (let i = 0; i < frames.length - 1; i++) {
    const end = frames[i].offset + frames[i].size;
    if (end !== frames[i + 1].offset) {
      err(name, `gap/overlap at frame ${i}: end ${end} != next offset ${frames[i + 1].offset}`);
    }
  }
  const last = frames[frames.length - 1];
  const lastEnd = last.offset + last.size;
  if (lastEnd !== fileSize) {
    err(name, `last frame ends at ${lastEnd} but file is ${fileSize} bytes`);
  }

  // --- Checks 3 & 4: NAL structure per AU
  const buf = readFileSync(filePath);
  const firstTypes = nalTypes(buf, frames[0].offset, frames[0].offset + frames[0].size);
  for (const [t, label] of [[9, "AUD"], [7, "SPS"], [8, "PPS"], [5, "IDR slice"]]) {
    if (!firstTypes.includes(t)) {
      err(name, `first AU missing ${label} (NAL type ${t}); found types [${firstTypes.join(",")}]`);
    }
  }
  for (let i = 1; i < frames.length; i++) {
    const types = nalTypes(buf, frames[i].offset, frames[i].offset + frames[i].size);
    if (!types.includes(1)) {
      err(name, `AU ${i} missing non-IDR slice (NAL type 1); found types [${types.join(",")}]`);
    }
    if (types.includes(5)) {
      err(name, `AU ${i} contains an IDR (NAL type 5) - changes legal splice points`);
    }
  }

  // --- Check 5: ffprobe cross-check
  let probed = null;
  try {
    probed = ffprobeFrameCount(filePath);
    if (probed !== frames.length) {
      err(name, `ffprobe counted ${probed} frames, index has ${frames.length}`);
    }
  } catch (e) {
    err(name, `ffprobe failed: ${e.message}`);
  }

  // --- Check 6: stats
  const pSizes = frames.slice(1).map((f) => f.size);
  const meanP = pSizes.length ? pSizes.reduce((a, b) => a + b, 0) / pSizes.length : 0;
  stats.push({
    clip: name,
    frames: frames.length,
    bytes: fileSize,
    idrBytes: frames[0].size,
    meanPBytes: Math.round(meanP),
    ffprobe: probed ?? "n/a",
  });
}

// --- Report
const pad = (s, n) => String(s).padStart(n);
const header = `${"clip".padEnd(38)}${pad("frames", 7)}${pad("bytes", 10)}${pad("IDR B", 9)}${pad("mean P B", 10)}${pad("ffprobe", 9)}`;
console.log(header);
console.log("-".repeat(header.length));
for (const s of stats) {
  console.log(
    `${s.clip.padEnd(38)}${pad(s.frames, 7)}${pad(s.bytes, 10)}${pad(s.idrBytes, 9)}${pad(s.meanPBytes, 10)}${pad(s.ffprobe, 9)}`
  );
}
console.log();

for (const w of warnings) console.log(`WARN  ${w}`);
if (errors.length) {
  console.log(`FAIL: ${errors.length} error(s)`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`PASS: ${clipNames.length} clips validated (index, contiguity, NAL structure, ffprobe)`);
}
