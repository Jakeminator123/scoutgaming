import { MEDIA_FAMILY_DEFINITIONS } from '../../presentation-runtime/media-families.mjs';

// Display names only. Never rename files, hashes or family ids.
const ACTIONS = {
  deal: 'Deal',
  reveal: 'Reveal',
  speak: 'Tal',
  idle: 'Idle',
  turn: 'Tur',
  settle: 'Resultat',
};
const SEATS = {
  'player.left': 'spelare vänster',
  'player.centre': 'spelare mitten',
  'player.center': 'spelare mitten',
  'player.right': 'spelare höger',
};
const SITUATIONS = {
  'dealer-hole': 'dealerns hålkort',
  'dealer-up': 'dealerns öppna kort',
  ready: 'redo',
  goodluck: 'lycka till',
  insurance: 'försäkring',
  double: 'dubbling',
  blackjack: 'blackjack',
  bust: 'bust',
  chatter1: 'prat 1',
  chatter2: 'prat 2',
  dealerblackjack: 'dealerns blackjack',
  dealerbust: 'dealer bust',
  farewell: 'avsked',
  greeting: 'hälsning',
  lose: 'förlust',
  peek: 'titt',
  placebets: 'lägg insatser',
  push: 'push',
  sidebet: 'sidospel',
  win: 'vinst',
};

const situationText = situation => {
  if (Object.hasOwn(SITUATIONS, situation)) return SITUATIONS[situation];
  // Studio shows box0 as plats 1 (mediaSituationLabel and the hand row both add 1).
  const box = /^box([0-6])$/.exec(situation);
  if (box) return `box ${Number(box[1]) + 1}`;
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

// overrides is the project's clipLabels map (clip id → text), not the whole project.
export function clipLabel(clip, overrides) {
  const id = clip && typeof clip.id === 'string' ? clip.id : '';
  const override = overrides && id && typeof overrides[id] === 'string' ? overrides[id] : '';
  if (override.trim() && override.length <= 80 && !/[\u0000-\u001f\u007f]/.test(override)) return override;
  const fromFamily = labelFromFamily(clip?.familyId, clip?.role);
  if (fromFamily) return fromFamily;
  const fromPath = labelFromPath(clip?.relativePath, clip?.role);
  if (fromPath) return fromPath;
  if (id.trim()) return id.trim();
  return 'Klipp';
}
