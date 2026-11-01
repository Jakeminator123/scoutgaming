import { setTimeout as pause } from 'node:timers/promises';
import { createJournalSpeechSessionManager } from './speech-journal-runtime.mjs';
import { requireSpeechJournal } from '../../packages/presentation/server/speech-journal-lease.mjs';

export const SPEECH_SESSION_POLICY = Object.freeze({
  seconds: 540, executionTimeout: 600000, ttl: 660000,
  admissionWindowMs: 180000,
  // Includes the bounded session, drain and shutdown allowance. Reserve the
  // full configured cost on both days when this window crosses UTC midnight.
  reservationWindowMs: 720000, dailyMicroUsd: 20000000, reserveMicroUsd: 10000000,
});
const jobIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const token = value => typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/\s/.test(value);
const fail = (code, statusCode = 503) => { throw Object.assign(new Error(code), { code, statusCode }); };
function parseMicroUsd(value, maximum) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
  return amount > 0 && amount <= maximum ? amount : null;
}
export const sessionReserveMicroUsd = value => parseMicroUsd(value, SPEECH_SESSION_POLICY.reserveMicroUsd);
export const dailyBudgetMicroUsd = value => parseMicroUsd(value, SPEECH_SESSION_POLICY.dailyMicroUsd);

/** Starts nothing at construction/startup. One verified conversation request
 * may create one bounded GPU session; subsequent utterances reuse it. Budget
 * reservations are immutable, conservative, never automatically refunded.
 * reserveUsd must include actual GPU rate, startup/idle/storage and margin.
 */
export function createSpeechSessionManager(configuration, {
  workerState, stopWorker = () => {}, fetchImpl = fetch, now = Date.now,
  sleep = (ms, signal) => pause(ms, undefined, { signal }),
  // A cold worker also prepares the selected avatar. Use the existing
  // admission window; playback and provider execution limits stay separate.
  readyTimeoutMs = SPEECH_SESSION_POLICY.admissionWindowMs, pollMs = 500, idleTimeoutMs = 60000,
  journal = null, leaseManager,
} = {}) {
  requireSpeechJournal(journal);
  const { apiKey, endpointId, workerSecret, origin, reserveUsd, dailyBudgetUsd } = configuration ?? {};
  const reserveMicroUsd = sessionReserveMicroUsd(reserveUsd);
  const dailyBudgetMicroUsd = parseMicroUsd(dailyBudgetUsd, SPEECH_SESSION_POLICY.dailyMicroUsd);
  let url;
  try { url = new URL(origin); } catch {}
  if (!token(apiKey) || !jobIdPattern.test(endpointId ?? '')
    || !token(workerSecret) || workerSecret.length < 32 || !reserveMicroUsd || !dailyBudgetMicroUsd
    || reserveMicroUsd > dailyBudgetMicroUsd || !workerState
    || url?.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail('generated_speech_session_not_configured');
  }
  return createJournalSpeechSessionManager(configuration, { journal, leaseManager, workerState, stopWorker,
    fetchImpl, now, sleep, readyTimeoutMs, pollMs, idleTimeoutMs, policy:SPEECH_SESSION_POLICY, reserveMicroUsd, dailyBudgetMicroUsd });
}
