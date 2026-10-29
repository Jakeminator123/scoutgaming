// Tilldelningen (ADMIN-FORENKLING 5.3): det Admin har gett bolaget i det
// publicerade paketet. Spel, dealers, scenmallar, bordsgrafik, bakgrunder,
// insatsprofiler och `allow`, det bolaget själv får ändra. Datamodellen ändras
// inte: Admins egna val ligger i paketets branding under `assignment`
// ({ allow, limitPresets, languages }), som partnerns utseendeutkast aldrig kan
// skriva (partner-branding-api.mjs tar bara PARTNER_BRANDING_FIELDS).
//
// `allow` kan bara smalna av, aldrig vidga, det den frysta scenmallen tillåter:
// dealer, bordsgrafik och bakgrund kräver dessutom att mallens
// operatorAdjustable ger bolaget lagret. Språk, insatsprofil och paus finns
// inte i mallen och är stängda tills Admin uttryckligen ger dem.
import { materialLabel } from '../../../packages/presentation/contracts/material-catalog.mjs';
import { ROOM_LIMIT_PRESETS } from '../../../packages/presentation/contracts/room-game-config.mjs';
import { PARTNER_ASSIGNMENT_KEY } from '../../../packages/presentation/server/presentation-package.mjs';
import { effectivePartnerAdjustments, partnerLayerChoices } from './partner-package-view.mjs';

export { PARTNER_ASSIGNMENT_KEY };
export const PARTNER_ALLOW_KEYS = Object.freeze(['dealer', 'tableAsset', 'background', 'language', 'limit', 'pause']);
// Samma språk som validateRoomGameConfig godtar.
export const PARTNER_LANGUAGES = Object.freeze(['en', 'sv']);
const LAYER_TOKENS = Object.freeze({ dealer: 'dealer', tableAsset: 'table', background: 'background' });

function stated(pack) {
  const value = pack?.branding?.[PARTNER_ASSIGNMENT_KEY];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function knownList(value, known) {
  return Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && known.includes(item)))] : null;
}

export function partnerAllow(pack, presentation) {
  const given = stated(pack).allow;
  const allow = given && typeof given === 'object' && !Array.isArray(given) ? given : {};
  const lanes = presentation?.lanes ?? [];
  return Object.freeze(Object.fromEntries(PARTNER_ALLOW_KEYS.map(key => {
    const token = LAYER_TOKENS[key];
    if (token) return [key, allow[key] !== false && lanes.some(lane => effectivePartnerAdjustments(lane).includes(token))];
    return [key, allow[key] === true];
  })));
}

// Snapshotens tilldelning (partner-data.mjs). Insatsprofilerna är Admins
// uttryckliga lista, annars de profiler bolagets spelbord har publicerade.
export function partnerAssignment(pack, presentation, settings = new Map()) {
  const label = (id, role) => { const asset = presentation?.assets?.find(item => item.id === id && item.role === role); return asset ? materialLabel(asset) : id; };
  const materials = role => [...new Set((presentation?.lanes ?? []).flatMap(lane => partnerLayerChoices(lane, role)))].map(id => ({ id, label: label(id, role) }));
  const dealers = presentation?.registeredDealers?.length ? presentation.registeredDealers.map(dealer => ({ id: dealer.id, label: dealer.label ?? dealer.id }))
    : [...new Set((presentation?.lanes ?? []).flatMap(lane => lane.layers?.dealer?.allowed ?? []))].map(id => ({ id, label: id }));
  const limitPresets = knownList(stated(pack).limitPresets, Object.keys(ROOM_LIMIT_PRESETS))
    ?? [...new Set([...settings.values()].map(row => row.limitPreset))].sort();
  return {
    games: [...(Array.isArray(pack?.games) ? pack.games : [])],
    dealers, lanes: (presentation?.lanes ?? []).map(lane => ({ id: lane.id, label: lane.label })),
    backgrounds: materials('background'), tables: materials('table'),
    ...(limitPresets.length ? { limitPresets } : {}),
  };
}

// Admins fält (Bolag › Tilldelat): vad scenmallarna i paketet ger bolaget
// (dealer, bordsgrafik, bakgrund), det Admin uttryckligen sagt och valen att
// välja bland. null utan fryst presentation i paketet.
export const ASSIGNMENT_LIMIT_PRESETS = Object.freeze(Object.keys(ROOM_LIMIT_PRESETS));
function laneLayers(presentation) {
  const lanes = presentation?.lanes ?? [];
  return Object.fromEntries(Object.entries(LAYER_TOKENS).map(([key, token]) => [key, lanes.some(lane => effectivePartnerAdjustments(lane).includes(token))]));
}
export function adminAssignmentView(pack, presentation) {
  if (!presentation) return null;
  const given = stated(pack);
  return {
    allow: partnerAllow(pack, presentation),
    adjustable: laneLayers(presentation),
    limitPresets: knownList(given.limitPresets, ASSIGNMENT_LIMIT_PRESETS) ?? [],
    languages: knownList(given.languages, PARTNER_LANGUAGES) ?? [...PARTNER_LANGUAGES],
    options: { limitPresets: [...ASSIGNMENT_LIMIT_PRESETS], languages: [...PARTNER_LANGUAGES] },
  };
}

// Admins skrivning av `assignment`: exakt { allow, limitPresets, languages }.
// allow har alla sex nycklar som ja/nej; dealer, bordsgrafik och bakgrund får
// bara vara ja om scenmallen ger bolaget lagret (smalnar av, vidgar aldrig).
// Listorna är kända, unika värden; ett upplåst val kräver minst ett alternativ.
export function validateAdminAssignment(value, presentation) {
  const reject = () => { throw Object.assign(new Error('assignment_invalid'), { statusCode: 422 }); };
  const plainObject = item => item && typeof item === 'object' && !Array.isArray(item) && Object.getPrototypeOf(item) === Object.prototype;
  const sameKeys = (item, keys) => plainObject(item) && Object.keys(item).sort().join(',') === [...keys].sort().join(',');
  if (!presentation || !sameKeys(value, ['allow', 'limitPresets', 'languages']) || !sameKeys(value.allow, PARTNER_ALLOW_KEYS)) reject();
  if (PARTNER_ALLOW_KEYS.some(key => typeof value.allow[key] !== 'boolean')) reject();
  const layers = laneLayers(presentation);
  if (Object.keys(LAYER_TOKENS).some(key => value.allow[key] && !layers[key])) reject();
  const list = (items, known) => {
    if (!Array.isArray(items) || items.length > known.length || new Set(items).size !== items.length
      || items.some(item => typeof item !== 'string' || !known.includes(item))) reject();
    return known.filter(item => items.includes(item));
  };
  const limitPresets = list(value.limitPresets, ASSIGNMENT_LIMIT_PRESETS), languages = list(value.languages, PARTNER_LANGUAGES);
  if (value.allow.limit && !limitPresets.length || value.allow.language && !languages.length) reject();
  return { allow: Object.fromEntries(PARTNER_ALLOW_KEYS.map(key => [key, value.allow[key]])), limitPresets, languages };
}

// Hela tilldelningen för läs-API:t och skrivvägarnas kontroll: alltid med
// insatsprofiler, språk och `allow`.
export function partnerAssignmentDetail(pack, presentation, settings = new Map()) {
  const base = partnerAssignment(pack, presentation, settings);
  return {
    ...base,
    limitPresets: base.limitPresets ?? [],
    languages: knownList(stated(pack).languages, PARTNER_LANGUAGES) ?? [...PARTNER_LANGUAGES],
    allow: partnerAllow(pack, presentation),
  };
}
