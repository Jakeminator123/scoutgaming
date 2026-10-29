#!/usr/bin/env node
// Kevin 28 Oct ("lets set up the adebayor dealer locally, if I choose Välj I get to see him in the game, build him live"):
// builds public/media/dealers/adebayor/v2/ from the clips Kevin keeps in Klippstudion (~/.claude-notch/clip-picks.json:
// dealer adebayor, decision "keep"). The folder says where a clip is used: box1..box7 → pos1..pos7, boxdealer/dealer →
// posdealer, hole, flip, an idle take (andas, blickhoger, …) → <take>.mp4. vila.png = his start image with the shoe.
// A take with no kept clip gets the newest pass-3 default (s7101 deals, s7201 idles), so he is whole from the start.
// meta.json: every take is 39 frames from rest to rest (restStart/restEnd = all, so the planner plays them whole),
// landing frames and card centres from Dragan's plate (his start image was built on it) until Spel-QA measures his.
// `--watch`: rebuilds within 2 s of every change of the picks file (Klippstudion writes it on each V/X); a reload of
// the table (⌘R) then shows the new clip (the server serves the files with no-cache). Local only, never prod.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync, readdirSync, lstatSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url).pathname;
const KAND = path.join(ROOT, 'public/media/dealers/adebayor/kandidater');
const V2 = path.join(ROOT, 'public/media/dealers/adebayor/v2');
const PICKS = path.join(os.homedir(), '.claude-notch/clip-picks.json');
const START = [path.join(KAND, 'start/v3-sko.png'), path.join(os.homedir(), 'Desktop/adebayor-h3/referens/VILA-sko.png')].find(existsSync);
const DEALS = { box1: 'pos1', box2: 'pos2', box3: 'pos3', box4: 'pos4', box5: 'pos5', box6: 'pos6', box7: 'pos7', boxdealer: 'posdealer', dealer: 'posdealer', hole: 'hole', flip: 'flip' };
const IDLES = ['andas', 'blickhoger', 'blickvanster', 'djupandetag', 'fingrar', 'huvud', 'lugnandetag', 'nerupp', 'nick'];   // + pass 8 (s721x); axlar, blinkhuvud, blickskon out (Spel-QA 29 Oct: grin, teeth, big head turn)
const TRACK = { pos1: '1', pos2: '2', pos3: '3', pos4: '4', pos5: '5', pos6: '6', pos7: '7', posdealer: 'dealer', hole: 'hole', flip: 'flip' };
// Dragan's plate (public/media/dealers/dragge/v2/meta.json), the same scaled plate Adebayor's start image was built on
const DRAGGE = JSON.parse(readFileSync(path.join(ROOT, 'public/media/dealers/dragge/v2/meta.json'), 'utf8'));
// Spel-QA 28 Oct (~/Desktop/adebayor-h3/ut/adebayor-ready.json): the frame the card lands in, per take and seed, and the
// card centres (Paow's: his start image sits on the same scaled plate); Dragan's plate until that file exists
const QA_FILE = path.join(os.homedir(), 'Desktop/adebayor-h3/ut/adebayor-ready.json');
// Spel-QA's approved clip per take when Kevin has not picked one himself (~/Desktop/adebayor-h3/ut/adebayor-val.json:
// {"pos4": "box4/s7301.mp4", ...}, paths relative to kandidater/); Kevin's keep in Klippstudion always wins
const VAL_FILE = path.join(os.homedir(), 'Desktop/adebayor-h3/ut/adebayor-val.json');
const val = () => { try { return JSON.parse(readFileSync(VAL_FILE, 'utf8')); } catch { return {}; } };
const qa = () => { try { return JSON.parse(readFileSync(QA_FILE, 'utf8')); } catch { return null; } };
const FFPROBE = [path.join(os.homedir(), '.local/bin/ffprobe'), '/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe'].find(existsSync);

const takeOf = folder => DEALS[folder] ?? (IDLES.includes(folder.replace(/^idle-/, '')) ? folder.replace(/^idle-/, '') : null);
function frames(file) {
  if (!FFPROBE) return 39;
  try { return Number(execFileSync(FFPROBE, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]).toString().trim()) || 39; } catch { return 39; }
}
/** The kept clips per take from Klippstudion's picks: the last keep wins; a later reject of the same file drops it. */
export function keptPerTake(picks) {
  const out = {};
  for (const c of picks?.clips ?? []) {
    if (c.dealer !== 'adebayor') continue;
    const take = takeOf(c.folder ?? ''); if (!take) continue;
    const file = c.url?.startsWith('file://') ? decodeURIComponent(c.url.slice(7)) : null;
    if (!file) continue;
    if (c.decision === 'keep') out[take] = file;
    else if (c.decision === 'reject' && out[take] === file) delete out[take];
  }
  return out;
}
function newest(folder, seedPrefix) {
  const dir = path.join(KAND, folder); if (!existsSync(dir)) return null;
  // the newest seed of the newest pass in that folder
  const files = readdirSync(dir).filter(f => /^s\d+\.mp4$/.test(f)).sort();
  return path.join(dir, files.filter(f => f.startsWith(seedPrefix)).pop() ?? files.pop() ?? '');
}
const same = (a, b) => existsSync(b) && statSync(a).size === statSync(b).size && readFileSync(a).equals(readFileSync(b));

export function build({ log = console.log } = {}) {
  let picks = {}; try { picks = JSON.parse(readFileSync(PICKS, 'utf8')); } catch {}
  const kept = keptPerTake(picks), approved = Object.fromEntries(Object.entries(val()).filter(([t, f]) => typeof f === 'string' && !t.startsWith('_')).map(([t, f]) => [t, path.join(KAND, f)]));
  mkdirSync(V2, { recursive: true });
  const used = {}, changed = [];
  const put = (take, src) => {
    if (!src || !existsSync(src)) return;
    const dst = path.join(V2, `${take}.mp4`);
    if (!same(src, dst)) { copyFileSync(src, dst); changed.push(take); }
    used[take] = path.relative(KAND, src);
    // the page preloads the variants '', 'i', 'u', 'iu' of every deal take (dealers.js dealerClipVariants); his takes go
    // from rest to rest, so the planner always plays '' and the variants are symlinks to the same clip (small in git)
    if (TRACK[take]) for (const v of ['i', 'u', 'iu']) { const d = path.join(V2, `${take}-${v}.mp4`); try { if (lstatSync(d).isSymbolicLink() && readlinkSync(d) === `${take}.mp4`) continue; rmSync(d); } catch {} symlinkSync(`${take}.mp4`, d); }
  };
  for (const take of new Set(Object.values(DEALS))) put(take, kept[take] ?? approved[take] ?? Object.keys(DEALS).filter(k => DEALS[k] === take).map(k => newest(k, 's71')).find(Boolean));
  for (const take of IDLES) put(take, kept[take] ?? approved[take] ?? newest(take, 's72'));
  if (START && !same(START, path.join(V2, 'vila.png'))) { copyFileSync(START, path.join(V2, 'vila.png')); changed.push('vila'); }
  const fr = {}; for (const [take, track] of Object.entries(TRACK)) if (used[take]) fr[track] = { '-': frames(path.join(V2, `${take}.mp4`)) };
  const q = qa(), land = { ...DRAGGE.land };
  if (q?.land) for (const [take, track] of Object.entries(TRACK)) { const seed = (used[take] ?? '').match(/s(\d+)\.mp4$/)?.[1]; if (seed && q.land[seed]?.[track] != null) land[track] = q.land[seed][track]; }
  const meta = { in: 0, ut: 0, land, centre: q?.centre ?? DRAGGE.centre, missing: Object.keys(TRACK).filter(t => !used[t]), frames: fr, card: q?.card ?? DRAGGE.card ?? [78, 106], landFrom: q ? 'Spel-QA adebayor-ready.json' : 'dragge',
    // the planner matches these against s.track ?? s.seat (shared-table.mjs readyTimeline): a box seat is a number, the
    // dealer's tracks are strings, so both forms are listed; every take is whole, rest to rest (variant '')
    restStart: [...Object.keys(fr), ...Object.keys(fr).map(Number).filter(Number.isFinite)], restEnd: [...Object.keys(fr), ...Object.keys(fr).map(Number).filter(Number.isFinite)],
    picks: used, kept: Object.keys(kept), built: new Date().toISOString() };
  writeFileSync(path.join(V2, 'meta.json'), JSON.stringify(meta, null, 1));
  log(`${new Date().toTimeString().slice(0, 5)} adebayor v2: ${Object.keys(used).length} tagningar (${Object.keys(kept).length} valda i Klippstudion), ${changed.length ? 'nya: ' + changed.join(' ') : 'oförändrat'}`);
  return { used, kept, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  build();
  if (process.argv.includes('--watch')) {
    let last = ''; const stamp = () => [PICKS, VAL_FILE, QA_FILE, path.join(KAND, 'manifest.json')].map(f => { try { return String(statSync(f).mtimeMs); } catch { return ''; } }).join('|');
    last = stamp();
    setInterval(() => { const s = stamp(); if (s !== last) { last = s; try { build(); } catch (e) { console.log('adebayor v2: fel', e.message); } } }, 2000);
  }
}
