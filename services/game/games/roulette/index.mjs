// Server-only roulette outcome generator. Room lifecycle, persistence and
// transport belong to the caller; this module never starts a timer or server.
import crypto from 'node:crypto';

export const ROULETTE_RULES = Object.freeze({
  variant: 'european-single-zero',
  minNumber: 0,
  maxNumber: 36,
  pocketCount: 37,
});

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const contextFields = ['operatorId', 'roomId', 'roundId'];
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);

/** Describe a pocket, without drawing or evaluating any bets. */
export function describePocket(number) {
  if (!Number.isInteger(number) || Object.is(number, -0) || number < 0 || number > 36) {
    throw new RangeError('Roulette number must be an integer from 0 to 36');
  }
  return Object.freeze({ number, color: number === 0 ? 'green' : redNumbers.has(number) ? 'red' : 'black' });
}

/**
 * Draw one independent outcome for a NEW round whose bets are already closed.
 * Context must come from the authenticated server, never directly from a client.
 * Every call draws again: persist once under (operatorId, roomId, roundId), then
 * replay the stored event for retries. Call under the room's transaction/lock.
 */
export function createSpinResult(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new TypeError('Roulette context is required');
  }
  const { operatorId, roomId, roundId } = context;
  const scope = { operatorId, roomId, roundId };
  for (const field of contextFields) {
    if (!validId(scope[field])) throw new TypeError(`Invalid roulette ${field}`);
  }
  // Reject seed, forced result, weights, variant and other accidental controls.
  if (Object.keys(context).some(key => !contextFields.includes(key))) {
    throw new TypeError('Unknown roulette context field');
  }
  // Node's crypto.randomInt uses an exclusive upper bound and avoids modulo bias.
  // Entropy failures propagate; there is no Math.random or cached-outcome fallback.
  const outcome = describePocket(crypto.randomInt(0, ROULETTE_RULES.pocketCount));
  return Object.freeze({
    schemaVersion: 1,
    type: 'roulette.spin.resolved',
    eventId: crypto.randomUUID(),
    game: 'roulette',
    variant: ROULETTE_RULES.variant,
    ...scope,
    occurredAt: new Date().toISOString(),
    outcome,
  });
}
