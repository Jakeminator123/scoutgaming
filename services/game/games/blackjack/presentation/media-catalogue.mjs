// K04: exact media identity for Kevin's dealers, from k04-media.tsv (K04-medie-fack.tsv on
// codex/kevin-k01-underlag @ 6bd92d05, its six JS paths normalised to public/...) without Astrid's
// rows (astrid, astrid2: ren start K3, Jakob 2026-10-28). CATALOGUE_SOURCE stays the provenance of
// the kept rows and is part of every material revision, so kept revisions are unchanged. Metadata
// only: paths, bytes and sha256. No media file is read, imported, uploaded or deleted here; K05 owns
// the Neon/Blob identities. Media paths are the served URL path under Kevin's public/ (media/...),
// the five JS rows are source files under kevin/croupier-scoutgg/ (public/...).
//
// Identity is the exact row: dealer + main slot + Kevin's variant name (bas, i, u, iu, v, iv) or
// line/take/language. Main's pose alias (u->v, iu->iv in clip-naming.mjs) is never used to pick a
// file: Kevin's -u and -v are different takes with different bytes and land frames.
import { readFileSync } from 'node:fs';

export const CATALOGUE_SOURCE = Object.freeze({ branch: 'codex/kevin-k01-underlag', commit: '6bd92d05b0d52032675148519e001b8386110dec',
  file: 'migrering/kevin-ks-migrering/K04/K04-medie-fack.tsv', sha256: '6c82fc4d1110bd5ecde1e2674154b753ca67ed7672867d908cd55f8384c25daf',
  kevin: '5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc' });
// Orchestrator decision (issue #312): table languages en and sv.
export const LANGUAGES = Object.freeze(['en', 'sv']);
export const DEAL_VARIANTS = Object.freeze(['bas', 'i', 'u', 'iu', 'v', 'iv']);
const KEYED = new Set(['dragge', 'paow', 'marten']);
const COLUMNS = ['dealer', 'source', 'slot', 'variant', 'poseVariant', 'language', 'path', 'bytes', 'sha256', 'note'];
const HASH = /^[a-f0-9]{64}$/;

// Kevin's ready-dealer contact data (K public/dealers.js:23,28,31,64 @ 5aa7ed10): `in` = frames the
// -i in-transition adds before the take, `land` = frame per card track from which the filmed card
// rests. Two measurements exist (dealers.js and meta.json `land`); the client contact follows
// dealers.js together with the dealer's card track (orchestrator decision 4). No universal value.
export const READY_CONTACT = Object.freeze({
  dragge: { in: 27, land: { 1: 29, 2: 27, 3: 27, 4: 24, 5: 26, 6: 27, 7: 33, dealer: 35, hole: 27, flip: 23, '1v': 36, '2v': 37, '3v': 37, '4v': 37, '5v': 35, '6v': 37, '7v': 37, dealerv: 37 } },
  paow: { in: 21, land: { 1: 28, 2: 33, 3: 27, 4: 27, 5: 26, 6: 27, 7: 28, dealer: 37, hole: 29, flip: 31, '1v': 34, '2v': 33, '3v': 31, '4v': 37, '5v': 31, '6v': 31, '7v': 34, dealerv: 23 } },
  marten: { in: 24, land: { 1: 28, 2: 28, 3: 27, 4: 25, 5: 26, 6: 30, 7: 33, dealer: 34, hole: 31, flip: 27, '1v': 26, '2v': 27, '3v': 36, '4v': 25, '5v': 34, '6v': 35, '7v': 33, dealerv: 36 } },
});
// Takes filmed rest to rest: the in-transition adds nothing (K public/dealers.js REST_TAKES).
const REST_TAKES = new Set(['flip']);

export function parseCatalogue(text) {
  const [head, ...lines] = String(text).split(/\r?\n/).filter(Boolean);
  if (head.split('\t').length !== COLUMNS.length) throw new Error('Unexpected media catalogue header');
  const rows = lines.map(line => {
    const cells = line.split('\t');
    if (cells.length !== COLUMNS.length) throw new Error('Malformed media catalogue row');
    const row = Object.fromEntries(COLUMNS.map((key, i) => [key, cells[i]]));
    row.bytes = Number(row.bytes);
    if (!HASH.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes <= 0) throw new Error(`Invalid media identity for ${row.path}`);
    return Object.freeze(row);
  });
  if (new Set(rows.map(r => r.path)).size !== rows.length) throw new Error('Duplicate media catalogue path');
  return Object.freeze(rows);
}

export const loadCatalogue = () => parseCatalogue(readFileSync(new URL('./k04-media.tsv', import.meta.url), 'utf8'));

// Deferred (K05 / review 6329902583 p2): G13 lines without a main slot and the Table Studio greeting.
// One predicate for activation, planning and line binding: a deferred row is never bound or required.
export const isDeferred = r => r.source === 'studio' || (r.source === 'replik' && !r.slot);

const identity = row => ({ path: row.path, bytes: row.bytes, sha256: row.sha256 });
const one = (rows, what) => {
  if (rows.length !== 1) throw new Error(`${rows.length ? 'Ambiguous' : 'No'} media binding for ${what}`);
  return rows[0];
};

// Card track per Kevin's take: seat 1-7, dealer, hole or flip; a rest variant (v, iv) has its own track '<take>v'.
export function trackFor(slot, variant) {
  const box = /^deal\.player\.(?:left|centre|right)\/box([0-6])$/.exec(slot);
  const take = box ? String(Number(box[1]) + 1) : { 'deal.dealer/dealer-up': 'dealer', 'deal.dealer/dealer-hole': 'hole', 'reveal.dealer/dealer-hole': 'flip' }[slot];
  if (!take) throw new Error(`Not a deal slot: ${slot}`);
  return variant === 'v' || variant === 'iv' ? `${take}v` : take;
}

// One deal/reveal take by Kevin's variant name.
export function bindDeal(catalogue, { dealer, slot, variant }) {
  if (!DEAL_VARIANTS.includes(variant)) throw new Error(`Unknown Kevin variant ${variant}`);
  const row = one(catalogue.filter(r => r.dealer === dealer && r.source === 'deal-tagning' && r.slot === slot && r.variant === variant),
    `${dealer} ${slot} ${variant}`);
  return { ...identity(row), dealer, slot, variant, track: trackFor(slot, variant) };
}

// Frame of the take at which the card makes contact: dealers.js land for the variant's own card
// track plus the -i in-transition. A dealer or track without its own measurement has no binding.
export function contactFrame(dealer, { slot, variant }) {
  const ready = READY_CONTACT[dealer];
  if (!ready) throw new Error(`No ready-dealer contact data for ${dealer}`);
  const track = trackFor(slot, variant), land = ready.land[track];
  if (!Number.isInteger(land)) throw new Error(`No land frame for ${dealer} track ${track}`);
  return land + (variant.includes('i') && !REST_TAKES.has(track.replace(/v$/, '')) ? ready.in : 0);
}

// Variant length from the dealer's meta.json (Kevin readyTimeline: ready.frames[track]['-<variant>'],
// base = '-'). The caller passes the meta it has verified by sha256 with verifyActivation.
export function variantFrames(meta, { slot, variant }) {
  const frames = meta?.frames?.[trackFor(slot, variant).replace(/v$/, '')]?.[`-${variant === 'bas' ? '' : variant}`];
  if (!Number.isInteger(frames) || frames <= 0) throw new Error(`meta.json has no length for ${slot} ${variant}`);
  return frames;
}

// A recorded line `<line>_<take>` in en or sv, from the keyed dealer's own repliker/<lang>/.
export function bindLine(catalogue, { dealer, line, take, language }) {
  if (!LANGUAGES.includes(language)) throw new Error(`Language ${language} is outside en/sv`);
  if (!/^[a-z]+$/.test(line) || !Number.isInteger(take) || take < 1) throw new Error('Invalid line identity');
  const path = KEYED.has(dealer) ? `media/dealers/${dealer}/repliker/${language}/${line}_${take}.mp4` : null;
  const row = one(path ? catalogue.filter(r => r.path === path && r.source === 'replik' && !isDeferred(r)) : [], `${dealer} ${line}_${take} ${language}`);
  return { ...identity(row), dealer, line, take, language, slot: row.slot || null };
}

// An idle take by its exact file name; `calm` follows Kevin's CALM_IDLE classification in the catalogue.
export function bindIdle(catalogue, { dealer, take }) {
  const row = one(catalogue.filter(r => r.dealer === dealer && r.source === 'idle-tagning'
    && r.path.split('/').at(-1) === `${take}.mp4`), `${dealer} idle ${take}`);
  return { ...identity(row), dealer, take, calm: row.note === 'lugn' };
}

// Every row a dealer's activation depends on: its media, its data files (meta.json, card track,
// en/sv texter.json) and the shared code/data rows.
export function activationSet(catalogue, dealer) {
  const lang = r => !r.language || LANGUAGES.includes(r.language);
  return catalogue.filter(r => !isDeferred(r) && ((r.dealer === dealer && lang(r) && r.source !== 'face')
    || (r.dealer === 'shared' && r.source === 'data-beroende')));
}

// Verify the whole binding before activation: every required path must be present with the exact
// sha256. `observed` maps path -> sha256 (e.g. from K05's registry or a local hash pass).
export function verifyActivation(catalogue, dealer, observed) {
  const required = activationSet(catalogue, dealer);
  if (!catalogue.some(r => r.dealer === dealer)) return { ok: false, dealer, required: 0, missing: [], mismatched: [], reason: 'unknown_dealer' };
  const get = path => observed instanceof Map ? observed.get(path) : observed?.[path];
  const missing = required.filter(r => get(r.path) === undefined).map(r => r.path);
  const mismatched = required.filter(r => get(r.path) !== undefined && get(r.path) !== r.sha256).map(r => r.path);
  return { ok: !missing.length && !mismatched.length, dealer, required: required.length, missing, mismatched };
}
