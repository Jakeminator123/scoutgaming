// Shared clip naming convention for registered blackjack dealers. A filename is
// advice: it can propose an exact slot, a pose chain, a language and a take
// number, but it never creates slots, approves content or selects playback.
import { SPEECH_LINES } from './speech-lines.mjs';

// Kevin's take suffixes describe where the hands are when a clip starts and
// ends. REDO is the hand at the shoe, VILA is the resting pose. A deal chain
// joins clips at REDO; the first clip enters from VILA (i) and the last one
// returns to VILA (v). A single clip that does both is iv.
export const CLIP_POSES = Object.freeze(['VILA', 'REDO']);
export const CLIP_POSE_VARIANTS = Object.freeze({
  base: Object.freeze({ start: 'REDO', end: 'REDO', label: 'REDO → REDO · mitt i kedjan' }),
  i: Object.freeze({ start: 'VILA', end: 'REDO', label: 'VILA → REDO · första klippet (in)' }),
  v: Object.freeze({ start: 'REDO', end: 'VILA', label: 'REDO → VILA · sista klippet (ut)' }),
  iv: Object.freeze({ start: 'VILA', end: 'VILA', label: 'VILA → VILA · ensamt klipp (in och ut)' }),
});
export const CLIP_LANGUAGES = Object.freeze(['sv', 'en', 'es', 'no', 'da', 'fi', 'de', 'fr', 'ko', 'pt']);
export const SPEECH_LINE_IDS = Object.freeze(Object.keys(SPEECH_LINES));
const DEDICATED_SPEECH = new Set(['goodluck', 'insurance', 'double']);
const REACTION_PREFIX = /^(?:settle|reaktion|reaction|resultat)$/;
const IDLE_TOKENS = new Set(['idle', 'grundloop', 'vila', 'andning', 'breath', 'breathing', 'blink', 'blinkning', 'smile', 'leende', 'glance', 'blick', 'yawn', 'gaspning', 'cheek', 'insulted']);
// Kevin's silent behaviour takes are named after the movement plus a take
// number without a separator (axlar6101, nick6103, vridvanster6105, andasb).
// Match the stem; the digits are a take, not a seat.
const IDLE_STEMS = Object.freeze(['andas', 'andning', 'axlar', 'blick', 'djupandetag', 'fingrar', 'huvud', 'lutfram', 'lutbak', 'nick', 'rakrygg', 'vikt',
  'vridhoger', 'vridvanster', 'breath', 'glance', 'smile', 'blink', 'yawn', 'gasp', 'leende', 'suck', 'harsvep']);
// Folder names of a dropped tree carry the same advice as filename tokens:
// repliker/<lang>/ holds speech, idle-v2/ and idle/ hold behaviour takes. They
// never create slots or approve content.
const IDLE_FOLDERS = new Set(['idle', 'idle-v2', 'vila', 'beteenden', 'behaviour', 'behavior']);
const SPEECH_FOLDERS = new Set(['repliker', 'speech', 'tal', 'lines', 'replik']);
const isIdleToken = token => IDLE_TOKENS.has(token) || /^[a-z]+\d*[a-z]?$/.test(token) && IDLE_STEMS.some(stem => token.startsWith(stem));
export function normalizeClipPath(path) {
  if (typeof path !== 'string' || !path) return [];
  return path.split('/').slice(0, -1).map(segment => segment.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()).filter(Boolean);
}
// The token right after a destination may describe the pose chain. in/ut are
// the Swedish spellings; u is Emil's older spelling of v.
const SUFFIX = Object.freeze({ i: 'i', in: 'i', v: 'v', u: 'v', ut: 'v', iv: 'iv', iu: 'iv', inut: 'iv', base: 'base', bas: 'base' });
const DESTINATION = /^(?:pos(?:ition)?|plats|seat|box|spelarplats)\d[a-z]?$|^(?:posdealer|poshole|hole|holecard|flip|dealerup|dealerhole|reveal|vand|vanda|vandning)$/;

export function normalizeClipName(name) {
  const stem = String(name ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '');
  return stem.split(/[^a-z0-9]+/).filter(Boolean);
}
const has = (joined, word) => new RegExp(`(?:^|-)(?:${word})(?:-|$)`).test(joined);
const box = n => `deal.player.${n < 2 ? 'left' : n < 5 ? 'centre' : 'right'}/box${n}`;
export function clipPoseVariant(token) { return SUFFIX[token] ?? null; }
export function clipPosesForVariant(variant) {
  const row = CLIP_POSE_VARIANTS[variant];
  return row ? { start: row.start, end: row.end } : null;
}
export function clipVariantForPoses(poses) {
  return Object.keys(CLIP_POSE_VARIANTS).find(key => CLIP_POSE_VARIANTS[key].start === poses?.start && CLIP_POSE_VARIANTS[key].end === poses?.end) ?? null;
}
// Each destination has a natural base chain in the filmed material: deals and
// the open dealer card run REDO → REDO, the hole card ends in VILA and the flip
// starts and ends in VILA. A suffix only moves the matching end to VILA.
function posesFor(slotId, suffix) {
  const base = slotId === 'reveal.dealer/dealer-hole' ? { start: 'VILA', end: 'VILA' }
    : slotId === 'deal.dealer/dealer-hole' ? { start: 'REDO', end: 'VILA' } : { start: 'REDO', end: 'REDO' };
  if (suffix === 'base' || suffix === null) return base;
  return { start: suffix === 'i' || suffix === 'iv' ? 'VILA' : base.start, end: suffix === 'v' || suffix === 'iv' ? 'VILA' : base.end };
}

// Returns every slot the name could mean plus the metadata that is safe to
// derive from it. Callers filter candidates against the saved catalogue.
export function parseClipFilename(name, { type = 'video/mp4', path = '' } = {}) {
  const tokens = normalizeClipName(name), joined = tokens.join('-');
  const folders = normalizeClipPath(path);
  const result = { slotIds: [], slotId: null, poses: null, variant: null, explicitPose: false, language: null, take: null, canonical: false,
    folderHint: folders.some(folder => IDLE_FOLDERS.has(folder)) ? 'idle' : folders.some(folder => SPEECH_FOLDERS.has(folder)) ? 'speech' : null };
  const folderLanguage = folders.find(folder => CLIP_LANGUAGES.includes(folder)) ?? null;
  const candidates = new Set();
  if (!tokens.length) return finish(result, candidates);
  if (String(type).startsWith('image/')) {
    if (has(joined, 'vila|keystone|rest')) candidates.add('pose/vila');
    if (has(joined, 'redo|ready')) candidates.add('pose/redo');
    return finish(result, candidates);
  }
  // Transitions carry their pose chain by definition.
  const toShoe = has(joined, 'to-shoe|toshoe|till-skon|vila-till-redo|vila-redo|in-vila-till-redo');
  const fromShoe = has(joined, 'from-shoe|fromshoe|fran-skon|redo-till-vila|redo-vila|ut-redo-till-vila');
  if (toShoe) candidates.add('transition.shoe/to-shoe');
  if (fromShoe) candidates.add('transition.shoe/from-shoe');
  if (toShoe !== fromShoe) { result.poses = toShoe ? { start: 'VILA', end: 'REDO' } : { start: 'REDO', end: 'VILA' }; result.explicitPose = true; }
  if (toShoe || fromShoe) return finish(result, candidates);
  // Deals: pos1–pos7 / plats / seat (1-based) or box0–box6 (0-based). A trailing
  // letter such as pos6b is an alternate take, not a pose.
  for (const match of joined.matchAll(/(?:^|-)(?:deal-)?(pos(?:ition)?|plats|seat|spelarplats|box)-?(\d)(?:[a-z]|-?alt\d*)?(?=-|$)/g)) {
    const n = Number(match[2]), zero = match[1] === 'box' ? n : n - 1;
    if (zero >= 0 && zero <= 6) candidates.add(box(zero));
  }
  const reveal = has(joined, 'flip|reveal|vand|vanda|vandning|turnover|turn-over');
  if (reveal) candidates.add('reveal.dealer/dealer-hole');
  else if (has(joined, 'hole|poshole|dealer-hole|dealerhole|hole-card|holecard|dolt|dolt-kort|dealer-dolt')) candidates.add('deal.dealer/dealer-hole');
  if (has(joined, 'posdealer|dealer-up|dealerup|dealer-open|oppet|oppet-kort|oppet-dealerkort|dealerkort')) candidates.add('deal.dealer/dealer-up');
  const shoe = [...candidates].filter(id => id.startsWith('deal.') || id.startsWith('reveal.'));
  if (shoe.length === 1) {
    const index = tokens.findIndex(token => DESTINATION.test(token));
    const suffix = index >= 0 ? clipPoseVariant(tokens[index + 1]) : null;
    result.explicitPose = suffix !== null;
    result.poses = posesFor(shoe[0], suffix);
    result.variant = clipVariantForPoses(result.poses);
  }
  const reaction = tokens.some(token => REACTION_PREFIX.test(token));
  if (reaction || !reveal && has(joined, 'turn|tur|spelarens-tur|player-turn')) candidates.add('idle.ready/');
  // Speech: <line>[-<lang>][-<take>], for example goodluck-sv-1 or greet-jakob.
  if (!reaction) {
    for (const line of SPEECH_LINE_IDS) {
      if (has(joined, line) || line === 'greeting' && has(joined, 'greet|valkommen|halsning')) {
        candidates.add(`${DEDICATED_SPEECH.has(line) ? `speak.${line}` : 'speak.other'}/${line}`);
      }
    }
    if ([...candidates].some(id => id.startsWith('speak.'))) {
      result.language = tokens.find(token => CLIP_LANGUAGES.includes(token)) ?? folderLanguage;
      if (tokens.length > 1 && /^\d{1,2}$/.test(tokens.at(-1))) result.take = Number(tokens.at(-1));
    }
  }
  // A behaviour folder makes an otherwise unknown silent take an idle proposal.
  // A speech folder names no line, so it adds nothing on its own.
  if (!candidates.size && (tokens.some(isIdleToken) || result.folderHint === 'idle')) candidates.add('idle.ready/');
  return finish(result, candidates);
}
function finish(result, candidates) {
  result.slotIds = [...candidates];
  result.slotId = result.slotIds.length === 1 ? result.slotIds[0] : null;
  if (result.slotId === null) { result.poses = null; result.variant = null; result.explicitPose = false; }
  result.canonical = result.slotId !== null && (result.explicitPose || !/^(?:deal|reveal)\./.test(result.slotId));
  return result;
}

// Suggested filenames per slot, used by the import guide and documentation.
export function clipNamingGuide() {
  return [
    { slotId: 'idle.ready/', pattern: '<dealer>_idle[_<beskrivning>]', example: 'dragan_idle_andning.mp4', note: 'Basloop och tysta beteendeklipp (andas, blick, nick, axlar) i samma fack. Mappen idle-v2/ räknas som beteendeklipp.' },
    { slotId: 'transition.shoe/to-shoe', pattern: '<dealer>_vila_till_redo', example: 'dragan_vila_till_redo.mp4', note: 'Till skon: VILA → REDO.' },
    { slotId: 'transition.shoe/from-shoe', pattern: '<dealer>_redo_till_vila', example: 'dragan_redo_till_vila.mp4', note: 'Från skon: REDO → VILA.' },
    ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ slotId: box(n - 1), pattern: `<dealer>_pos${n}[-i|-iv|-v]`, example: `dragan_pos${n}-iv.mp4`,
      note: `Spelarplats ${n} = box${n - 1}. Utan suffix REDO → REDO; -i börjar i VILA, -v slutar i VILA, -iv båda.` })),
    { slotId: 'deal.dealer/dealer-up', pattern: '<dealer>_posdealer[-i|-iv|-v]', example: 'dragan_posdealer.mp4', note: 'Öppet dealerkort, även tredje kort och senare. Samma suffix som spelarplatserna.' },
    { slotId: 'deal.dealer/dealer-hole', pattern: '<dealer>_hole[-i]', example: 'dragan_hole-i.mp4', note: 'Dolt kort läggs och handen går till VILA. -i när klippet även börjar i VILA.' },
    { slotId: 'reveal.dealer/dealer-hole', pattern: '<dealer>_flip', example: 'dragan_flip.mp4', note: 'Vänd dolt kort. VILA → VILA.' },
    ...SPEECH_LINE_IDS.map(line => ({ slotId: `${DEDICATED_SPEECH.has(line) ? `speak.${line}` : 'speak.other'}/${line}`, pattern: `<dealer>_${line}_<språk>_<nr>`, example: `dragan_${line}_sv_1.mp4`,
      note: 'Inspelad replik med inbakad mun. Språk och tagningsnummer följer med som notering; manus, ljudhash och granskning sätts separat.' })),
    { slotId: 'pose/vila', pattern: '<dealer>_vila.png', example: 'dragan_vila.png', note: 'Referensbild, sparas inte i klippbanken.' },
    { slotId: 'pose/redo', pattern: '<dealer>_redo.png', example: 'dragan_redo.png', note: 'Referensbild, sparas inte i klippbanken.' },
  ];
}
