import { MEDIA_FAMILY_DEFINITIONS } from '../../../packages/presentation/runtime/media-families.mjs';

// Display names only. Never rename files, hashes or family ids.
const ACTIONS = {
  deal: 'Ge kort',
  reveal: 'Vänd kort',
  speak: 'Replik',
  idle: 'Grundloop',
  turn: 'Tur',
  settle: 'Resultat',
  transition: 'Övergång',
};
const SEATS = {
  'player.left': 'spelare vänster',
  'player.centre': 'spelare mitten',
  'player.center': 'spelare mitten',
  'player.right': 'spelare höger',
};
const SITUATIONS = {
  'dealer-hole': 'Dolt kort',
  'dealer-up': 'Öppet kort',
  ready: 'redo',
  goodluck: 'lycka till',
  insurance: 'försäkring',
  double: 'dubbling',
  blackjack: 'blackjack',
  bust: 'Över 21',
  chatter1: 'prat 1',
  chatter2: 'prat 2',
  dealerblackjack: 'dealerns blackjack',
  dealerbust: 'Dealern över 21',
  farewell: 'avsked',
  greeting: 'Välkomsthälsning',
  lose: 'förlust',
  peek: 'titt',
  placebets: 'lägg insatser',
  push: 'Lika',
  sidebet: 'sidospel',
  win: 'vinst',
  'to-shoe': 'Till skon',
  'from-shoe': 'Från skon',
};

const situationText = situation => {
  if (Object.hasOwn(SITUATIONS, situation)) return SITUATIONS[situation];
  // Studio shows box0 as plats 1 (mediaSituationLabel and the hand row both add 1).
  const box = /^box([0-6])$/.exec(situation);
  if (box) return `Spelarplats ${Number(box[1]) + 1}`;
  return situation;
};

const withRole = (label, role) => {
  if (!label) return '';
  if (role === 'variant') return `${label} · variant`;
  if (typeof role === 'string' && role && role !== 'standard') return `${label} · ${role}`;
  return label;
};

function labelFromFamily(familyId, role) {
  if (typeof familyId !== 'string' || !familyId || familyId.length > 240) return '';
  const parts = familyId.split('/');
  if (parts.length !== 3 || parts.some(part => !part)) return '';
  const eventId = parts[1];
  const situation = parts[2];
  const dot = eventId.indexOf('.');
  const action = dot === -1 ? eventId : eventId.slice(0, dot);
  const rest = dot === -1 ? '' : eventId.slice(dot + 1);
  if (action === 'speak' && Object.hasOwn(SITUATIONS, situation)) return withRole(clipSituationLabel(eventId, situation), role);
  if (action === 'idle' && situation === 'ready') return role === 'variant' ? 'Variation' : 'Lugn blick';
  if (action === 'transition' && (situation === 'to-shoe' || situation === 'from-shoe')) return withRole(clipSituationLabel(eventId, situation), role);
  if (action === 'deal' && /^box[0-6]$/.test(situation)) return withRole(`Ge kort · ${situationText(situation)}`, role);
  if (['deal', 'reveal'].includes(action) && ['dealer-up', 'dealer-hole'].includes(situation)) {
    return withRole(`${action === 'reveal' ? 'Vänd dolt kort' : situation === 'dealer-up' ? 'Ge öppet kort' : 'Ge dolt kort'} · Dealer`, role);
  }
  const bits = [Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : action];
  if (rest && Object.hasOwn(SEATS, rest)) bits.push(SEATS[rest]);
  else if (rest && rest !== 'dealer' && rest !== 'other' && rest !== situation) bits.push(rest);
  const situationLabel = situationText(situation);
  if (situationLabel && situationLabel !== bits.at(-1)) bits.push(situationLabel);
  return withRole(bits.filter(Boolean).join(' · '), role);
}

function labelFromPath(relativePath, role) {
  if (typeof relativePath !== 'string') return '';
  const path = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!path || path.length > 240 || path.split('/').some(part => !part || part === '.' || part === '..')) return '';
  const definition = MEDIA_FAMILY_DEFINITIONS.find(item => item.standardPaths.includes(path) || path.startsWith(`${item.variantDirectory}/`));
  if (definition) {
    const inferred = role || (path.startsWith(`${definition.variantDirectory}/`) ? 'variant' : 'standard');
    return labelFromFamily(definition.id, inferred);
  }
  return withRole(path.split('/').at(-1), role);
}

// Same bounds as studio-model clipLabelErrors. Display text only.
const CLIP_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const CLIP_LABEL_MAX = 80;
const MAX_CLIP_LABELS = 2048;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const clipMap = value => {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('clipLabels: ska vara ett objekt');
  return { ...value };
};

// Blank text removes the key so clipLabel derives the name again.
// A longer name is rejected; nothing is truncated and no file or hash is touched.
export function assignClipLabel(clipLabels, clipId, text) {
  if (typeof clipId !== 'string' || !CLIP_ID.test(clipId)) throw new Error(`clipLabels: ogiltigt klipp-id ${clipId}`);
  const next = clipMap(clipLabels);
  if (typeof text !== 'string' || !text.trim()) {
    delete next[clipId];
    return next;
  }
  if (text.length > CLIP_LABEL_MAX || CONTROL_CHARS.test(text)) throw new Error(`clipLabels.${clipId}: ska vara text med 1–${CLIP_LABEL_MAX} tecken`);
  if (!Object.hasOwn(next, clipId) && Object.keys(next).length >= MAX_CLIP_LABELS) throw new Error('clipLabels: ska ha högst 2048 namn');
  next[clipId] = text;
  return next;
}

export function applyClipLabel(project, clipId, text) {
  const clipLabels = assignClipLabel(project?.clipLabels, clipId, text);
  const next = structuredClone(project);
  if (Object.keys(clipLabels).length) next.clipLabels = clipLabels;
  else delete next.clipLabels;
  return next;
}

// overrides is the project's clipLabels map (clip id → text), not the whole project.
export function clipLabel(clip, overrides) {
  const id = clip && typeof clip.id === 'string' ? clip.id : '';
  const override = overrides && id && typeof overrides[id] === 'string' ? overrides[id] : '';
  if (override.trim() && override.length <= CLIP_LABEL_MAX && !CONTROL_CHARS.test(override)) return override;
  // Preserve filmed take identities: u is an appended return, v is a different
  // rest take with its own card track. A family name cannot distinguish them.
  const take = [clip?.label, clip?.relativePath?.replace(/\\/g, '/').split('/').at(-1)]
    .find(value => typeof value === 'string' && /^(?:pos(?:[1-7]|dealer)|hole|flip)(?:-(?:i|u|iu|v|iv))?(?:\.mp4)?$/.test(value));
  if (take && /\/(?:deal\.|reveal\.)/.test(clip?.familyId ?? '')) {
    const name = take.replace(/\.mp4$/, '');
    return `${labelFromFamily(clip.familyId)} · ${name}`;
  }
  if (clip?.familyId?.includes('/idle.ready/')) {
    const path = clip?.relativePath ?? '';
    if (/idle_breath/.test(path)) return 'Andas lugnt';
    if (/idle_still/.test(path)) return 'Lugn blick';
  }
  const fromFamily = labelFromFamily(clip?.familyId, clip?.role);
  if (fromFamily) return fromFamily;
  const fromPath = labelFromPath(clip?.relativePath, clip?.role);
  if (fromPath) return fromPath;
  if (typeof clip?.label === 'string' && clip.label.trim()) return clip.label;
  if (id.trim()) return id.trim();
  return 'Klipp';
}

// Display only: retain the original situation in select values and callbacks.
export function clipSituationLabel(eventId, situation) {
  if (/^box[0-6]$/.test(situation)) return situationText(situation);
  if (eventId === 'reveal.dealer' && situation === 'dealer-hole') return 'Dealer · vänd dolt kort';
  if (situation === 'dealer-up') return 'Dealer · öppet kort';
  if (situation === 'dealer-hole') return 'Dealer · dolt kort';
  if (eventId === 'idle.ready') return 'Grundloop';
  if (situation === 'to-shoe') return 'Till skon';
  if (situation === 'from-shoe') return 'Från skon';
  const label = situationText(situation);
  return label ? label[0].toLocaleUpperCase('sv') + label.slice(1) : eventId;
}
