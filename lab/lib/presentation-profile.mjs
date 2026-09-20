import contract from '../policies/studio-contract.json' with { type: 'json' };

// A display model over the existing contract, never a new event or playback schema.
export const OUTPUT_GROUPS = Object.freeze([
  Object.freeze({ id: 'idle', label: 'Idle / bakgrund', symbol: '◷', summary: 'Vänteläge mellan handlingar.', playback: 'Bakgrund i målbilden · preview spelas en gång' }),
  Object.freeze({ id: 'action', label: 'Handling / engång', symbol: '↗', summary: 'Dela eller visa ett bestämt kort.', playback: 'En handling · ingen loop' }),
  Object.freeze({ id: 'speech', label: 'Tal / exakt replik', symbol: '◌', summary: 'En publicerad spelreplik.', playback: 'Exakt talpaket · en gång' }),
  Object.freeze({ id: 'reaction', label: 'Tur / resultat', symbol: '✦', summary: 'Visa tur eller redan avgjort utfall.', playback: 'En markering eller reaktion' }),
]);

export function presentationProfile(sourceType) {
  const kind = contract.sourceTypes[sourceType]?.kind;
  return OUTPUT_GROUPS.find(group => group.id === kind) ?? null;
}

const field = (path, label, note, optional = false) => ({ path, label, note, optional });
const typeField = field('type', 'Presentationstyp', 'Källans tekniska typ.');
const cardField = field('card', 'Publicerat kort', 'Valör r och färg s; ett dolt kort visas som null.');
const drawField = field('shoeDraw', 'Drag-ID', 'Identifierar draget ur skon, inte kortets ordning i handen.');
const boxField = field('box', 'Bordsplats', 'Box 0–6 är plats 1–7. Detta är inget playerId.');
const handField = field('handIndex', 'Handindex', 'Index i rundans händer; en box kan ha flera händer.');
const FIELDS = {
  idle: [typeField],
  deal: [typeField, field('to', 'Mottagare', 'box eller dealer.'), boxField, handField, cardField,
    field('faceDown', 'Dolt kort', 'true döljer kortets valör och färg.'), drawField,
    field('clip.action', 'Delningsriktning', 'Källans riktning bevaras när uttrycket väljs.'),
    field('clip.prefer', 'Önskat klippmönster', 'Ett klippmönster från Partner API, inte labbets valda variant.'),
    field('clip.fallback', 'Källans reserv', 'Partner API anger slide; det är skilt från standardvarianten i labbet.')],
  reveal: [typeField, field('to', 'Mottagare', 'Det tidigare dolda croupierkortet.'), cardField, drawField],
  speak: [typeField, field('line', 'Exakt replik-ID', 'Ska motsvara samma text, ljud och synk i talpaketet.'),
    field('blocking', 'Blockerande replik', 'Publiceras som true för goodluck; saknas i flera andra repliker.', true)],
  turn: [typeField, boxField, handField, field('legalActions', 'Tillåtna spelhandlingar', 'Motorns redan beslutade alternativ.')],
  settle: [typeField, field('dealerTotal', 'Croupiersumma', 'Publicerad summa.'),
    field('dealerBlackjack', 'Croupier-blackjack', 'Publicerat utfall.'),
    field('hands', 'Resultat per hand', 'Partner API ger box, stake, returned och outcome. Labbexemplen saknar beloppen.')],
};

function atPath(object, path) {
  let value = object;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return { present: false, value: undefined };
    value = value[key];
  }
  return { present: true, value };
}

export function describeEventFields(event) {
  const descriptors = Object.hasOwn(FIELDS, event?.type) ? FIELDS[event.type] : [typeField];
  return descriptors.map(descriptor => {
    const found = atPath(event, descriptor.path);
    // Do not expose hidden card data in an inspector, even for a malformed input.
    if (descriptor.path === 'card' && event.faceDown === true && found.present) found.value = null;
    return { ...descriptor, ...found };
  });
}

export function formatEventValue(value) {
  if (value === undefined) return 'Saknas i detta exempel';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
