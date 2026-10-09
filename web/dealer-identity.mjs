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
