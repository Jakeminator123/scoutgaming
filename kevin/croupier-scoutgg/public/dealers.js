import { DRAGGE_FACE_TRACKS } from './dealer-card-tracks-dragge.js';
import { PAOW_FACE_TRACKS } from './dealer-card-tracks-paow.js';
import { MARTEN_FACE_TRACKS } from './dealer-card-tracks-marten.js';
import { ASTRID2_FACE_TRACKS } from './dealer-card-tracks-astrid2.js';

// Dealer picker. Astrid is the filmed default (Emil's clips); Dragge and Paow are the
// alternatives, keyed into Astrid's room. The choice is per viewer and never changes
// the round, the shoe or what other players see.
//
// Dragge and Paow are READY-pose dealers (H3's KLARA plates, 2026-10-07): they rest in VILA,
// lift a hand onto the card in the shoe (REDO) and deal from there, one short take per card.
// The shared table schedules one take per step, so each take exists in four variants and the
// client picks by where the step sits in a run of deals (readyVariant below):
//   pos4.mp4 REDO -> card   pos4-i.mp4 VILA -> in -> card   pos4-u.mp4 card -> ut -> VILA   pos4-iu.mp4 both
// Built by croupier-dealer-dragge/build_ready_dealer.py (meta.json next to the clips).
// Media is cached for a day (server.mjs), so rebuilt files get a new version here.
const V = '?v=20261011a';

// Frame of the deal take (without the in-transition) from which the filmed card no longer moves (its planar track,
// review/2026-10-10-card-tracking); until then the game's card follows the track, from there it rests on its seat.
// 'in' = frames the in-transition adds in front of a -i variant.
// 'card' = the size (px) their prop card rests at: the game draws its cards at that size for them.
const DRAGGE_READY = { in: 27, land: { 1: 29, 2: 27, 3: 27, 4: 24, 5: 26, 6: 27, 7: 33, dealer: 35, hole: 27, flip: 23, '1v': 36, '2v': 37, '3v': 37, '4v': 37, '5v': 35, '6v': 37, '7v': 37, dealerv: 37 }, card: [78, 106] };
// Idle loops between clips, so a ready dealer never stands frozen on his still: Kling 3.0 on his VILA
// image, each starting and ending on VILA (croupier-dealer-dragge/idle_v2.py). Weighted like Astrid's.
const idlesFor = id => [['breath', 40, 'andas lugnt, blinkar'], ['glance', 12, 'blicken ned mot bordet'], ['smile', 4, 'litet leende och nick']]
  .map(([k, vikt, beskrivning]) => ({ id: k, url: `/media/dealers/${id}/idle-v2/${k}.mp4${V}`, vikt, beskrivning, dur: 5.04 }));
const PAOW_READY = { in: 21, land: { 1: 28, 2: 33, 3: 27, 4: 27, 5: 26, 6: 27, 7: 28, dealer: 37, hole: 29, flip: 31, '1v': 34, '2v': 33, '3v': 31, '4v': 37, '5v': 31, '6v': 31, '7v': 34, dealerv: 23 }, card: [78, 106] };
// Astrid 2.0 (Emil 13 Oct): Astrid on Paow's green plate, H3 takes with the one-hand technique for 5-7 and the dealer
// (KLARA_ASTRID, metodik/videoklipp/skript/greenscreen/bygg-spelklipp.py). land = build-tracks.py's printout.
const ASTRID2_READY = { in: 24, land: { 1: 27, 2: 31, 3: 28, 4: 27, 5: 26, 6: 26, 7: 23, dealer: 24, hole: 37, flip: 25, '1v': 26, '2v': 26, '3v': 23, '4v': 24, '5v': 25, '6v': 23, '7v': 22, dealerv: 37 }, card: [79, 106] };
// Her idles are H3 takes from rest to rest (3 s, kor-idle.sh): breathing plus at most one small thing each.
const ASTRID2_IDLES = [['andas', 20, 'andas lugnt'], ['andasb', 20, 'andas lugnt'], ['djupandetag', 8, 'ett djupare andetag'],
  ['blickvanster', 6, 'blicken mot spelarna till vänster'], ['blickhoger', 4, 'blicken mot spelarna till höger'],
  ['blickhogerb', 4, 'blicken mot spelarna till höger'], ['huvud', 3, 'lutar huvudet lite'], ['huvudb', 3, 'lutar huvudet lite'],
  ['fingrar', 4, 'fingrarna rör sig lätt']]
  .map(([k, vikt, beskrivning]) => ({ id: k, url: `/media/dealers/astrid2/idle-v2/${k}.mp4${V}`, vikt, beskrivning, dur: 3.04 }));
const MARTEN_READY = { in: 24, land: { 1: 28, 2: 28, 3: 27, 4: 25, 5: 26, 6: 30, 7: 33, dealer: 34, hole: 31, flip: 27, '1v': 26, '2v': 27, '3v': 36, '4v': 25, '5v': 34, '6v': 35, '7v': 33, dealerv: 36 }, card: [79, 106] };

export const DEALERS = {
  astrid: { id: 'astrid', name: 'Astrid', still: '/media/startbild.png', face: '/media/dealers/faces/astrid.jpg' + V },
  dragge: { id: 'dragge', name: 'Dragge', still: '/media/dealers/rooms-v2/darkhall.png' + V, face: '/media/dealers/faces/dragge.jpg' + V,
    keyed: { still: '/media/dealers/dragge/v2/vila.png' + V }, layerScale: 1, ready: DRAGGE_READY,
    clips: '/media/dealers/dragge/v2/', land: DRAGGE_READY.land, lines: ['sv', 'en'], linesDir: '/media/dealers/dragge/repliker/', idles: idlesFor('dragge'), handMatte: false, faceTracks: DRAGGE_FACE_TRACKS },
  // Paow speaks with her cloned voice (ElevenLabs WZVEBKUreb9jAKojf0QF), lip-synced on her own endpoint.
  // Her hole card (Emil, 9 Oct) is filmed face down and ends at rest; her turn of it is filmed too (rest to rest).
  paow: { id: 'paow', name: 'Paow', still: '/media/dealers/rooms-v2/darkhall.png' + V, face: '/media/dealers/faces/paow.jpg' + V,
    keyed: { still: '/media/dealers/paow/v2/vila.png' + V }, layerScale: 1, ready: PAOW_READY,
    clips: '/media/dealers/paow/v2/', land: PAOW_READY.land, lines: ['sv', 'en'], linesDir: '/media/dealers/paow/repliker/', idles: idlesFor('paow'), handMatte: false, faceTracks: PAOW_FACE_TRACKS },
  // Mårten (Emil's KLARA_MARTEN, 9 Oct; built on Paow's plate, so table, shoe and seats are hers). No voice and no recorded
  // lines yet: lines null means every spoken line and chat reply is text only (never another dealer's face or voice).
  // His idles are Kling loops like Dragge's and Paow's (Emil 11 Oct liked those best): back at rest after a single card
  // he breathes instead of holding his still.
  marten: { id: 'marten', name: 'Mårten', still: '/media/dealers/rooms-v2/darkhall.png' + V, face: '/media/dealers/faces/marten.jpg' + V,
    keyed: { still: '/media/dealers/marten/v2/vila.png' + V }, layerScale: 1, ready: MARTEN_READY,
    clips: '/media/dealers/marten/v2/', land: MARTEN_READY.land, lines: ['sv', 'en', 'es'], linesDir: '/media/dealers/marten/repliker/', idles: idlesFor('marten'), handMatte: false, faceTracks: MARTEN_FACE_TRACKS },
  // Astrid 2.0: Astrid as a keyed ready dealer, playing like Paow and Dragge. Her voice is the one her recorded lines have
  // (ElevenLabs Helena, d1PjUBrElTJTH5EkXPZp); her lines are those recordings on her rest image (the moving lip sync
  // draws her mouth). label = the name in the pickers; name stays Astrid, as she calls herself.
  astrid2: { id: 'astrid2', name: 'Astrid', label: 'Astrid 2.0', still: '/media/dealers/rooms-v2/darkhall.png' + V, face: '/media/dealers/faces/astrid2.jpg' + V,
    keyed: { still: '/media/dealers/astrid2/v2/vila.png' + V }, layerScale: 1, ready: ASTRID2_READY,
    clips: '/media/dealers/astrid2/v2/', land: ASTRID2_READY.land, lines: ['en'], linesDir: '/media/dealers/astrid2/repliker/', idles: ASTRID2_IDLES, handMatte: false, faceTracks: ASTRID2_FACE_TRACKS },
};

// Kevin 12 Oct: Mårten is for Svenska Spel. The public demo never shows him; a Table Studio table built with him
// (a ?table= link) still plays with him. Keep this list in step with stage-pending.js.
export const PUBLIC_HIDDEN = ['marten'];
function pick() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? ''), onTable = q.has('table');
    const ok = id => !!DEALERS[id] && (onTable || !PUBLIC_HIDDEN.includes(id));
    const asked = q.get('dealer');
    if (asked && ok(asked)) { globalThis.localStorage?.setItem('dealer', asked); return asked; }
    const saved = globalThis.localStorage?.getItem('dealer');
    return ok(saved) ? saved : 'astrid';
  } catch { return 'astrid'; }
}

export const dealer = DEALERS[pick()];
export const isAlternative = dealer.id !== 'astrid';

// Emil's deal clip URL -> the same take for the chosen dealer (in the run variant, for a ready dealer).
export function dealerClipUrl(url, variant = '') {
  if (!isAlternative || !url) return url;
  const m = /\/media\/deal\/([a-z0-9]+)\.mp4/.exec(url);
  return m ? `${dealer.clips}${m[1]}${dealer.ready && variant ? '-' + variant : ''}.mp4${V}` : url;
}

// Every run variant of one of a ready dealer's takes (any other URL passes through), for the preloader.
export function dealerClipVariants(url) {
  const m = dealer.ready && url?.startsWith(dealer.clips) ? /\/([a-z0-9]+)\.mp4/.exec(url) : null;
  return m ? ['', 'i', 'u', 'iu'].map(v => `${dealer.clips}${m[1]}${v ? '-' + v : ''}.mp4${V}`) : [url];
}

// Which variant a ready dealer plays for a plan step: 'i' when the step opens a run of deals
// (he lifts his hand to the shoe first), 'u' when it closes one (he puts it back to rest).
const dealing = s => s && s.clip && (s.kind === 'deal' || s.kind === 'reveal');
// On his own studio table the server times the run on his takes and names each step's variant (the cards
// join REDO to REDO). Elsewhere the slots are timed on Astrid's filmed deals (2.7-3.5 s), so every card is
// the whole move (-iu: rest, shoe, card, rest) stretched to its slot; a joined take would leave him frozen.
export function readyVariant(plan, step) {
  if (!dealer.ready || !dealing(step)) return '';
  return typeof step.variant === 'string' ? step.variant : 'iu';
}
// A studio table (/t/<slug>) has its own dealer, and the server times its deals on his takes: the game keeps him.
export const tableDealer = (() => { try { const q = new URLSearchParams(globalThis.location?.search ?? ''); return q.has('table') && DEALERS[q.get('dealer')] ? q.get('dealer') : null; } catch { return null; } })();
// Takes filmed from rest to rest (his turn of the hole card, meta.json restStart): every run variant is the take itself.
export const REST_TAKES = ['flip'];
// Seconds the variant's in-transition adds before the deal take itself starts.
export const variantOffset = (variant, track) => (dealer.ready && variant?.includes('i') && !REST_TAKES.includes(track) ? dealer.ready.in / 24 : 0);

// Saves the choice and reloads with it in the address, so a ?dealer= link
// never overrides a newer pick.
// Emil's replik URL (any language) -> the chosen dealer's own take of that line in the
// table's language, or English when he has none in it. Null when he has no such line.
export function dealerLineUrl(url, language) {
  if (!isAlternative || !dealer.lines || !url) return null;
  const m = /\/media\/repliker(?:-[a-z]+)?\/([a-z0-9]+_\d)(?:_[a-z]+)?\.mp4/.exec(url);
  if (!m) return null;
  const lang = dealer.lines.includes(language) ? language : 'en';
  return `${dealer.linesDir}${lang}/${m[1]}.mp4${V}`;
}

// An alternative dealer without recorded lines (Mårten) never fetches Astrid's: they would only be skipped.
export const unusedLine = url => isAlternative && !dealer.lines && /\/media\/repliker/.test(url ?? '');

// A line only the alternative dealer has (remarks, banter), in the table's language.
export function dealerExtraLineUrl(id, language) {
  if (!isAlternative || !dealer.lines) return null;
  return `${dealer.linesDir}${dealer.lines.includes(language) ? language : 'en'}/${id}.mp4${V}`;
}

// The public room has one table per dealer (CH: a player who went to Astrid stayed in the boxes at
// Dragge's table, because every dealer was only a per-viewer skin over one table). Astrid keeps the
// original room; a link with ?session= (a studio table, a shared table link) keeps its own table.
export const dealerRoom = id => (id === 'astrid' ? 'astrid' : id);

export function chooseDealer(id) {
  try { globalThis.localStorage?.setItem('dealer', id); } catch {}
  const url = new URL(location.href);
  // Switching dealer in the public room moves you to his table: leave this one first, so your boxes
  // free up for the others here (keepalive lets the request finish while the page reloads).
  if (!url.searchParams.has('session') && dealerRoom(id) !== dealerRoom(dealer.id)) {
    try {
      fetch('/api/table', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: dealerRoom(dealer.id), op: 'leave', requestId: 'switch-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }) }).catch(() => {});
    } catch {}
  }
  url.searchParams.set('dealer', id); location.replace(url);
}

// Rooms behind a keyed dealer. Every room shares Astrid's table pixel for pixel
// (croupier-dealer-dragge/rooms.py), so only the wall behind him changes.
// Rooms behind a keyed dealer. Every room shares Astrid's table pixel for pixel; rooms-v2 carry
// the bigger shoe where the KLARA plates draw from (croupier-dealer-dragge/rooms_v2.py).
export const ROOMS = [
  { id: 'darkhall', name: 'Dark Hall', still: '/media/dealers/rooms-v2/darkhall.png' + V, thumb: '/media/dealers/rooms-v2/darkhall-thumb.jpg' + V },
  { id: 'mahogany', name: 'Mahogany Privé', still: '/media/dealers/rooms-v2/mahogany.png' + V, thumb: '/media/dealers/rooms-v2/mahogany-thumb.jpg' + V },
  { id: 'golden', name: 'Golden Salon', still: '/media/dealers/rooms-v2/golden.png' + V, thumb: '/media/dealers/rooms-v2/golden-thumb.jpg' + V },
  { id: 'azure', name: 'Azure Venue', still: '/media/dealers/rooms-v2/azure.png' + V, thumb: '/media/dealers/rooms-v2/azure-thumb.jpg' + V },
];

export function savedRoom() {
  const asked = new URLSearchParams(globalThis.location?.search ?? '').get('room');   // a Table Studio link picks the room
  if (ROOMS.some(r => r.id === asked)) { try { globalThis.localStorage?.setItem('room', asked); } catch {} return ROOMS.find(r => r.id === asked); }
  try { return ROOMS.find(r => r.id === globalThis.localStorage?.getItem('room')) ?? ROOMS[0]; } catch { return ROOMS[0]; }
}

export function chooseRoom(id) {
  try { globalThis.localStorage?.setItem('room', id); } catch {}
}
