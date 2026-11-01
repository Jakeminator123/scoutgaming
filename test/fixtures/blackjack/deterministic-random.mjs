// Reproducible random port for blackjack core tests only (SHA-256 counter stream).
// Never import this from production code: it is predictable by design.
import { createHash } from 'node:crypto';

export function deterministicRandom(seed) {
  let counter = 0, pool = Buffer.alloc(0);
  const take = n => {
    while (pool.length < n) pool = Buffer.concat([pool, createHash('sha256').update(`${seed}:${counter++}`).digest()]);
    const out = Buffer.from(pool.subarray(0, n));
    pool = pool.subarray(n);
    return out;
  };
  return {
    uint32: () => take(4).readUInt32BE(0),
    nonce: () => take(32).toString('hex'),
    uuid: () => {
      const b = take(16);
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const h = b.toString('hex');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  };
}
