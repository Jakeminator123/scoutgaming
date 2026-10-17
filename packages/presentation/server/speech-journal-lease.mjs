import { randomUUID } from 'node:crypto';
import { GPU_RESERVATION_WINDOW_MS } from '../contracts/speech-journal-constants.mjs';

const fail = (code, statusCode = 503) => { throw Object.assign(new Error(code), { code, statusCode }); };
export function requireSpeechJournal(journal) {
  if (!journal || ['findRequest', 'acquireLease', 'renewLease', 'releaseLease', 'claimRequest',
    'getCompletedPackageById',
    'markRequestSubmissionStarted', 'completeRequest', 'failRequest', 'getBudgetPolicy',
    'listRecoverableSessions', 'reserveSession', 'markSubmissionStarted', 'attachJob',
    'markSubmissionUncertain', 'requestCancel', 'recordProviderStatus', 'confirmWorkerDrained',
    'retireExpiredMissingSession'].some(name => typeof journal[name] !== 'function')) fail('generated_speech_journal_unavailable');
  return journal;
}

// A lease is acquired on explicit demand, never at construction. An expired
// fence cannot become a new paid owner implicitly. Only known GPU recovery is
// allowed to adopt an expired lease, and that lease cannot submit paid work.
export function createSpeechJournalLease({ journal, resource, holderId = `speech-${randomUUID()}` }) {
  requireSpeechJournal(journal);
  let lease = null, pending = null;
  return Object.freeze({
    get({ recover = false } = {}) {
      if (pending) return pending;
      pending = (async () => {
        if (lease) lease = await journal.renewLease({ lease, ttlMs: GPU_RESERVATION_WINDOW_MS });
        else {
          try { lease = await journal.acquireLease({ resource, holderId, ttlMs: GPU_RESERVATION_WINDOW_MS }); }
          catch (error) {
            if (!recover || resource !== 'stream-session' || error.code !== 'generated_speech_recovery_required') throw error;
            lease = await journal.acquireLease({ resource, holderId, ttlMs: GPU_RESERVATION_WINDOW_MS, recoveryOnly: true });
          }
        }
        return lease;
      })().finally(() => { pending = null; });
      return pending;
    },
    async release() {
      if (pending) await pending;
      if (lease) { await journal.releaseLease({ lease }); lease = null; }
    },
    current: () => lease,
  });
}
