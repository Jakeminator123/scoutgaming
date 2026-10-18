// A revision check runs only before starting a new round. Existing cards,
// audio and presentation are left alone until that boundary. Refresh happens
// before the start command, so checking/reloading cannot place another bet.
export function createOperatorAppearanceBoundary({entry, request, refresh, isIdle = () => true} = {}) {
  if (typeof request !== 'function' || typeof refresh !== 'function' || typeof isIdle !== 'function') throw TypeError('Appearance boundary callbacks required');
  const enabled = Boolean(entry?.operator && Number.isSafeInteger(entry.packageRevision) && entry.packageRevision > 0);
  let pending = null, refreshing = false;
  return Object.freeze({
    beforeRound() {
      if (!isIdle() || refreshing) return Promise.resolve(false);
      if (!enabled) return Promise.resolve(true);
      if (pending) return pending;
      const query = new URLSearchParams({operator:entry.operator});
      if (entry.roomId) query.set('table',entry.roomId);
      else if (entry.lane) query.set('lane',entry.lane);
      pending = (async () => {
        const response = await request('/api/operator/appearance?' + query, {method:'GET', credentials:'same-origin', cache:'no-store', headers:{accept:'application/json'}});
        const value = await response.json().catch(() => null);
        if (!response.ok || value?.operator !== entry.operator || (value.roomId ?? null) !== (entry.roomId ?? null)
          || !Number.isSafeInteger(value?.packageRevision) || value.packageRevision < entry.packageRevision) {
          throw Error('Utseendet kunde inte kontrolleras. Dina valda insatser finns kvar. Försök igen.');
        }
        if (!isIdle()) return false;
        if (value.packageRevision === entry.packageRevision) return true;
        refreshing = true;
        try { await refresh(value.packageRevision); }
        catch (error) { refreshing = false; throw error; }
        return false;
      })().finally(() => { pending = null; });
      return pending;
    },
  });
}

const key = entry => 'croupier.appearance.pending-bets.' + entry.operator + '.' + (entry.roomId ?? entry.lane);
const validBets = (value, length) => Array.isArray(value) && value.length === length && value.every(row =>
  row && typeof row === 'object' && Object.keys(row).sort().join(',') === 'main,pp,tp'
  && ['main','pp','tp'].every(field => Number.isFinite(row[field]) && row[field] >= 0 && row[field] <= 1e9));
// These are unsubmitted UI selections only. The server still validates every
// amount and balance; restoring this state never starts a round automatically.
export function preserveAppearanceBets(storage, entry, revision, bets, now = Date.now()) {
  if (!validBets(bets,bets?.length) || !Number.isSafeInteger(revision) || revision <= entry.packageRevision) return false;
  try { storage.setItem(key(entry), JSON.stringify({revision, at:now, bets})); return true; } catch { return false; }
}
export function consumeAppearanceBets(storage, entry, length, now = Date.now()) {
  if (!entry?.operator || !entry.packageRevision) return null;
  try {
    const raw = storage.getItem(key(entry)); storage.removeItem(key(entry));
    const value = JSON.parse(raw);
    if (!Number.isSafeInteger(value?.revision) || value.revision > entry.packageRevision
      || !Number.isSafeInteger(value.at) || now < value.at || now - value.at > 600000 || !validBets(value.bets,length)) return null;
    return value.bets.map(row => ({...row}));
  } catch { return null; }
}
