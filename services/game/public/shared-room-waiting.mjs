// K6 full table: a viewer without a seat at a full table waits for one. The server counts a registration for
// FULL_TABLE.waitingMs (30 s, games/blackjack/table/coordinator.mjs) and, while one counts, leaves each player at
// most three boxes after the round. This renews it every WAIT_REFRESH_MS while the shown table stays full and the
// viewer has no seat. The WebSocket only reads, so the registration is an HTTP command (`wait`). It has its own
// command client, created on first use, so a lost reply never holds the player's own controls; `wait` is
// idempotent, so a lost one is simply sent again at the next renewal.
export const WAIT_REFRESH_MS = 10000;
export const WAITING_TEXT = 'Väntar på plats';

/** A viewer with no seat at a full table who is not on a pause. */
export function waitingForSeat(snapshot, at = snapshot?.serverNow ?? 0) {
  const s = snapshot;
  return Boolean(s?.me && Array.isArray(s.me.seats) && Array.isArray(s.owners) && s.owners.length === 7
    && s.me.seats.length === 0 && s.owners.every(owner => owner !== null) && !(s.me.pausedUntil > at));
}

/** state() returns the controller's {snapshot, connected, closed}; update() follows each restored snapshot. */
export function createSharedRoomWaiting({ roomId, createCommands, state, now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id), refreshMs = WAIT_REFRESH_MS }) {
  if (typeof roomId !== 'string' || typeof createCommands !== 'function' || typeof state !== 'function'
    || !Number.isSafeInteger(refreshMs) || refreshMs < 1) throw new TypeError('shared_room_invalid_waiting');
  let commands = null, timer = null, sending = false, stopped = false, sentAt = -Infinity;
  const due = () => {
    if (stopped) return false;
    const value = state();
    return Boolean(value && !value.closed && value.connected && waitingForSeat(value.snapshot));
  };
  const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
  function arm() {
    cancel();
    if (!sending && due()) timer = setTimer(send, Math.max(0, sentAt + refreshMs - now()));
  }
  async function send() {
    timer = null;
    if (sending || !due()) return;
    sending = true; sentAt = now();
    try {
      // A client left uncertain by a lost reply is replaced: the next wait is a new command.
      if (commands?.state !== 'idle') { commands?.stop(); commands = createCommands({ roomId }); }
      const reply = await commands.send({ op: 'wait' });
      // A refused sign-in or room access ends the waiting; the socket reports the session itself.
      if (reply?.status === 'rejected' && (reply.httpStatus === 401 || reply.httpStatus === 403)) stopped = true;
    } catch { /* The next renewal sends a new command. */ }
    finally { sending = false; arm(); }
  }
  return Object.freeze({
    update() { if (timer === null) arm(); else if (!due()) cancel(); },
    stop() { stopped = true; cancel(); commands?.stop(); commands = null; },
  });
}
