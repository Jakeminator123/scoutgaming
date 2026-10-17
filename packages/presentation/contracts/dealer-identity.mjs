// Identity syntax is shared. BASE_DEALER_IDS is only a historical storage contract.
// Runtime registration and playable media come from the saved presentation.
export const BASE_DEALER_IDS = Object.freeze(['vera', 'astrid', 'amira', 'mei']);
export const MAX_DEALERS = 32;
// Retired product identities remain valid in historical documents and trash.
const retired = new Set(['vera', 'mei', 'amira', 'johanna']);
const reserved = new Set(['constructor', 'prototype', 'admin', 'api', 'auth', 'control', 'game', 'site', 'runtime', 'media', 'login', 'logout', 'partner', 'play', 'studio', 'set-password']);
export function isDealerId(value) {
  return typeof value === 'string' && value.length <= 40 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !reserved.has(value);
}
export function isActiveDealerId(value) { return isDealerId(value) && !retired.has(value); }
export function isRegisteredDealer(project, dealerId) {
  return isDealerId(dealerId) && Array.isArray(project?.dealers) && project.dealers.some(row => row?.id === dealerId);
}
export function registeredDealerIds(project) {
  if (!Array.isArray(project?.dealers) || project.dealers.length > MAX_DEALERS) throw new Error('Invalid dealer registry');
  const ids = project.dealers.map(row => row?.id);
  if (ids.some(id => !isDealerId(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid dealer registry');
  return new Set(ids);
}

// Public metadata carries display names; it grants no server registration.
export function validatePublicRegisteredDealers(value) {
  if (!Array.isArray(value) || value.length > MAX_DEALERS) throw Error('Invalid dealer registry');
  const ids = new Set();
  return value.map(row => {
    if (!row || Object.keys(row).sort().join(',') !== 'id,label' || !isDealerId(row.id)
      || !isActiveDealerId(row.id) || ids.has(row.id) || typeof row.label !== 'string'
      || !row.label.trim() || row.label.length > 120 || /[\u0000-\u001f\u007f-\u009f]/u.test(row.label)) throw Error('Invalid dealer registry');
    ids.add(row.id); return { id: row.id, label: row.label };
  });
}
