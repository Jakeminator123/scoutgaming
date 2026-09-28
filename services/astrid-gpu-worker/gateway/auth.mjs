import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export function constantEqual(a, b) {
  const aa = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

// Call only from an authenticated application server after checking session ownership.
// Never put this secret, or the GPU credential, in browser code.
export function issueTicket(secret, { userId, sessionId, ttlSeconds = 30 }, now = Date.now()) {
  if (secret.length < 32 || !userId || !sessionId || ttlSeconds <= 0 || ttlSeconds > 60) throw new Error('Invalid ticket configuration');
  const body = Buffer.from(JSON.stringify({ userId, sessionId, nonce: randomUUID(), exp: now + ttlSeconds * 1000 })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function ticketAuthenticator(secret, { maxUsed = 10000 } = {}) {
  if (!secret || secret.length < 32) throw new Error('TICKET_SECRET must contain at least 32 characters');
  const used = new Map();
  return req => {
    const protocols = String(req.headers['sec-websocket-protocol'] || '').split(',').map(v => v.trim());
    if (!protocols.includes('astrid-v2')) return null;
    const ticket = protocols.find(v => v.startsWith('ticket.'))?.slice(7);
    if (!ticket || ticket.length > 4096) return null;
    const [body, sig, extra] = ticket.split('.');
    if (extra !== undefined || !body || !sig || !constantEqual(sig, createHmac('sha256', secret).update(body).digest('base64url'))) return null;
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString());
      const now = Date.now();
      for (const [nonce, exp] of used) if (exp < now) used.delete(nonce);
      if (typeof p.userId !== 'string' || p.userId.length > 128 || !p.userId || typeof p.sessionId !== 'string' || p.sessionId.length > 128 || !p.sessionId || typeof p.nonce !== 'string' || !Number.isFinite(p.exp) || p.exp <= now || p.exp > now + 60000 || used.has(p.nonce) || used.size >= maxUsed) return null;
      used.set(p.nonce, p.exp);
      return { userId: p.userId, sessionId: p.sessionId };
    } catch { return null; }
  };
}
