#!/usr/bin/env node
// Offline export of the keyed dealers (Dragge, Paow, Mårten) into Jakob's delivery format
// (origin/main: random/meddelande-kevin-emil-2026-10-08.md, test-videoeditor/program/docs/FORMATLASNING.md):
//   dealer/<id>/  deal clips, VILA.png, REDO.png, idle, silent speech lines + .wav, klippinfo.json,
//                 classification.json (one lab/schemas/video.schema.json object per clip), SHA256SUMS.txt
//   bakgrund/     the rooms as stills
// Reads the demo's media read-only and never touches runtime code. Needs ffmpeg + ffprobe (FFMPEG/FFPROBE env).
//   node tools/export-jakob-package.mjs --media public/media --out /tmp/jakob-export [--schema video.schema.json]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const MEDIA = arg('media', 'public/media'), OUT = arg('out', 'jakob-export'), SCHEMA = arg('schema');
const DEALERS = arg('dealers', 'dragge,paow,marten').split(',');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg', FFPROBE = process.env.FFPROBE ?? 'ffprobe';
const NAMES = { dragge: 'Dragge', paow: 'Paow', marten: 'Mårten' };
const MAX_VIDEO_BYTES = 134217728;   // origin/main lab/policies/studio-contract.json limits.videoBytes
// Starting key values: Jakob's own Paow lane in test-videoeditor/preview/site/catalog.json. Our WebGL key is a
// different shader, so its numbers do not carry over; Jakob tunes these in Sammansättning.
const KEY = { mode: 'green-screen', threshold: 0.23, softness: 0.15, despill: 0 };

// Our run variants of one take (public/dealers.js, server/shared-table.mjs readyTimeline).
const VARIANTS = {
  '': 'REDO → kort → REDO (Emils deal_posN, standard)',
  i: 'VILA → in → kort → REDO (öppnar en serie)',
  u: 'REDO → kort → ut → VILA (stänger en serie, ihopsatt)',
  iu: 'VILA → in → kort → ut → VILA (hela rörelsen för ett ensamt kort)',
  v: 'REDO → kort → VILA (Emils filmade vilotagning deal_pos<p>vila)',
  iv: 'VILA → in → kort → VILA (filmad vilotagning med in)',
};
// Take -> Jakob's file name (presentation-runtime/media-families.mjs), event and situation. Box = seat - 1.
const TAKES = [
  ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ take: `pos${n}`, track: String(n), file: `deal_pos${n}`, eventId: n <= 2 ? 'deal.player.left' : n <= 5 ? 'deal.player.centre' : 'deal.player.right', situation: `box${n - 1}`, seat: n })),
  { take: 'posdealer', track: 'dealer', file: 'deal_posdealer', eventId: 'deal.dealer', situation: 'dealer-up', seat: 'dealer' },
  { take: 'hole', track: 'hole', file: 'deal_hole', eventId: 'deal.dealer', situation: 'dealer-hole', seat: 'hole' },
  { take: 'flip', track: 'flip', file: 'deal_flip', eventId: 'reveal.dealer', situation: 'dealer-hole', seat: 'hole' },
];
const SPEECH = ['blackjack', 'bust', 'chatter1', 'chatter2', 'dealerblackjack', 'dealerbust', 'double', 'farewell',
  'goodluck', 'greeting', 'insurance', 'lose', 'peek', 'placebets', 'push', 'sidebet', 'win'];
const speechEvent = line => ['goodluck', 'insurance', 'double'].includes(line) ? `speak.${line}` : 'speak.other';

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
const copy = (src, dst) => { mkdirSync(dirname(dst), { recursive: true }); copyFileSync(src, dst); };

function probe(file) {
  const j = JSON.parse(run(FFPROBE, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]));
  const v = j.streams.find(s => s.codec_type === 'video'), a = j.streams.find(s => s.codec_type === 'audio');
  const rotation = v?.side_data_list?.find(d => 'rotation' in d)?.rotation ?? Number(v?.tags?.rotate ?? 0);
  return { codec: v?.codec_name, width: v?.width, height: v?.height, pix_fmt: v?.pix_fmt, fps: v?.r_frame_rate, avg_fps: v?.avg_frame_rate,
    frames: Number(v?.nb_read_frames ?? v?.nb_frames), duration: Number(Number(j.format.duration).toFixed(4)), rotation,
    has_audio: Boolean(a), ...(a ? { audio: { codec: a.codec_name, sample_rate: Number(a.sample_rate), channels: a.channels } } : {}),
    bytes: statSync(file).size };
}
// Jakob's import blockers: H.264 1080×1920, constant 24 fps, no audio, no rotation, size limit.
function checkVideo(p, { silent = true } = {}) {
  const bad = [];
  if (p.codec !== 'h264') bad.push(`codec ${p.codec}`);
  if (p.width !== 1080 || p.height !== 1920) bad.push(`size ${p.width}×${p.height}`);
  if (p.fps !== '24/1' || p.avg_fps !== '24/1') bad.push(`fps ${p.fps}/${p.avg_fps}`);
  if (p.rotation) bad.push(`rotation ${p.rotation}`);
  if (silent && p.has_audio) bad.push('audio stream');
  if (p.bytes > MAX_VIDEO_BYTES) bad.push(`bytes ${p.bytes}`);
  return bad;
}

// Tiny validator for the subset of JSON Schema that video.schema.json uses.
function validate(schema, value, path = '$') {
  const errs = [], t = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (schema.type && schema.type !== t) return [`${path}: type ${t}`];
  if ('const' in schema && value !== schema.const) errs.push(`${path}: const`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: enum ${JSON.stringify(value)}`);
  if (t === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${path}: minLength`);
    if (schema.maxLength != null && value.length > schema.maxLength) errs.push(`${path}: maxLength`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errs.push(`${path}: pattern`);
  }
  if (t === 'number') {
    if (schema.minimum != null && value < schema.minimum) errs.push(`${path}: minimum`);
    if (schema.maximum != null && value > schema.maximum) errs.push(`${path}: maximum`);
  }
  if (t === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) errs.push(`${path}: missing ${k}`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) errs.push(...validate(schema.properties[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}: extra ${k}`);
    }
  }
  if (schema.oneOf && schema.oneOf.filter(s => !validate(s, value, path).length).length !== 1) errs.push(`${path}: oneOf`);
  for (const s of schema.allOf ?? []) {
    if (s.if && !validate(s.if, value, path).length && s.then) errs.push(...validate(s.then, value, path));
    else if (!s.if) errs.push(...validate(s, value, path));
  }
  return errs;
}

const schema = SCHEMA ? JSON.parse(readFileSync(SCHEMA, 'utf8')) : null;
const failures = [];
const summary = {};

for (const id of DEALERS) {
  const src = join(MEDIA, 'dealers', id), out = join(OUT, 'dealer', id);
  const meta = JSON.parse(readFileSync(join(src, 'v2', 'meta.json'), 'utf8'));
  const name = NAMES[id] ?? id;
  const files = [];        // { path, kind, classification?, kevin }
  const emilKlipp = {};    // Emil's klippinfo "klipp" block, standard takes only
  const restStart = meta.restStart ?? [];
  const sameAsStandard = {};   // file -> run variants left out because they are the standard take byte for byte

  // Deal / hole / flip takes: the plain take is the standard, our run variants go under extra/korvarianter/.
  for (const t of TAKES) {
    for (const [variant, meaning] of Object.entries(VARIANTS)) {
      const source = join(src, 'v2', `${t.take}${variant ? '-' + variant : ''}.mp4`);
      if (!existsSync(source)) continue;
      const standard = variant === '';
      // A take that already starts/ends at rest has byte-identical run variants (flip, hole -u): ship it once.
      if (!standard && sha256(source) === sha256(join(src, 'v2', `${t.take}.mp4`))) { (sameAsStandard[t.file] ??= []).push(variant); continue; }
      const path = standard ? `${t.file}.mp4` : `extra/korvarianter/${t.file}-${variant}.mp4`;
      copy(source, join(out, path));
      const rest = variant.includes('v');
      const lead = variant.includes('i') && !restStart.includes(t.track) ? meta.in : 0;
      const land = meta.land[rest ? `${t.track}v` : t.track];
      const kevin = { source: relative(MEDIA, source), take: t.take, variant: variant || 'standard', variant_meaning: meaning,
        seat: t.seat, box: typeof t.seat === 'number' ? t.seat - 1 : null, eventId: t.eventId, situation: t.situation,
        land_frame: land == null ? null : land + lead, land_frame_base: 0, in_frames: lead,
        starts_at_rest: restStart.includes(t.track) || variant.includes('i'), ends_at_rest: (meta.restEnd ?? []).includes(t.track) || /[uv]/.test(variant) };
      const classification = standard ? { label: `${name} · ${t.file} (${t.situation})`, dealerId: id, eventId: t.eventId, kind: 'action',
        role: 'standard', situation: t.situation, notes: `Kevin-demons ${t.take}.mp4: ${meaning}. Kortet ligger still från ruta ${kevin.land_frame} (0-baserad).`,
        compositing: KEY } : undefined;
      files.push({ path, kind: 'video', silent: true, classification, kevin });
      if (standard) emilKlipp[`${id}/${t.file}.mp4`] = { plats: t.track === 'hole' || t.track === 'flip' ? t.track : String(t.seat), kortet_ligger_still_fran_ruta: kevin.land_frame };
    }
  }

  for (const [file, pose] of [['vila.png', 'VILA'], ['redo.png', 'REDO']]) {
    copy(join(src, 'v2', file), join(out, `${pose}.png`));
    files.push({ path: `${pose}.png`, kind: 'image', kevin: { source: relative(MEDIA, join(src, 'v2', file)) } });
  }

  // Idle loops (idle.ready, grundloop): each starts and ends on VILA. Breath (or Mårten's rest) is the standard.
  const idleDir = join(src, 'idle-v2');
  const idles = existsSync(idleDir) ? readdirSync(idleDir).filter(f => f.endsWith('.mp4')).sort((a, b) => (b === 'breath.mp4') - (a === 'breath.mp4') || a.localeCompare(b)) : [];
  idles.forEach((f, i) => {
    const path = `idle/idle_${f}`;
    copy(join(idleDir, f), join(out, path));
    files.push({ path, kind: 'video', silent: true, kevin: { source: relative(MEDIA, join(idleDir, f)), loop: 'VILA → VILA', note: f === 'rest.mp4' ? 'VILA-stillbild hållen 5 s (riktiga idles saknas än)' : 'Kling 3.0 på VILA-bilden' },
      classification: { label: `${name} · idle ${f.replace('.mp4', '')}`, dealerId: id, eventId: 'idle.ready', kind: 'idle', role: i === 0 ? 'standard' : 'alternative',
        situation: '', notes: 'Grundloop som börjar och slutar på VILA.', compositing: KEY } });
  });

  // Speech lines: audio is baked in, so the video goes out silent (stream copy, same pixels) plus a .wav per take.
  // Jakob has no language dimension: only 'en' is classified; 'sv' and lines without an event are kevin-only extras.
  const linesDir = join(src, 'repliker');
  for (const lang of existsSync(linesDir) ? readdirSync(linesDir).sort() : []) {
    for (const f of readdirSync(join(linesDir, lang)).filter(f => f.endsWith('.mp4')).sort()) {
      const base = f.replace('.mp4', ''), m = /^([a-z0-9]+)_(\d+)$/.exec(base);
      const line = m && SPEECH.includes(m[1]) ? m[1] : null;
      const dir = line ? `repliker/${lang}` : `extra/repliker/${lang}`;
      const source = join(linesDir, lang, f);
      mkdirSync(join(out, dir), { recursive: true });
      run(FFMPEG, ['-v', 'error', '-y', '-i', source, '-map', '0:v:0', '-c:v', 'copy', '-an', '-map_metadata', '-1', '-movflags', '+faststart', join(out, dir, `${base}.mp4`)]);
      run(FFMPEG, ['-v', 'error', '-y', '-i', source, '-map', '0:a:0', '-vn', '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-bitexact', join(out, dir, `${base}.wav`)]);
      const kevin = { source: relative(MEDIA, source), language: lang, take: m ? Number(m[2]) : 1, line: line ?? base,
        eventId: line ? speechEvent(line) : null, situation: line, audio: `${dir}/${base}.wav`, note: line ? undefined : 'Replik utan motsvarande event hos Jakob (namnhälsning, banter, remark, table).' };
      const classification = line && lang === 'en' ? { label: `${name} · ${base} (en)`, dealerId: id, eventId: speechEvent(line), kind: 'speech',
        role: m[2] === '1' ? 'standard' : 'alternative', situation: line, notes: `Engelsk tagning ${m[2]}. Tyst video; ljudet ligger i ${base}.wav bredvid.`, compositing: KEY } : undefined;
      files.push({ path: `${dir}/${base}.mp4`, kind: 'video', silent: true, classification, kevin });
      files.push({ path: `${dir}/${base}.wav`, kind: 'audio', kevin: { source: relative(MEDIA, source), language: lang, for: `${dir}/${base}.mp4` } });
    }
  }

  // Probe and check every file; validate every classification.
  for (const f of files) {
    const full = join(out, f.path);
    f.sha256 = sha256(full); f.bytes = statSync(full).size;
    if (f.kind === 'video') {
      f.probe = probe(full);
      for (const b of checkVideo(f.probe, { silent: f.silent })) failures.push(`${id}/${f.path}: ${b}`);
      if (f.kevin.source && !f.path.startsWith('repliker') && !f.path.startsWith('extra/repliker') && f.sha256 !== sha256(join(MEDIA, f.kevin.source))) failures.push(`${id}/${f.path}: not byte-identical`);
    } else if (f.kind === 'audio') {
      const a = JSON.parse(run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', full]));
      f.probe = { codec: a.streams[0]?.codec_name, sample_rate: Number(a.streams[0]?.sample_rate), channels: a.streams[0]?.channels, duration: Number(Number(a.format.duration).toFixed(4)), streams: a.streams.length };
      if (f.probe.codec !== 'pcm_s16le' || f.probe.streams !== 1) failures.push(`${id}/${f.path}: wav ${f.probe.codec}`);
    } else {
      const p = JSON.parse(run(FFPROBE, ['-v', 'error', '-show_streams', '-of', 'json', full])).streams[0];
      f.probe = { width: p.width, height: p.height, pix_fmt: p.pix_fmt };
      if (p.width !== 1080 || p.height !== 1920) failures.push(`${id}/${f.path}: still ${p.width}×${p.height}`);
    }
    if (f.classification && schema) for (const e of validate(schema, f.classification)) failures.push(`${id}/${f.path}: schema ${e}`);
  }

  const klipp = Object.fromEntries(files.filter(f => f.path.endsWith('.mp4') && !f.path.includes('/')).map(f =>
    [`${id}/${f.path}`, { rutor: f.probe.frames, sekunder: Number((f.probe.frames / 24).toFixed(2)), ...emilKlipp[`${id}/${f.path}`] }]));
  const pos = Object.fromEntries(Object.entries(meta.centre).filter(([k]) => k !== 'hole' && k !== 'flip').map(([k, [x, y]]) => [k, { cx: Math.round(x), cy: Math.round(y) }]));
  const klippinfo = {
    bild: '1080x1920', fps: 24, kort_bredd: meta.card[0], kort_hojd: meta.card[1], positioner: pos,
    'hålkort': `samma plats som dealer (cx ${Math.round(meta.centre.hole[0])}, cy ${Math.round(meta.centre.hole[1])})`, klipp,
    kevin: {
      about: 'Kevin-demons tillägg. Fälten ovanför följer Emils klippinfo.json; allt Jakobs format saknar ligger här.',
      dealer: { id, name, source_meta: meta },
      plats_till_box: 'Plats 1..7 = box 0..6 (situation boxN-1); dealer = dealer-up; hole/flip = dealer-hole.',
      ruta_bas: 'kortet_ligger_still_fran_ruta och land_frame är 0-baserade (spelaren jämför floor(currentTime*24)).',
      kort_storlek_per_plats: meta.props, in_frames: meta.in, ut_frames: meta.ut, rest_start: meta.restStart, rest_end: meta.restEnd,
      variants: VARIANTS, variants_same_as_standard: sameAsStandard, compositing_start: KEY,
      files: files.map(({ path, kind, sha256: s, bytes, probe: p, kevin, classification }) => ({ file: path, kind, sha256: s, bytes, probe: p, classified: Boolean(classification), ...kevin })),
    },
  };
  writeFileSync(join(out, 'klippinfo.json'), JSON.stringify(klippinfo, null, 1) + '\n');
  writeFileSync(join(out, 'classification.json'), JSON.stringify({
    schema: 'origin/main lab/schemas/video.schema.json', note: 'En post per klipp som har en plats i Jakobs event-katalog; nyckel = fil i paketet.',
    items: Object.fromEntries(files.filter(f => f.classification).map(f => [f.path, f.classification])) }, null, 1) + '\n');

  const all = [...files.map(f => f.path), 'klippinfo.json', 'classification.json'].sort();
  writeFileSync(join(out, 'SHA256SUMS.txt'), all.map(p => `${sha256(join(out, p))}  ${p}`).join('\n') + '\n');
  summary[id] = { files: all.length + 1, classified: files.filter(f => f.classification).length,
    videos: files.filter(f => f.kind === 'video').length, wav: files.filter(f => f.kind === 'audio').length,
    bytes: all.reduce((n, p) => n + statSync(join(out, p)).size, 0) };
}

// Rooms (bakgrund, mode image). Thumbnails stay behind.
const rooms = join(MEDIA, 'dealers', 'rooms-v2'), bg = join(OUT, 'bakgrund');
const roomFiles = readdirSync(rooms).filter(f => f.endsWith('.png')).sort();
for (const f of roomFiles) copy(join(rooms, f), join(bg, f));
writeFileSync(join(bg, 'SHA256SUMS.txt'), roomFiles.map(f => `${sha256(join(bg, f))}  ${f}`).join('\n') + '\n');
summary.bakgrund = { files: roomFiles.length + 1 };

console.log(JSON.stringify({ summary, failures }, null, 1));
if (failures.length) process.exit(1);
