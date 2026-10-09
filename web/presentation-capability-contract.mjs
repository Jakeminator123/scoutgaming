// Portable feature metadata shared by the endpoint, native preflight and UI.
// It grants no dealer registration, media ownership or package authorization.
export const PRESENTATION_CAPABILITY_VERSION_HEADER = 'X-Presentation-Capability-Version';
export const PRESENTATION_CAPABILITY_DEFAULT_VERSION = 2;
const legacyDealerIds = Object.freeze(['nora']);
const common = { registeredDealerIds: legacyDealerIds, compositing: 'per-clip' };
const contracts = Object.freeze({
  1: Object.freeze({ schemaVersion: 1, ...common }),
  2: Object.freeze({ schemaVersion: 2, ...common, rooms: 'operator-owned-v2' }),
  3: Object.freeze({ schemaVersion: 3, ...common, rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' }),
});
function failure(code, statusCode) { return Object.assign(new Error(code), { code, statusCode }); }
const invalid = () => { throw failure('presentation_capability_invalid', 503); };
function version(value) {
  if (!Number.isInteger(value) || ![1, 2, 3].includes(value)) invalid();
  return value;
}

// v1 is read compatibility for older deployments. The current endpoint keeps
// its v2 representation unless a caller explicitly negotiates v3. Malformed,
// duplicate or unsupported version headers never silently choose another version.
export function negotiatePresentationCapabilityVersion(header) {
  if (header === null || header === undefined) return PRESENTATION_CAPABILITY_DEFAULT_VERSION;
  if (header === '2') return 2;
  if (header === '3') return 3;
  throw failure('presentation_capability_version_unsupported', 406);
}
export function presentationCapabilitiesForVersion(requestedVersion) {
  return contracts[version(requestedVersion)];
}

// Validate an already parsed, bounded payload. HTTP status, redirects, content
// type, response size, trusted origin and authentication stay with the caller.
export function validatePresentationCapabilities(value, { expectedVersion } = {}) {
  if (expectedVersion !== undefined) version(expectedVersion);
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const names = Object.getOwnPropertyNames(value);
  if (Object.getOwnPropertySymbols(value).length || names.length !== Object.keys(value).length
    || names.some(name => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, name), 'value'))) invalid();
  const contract = presentationCapabilitiesForVersion(value.schemaVersion);
  if (expectedVersion !== undefined && value.schemaVersion !== expectedVersion) invalid();
  const keys = Object.keys(contract);
  if (names.length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
  if (!Array.isArray(value.registeredDealerIds) || Object.getPrototypeOf(value.registeredDealerIds) !== Array.prototype
    || value.registeredDealerIds.length !== 1 || Object.keys(value.registeredDealerIds).join(',') !== '0'
    || Object.getOwnPropertyNames(value.registeredDealerIds).sort().join(',') !== '0,length'
    || Object.getOwnPropertySymbols(value.registeredDealerIds).length
    || !Object.hasOwn(Object.getOwnPropertyDescriptor(value.registeredDealerIds, '0'), 'value')
    || value.registeredDealerIds[0] !== 'nora') invalid();
  for (const key of keys) if (key !== 'registeredDealerIds' && value[key] !== contract[key]) invalid();
  // Return immutable server-authored feature metadata, never caller-owned data.
  // The legacy Nora list is not the saved/frozen registry authority for v3.
  return contract;
}
