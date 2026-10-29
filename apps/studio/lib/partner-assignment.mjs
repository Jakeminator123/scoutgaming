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
import { effectivePartnerAdjustments, partnerLayerChoices } from './partner-package-view.mjs';

export const PARTNER_ASSIGNMENT_KEY = 'assignment';
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
