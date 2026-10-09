// Identity syntax is shared. Registration authority remains the saved project.
export const BASE_DEALER_IDS = Object.freeze(['vera', 'astrid', 'amira', 'mei']);
export const MAX_DEALERS = 32;
const reserved = new Set(['constructor', 'prototype', 'admin', 'api', 'auth', 'control', 'game', 'site', 'runtime', 'media', 'login', 'logout', 'partner', 'play', 'studio', 'set-password']);
export function isDealerId(value) {
  return typeof value === 'string' && value.length <= 40 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !reserved.has(value);
}
export function isRegisteredDealer(project, dealerId) {
  return isDealerId(dealerId) && Array.isArray(project?.dealers) && project.dealers.some(row => row?.id === dealerId);
}
export function registeredDealerIds(project) {
  if (!Array.isArray(project?.dealers) || project.dealers.length < BASE_DEALER_IDS.length || project.dealers.length > MAX_DEALERS) throw new Error('Invalid dealer registry');
  const ids = project.dealers.map(row => row?.id);
  if (ids.some(id => !isDealerId(id)) || new Set(ids).size !== ids.length || BASE_DEALER_IDS.some(id => !ids.includes(id))) throw new Error('Invalid dealer registry');
  return new Set(ids);
}

// Public metadata carries display names; it grants no server registration.
export function validatePublicRegisteredDealers(value) {
  if (!Array.isArray(value) || value.length > MAX_DEALERS) throw Error('Invalid dealer registry');
  const ids = new Set();
  return value.map(row => {
    if (!row || Object.keys(row).sort().join(',') !== 'id,label' || !isDealerId(row.id)
      || BASE_DEALER_IDS.includes(row.id) || ids.has(row.id) || typeof row.label !== 'string'
      || !row.label.trim() || row.label.length > 120 || /[\u0000-\u001f\u007f-\u009f]/u.test(row.label)) throw Error('Invalid dealer registry');
    ids.add(row.id); return { id: row.id, label: row.label };
  });
}
