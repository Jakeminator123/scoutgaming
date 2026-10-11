import { createHash, randomUUID } from 'node:crypto';
// Only authenticated server projections enter here. Never use headers or body actor fields.
// Legacy trusted adapters without accountId get a stable pseudonym, never a raw email.
const requests = new WeakMap();
export function operatorAuditContext(identity, action, requestId) {
  if (!requestId) {
    requestId = requests.get(identity);
    if (!requestId) { requestId = randomUUID(); requests.set(identity,requestId); }
  }
  const value = identity?.accountId ?? identity?.account?.userId;
  const actorId = typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value)
    ? value : 'actor-' + createHash('sha256').update(String(identity?.user ?? '')).digest('hex');
  const accessClass = identity?.accessClass === 'internal-admin' || identity?.role === 'admin'
    ? 'internal-admin' : identity?.accessClass === 'activation' ? 'activation' : 'partner';
  return { actorId, accessClass, requestId, ...(action ? { action } : {}) };
}
