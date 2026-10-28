import { DRAGGE_FACE_TRACKS } from './dealer-card-tracks-dragge.js';
import { isHead } from './idle-chain.js';
import { PAOW_FACE_TRACKS } from './dealer-card-tracks-paow.js';
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
const V = '?v=20261023a';   // bumped 23 Oct: Kevin's rejected idles left the rotation (dealers.js changes for every phone); bumped 21 Oct: huvud/huvudb were re-rendered under the same names, and the new takes arrived; a phone with a day-old cache fetches them anew

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
// Dragan gets the same nine (Kevin 20 Oct, e2e's H3 takes), in his take folder v2/: there they are takes the lip-sync
// worker can map, so a line he says at rest runs over a chain of them (server/shared-table.mjs withIdle) and his random
// idles and that chain are the same clips, every one starting and ending on VILA.
// Kevin 21 Oct: while the table waits for a player (hit or stand, insurance) only the calm takes play (calm: true):
// breathing, a deep breath, shoulders, straightening the back, a shift of weight, fingers. Turns of the head, glances,
// nods and leaning forward are for between rounds and under speech. The server lays the wait chain from these.
const CALM_IDLE = /^(andas|andasb|djupandetag|fingrar|axlar|rakrygg|vikt)/;
const calmIdle = id => CALM_IDLE.test(id);
const H3_IDLES = [['andas', 20, 'andas lugnt'], ['andasb', 20, 'andas lugnt'], ['djupandetag', 8, 'ett djupare andetag'],
  ['blickvanster', 6, 'blicken mot spelarna till vänster'], ['blickhoger', 4, 'blicken mot spelarna till höger'],
  ['blickhogerb', 4, 'blicken mot spelarna till höger'], ['huvud', 3, 'lutar huvudet lite'], ['huvudb', 3, 'lutar huvudet lite'],
  ['fingrar', 4, 'fingrarna rör sig lätt']];
// dur: Astrid's are 3 s; Dragan's are Emil's length, 39 frames (e2e 20 Oct: at 73 frames H3 invented a felt and chips
// mid-clip, at 39 the green plate holds).
// only: the takes a dealer has (Paow's two glances to the right derailed in H3 and were left out, e2e 20 Oct)
// Kevin 21 Oct: the new H3 idle takes he picked (all of e2e's set), beside the old ones, in the take folder v2/, 39 frames,
// VILA to VILA. Weighted so they show often: 6 each against the old breathing takes' 20 (Dragan 13 x 6 = 78 against 66,
// Paow 16 x 6 = 96 against 64).
const NEW_IDLE_WEIGHT = 6;
const extraIdles = (id, list) => list.map(([k, beskrivning]) => ({ id: k, url: `/media/dealers/${id}/v2/${k}.mp4${V}`, vikt: NEW_IDLE_WEIGHT, beskrivning, dur: 1.625, calm: calmIdle(k) }));
// Kevin 23 Oct (clip studio on staging): rejected and out of the rotation, their files stay. Dragan: andasb, blickhogerb,
// huvud, huvudb (below), axlar6101, axlar6103, blicksvep6101, nick6101, rakrygg6101, rakrygg6103, vikt6101, vikt7105, vridhoger6101
// (vridvanster6103 kept after all, his later pick).
// Paow: axlar6101, axlar6103, axlar6104, axlar6105, lutfram6103, nick6101, nick6103, nick6105, rakrygg6105, vikt6101.
// Astrid: andas, andasb, blickhoger, blickhogerb, blickvanster, djupandetag.
const DRAGGE_NEW_IDLES = [['vikt6103', 'viktförskjutning på stolen'], ['vridhoger7105', 'vrider huvudet åt höger'],
  ['vridvanster6101', 'vrider huvudet åt vänster'], ['vridvanster6103', 'vrider huvudet åt vänster']];
const PAOW_NEW_IDLES = [['rakrygg6101', 'rätar på ryggen'], ['vikt6103', 'viktförskjutning på stolen'], ['vikt6105', 'viktförskjutning på stolen'],
  ['vridhoger6101', 'vrider huvudet åt höger'], ['vridvanster6101', 'vrider huvudet åt vänster'], ['vridvanster6105', 'vrider huvudet åt vänster']];
const h3IdlesFor = (id, dir = 'idle-v2', dur = 3.04, only = null) => H3_IDLES.filter(([k]) => !only || only.includes(k)).map(([k, vikt, beskrivning]) => ({ id: k, url: `/media/dealers/${id}/${dir}/${k}.mp4${V}`, vikt, beskrivning, dur, calm: calmIdle(k) }));
// Kevin 23 Oct: "his head is moving too much": the head takes (idle-chain.js isHead: turns, glances, nods) are weighted
// down to a fifth of a dealer's idle weight, so the calm ones dominate; idle-chain.js keeps two head takes at least four
// apart and never in a row. The other takes keep their weights.
const HEAD_SHARE = .2;
const headMovesRarely = idles => {
  const rest = idles.filter(i => !isHead(i.id)).reduce((n, i) => n + i.vikt, 0), head = idles.filter(i => isHead(i.id)).reduce((n, i) => n + i.vikt, 0);
  if (!rest || !head) return idles;
  const k = rest * HEAD_SHARE / (1 - HEAD_SHARE) / head;
  return idles.map(i => !isHead(i.id) ? i : { ...i, head: true, vikt: Math.round(i.vikt * k * 1000) / 1000 });
};
// Kevin 23 Oct, for Dragan instead of the head rule: of the glances to the right only blickhoger stays, said at most once
// in an idle period (a chain under speech), never again in it; his other idles are plain ones with their usual weights.
const oncePerPeriod = (idles, ids) => idles.map(i => ids.includes(i.id) ? { ...i, once: true } : i);
// Kevin 23 Oct: the H3 v2 idles e2e made from Emil's rest image after the Evolution references, colour-matched to the game
// (/root/qa/h3-idle-ingest). Hands clasped: into the pose from VILA (knappin), takes that stay in it (knappandas,
// knappaxlar), back to VILA (knapput); from/to name the pose a take starts and ends in, so a run of them always starts and
// ends on VILA. They play while the table bets (fas bets). Hands flat on the felt (plattandas, plattaxlar) and leaning
// forward (lutfram), VILA to VILA, play in the wait while the player decides (fas decide). idle-chain.js phasePool lets
// a phase's takes dominate it.
const POSES = { knappin: ['vila', 'knappt'], knappandas: ['knappt', 'knappt'], knappaxlar: ['knappt', 'knappt'], knapput: ['knappt', 'vila'] };
// in the clasped pose: stay 3 to 1 against going back to VILA (a run of about five takes, 8 s)
const POSE_WEIGHT = { knappin: 6, knappandas: 6, knappaxlar: 6, knapput: 2, plattandas: 6, plattaxlar: 6, lutfram: 6 };
const evolutionIdles = (id, takes) => takes.map(k => {
  const base = k.replace(/\d+$/, ''), [from, to] = POSES[base] ?? ['vila', 'vila'];
  return { id: k, url: `/media/dealers/${id}/v2/${k}.mp4${V}`, vikt: POSE_WEIGHT[base], dur: 1.625, calm: true, fas: base.startsWith('knapp') ? 'bets' : 'decide', from, to };
});
const DRAGGE_EVOLUTION_IDLES = ['knappin5101', 'knappin5102', 'knappandas5102', 'knappaxlar5102', 'knapput5101', 'knapput5102', 'plattaxlar5101', 'lutfram5101'];
const PAOW_EVOLUTION_IDLES = ['knappin5101', 'knappin5102', 'knappandas5101', 'knappandas5102', 'knappaxlar5101', 'knappaxlar5102', 'knapput5101', 'knapput5102', 'plattandas5101', 'plattandas5102', 'plattaxlar5101'];
const ASTRID2_IDLES = headMovesRarely(h3IdlesFor('astrid2', 'idle-v2', 3.04, ['huvud', 'huvudb', 'fingrar']));

// serverGreets (Kevin 23 Oct): the server greets the player by nickname in this dealer's own voice (server.mjs welcomeGuest,
// over his idle takes when the lip-sync worker is warm), so the recorded greet_guest without a name is not played as well:
// the two met at the table at once. Astrid 2.0 too (e2e 23 Oct: she greeted twice within 0.3 s), and Mårten (Kevin 23 Oct:
// the server plays his own recorded greeting at once, he has no moving lip sync).
export const DEALERS = {
  astrid: { id: 'astrid', name: 'Astrid', label: 'Astrid (classic)', still: '/media/startbild.png', face: '/media/dealers/faces/astrid.jpg' + V },
  dragge: { id: 'dragge', name: 'Dragan',   // shown as Dragan (Emil 14 Oct: more official); the id stays dragge
    still: '/media/dealers/rooms-v2/darkhall.png' + V, face: '/media/dealers/faces/dragge.jpg' + V,
    keyed: { still: '/media/dealers/dragge/v2/vila.png' + V }, layerScale: 1, ready: DRAGGE_READY,
    clips: '/media/dealers/dragge/v2/', land: DRAGGE_READY.land, lines: ['sv', 'en', 'pt', 'ko'], linesDir: '/media/dealers/dragge/repliker/', linesV: '?v=20261014i', idles: oncePerPeriod([...h3IdlesFor('dragge', 'v2', 1.625, ['andas', 'djupandetag', 'blickhoger', 'fingrar']), ...extraIdles('dragge', DRAGGE_NEW_IDLES)], ['blickhoger']).concat(evolutionIdles('dragge', DRAGGE_EVOLUTION_IDLES)), handMatte: false, faceTracks: DRAGGE_FACE_TRACKS, serverGreets: true },   // Kevin 20 Oct: no glance to the left; huvud/huvudb re-rendered with the milder smile
  // Paow speaks with her cloned voice (ElevenLabs WZVEBKUreb9jAKojf0QF), lip-synced on her own endpoint.
  // Her hole card (Emil, 9 Oct) is filmed face down and ends at rest; her turn of it is filmed too (rest to rest).
  paow: { id: 'paow', name: 'Paow', still: '/media/dealers/rooms-v2/darkhall.png' + V, face: '/media/dealers/faces/paow.jpg' + V,
    keyed: { still: '/media/dealers/paow/v2/vila.png' + V }, layerScale: 1, ready: PAOW_READY,
    clips: '/media/dealers/paow/v2/', land: PAOW_READY.land, lines: ['sv', 'en', 'pt', 'ko'], linesDir: '/media/dealers/paow/repliker/', linesV: '?v=20261014i', idles: headMovesRarely([...h3IdlesFor('paow', 'v2', 1.625, ['andas', 'andasb', 'djupandetag', 'blickvanster', 'huvud', 'huvudb', 'fingrar']), ...extraIdles('paow', PAOW_NEW_IDLES)]).concat(evolutionIdles('paow', PAOW_EVOLUTION_IDLES)), handMatte: false, faceTracks: PAOW_FACE_TRACKS, serverGreets: true },
  // Astrid 2.0: Astrid as a keyed ready dealer, playing like Paow and Dragge. Her voice is the one her recorded lines have
  // (ElevenLabs Helena, d1PjUBrElTJTH5EkXPZp); her lines are those recordings on her rest image (the moving lip sync
  // draws her mouth). label = the name in the pickers; name stays Astrid, as she calls herself.
  astrid2: { id: 'astrid2', name: 'Astrid', label: 'Astrid', still: '/media/dealers/rooms-v2/darkhall.png' + V, face: '/media/dealers/faces/astrid2.jpg?v=20261014',
    keyed: { still: '/media/dealers/astrid2/v2/vila.png' + V }, layerScale: 1, ready: ASTRID2_READY,
    clips: '/media/dealers/astrid2/v2/', land: ASTRID2_READY.land, lines: ['en', 'pt', 'ko'], linesDir: '/media/dealers/astrid2/repliker/', linesV: '?v=20261014i', idles: ASTRID2_IDLES, handMatte: false, faceTracks: ASTRID2_FACE_TRACKS, serverGreets: true },
};

function pick() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    const ok = id => !!DEALERS[id];
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
  return `${dealer.linesDir}${lang}/${m[1]}.mp4${dealer.linesV ?? V}`;
}

// An alternative dealer without recorded lines never fetches Astrid's: they would only be skipped.
export const unusedLine = url => isAlternative && !dealer.lines && /\/media\/repliker/.test(url ?? '');

// A line only the alternative dealer has (remarks, banter), in the table's language.
export function dealerExtraLineUrl(id, language) {
  if (!isAlternative || !dealer.lines) return null;
  return `${dealer.linesDir}${dealer.lines.includes(language) ? language : 'en'}/${id}.mp4${dealer.linesV ?? V}`;
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
  // wide: the room widened around the 1080 x 1920 frame for the desktop table (desk.css; greenscreen KLARA_DESKTOP, Emil 16 Oct; the other three
  // Emil 28 Oct, metodik bredda-rum-gemini.py)
  { id: 'darkhall', name: 'Dark Hall', still: '/media/dealers/rooms-v2/darkhall.png' + V, thumb: '/media/dealers/rooms-v2/darkhall-thumb.jpg' + V, wide: '/media/dealers/rooms-wide/darkhall.jpg?v=20261028b' },
  { id: 'mahogany', name: 'Mahogany Privé', still: '/media/dealers/rooms-v2/mahogany.png' + V, thumb: '/media/dealers/rooms-v2/mahogany-thumb.jpg' + V, wide: '/media/dealers/rooms-wide/mahogany.jpg?v=20261028b' },
  { id: 'golden', name: 'Golden Salon', still: '/media/dealers/rooms-v2/golden.png' + V, thumb: '/media/dealers/rooms-v2/golden-thumb.jpg' + V, wide: '/media/dealers/rooms-wide/golden.jpg?v=20261028b' },
  { id: 'azure', name: 'Azure Venue', still: '/media/dealers/rooms-v2/azure.png' + V, thumb: '/media/dealers/rooms-v2/azure-thumb.jpg' + V, wide: '/media/dealers/rooms-wide/azure.jpg?v=20261028b' },
];

export function savedRoom() {
  const asked = new URLSearchParams(globalThis.location?.search ?? '').get('room');   // a Table Studio link picks the room
  if (ROOMS.some(r => r.id === asked)) { try { globalThis.localStorage?.setItem('room', asked); } catch {} return ROOMS.find(r => r.id === asked); }
  try { return ROOMS.find(r => r.id === globalThis.localStorage?.getItem('room')) ?? ROOMS[0]; } catch { return ROOMS[0]; }
}

export function chooseRoom(id) {
  try { globalThis.localStorage?.setItem('room', id); } catch {}
}
