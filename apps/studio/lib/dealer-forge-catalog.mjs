// Dealer Forge catalog: which slots a dealer bank needs, how each slot is
// generated from one still image, prompt templates and credit estimates.
// Geometry is the canonical 1080x1920 / 24 fps portrait master shared with
// packages/presentation (Paow catalog) and the layered player; desktop is a crop,
// never a new camera. Prompts request geometry; they are not acceptance.
import { blackjackMediaSlots } from './dealer-media-library.mjs';

export const FORGE_CANVAS = Object.freeze({ width: 1080, height: 1920, fps: 24 });
export const FORGE_CARD = Object.freeze({ width: 79, height: 106 });
// Frozen from the removed preview catalog (Paow, lanes[0].dealer.metadata.positioner).
export const DEFAULT_POSITIONS = Object.freeze({
  1: Object.freeze({ cx: 110, cy: 1025 }), 2: Object.freeze({ cx: 253, cy: 1075 }), 3: Object.freeze({ cx: 396, cy: 1105 }),
  4: Object.freeze({ cx: 540, cy: 1115 }), 5: Object.freeze({ cx: 684, cy: 1105 }), 6: Object.freeze({ cx: 827, cy: 1075 }),
  7: Object.freeze({ cx: 970, cy: 1025 }), dealer: Object.freeze({ cx: 540, cy: 895 }),
});
export const DEFAULT_TABLE_GEOMETRY = Object.freeze({
  rearY: 740,
  outline: Object.freeze([[105, 740], [970, 740], [1080, 848], [1080, 1420], [1030, 1515], [947, 1600], [840, 1668], [700, 1732], [540, 1764], [380, 1732], [240, 1668], [133, 1600], [50, 1515], [0, 1420], [0, 848]].map(Object.freeze)),
  frontLine: Object.freeze([[0, 1220], [80, 1400], [195, 1509], [340, 1582], [540, 1627], [740, 1582], [885, 1509], [1000, 1400], [1080, 1220]].map(Object.freeze)),
});
export const DEFAULT_PROFILE = Object.freeze({
  schemaVersion: 1,
  subject: 'the dealer', // Short identity text used in prompts, e.g. "woman with dark hair, white shirt, black vest".
  theme: 'elegant dark casino, warm architectural lights, restrained luxury',
  tableStyle: 'dark charcoal felt, black padded rail, subtle warm metallic trim',
  positions: DEFAULT_POSITIONS,
  table: DEFAULT_TABLE_GEOMETRY,
  anchors: Object.freeze({}), // { vila: {pathname,sha256,size,contentType,width,height}, redo: {...} }
  avatar: null, // { id, voice, status } from Runway Avatars for lip-synced speech.
  voice: Object.freeze({ type: 'runway-live-preset', presetId: 'clara' }),
  language: 'en',
});

// Checked 2026-10-12 against https://docs.dev.runwayml.com/guides/pricing/. 1 credit = 0.01 USD before tax.
export const PRICE_CHECKED = '2026-10-12';
export const QUALITIES = Object.freeze({
  720: Object.freeze({ id: '720', label: 'Prov / webb · 720p', portrait: [720, 1280], landscape: [1280, 720], wanRate: 10, wanRatio: 'auto_720p', wanPortrait: '720:1280', imageModel: 'gen4_image', imageCredits: 5, imageRatio: { portrait: '720:1280', landscape: '1280:720' } }),
  1080: Object.freeze({ id: '1080', label: 'Hög upplösning · 1080p', portrait: [1080, 1920], landscape: [1920, 1080], wanRate: 20, wanRatio: 'auto_1080p', wanPortrait: '1080:1920', imageModel: 'gen4_image', imageCredits: 8, imageRatio: { portrait: '1080:1920', landscape: '1920:1080' } }),
});
const GEN4_TURBO_RATE = 5;
const AVATAR_BASE = 2, AVATAR_PER_SIX_SECONDS = 2;

export const FORGE_GROUPS = Object.freeze([
  Object.freeze({ id: 'pose', label: 'Grundposer' }),
  Object.freeze({ id: 'idle', label: 'Vila / Idle' }),
  Object.freeze({ id: 'transition', label: 'Övergångar' }),
  Object.freeze({ id: 'deal', label: 'Givning' }),
  Object.freeze({ id: 'speech', label: 'Talade repliker' }),
  Object.freeze({ id: 'layer', label: 'Bord & bakgrund' }),
]);

// Slots that exist in the forge before (or regardless of) the saved project events.
// transition.shoe is the event prepared in the parallel PR; its ids match so the
// forge matrix lines up once that event lands in the saved project.
const EXTRA_SLOTS = Object.freeze([
  Object.freeze({ id: 'pose/vila', group: 'pose', kind: 'pose', pose: 'vila', label: 'VILA · stillbild (ladda upp)', start: 'VILA', end: 'VILA', required: true }),
  Object.freeze({ id: 'pose/redo', group: 'pose', kind: 'pose', pose: 'redo', label: 'REDO · handen vid skon (genereras)', start: 'REDO', end: 'REDO', required: true }),
  Object.freeze({ id: 'transition.shoe/to-shoe', group: 'transition', kind: 'clip', eventId: 'transition.shoe', situation: 'to-shoe', label: 'Till skon · VILA → REDO', start: 'VILA', end: 'REDO', frames: 22 }),
  Object.freeze({ id: 'transition.shoe/from-shoe', group: 'transition', kind: 'clip', eventId: 'transition.shoe', situation: 'from-shoe', label: 'Från skon · REDO → VILA', start: 'REDO', end: 'VILA', frames: 22 }),
  Object.freeze({ id: 'layer/table', group: 'layer', kind: 'table', label: 'Bord · separat bildlager', role: 'table' }),
  Object.freeze({ id: 'layer/background', group: 'layer', kind: 'background', label: 'Bakgrund · tomt rum', role: 'background' }),
]);

const DEAL_TARGETS = Object.freeze({ box0: '1', box1: '2', box2: '3', box3: '4', box4: '5', box5: '6', box6: '7', 'dealer-up': 'dealer', 'dealer-hole': 'dealer' });
const DEAL_FRAMES = Object.freeze({ box0: 26, box1: 26, box2: 27, box3: 26, box4: 26, box5: 26, box6: 26, 'dealer-up': 28, 'dealer-hole': 28 });

function eventSlot(slot) {
  const base = { id: slot.id, eventId: slot.eventId, situation: slot.situation, label: slot.label, category: slot.category };
  if (slot.eventId === 'idle.ready') return { ...base, group: 'idle', kind: 'clip', start: 'VILA', end: 'VILA', label: 'Idle · lugn andning (VILA)', required: true };
  if (slot.eventId.startsWith('deal.')) {
    const target = DEAL_TARGETS[slot.situation];
    return { ...base, group: 'deal', kind: 'clip', start: 'REDO', end: 'REDO', target, frames: DEAL_FRAMES[slot.situation] ?? 26,
      faceDown: slot.situation === 'dealer-hole', label: `Ge kort · ${target === 'dealer' ? (slot.situation === 'dealer-hole' ? 'dolt kort till dealern' : 'öppet kort till dealern') : `plats ${target}`}` };
  }
  if (slot.eventId.startsWith('reveal.')) return { ...base, group: 'deal', kind: 'clip', start: 'REDO', end: 'REDO', target: 'dealer', frames: 28, reveal: true, label: 'Vänd dolt kort · dealern' };
  if (slot.eventId === 'transition.shoe') return { ...base, ...EXTRA_SLOTS.find(row => row.id === slot.id), fromProject: true };
  if (slot.category === 'speech') return { ...base, group: 'speech', kind: 'speech', start: 'VILA', end: 'VILA', line: slot.situation };
  return { ...base, group: 'reaction', kind: 'clip', start: 'VILA', end: 'VILA', reaction: slot.eventId };
}

/** Matrix rows for one dealer: project events (exact slots) plus forge-only pose/transition/layer slots. */
export function forgeSlots(project) {
  const fromProject = blackjackMediaSlots(project).map(eventSlot);
  const ids = new Set(fromProject.map(slot => slot.id));
  const extras = EXTRA_SLOTS.filter(slot => !ids.has(slot.id)).map(slot => ({ ...slot, fromProject: false,
    // transition slots only become registrable once the saved project carries the event.
    needsEvent: Boolean(slot.eventId) }));
  const order = new Map(FORGE_GROUPS.map((group, index) => [group.id, index]));
  return [...fromProject, ...extras].sort((a, b) => order.get(a.group) - order.get(b.group));
}

export function slotById(project, slotId) {
  const slot = forgeSlots(project).find(row => row.id === slotId);
  if (!slot) throw Object.assign(new Error('Okänt fack.'), { statusCode: 404, code: 'forge_slot_unknown' });
  return slot;
}

export function stageTransform(size, cropTop = 108) {
  const [w, h] = size;
  if (w > h) { const scale = h / FORGE_CANVAS.height * (FORGE_CANVAS.height / 1080); return { scale: h / 1080, offsetX: (w - 1080 * (h / 1080)) / 2, offsetY: -cropTop * (h / 1080), scaleNote: scale }; }
  const scale = Math.min(w / 1080, h / 1920);
  return { scale, offsetX: (w - 1080 * scale) / 2, offsetY: (h - 1920 * scale) / 2 };
}

/** Normalize a client-supplied positions map: eight targets within the canvas. */
export function validatePositions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Positioner ska vara ett objekt.');
  const keys = Object.keys(value).sort().join(',');
  if (keys !== '1,2,3,4,5,6,7,dealer') throw new Error('Positioner måste ha plats 1–7 och dealer.');
  const out = {};
  for (const key of Object.keys(value)) {
    const point = value[key];
    if (!point || !Number.isFinite(point.cx) || !Number.isFinite(point.cy) || point.cx < 0 || point.cx > 1080 || point.cy < 0 || point.cy > 1920) throw new Error(`Ogiltig koordinat för ${key}.`);
    out[key] = { cx: Math.round(point.cx), cy: Math.round(point.cy) };
  }
  return out;
}

const text = (value, max, fallback) => typeof value === 'string' && value.trim() && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : fallback;

export function validateProfile(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const anchors = {};
  for (const pose of ['vila', 'redo']) {
    const anchor = value.anchors?.[pose];
    if (anchor === undefined || anchor === null) continue;
    if (!anchor || typeof anchor.pathname !== 'string' || !/^[a-f0-9]{64}$/.test(anchor.sha256) || !Number.isSafeInteger(anchor.size) || anchor.size < 16
      || !['image/png', 'image/jpeg', 'image/webp'].includes(anchor.contentType) || ![anchor.width, anchor.height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 16384)) throw new Error(`Ogiltigt ankare: ${pose}.`);
    anchors[pose] = { pathname: anchor.pathname, sha256: anchor.sha256, size: anchor.size, contentType: anchor.contentType, width: anchor.width, height: anchor.height };
  }
  let avatar = null;
  if (value.avatar) {
    if (typeof value.avatar.id !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(value.avatar.id)) throw new Error('Ogiltigt avatar-ID.');
    avatar = { id: value.avatar.id, status: text(value.avatar.status, 40, 'unknown'), presetId: text(value.avatar.presetId, 40, DEFAULT_PROFILE.voice.presetId) };
  }
  const voicePreset = text(value.voice?.presetId, 40, DEFAULT_PROFILE.voice.presetId);
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(voicePreset)) throw new Error('Ogiltig röst.');
  return {
    schemaVersion: 1,
    subject: text(value.subject, 240, DEFAULT_PROFILE.subject),
    theme: text(value.theme, 240, DEFAULT_PROFILE.theme),
    tableStyle: text(value.tableStyle, 240, DEFAULT_PROFILE.tableStyle),
    positions: value.positions ? validatePositions(value.positions) : structuredClone(DEFAULT_POSITIONS),
    table: structuredClone(DEFAULT_TABLE_GEOMETRY),
    anchors, avatar,
    voice: { type: 'runway-live-preset', presetId: voicePreset },
    language: ['en', 'sv'].includes(value.language) ? value.language : 'en',
  };
}

// --- Prompts -----------------------------------------------------------------

const common = profile => `Same person as the reference (${profile.subject}): identical face, hair, skin, clothing, body proportions and the exact locked frontal camera. `
  + 'Uniform flat bright chroma green (#00FF00) everywhere outside the person and the necessary card props. '
  + 'No visible table surface, rim, table legs, room, shadows on green, text, zoom or camera motion. ';

const positionText = (profile, target) => {
  const point = profile.positions[target];
  return `Target center on the canonical 1080x1920 canvas: x=${point.cx}, y=${point.cy} (${(point.cx / 1080).toFixed(4)} across, ${(point.cy / 1920).toFixed(4)} down). Card footprint: ${FORGE_CARD.width}x${FORGE_CARD.height} pixels. `;
};

export const REACTION_MOTION = Object.freeze({
  'turn.player': 'She looks toward the active player, gives a small inviting nod and an open-palm gesture that asks for a decision, then returns to the resting pose.',
  'settle.blackjack': 'A warm congratulating smile and a small approving nod; hands stay at rest on the green. Return to the neutral resting pose.',
  'settle.dealerBust': 'A small apologetic smile and a brief acknowledging nod toward the players; hands stay at rest. Return to the neutral resting pose.',
  'settle.win': 'A pleased smile and a light nod of congratulation; hands stay at rest. Return to the neutral resting pose.',
  'settle.push': 'A neutral, even expression with a small shrug-free nod indicating a tie; hands stay at rest. Return to the neutral resting pose.',
  'settle.other': 'A calm, reassuring expression and a brief gentle nod; hands stay at rest. Return to the neutral resting pose.',
});

export function slotPrompt(slot, profile, { expression = 'neutral', speechText = '' } = {}) {
  if (slot.kind === 'background') {
    return 'Create an empty photorealistic casino room background plate. Use @layout as a composition guide only. '
      + 'Fixed frontal camera consistent with a seated blackjack dealer, perfectly level. The central portrait-safe region must be calm and clear behind the future dealer. '
      + 'No dealer, people, blackjack table, cards, foreground furniture, text or logos. Room detail may continue into the wide left and right margins. '
      + `Do not reproduce guide marks, labels or colored boxes. Decor and lighting: ${profile.theme}.`;
  }
  if (slot.kind === 'table') {
    const dealer = profile.positions.dealer, centre = profile.positions[4];
    return 'Create a photorealistic empty blackjack table layer using @layout. Preserve the exact silhouette, rear contact line and frontal downward camera perspective of the guide. '
      + `The guide is on a 1080x1920 coordinate canvas. The rear hand-support line is around y=${profile.table.rearY}. `
      + `The playing surface must include all the marked landing areas, including the center at (${centre.cx},${centre.cy}) and dealer area at (${dealer.cx},${dealer.cy}). `
      + 'The marks are alignment guides only and must not be visible in the result. Preserve the table outline instead of inventing a new camera angle. '
      + `Isolate the table on a uniform magenta (#FF00FF) background for separation; no people, hands, cards, room or text. Materials and style: ${profile.tableStyle}.`;
  }
  if (slot.kind === 'pose' && slot.pose === 'redo') {
    return common(profile) + 'Still image. She has moved into the READY pose: her left hand rests on the card shoe at screen right with fingertips on the top card, her right hand settles in the ready position near the table edge. '
      + 'No card is drawn. Same calm closed-mouth expression and gaze as the reference. Same framing and scale; nothing else changes.';
  }
  if (slot.kind === 'speech') {
    const line = speechText || 'a short friendly dealer line';
    return common(profile) + `She sits in the VILA pose with both palms resting at their original positions and speaks the line "${line}" clearly to the camera with natural mouth movement, small natural head motion and a friendly expression. `
      + 'No hand movement, no cards, no torso scaling. Return to the closed-mouth neutral expression and the same resting pose at the end.';
  }
  let motion;
  if (slot.eventId === 'idle.ready') {
    motion = 'She sits in the original VILA pose with both palms resting at their original positions. One relaxed natural breath over the clip: a small but visible expansion and release of the ribcage, '
      + 'with the clothing moving just slightly. Shoulders stay relaxed, not rising in a shrug. No heavy breathing, head bobbing, torso scaling or hand movement. Same closed-mouth expression. Return to the starting pose and breathing phase.';
  } else if (slot.situation === 'to-shoe') {
    motion = 'Perform the VILA-to-READY transition. From both palms at rest, her left hand moves to the card shoe on screen right and rests on the next card; her right hand settles in the ready position. '
      + `Draw no card. End exactly in the supplied READY pose. Smooth natural hand paths over about ${slot.frames ?? 22} frames at 24 fps; hold still before and after.`;
  } else if (slot.situation === 'from-shoe') {
    motion = 'Perform the READY-to-VILA transition. Move the left hand away from the shoe and return both palms to the VILA resting positions. Move no cards. '
      + `Smooth natural hand paths over about ${slot.frames ?? 22} frames at 24 fps; hold still before and after. End exactly in the supplied VILA pose.`;
  } else if (slot.reveal) {
    motion = 'In READY pose, reach to the face-down card lying in the dealer area, flip it face up in place with the right hand, then return hands to READY. '
      + positionText(profile, 'dealer') + `Preserve a clean, deliberate flip over about ${slot.frames} frames at 24 fps. Hold still before and after. The card shows a blank white face.`;
  } else if (slot.group === 'deal') {
    const where = slot.target === 'dealer' ? (slot.faceDown ? 'the dealer area, face down (blank dark back up)' : 'the dealer area, face up') : `player position ${slot.target} (numbered from screen left), face up`;
    const technique = ['7', 'dealer'].includes(slot.target) ? 'Use a one-handed delivery with the right hand. ' : 'Left hand draws from the shoe, right hand delivers. ';
    motion = `In READY pose, deal exactly one blank white card to ${where}, then return hands to READY. ` + positionText(profile, slot.target) + technique
      + `Clean arm, finger and card trajectories, a visible contact point and about ${slot.frames} frames of action at 24 fps. Hold still before and after. One card only, no printed suit or rank. Leave the card at its final location.`;
  } else {
    motion = REACTION_MOTION[slot.reaction] ?? 'A small natural reaction; hands stay at rest on the green. Return to the neutral resting pose.';
  }
  const emotion = expression === 'smile' ? ' A small warm closed-mouth smile appears during the movement and returns to the original neutral expression before the end. No laughter, speech or changed hand motion.' : '';
  return common(profile) + motion + emotion;
}

// --- Generation plans ------------------------------------------------------------

export const MODES = Object.freeze(['keyframe', 'reference', 'avatar', 'image']);

/**
 * Decide model, endpoint and price for a slot. `mode`:
 *  keyframe  – wan3 first/last pose anchors (deals, transitions, 1080p idle) or gen4_turbo (720p idle/reactions/speech-no-audio)
 *  reference – wan3 with an existing clip in the same slot as motion reference (variants)
 *  avatar    – gwm1_avatars lip-synced speech from the VILA anchor + text/audio
 *  image     – gen4_image for poses, tables and backgrounds
 */
export function slotPlan(slot, { quality = '720', duration, mode, expression = 'neutral', hasReference = false, speechSeconds = 5 } = {}) {
  const q = QUALITIES[quality];
  if (!q) throw Object.assign(new Error('Välj 720p eller 1080p.'), { statusCode: 422, code: 'forge_invalid_quality' });
  if (slot.kind === 'table' || slot.kind === 'background' || slot.kind === 'pose') {
    if (slot.kind === 'pose' && slot.pose === 'vila') throw Object.assign(new Error('VILA laddas upp, den genereras inte.'), { statusCode: 422, code: 'forge_slot_upload_only' });
    const landscape = slot.kind === 'background';
    return { mode: 'image', model: q.imageModel, endpoint: 'text_to_image', ratio: landscape ? q.imageRatio.landscape : q.imageRatio.portrait, quality, duration: 0, credits: q.imageCredits, expression: 'neutral', priceChecked: PRICE_CHECKED };
  }
  if (slot.kind === 'speech') {
    const chosen = mode ?? 'avatar';
    if (chosen === 'avatar') {
      const seconds = Math.max(1, Math.min(30, Math.round(speechSeconds)));
      return { mode: 'avatar', model: 'gwm1_avatars', endpoint: 'avatar_videos', ratio: null, quality, duration: seconds, credits: AVATAR_BASE + AVATAR_PER_SIX_SECONDS * Math.ceil(seconds / 6), expression, priceChecked: PRICE_CHECKED };
    }
    const seconds = [5, 10].includes(duration) ? duration : 5;
    return { mode: 'keyframe', model: 'wan3', endpoint: 'image_to_video', ratio: q.wanRatio, quality, duration: seconds, credits: seconds * q.wanRate, expression, audio: true, priceChecked: PRICE_CHECKED };
  }
  // Clips
  const isStill = slot.eventId === 'idle.ready' || slot.group === 'reaction';
  if (mode === 'reference') {
    if (!hasReference) throw Object.assign(new Error('Referensläget kräver ett befintligt klipp i samma fack.'), { statusCode: 422, code: 'forge_reference_missing' });
    const seconds = [2, 5, 10].includes(duration) ? duration : 2;
    return { mode: 'reference', model: 'wan3', endpoint: 'image_to_video', ratio: q.wanPortrait, quality, duration: seconds, credits: seconds * q.wanRate, expression, priceChecked: PRICE_CHECKED };
  }
  if (isStill && quality === '720' && mode !== 'wan3') {
    const seconds = [5, 10].includes(duration) ? duration : 5;
    return { mode: 'keyframe', model: 'gen4_turbo', endpoint: 'image_to_video', ratio: '720:1280', quality, duration: seconds, credits: seconds * GEN4_TURBO_RATE, expression, priceChecked: PRICE_CHECKED };
  }
  const seconds = [2, 5, 10].includes(duration) ? duration : isStill ? 5 : 2;
  return { mode: 'keyframe', model: 'wan3', endpoint: 'image_to_video', ratio: q.wanRatio, quality, duration: seconds, credits: seconds * q.wanRate, expression, priceChecked: PRICE_CHECKED };
}

/** Which anchors a plan needs. */
export function anchorsFor(slot, plan) {
  if (plan.mode === 'image') return slot.kind === 'pose' ? ['vila'] : [];
  if (plan.mode === 'avatar') return ['vila'];
  const first = slot.start === 'REDO' ? 'redo' : 'vila', last = slot.end === 'REDO' ? 'redo' : 'vila';
  if (plan.model === 'gen4_turbo' || plan.mode === 'reference') return [first];
  return first === last ? [first] : [first, last];
}

/** Speech line texts come from web/public/speech-lines.mjs (English bank). */
export function speechTextFor(line, speechLines, language = 'en') {
  const row = speechLines?.[line];
  if (!row) return '';
  if (typeof row === 'string') return row;
  return row[language] ?? row.en ?? row.text ?? '';
}
