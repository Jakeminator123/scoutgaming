import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// PR 4 (plan-chatt-tal-lipsync §3): one GPU session per room answer, any number of listeners. The relay is the
// worker's only consumer. It buffers ready, pcm and lapp chunks (at most maxFrames frames, at most lifetimeMs) and
// serves each room socket from that buffer with the same credit protocol as moving-speech-runtime stream(), each
// under its own single-use ticket. A listener that stops, lags or breaks the protocol never stops the others.
// recipient: {owner, playerId, signal?, check?(req)}: owner is the session the ticket is bound to (resolveOwner of
// the redeeming request must equal it), signal aborts with the room socket that got the ticket, check is the
// recipient's own (unlocked) freshness read. data is what the rest download needs (the runtime's evidence).
const fail = code => { throw Object.assign(Error(code), { code, statusCode: 403 }); };
const same = (a, b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const exactKeys = (value, keys) => Object.keys(value).sort().join(',') === keys;

export function createMovingSpeechRoomRelay({ ticketSecret, resolveOwner, now = Date.now, ticketMs = 15000, lifetimeMs = 60000,
  maxFrames = 600, maxBytes = 64 * 1024 * 1024, creditTimeoutMs = 12000, maxBufferedBytes = 4 * 1024 * 1024 } = {}) {
  if (typeof ticketSecret !== 'string' || ticketSecret.length < 32 || typeof resolveOwner !== 'function') fail('moving_speech_configuration');
  const sign = body => createHmac('sha256', ticketSecret).update(body).digest('base64url');
  const broadcasts = new Map();

  function open({ id, attemptId, nonce, planId, frames, owner, playerId, dealerId, data = null }) {
    if (typeof id !== 'string' || broadcasts.has(id) || !Number.isSafeInteger(frames) || frames < 1 || frames > maxFrames) fail('moving_speech_relay_invalid');
    const items = [], tickets = new Map(), listeners = new Set(), wakers = new Set(), closesAt = now() + lifetimeMs;
    let state = 'open', framesIn = 0, bytes = 0, settleTimer;
    const timer = setTimeout(() => close(), lifetimeMs); timer.unref?.();
    const wake = () => { for (const waker of [...wakers]) waker(); };
    function close() {
      if (state === 'closed') return;
      if (state === 'open') state = 'failed';
      const ended = state; state = 'closed'; b.ended = ended;
      clearTimeout(timer); clearTimeout(settleTimer); broadcasts.delete(id); tickets.clear();
      for (const listener of [...listeners]) listener.stop();
      for (const item of items) for (const [part, binary] of item.parts) if (binary) part.fill(0);
      items.length = 0; wake();
    }
    // Closes early once the answer is complete, nobody listens and no issued ticket can still be redeemed.
    function settle() {
      if (state !== 'done' || listeners.size) return;
      // A redeemed ticket counts until its socket attaches: the upgrade completes after redeem.
      const latest = Math.max(0, ...[...tickets.values()].filter(entry => !entry.attached).map(entry => entry.exp));
      clearTimeout(settleTimer);
      if (latest <= now()) { close(); return; }
      settleTimer = setTimeout(settle, latest - now() + 1); settleTimer.unref?.();
    }
    const b = {
      id, attemptId, nonce, planId, frames, owner, playerId, dealerId, data, items, listeners, wakers, tickets, redeemed: new Set(),
      get state() { return state; },
      push(parts, count = 0) {
        if (state !== 'open') return false;
        const copied = parts.map(([part, binary]) => [binary ? Buffer.from(part) : part, binary]);
        framesIn += count; bytes += copied.reduce((sum, [part]) => sum + Buffer.byteLength(part), 0);
        if (framesIn > frames || bytes > maxBytes) { close(); return false; }
        items.push({ parts: copied, frames: count }); wake(); return true;
      },
      end() { if (state === 'open') { state = 'done'; wake(); settle(); } },
      fail: close, close, settle,
      issue(recipient) {
        if (state === 'closed' || state === 'failed' || recipient?.signal?.aborted || typeof recipient?.owner !== 'string' || !recipient.owner
          || typeof recipient.playerId !== 'string') return null;
        const exp = Math.min(now() + ticketMs, closesAt);
        if (exp <= now()) return null;
        const r = randomBytes(16).toString('hex');
        const body = Buffer.from(JSON.stringify({ sessionId: id, exp, attemptId, nonce, r })).toString('base64url'), ticket = body + '.' + sign(body);
        tickets.set(r, { ticket, exp, recipient, used: false, attached: false });
        return Object.freeze({ ticket, expiresAt: exp });
      },
    };
    broadcasts.set(id, b);
    return b;
  }

  // Single use: a ticket is spent by its first redemption, even one that then fails the owner or freshness check.
  async function redeem(ticket, req) {
    const [body, signature, extra] = typeof ticket === 'string' && ticket.length <= 4096 ? ticket.split('.') : [];
    if (!body || extra !== undefined || !same(signature, sign(body))) fail('moving_speech_ticket');
    let claim; try { claim = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { fail('moving_speech_ticket'); }
    const b = broadcasts.get(claim?.sessionId), entry = b?.tickets.get(claim?.r);
    if (!b || !entry || entry.used || !same(ticket, entry.ticket) || entry.exp <= now() || !['open', 'done'].includes(b.state)
      || entry.recipient.signal?.aborted) fail('moving_speech_ticket');
    entry.used = true;
    try {
      if (!same(await resolveOwner(req, entry.recipient.playerId), entry.recipient.owner)) fail('moving_speech_owner_changed');
      await entry.recipient.check?.(req);
    } finally { b.settle(); }
    if (!['open', 'done'].includes(b.state) || entry.recipient.signal?.aborted) fail('moving_speech_ticket');
    b.redeemed.add(entry.recipient);
    return Object.freeze({ broadcast: b, recipient: entry.recipient, entry });
  }

  // Serves one listener from the buffer: an item with frames waits for that listener's credit.
  async function attach({ broadcast: b, recipient, entry }, ws) {
    const controller = new AbortController(), signal = controller.signal;
    let credit = 0, sent = 0, index = 0, wakeSelf = null;
    const listener = { stop: () => { controller.abort(); wakeSelf?.(); } };
    const fromSocket = () => listener.stop();
    entry.attached = true; b.listeners.add(listener);
    if (!['open', 'done'].includes(b.state)) listener.stop();
    recipient.signal?.addEventListener('abort', fromSocket, { once: true });
    ws.on('close', fromSocket); ws.on('error', fromSocket);
    ws.on('message', (data, binary) => {
      try {
        if (binary) fail('moving_speech_invalid_credit');
        const value = JSON.parse(data.toString('utf8'));
        if (value?.t === 'abort' && value.id === b.id && exactKeys(value, 'id,t')) { listener.stop(); return; }
        if (!value || value.t !== 'credit' || !exactKeys(value, 'frames,id,t') || value.id !== b.planId || !Number.isSafeInteger(value.frames)
          || value.frames < 1 || value.frames > 48 || credit + value.frames > 48 || sent + credit + value.frames > b.frames + 48) fail('moving_speech_invalid_credit');
        credit += value.frames; wakeSelf?.();
      } catch { listener.stop(); }
    });
    const pause = timeoutMs => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(Error('moving_speech_credit_timeout')), timeoutMs);
      const finish = error => { clearTimeout(timeout); b.wakers.delete(waker); wakeSelf = null; error ? reject(error) : resolve(); };
      const waker = () => finish(); wakeSelf = waker; b.wakers.add(waker);
      if (signal.aborted) finish();
    });
    const send = (value, binary) => new Promise((resolve, reject) => {
      if (ws.readyState !== 1 || ws.bufferedAmount + Buffer.byteLength(value) > maxBufferedBytes) { reject(Error('moving_speech_client_backpressure')); return; }
      ws.send(value, { binary }, error => error ? reject(Error('moving_speech_client_closed')) : resolve());
    });
    try {
      for (;;) {
        signal.throwIfAborted();
        if (index < b.items.length) {
          const item = b.items[index];
          if (credit < item.frames) { await pause(creditTimeoutMs); continue; }
          credit -= item.frames; sent += item.frames; index++;
          for (const [part, binary] of item.parts) await send(part, binary);
          continue;
        }
        if (b.state === 'done') break;
        if (b.state !== 'open') fail('moving_speech_unavailable');
        await pause(lifetimeMs);
      }
      ws.close(1000, 'Complete');
      const drain = setTimeout(() => ws.terminate(), 2000); drain.unref?.(); ws.once('close', () => clearTimeout(drain));
    } catch {
      if (ws.readyState === 1) await send(JSON.stringify({ t: 'error', code: 'moving_speech_unavailable' }), false).catch(() => {});
      ws.terminate();
    } finally {
      b.listeners.delete(listener); recipient.signal?.removeEventListener('abort', fromSocket); b.settle();
    }
  }

  // The rest frame is downloaded by a listener that has redeemed its ticket, with its own session.
  async function authorizeRest(id, req) {
    const b = broadcasts.get(id);
    if (!b || !['open', 'done'].includes(b.state)) fail('moving_speech_rest_unavailable');
    for (const recipient of b.redeemed) {
      if (recipient.signal?.aborted) continue;
      try { if (same(await resolveOwner(req, recipient.playerId), recipient.owner)) return b.data; } catch {}
    }
    fail('moving_speech_rest_unavailable');
  }

  const matching = test => [...broadcasts.values()].filter(test).forEach(b => b.close());
  return Object.freeze({ open, redeem, attach, authorizeRest, get: id => broadcasts.get(id) ?? null,
    cancel: matching, close: () => matching(() => true) });
}
