// Production random port for core.mjs: the same CSPRNG calls Kevin's engine made inline
// (crypto.getRandomValues per shuffle sample, randomBytes(32) nonce, randomUUID ids).
// Reproducible sources exist only as test fixtures and are never a fallback here.
import { getRandomValues, randomBytes, randomUUID } from 'node:crypto';

export function secureRandom() {
  return Object.freeze({
    uint32() { return getRandomValues(new Uint32Array(1))[0]; },
    nonce() { return randomBytes(32).toString('hex'); },
    uuid() { return randomUUID(); },
  });
}
