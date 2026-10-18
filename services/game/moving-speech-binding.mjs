const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const AVATAR = /^[a-z][a-z0-9-]{0,39}$/;
export const MOVING_ATTESTATION_KEYS = Object.freeze(['schemaVersion', 'releaseSha256', 'dealerId', 'workerAvatar',
  'profileRevision', 'sourceSetSha256', 'avatarSha256', 'bankReceiptSha256', 'sessionId', 'attemptId', 'nonce']);

// Trusted server evidence. The worker must echo it together with our saved job ID.
export function verifyMovingSpeechBinding(value, plan) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== MOVING_ATTESTATION_KEYS.length
    || MOVING_ATTESTATION_KEYS.some(key => !Object.hasOwn(value, key)) || value.schemaVersion !== 1
    || ['releaseSha256', 'profileRevision', 'sourceSetSha256', 'avatarSha256', 'bankReceiptSha256', 'nonce']
      .some(key => typeof value[key] !== 'string' || !HASH.test(value[key]))
    || ['dealerId', 'workerAvatar'].some(key => typeof value[key] !== 'string' || !AVATAR.test(value[key]))
    || ['sessionId', 'attemptId'].some(key => typeof value[key] !== 'string' || !ID.test(value[key]))
    || (plan && ['dealerId', 'workerAvatar', 'profileRevision', 'avatarSha256', 'sessionId']
      .some(key => value[key] !== plan.binding[key]))) throw Error('moving_worker_binding_invalid');
  return Object.freeze(Object.fromEntries(MOVING_ATTESTATION_KEYS.map(key => [key, value[key]])));
}
