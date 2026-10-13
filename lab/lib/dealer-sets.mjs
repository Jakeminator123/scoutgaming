// Authoring categories only. Set names never register a dealer, choose playback
// media or identify an immutable published package version.
const SET_ID = /^[a-z][a-z0-9-]{0,63}$/;
const CLIP_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function dealerSetErrors(value, dealerIds) {
  if (!Array.isArray(value) || value.length > 64) return ['dealerSets: ska ha 0–64 kategorier'];
  const errors = [], ids = new Set(); let count = 0;
  for (const [index, set] of value.entries()) {
    const at = `dealerSets[${index}]`;
    if (!record(set) || Object.keys(set).sort().join(',') !== 'archived,clipIds,dealerId,id,name') { errors.push(`${at}: ogiltiga kategorifält`); continue; }
    if (typeof set.id !== 'string' || !SET_ID.test(set.id) || ids.has(set.id)) errors.push(`${at}.id: ogiltigt eller dubblerat kategori-id`);
    ids.add(set.id);
    if (typeof set.name !== 'string' || !set.name.trim() || set.name !== set.name.trim() || set.name.length > 120) errors.push(`${at}.name: välj ett namn med 1–120 tecken`);
    if (!dealerIds.has(set.dealerId)) errors.push(`${at}.dealerId: kategorin måste tillhöra en aktiv registrerad dealer`);
    if (typeof set.archived !== 'boolean') errors.push(`${at}.archived: ska vara true eller false`);
    if (!Array.isArray(set.clipIds) || set.clipIds.length > 512 || new Set(set.clipIds).size !== set.clipIds.length
      || set.clipIds.some(id => typeof id !== 'string' || !CLIP_ID.test(id) || id.includes('..') || id.includes('://') || /^[A-Za-z]:\//.test(id))) errors.push(`${at}.clipIds: välj högst 512 unika exakta media-id`);
    else count += set.clipIds.length;
  }
  if (count > 5000) errors.push('dealerSets: högst 5000 medlemskap totalt');
  return errors;
}
function checked(project, sets) {
  if (dealerSetErrors(sets, new Set(project.dealers.map(row => row.id))).length) fail('studio_dealer_set_invalid');
  return { ...structuredClone(project), dealerSets: structuredClone(sets) };
}
export function createDealerSet(project, { id, name, dealerId, clipIds = [] }) {
  return checked(project, [...(project.dealerSets ?? []), { id, name: name.trim(), dealerId, clipIds, archived: false }]);
}
export function editDealerSet(project, id, patch) {
  if (!record(patch) || Object.keys(patch).some(key => !['name', 'clipIds', 'archived'].includes(key))) fail('studio_dealer_set_invalid');
  if (!project.dealerSets?.some(row => row.id === id)) fail('studio_dealer_set_missing');
  return checked(project, project.dealerSets.map(row => row.id === id ? { ...row, ...patch, ...(typeof patch.name === 'string' ? { name: patch.name.trim() } : {}) } : row));
}
export function removeDealerSet(project, id) {
  if (!project.dealerSets?.some(row => row.id === id)) fail('studio_dealer_set_missing');
  // Removing this label/membership never mutates media, dealer or compositions.
  const next = checked(project, project.dealerSets.filter(row => row.id !== id));
  if (!next.dealerSets.length) delete next.dealerSets;
  return next;
}
export function dealerSetsForClip(project, clipId) { return (project.dealerSets ?? []).filter(row => row.clipIds.includes(clipId)); }
export function validateDealerSetRecordOwners(project, records) {
  const media = new Map(records.map(row => [row.id, row]));
  if (media.size !== records.length) fail('studio_dealer_set_binding_invalid');
  for (const set of project.dealerSets ?? []) for (const id of set.clipIds) {
    const row = media.get(id);
    if (!row || row.classification?.dealerId !== set.dealerId || row.classification.archived || row.deletion) fail('studio_dealer_set_binding_invalid');
  }
}
export function validateDealerSetBindings(project, registry) {
  if (dealerSetErrors(project.dealerSets ?? [], new Set(project.dealers.map(row => row.id))).length) fail('studio_dealer_set_invalid');
  const videos = new Map(registry.videos.map(row => [row.id, row]));
  if (videos.size !== registry.videos.length) fail('studio_dealer_set_binding_invalid');
  for (const set of project.dealerSets ?? []) for (const id of set.clipIds) {
    const video = videos.get(id), owner = video?.classification?.dealerId ?? video?.dealer;
    if (!video || !video.classification || typeof video.revision !== 'string' || !video.revision || owner !== set.dealerId || video.dealer !== undefined && video.dealer !== owner
      || video.classification?.archived || video.deletion || video.available !== true || video.integrity === 'unavailable'
      || !/^[a-f0-9]{64}$/.test(video.sha256) || !Number.isSafeInteger(video.bytes) || video.bytes < 1) fail('studio_dealer_set_binding_invalid');
  }
}
