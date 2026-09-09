#!/usr/bin/env node
// A reproducibility gate, not a claim that a generated mouth pronounces words.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SPEECH_LINES } from '../web/public/speech-lines.mjs';
const rootArg = process.argv.indexOf('--root');
const root = rootArg >= 0 ? resolve(process.argv[rootArg+1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineFile = join(root, 'docs/dealer-sync-baseline.json');
const roster = { vera:'dealer', astrid:'dealers/astrid', amira:'dealers/amira', mei:'dealers/mei' };
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const fingerprint = file => existsSync(file) ? sha(readFileSync(file)) : null;
const probeCache = new Map();
const probe = file => {
  if (!probeCache.has(file)) probeCache.set(file, JSON.parse(execFileSync(process.env.FFPROBE || 'ffprobe', ['-v','error','-show_entries','stream=codec_type,has_b_frames,width,height:format=duration','-of','json',file], {encoding:'utf8'})));
  return probeCache.get(file);
};
const deep = process.argv.includes('--probe');
const snapshot = { version:1, purpose:'Asset regression baseline only. Human audiovisual acceptance remains pending.', dealers:{} };
const errors = [];
const nativeFile=join(root,'web/public/speech-media.json');
const nativeMedia=existsSync(nativeFile)?read(nativeFile):{};
for (const [name, relative] of Object.entries(roster)) {
  const base = join(root, 'web/public', relative);
  const index = read(join(base, 'streams/index.json'));
  const bank = read(join(base, 'audio/en/bank.json'));
  const lines = {};
  const ids = new Set([...Object.keys(bank), ...Object.keys(index.clips).filter(k=>k.includes('/speak/')).map(k=>k.split('/').at(-1))]);
  for (const id of [...ids].sort()) {
    const clip = index.clips[`idle-1/speak/${id}`];
    const audioFile = join(base, 'audio/en', `${id}.mp3`);
    const videoFile = clip && join(base, 'streams', clip.file);
    lines[id] = { audio: fingerprint(audioFile), video:videoFile ? fingerprint(videoFile) : null, text:bank[id]?.text ?? SPEECH_LINES[id] ?? null, calibration:clip?.audioDelayMs ?? null, index:clip ? sha(JSON.stringify(clip)) : null };
    if (!clip) continue; // explicit known gaps are included in the baseline
    if (!Number.isFinite(clip.audioDelayMs) || clip.audioDelayMs < 0) errors.push(`${name}/${id}: missing or invalid calibration`);
    if (!lines[id].audio || !lines[id].video) errors.push(`${name}/${id}: missing paired media`);
    if (deep && lines[id].audio && lines[id].video) {
      const a = probe(audioFile), v = probe(videoFile);
      if (v.streams[0]?.has_b_frames !== 0) errors.push(`${name}/${id}: reordered B frames are incompatible with the player`);
      const duration = clip.frames.length / (clip.fps ?? 24);
      if (+a.format.duration + clip.audioDelayMs/1000 > duration + .1) errors.push(`${name}/${id}: audio extends past the take`);
    }
  }
  // Every indexed clip and matte is protected, including action/idle assets.
  const streams = {};
  for (const [key, clip] of Object.entries(index.clips)) {
    const file = join(base,'streams',clip.file);
    const bytes = existsSync(file) ? readFileSync(file) : null;
    let offset = 0;
    if ((clip.fps ?? 24) !== 24) errors.push(`${name}/${key}: player requires 24 fps`);
    if (clip.frameCount !== undefined && clip.frameCount !== clip.frames?.length) errors.push(`${name}/${key}: frameCount mismatch`);
    for (const [start,size] of clip.frames ?? []) {
      if (start !== offset || size <= 0) errors.push(`${name}/${key}: invalid frame boundary`);
      offset = start + size;
    }
    if (!bytes || !offset || offset !== bytes.length) errors.push(`${name}/${key}: indexed bytes do not match stream`);
    if (deep && bytes) {
      const stream = probe(file).streams[0];
      if (stream?.has_b_frames !== 0) errors.push(`${name}/${key}: B frames are not supported`);
      if (stream.width !== index.width || stream.height !== index.height) errors.push(`${name}/${key}: dimensions disagree with decoder index`);
    }
    streams[key] = {video:bytes ? sha(bytes) : null, metadata:sha(JSON.stringify(clip))};
  }
  const matteBase = join(root,'web/public',name==='vera'?'dealer-hands':`dealers/${name}-hands`);
  const matteIndex = join(matteBase,'streams/index.json');
  const mattes = {};
  if (existsSync(matteIndex)) for (const [key, clip] of Object.entries(read(matteIndex).clips)) {
    if (clip.frames.length !== index.clips[key]?.frames.length) errors.push(`${name}/${key}: matte frame count mismatch`);
    const file = join(matteBase,'streams',clip.file);
    mattes[key] = {video:fingerprint(file), metadata:sha(JSON.stringify(clip))};
    if (!mattes[key].video) errors.push(`${name}/${key}: missing hand matte`);
    if (deep && mattes[key].video && probe(file).streams[0]?.has_b_frames !== 0) errors.push(`${name}/${key}: B frames in hand matte`);
  }
  const native = {};
  for(const [id, take] of Object.entries(nativeMedia[name] ?? {})) {
    const file=join(root,'web/public',take.src);
    native[id]={...take,sha256:fingerprint(file)};
    if(!native[id].sha256 || !take.text || !take.review) errors.push(`${name}/${id}: native speech requires media, text and review`);
    if(deep && native[id].sha256) {
      const streams=probe(file).streams;
      if(!streams.some(s=>s.codec_type==='audio') || !streams.some(s=>s.codec_type==='video')) errors.push(`${name}/${id}: native speech requires both audio and video tracks`);
    }
  }
  const {clips: ignored, ...header} = index;
  snapshot.dealers[name] = {header, lines, streams, mattes, ...(Object.keys(native).length?{native}:{}), cues:fingerprint(join(base,'dealing-cues.json'))};
  console.log(`${name}: ${ids.size} lines, ${Object.values(lines).filter(l=>!l.video).length} missing speech takes (not approved), ${Object.keys(streams).length} streams`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (process.argv.includes('--record-baseline')) {
  writeFileSync(baselineFile, JSON.stringify(snapshot,null,2)+'\n');
  console.log('Recorded current asset identities. This does NOT approve lip sync. Review the baseline diff with the changed takes.');
} else {
  const before = read(baselineFile);
  for (const name of Object.keys(roster)) {
    const previous = before.dealers[name], current = snapshot.dealers[name];
    for (const section of ['lines','streams','mattes','native']) {
      for (const key of new Set([...Object.keys(previous?.[section] ?? {}),...Object.keys(current[section] ?? {})])) {
        if (JSON.stringify(previous?.[section]?.[key]) !== JSON.stringify(current[section]?.[key])) errors.push(`${name}/${section}/${key}: changed since baseline; inspect media and calibration together`);
      }
    }
    if (previous?.cues !== current.cues) errors.push(`${name}: hand cues changed`);
    if (JSON.stringify(previous?.header) !== JSON.stringify(current.header)) errors.push(`${name}: decoder format changed`);
  }
  if (errors.length) {console.error(errors.join('\n'));process.exit(1);}
  console.log('PASS: all four dealer asset sets match the regression baseline. Human lip-sync acceptance is still pending.');
}
