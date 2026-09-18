// Partner API v1 — for operators/aggregators integrating the Croupier AI-dealer tables.
// Auth: X-Api-Key + X-Timestamp + X-Signature (HMAC-SHA256 hex of `${ts}.${method}.${path}.${body}` with the key's secret).
// Wallet: "seamless" — when a key has walletUrl set, we call the partner for bet/win/rollback; otherwise the internal demo wallet is used.
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export function installPartnerApi({ db, boDb, shoeCommand, newGame, getPlayer, logTx, jwtSign, publicUrl }) {
  boDb.exec(`CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, key TEXT UNIQUE NOT NULL, secret TEXT NOT NULL,
    scopes TEXT NOT NULL, wallet_url TEXT, ip_allow TEXT, created_by TEXT, created_at TEXT NOT NULL, last_used TEXT, revoked_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS partner_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT, key_id TEXT NOT NULL, player_id TEXT NOT NULL, partner_player TEXT NOT NULL, table_version INTEGER,
    shoe_id TEXT, op TEXT NOT NULL, request_id TEXT, stake REAL, delta REAL, currency TEXT, view TEXT, at TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS partner_players (key_id TEXT NOT NULL, partner_player TEXT NOT NULL, player_id TEXT NOT NULL, PRIMARY KEY (key_id, partner_player))`);
  db.exec(`CREATE TABLE IF NOT EXISTS partner_idem (key_id TEXT NOT NULL, request_id TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY (key_id, request_id))`);

  const SCOPES = ['launch', 'play', 'wallet', 'history', 'lobby'];
  const keys = {
    list() { return boDb.prepare('SELECT id, name, key, scopes, wallet_url, ip_allow, created_by, created_at, last_used, revoked_at FROM api_keys ORDER BY created_at DESC').all().map(r => ({ ...r, scopes: JSON.parse(r.scopes), key: r.key.slice(0, 12) + '…' })); },
    create({ name, scopes, walletUrl, ipAllow }, who) {
      if (typeof name !== 'string' || !name.trim()) throw new Error('name required');
      const sc = (Array.isArray(scopes) ? scopes : SCOPES).filter(s => SCOPES.includes(s));
      if (!sc.length) throw new Error('at least one scope');
      const id = randomUUID(), key = 'ck_live_' + randomBytes(18).toString('base64url'), secret = 'cs_' + randomBytes(32).toString('base64url');
      boDb.prepare('INSERT INTO api_keys (id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id, name.trim().slice(0, 80), key, secret, JSON.stringify(sc), walletUrl || null, ipAllow || null, who ?? null, new Date().toISOString());
      return { id, name: name.trim(), key, secret, scopes: sc, walletUrl: walletUrl || null, note: 'Secret is shown ONCE. Store it now.' };
    },
    revoke(id) { boDb.prepare('UPDATE api_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(new Date().toISOString(), id); return { ok: true }; },
    rotate(id) { const secret = 'cs_' + randomBytes(32).toString('base64url'); boDb.prepare('UPDATE api_keys SET secret=? WHERE id=? AND revoked_at IS NULL').run(secret, id); return { id, secret, note: 'New secret shown ONCE.' }; },
  };

  function authenticate(req, method, path, body) {
    const key = req.headers['x-api-key'], ts = req.headers['x-timestamp'], sig = req.headers['x-signature'];
    if (!key || !ts || !sig) return { error: 'missing auth headers', status: 401 };
    const row = boDb.prepare('SELECT * FROM api_keys WHERE key=? AND revoked_at IS NULL').get(key);
    if (!row) return { error: 'unknown or revoked key', status: 401 };
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return { error: 'timestamp outside 5 min window', status: 401 };
    const expected = createHmac('sha256', row.secret).update(`${ts}.${method}.${path}.${body}`).digest('hex');
    const a = Buffer.from(String(sig)), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'bad signature', status: 401 };
    if (row.ip_allow) {
      const ip = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
      if (!row.ip_allow.split(',').map(s => s.trim()).includes(ip)) return { error: `ip ${ip} not allowed`, status: 403 };
    }
    boDb.prepare('UPDATE api_keys SET last_used=? WHERE id=?').run(new Date().toISOString(), row.id);
    return { key: { ...row, scopes: JSON.parse(row.scopes) } };
  }
  const need = (k, scope) => k.scopes.includes(scope) ? null : { error: `scope ${scope} required`, status: 403 };

  function playerFor(k, partnerPlayer, currency) {
    const m = db.prepare('SELECT player_id FROM partner_players WHERE key_id=? AND partner_player=?').get(k.id, partnerPlayer);
    if (m) return getPlayer(m.player_id);
    const id = randomUUID();
    db.prepare('INSERT INTO players (id, name, currency, balance, created_at) VALUES (?,?,?,?,?)').run(id, `${k.name}:${partnerPlayer}`.slice(0, 40), currency || 'EUR', 0, new Date().toISOString());
    db.prepare('INSERT INTO partner_players VALUES (?,?,?)').run(k.id, partnerPlayer, id);
    return getPlayer(id);
  }

  // Seamless wallet callbacks to the partner. Partner must respond {balance:number} (and honour idempotency on transactionId).
  async function walletCall(k, type, payload) {
    const body = JSON.stringify({ type, ...payload, at: new Date().toISOString() });
    const ts = Math.floor(Date.now() / 1000), sig = createHmac('sha256', k.secret).update(`${ts}.POST./wallet.${body}`).digest('hex');
    const r = await fetch(k.wallet_url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': k.key, 'X-Timestamp': String(ts), 'X-Signature': sig }, body, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`partner wallet ${type} rejected: ${r.status}`);
    const j = await r.json();
    if (typeof j.balance !== 'number') throw new Error('partner wallet returned no balance');
    return j.balance;
  }

  async function handle(req, res, pathname) {
    let body = '';
    for await (const c of req) { body += c; if (body.length > 20000) { res.writeHead(413); res.end(); return; } }
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
    const a = authenticate(req, req.method, pathname, body);
    if (a.error) return send(a.status, { error: a.error });
    const k = a.key;
    let input = {}; try { input = body ? JSON.parse(body) : {}; } catch { return send(400, { error: 'invalid json' }); }
    try {
      if (pathname === '/api/v1/ping') return send(200, { ok: true, key: k.name, scopes: k.scopes, serverTime: new Date().toISOString() });
      if (pathname === '/api/v1/lobby') { const e = need(k, 'lobby'); if (e) return send(e.status, e);
        return send(200, { tables: [{ id: 'astrid-blackjack', game: 'blackjack', dealer: 'astrid', name: 'Dark Hall', decks: 8, cutAfter: 312, boxes: 7, minBet: 5, maxBet: 2000, sideBets: ['perfectPairs', '21+3'], blackjackPays: '3:2', dealerStandsSoft17: true, aiDealer: true }] }); }
      if (pathname === '/api/v1/launch') { const e = need(k, 'launch'); if (e) return send(e.status, e);
        const { playerId, currency, language, returnUrl } = input; if (typeof playerId !== 'string' || !playerId) return send(400, { error: 'playerId required' });
        const p = playerFor(k, playerId, currency);
        const tok = jwtSign({ sub: p.id, partner: k.id, exp: Math.floor(Date.now() / 1000) + 6 * 3600, lang: language ?? 'en', returnUrl: returnUrl ?? null });
        return send(200, { url: `${publicUrl}/?dealer=astrid&performance=staged&motion=smooth60&launch=${tok}`, expiresIn: 21600, playerRef: p.id }); }
      if (pathname === '/api/v1/table') { const e = need(k, 'play'); if (e) return send(e.status, e);
        const { playerId, requestId, ...cmd } = input; if (typeof playerId !== 'string' || !playerId) return send(400, { error: 'playerId required' });
        if (cmd.op !== 'state') { if (typeof requestId !== 'string' || !requestId) return send(400, { error: 'requestId required (idempotency)' });
          const prev = db.prepare('SELECT response FROM partner_idem WHERE key_id=? AND request_id=?').get(k.id, requestId); if (prev) return send(200, JSON.parse(prev.response)); }
        const p = playerFor(k, playerId, cmd.currency);
        const saved = db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(p.id);
        const g = saved ? JSON.parse(saved.state) : newGame();
        let balance = p.balance;
        if (k.wallet_url && cmd.op !== 'state') balance = await walletCall(k, 'balance', { playerId, currency: p.currency });
        // Partner convenience: version defaults to current (no optimistic lock unless sent); bets may be sparse [{box,main,pp,tp}].
        const req = { ...cmd, requestId: requestId ?? 'state', version: cmd.version ?? g.version };
        if (req.op === 'start' && Array.isArray(req.bets) && req.bets.length !== 7) { const full = Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 }));
          for (const b of req.bets) { if (!Number.isInteger(b?.box) || b.box < 0 || b.box > 6) throw new Error('bet.box must be 0-6'); full[b.box] = { main: Number(b.main) || 0, pp: Number(b.pp) || 0, tp: Number(b.tp) || 0 }; } req.bets = full; }
        const { delta, view } = shoeCommand(g, req, balance);
        let newBalance = Math.round((balance + delta) * 100) / 100;
        if (k.wallet_url && delta) newBalance = await walletCall(k, delta < 0 ? 'bet' : 'win', { playerId, currency: p.currency, amount: Math.abs(delta), transactionId: `${k.id}:${requestId}`, roundId: `${g.shoe?.id}:${g.version}` });
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO blackjack_tables VALUES (?,?) ON CONFLICT(player_id) DO UPDATE SET state=excluded.state').run(p.id, JSON.stringify(g));
          db.prepare('UPDATE players SET balance=? WHERE id=?').run(newBalance, p.id);
          if (delta) logTx(p.id, cmd.op, delta, p.currency, `partner:${k.name}`);
          const out = { ...view, balance: newBalance, requestId: requestId ?? null };
          if (cmd.op !== 'state') { db.prepare('INSERT INTO partner_rounds (key_id,player_id,partner_player,table_version,shoe_id,op,request_id,stake,delta,currency,view,at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(k.id, p.id, playerId, g.version, g.shoe?.id ?? null, cmd.op, requestId, cmd.op === 'start' ? -delta : null, delta, p.currency, JSON.stringify(view.round), new Date().toISOString());
            db.prepare('INSERT OR IGNORE INTO partner_idem VALUES (?,?,?)').run(k.id, requestId, JSON.stringify(out)); }
          db.exec('COMMIT'); return send(200, out);
        } catch (e) { db.exec('ROLLBACK'); throw e; } }
      if (pathname === '/api/v1/history') { const e = need(k, 'history'); if (e) return send(e.status, e);
        const { playerId, from, to, limit } = input; const n = Math.min(Number(limit) || 100, 1000);
        const rows = db.prepare(`SELECT id, partner_player AS playerId, table_version AS tableVersion, shoe_id AS shoeId, op, request_id AS requestId, stake, delta, currency, view, at FROM partner_rounds WHERE key_id=? ${playerId ? 'AND partner_player=?' : ''} ${from ? 'AND at>=?' : ''} ${to ? 'AND at<=?' : ''} ORDER BY id DESC LIMIT ?`)
          .all(k.id, ...[playerId, from, to].filter(Boolean), n).map(r => ({ ...r, round: r.view ? JSON.parse(r.view) : null, view: undefined }));
        return send(200, { rounds: rows, count: rows.length }); }
      if (pathname === '/api/v1/demo-credit') { const e = need(k, 'wallet'); if (e) return send(e.status, e); if (k.wallet_url) return send(400, { error: 'not available with seamless wallet' });
        const { playerId, amount } = input; if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return send(400, { error: 'amount 0-100000' });
        const p = playerFor(k, playerId, input.currency); const nb = Math.round((p.balance + amount) * 100) / 100; db.prepare('UPDATE players SET balance=? WHERE id=?').run(nb, p.id); logTx(p.id, 'deposit', amount, p.currency, `partner-demo:${k.name}`); return send(200, { playerId, balance: nb, currency: p.currency }); }
      if (pathname === '/api/v1/balance') { const e = need(k, 'wallet'); if (e) return send(e.status, e);
        const { playerId } = input; const p = playerFor(k, playerId, input.currency); return send(200, { playerId, balance: p.balance, currency: p.currency, note: k.wallet_url ? 'seamless wallet: partner is source of truth' : 'internal demo wallet' }); }
      return send(404, { error: 'unknown endpoint' });
    } catch (e) { return send(400, { error: String(e.message || e) }); }
  }
  return { keys, handle, SCOPES };
}
