// PostgreSQL implementation; explicit schema is installed before service initialization.
// Partner API v1 — for operators/aggregators integrating the Croupier AI-dealer tables.
// Auth: X-Api-Key + X-Timestamp + X-Signature (HMAC-SHA256 hex of `${ts}.${method}.${path}.${body}` with the key's secret).
// PostgreSQL preserves internal demo wallets; external wallet commands fail explicitly until recovery is verified.
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { buildAssetsManifest, presentationEvents } from '../partner-presentation.mjs';

const DISPLAY_NAME_FORBIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
export function normalizeDisplayName(value) {
  if (value === undefined || value === null) return 'spelaren';
  if (typeof value !== 'string') throw new Error('displayName must be a string');
  const normalized = value.normalize('NFC');
  if (DISPLAY_NAME_FORBIDDEN.test(normalized)) throw new Error('displayName contains control or formatting characters');
  const compact = normalized.replace(/\p{White_Space}+/gu, ' ').trim();
  if (!compact) throw new Error('displayName must not be empty');
  if ([...compact].length > 40) throw new Error('displayName must be at most 40 characters');
  return compact;
}

export function installPartnerApi({ db, boDb, shoeCommand, newGame, getPlayer, logTx, jwtSign, publicUrl, root, publicGamePath = '/', readMetadata, hasPublicMedia,
  nativeMode=process.env.CROUPIER_STUDIO_NEON_POLICY==='1'||process.env.CROUPIER_CLOUD_RUNTIME==='1',
  allowLegacyPartnerSessions = process.env.CROUPIER_STUDIO_NEON_POLICY !== '1' }) {
  if (!['/', '/game','/blackjack'].includes(publicGamePath)) throw Error('Invalid public game path');
  // SSE subscribers per (key,player): partner clients receive presentation events as they happen.
  const subs = new Map(); const chan = (k, pid) => `${k}:${pid}`;
  function publish(k, pid, payload) { const set = subs.get(chan(k, pid)); if (!set) return; const line = `id: ${Date.now()}\nevent: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`; for (const res of set) { try { res.write(line); } catch {} } }
  // events = observe the SSE stream only; play implies it. A key with just events cannot launch or act.
  const SCOPES = ['launch', 'play', 'wallet', 'history', 'lobby', 'events'];
  const keyStamp = key => createHash('sha256').update(key.secret).digest('hex');
  const keys = {
    async list() { return (await boDb.prepare('SELECT id, name, key, scopes, wallet_url, ip_allow, created_by, created_at, last_used, revoked_at FROM api_keys ORDER BY created_at DESC').all()).map(r => ({ ...r, scopes: JSON.parse(r.scopes), key: r.key.slice(0, 12) + '…' })); },
    async create({ name, scopes, walletUrl, ipAllow }, who) {
      if (typeof name !== 'string' || !name.trim()) throw new Error('name required');
      const sc = (Array.isArray(scopes) ? scopes : SCOPES).filter(s => SCOPES.includes(s));
      if (!sc.length) throw new Error('at least one scope');
      const id = randomUUID(), key = 'ck_live_' + randomBytes(18).toString('base64url'), secret = 'cs_' + randomBytes(32).toString('base64url');
      (await boDb.prepare('INSERT INTO api_keys (id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id, name.trim().slice(0, 80), key, secret, JSON.stringify(sc), walletUrl || null, ipAllow || null, who ?? null, new Date().toISOString()));
      return { id, name: name.trim(), key, secret, scopes: sc, walletUrl: walletUrl || null, note: 'Secret is shown ONCE. Store it now.' };
    },
    async mintLaunch(id, { playerId, displayName, currency, language } = {}) {
      const row = (await boDb.prepare('SELECT * FROM api_keys WHERE id=? AND revoked_at IS NULL').get(id));
      if (!row) throw new Error('unknown or revoked key');
      if (row.wallet_url) throw Object.assign(new Error('External wallet is not enabled for PostgreSQL'), {statusCode:503});
      const pid = String(playerId || 'test-' + randomBytes(3).toString('hex'));
      const p = (await playerFor({ ...row, scopes: JSON.parse(row.scopes) }, pid, currency || 'EUR'));
      const presentedAs = normalizeDisplayName(displayName);
      const tok = jwtSign({ sub: p.id, partner: row.id, partner_key_stamp: keyStamp(row), displayName: presentedAs, exp: Math.floor(Date.now() / 1000) + 6 * 3600, lang: language ?? 'en', returnUrl: null });
      const ts = Math.floor(Date.now() / 1000), body = JSON.stringify({ playerId: pid, displayName: presentedAs, currency: currency || 'EUR' });
      const sig = createHmac('sha256', row.secret).update(`${ts}.POST./api/v1/launch.${body}`).digest('hex');
      return { playerId: pid, playerRef: p.id, balance: p.balance, currency: p.currency, expiresIn: 21600,
        url: `${publicUrl}${publicGamePath}?dealer=astrid&launch=${tok}`,
        curlLines: [`curl -X POST ${publicUrl}/api/v1/launch`, `  -H 'Content-Type: application/json'`, `  -H 'X-Api-Key: ${row.key}'`, `  -H 'X-Timestamp: ${ts}'`, `  -H 'X-Signature: ${sig}'`, `  -d '${body}'`],
        signedString: `${ts}.POST./api/v1/launch.${body}`,
        curlNote: 'Signature valid 5 minutes. signedString is the exact input to HMAC-SHA256 with the key secret.' };
    },
    async credit(id, { playerId, amount }) {
      const row = (await boDb.prepare('SELECT * FROM api_keys WHERE id=? AND revoked_at IS NULL').get(id)); if (!row) throw new Error('unknown or revoked key');
      if (row.wallet_url) throw new Error('key uses a seamless wallet; fund the player in your own wallet');
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error('amount 0-100000');
      return db.transaction(async()=>{
      const p = (await playerFor({ ...row, scopes: JSON.parse(row.scopes) }, String(playerId), null));
      const nb = Math.round((p.balance + amount) * 100) / 100;
      (await db.prepare('UPDATE players SET balance=? WHERE id=?').run(nb, p.id)); (await logTx(p.id, 'deposit', amount, p.currency, `bo-demo:${row.name}`));
      return { playerId, balance: nb, currency: p.currency };
      });
    },
    async revoke(id) {
      await boDb.prepare('UPDATE api_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(new Date().toISOString(), id);
      for (const [channel, responses] of subs) if (channel.startsWith(`${id}:`)) {
        for (const response of responses) { try { response.end(); } catch {} } subs.delete(channel);
      }
      return { ok: true };
    },
    async rotate(id) {
      const secret = 'cs_' + randomBytes(32).toString('base64url');
      const changed = await boDb.prepare('UPDATE api_keys SET secret=? WHERE id=? AND revoked_at IS NULL').run(secret, id);
      if (!changed.changes) throw Object.assign(new Error('Partner key unavailable'), { statusCode: 404 });
      for (const [channel, responses] of subs) if (channel.startsWith(`${id}:`)) {
        for (const response of responses) { try { response.end(); } catch {} } subs.delete(channel);
      }
      return { id, secret, note: 'New secret shown ONCE.' };
    },
  };

  async function authenticate(req, method, path, body) {
    const key = req.headers['x-api-key'], ts = req.headers['x-timestamp'], sig = req.headers['x-signature'];
    if (!key || !ts || !sig) return { error: 'missing auth headers', status: 401 };
    const row = (await boDb.prepare('SELECT * FROM api_keys WHERE key=? AND revoked_at IS NULL').get(key));
    if (!row) return { error: 'unknown or revoked key', status: 401 };
    if (!Number.isFinite(Number(ts)) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return { error: 'timestamp outside 5 min window', status: 401 };
    const expected = createHmac('sha256', row.secret).update(`${ts}.${method}.${path}.${body}`).digest('hex');
    const a = Buffer.from(String(sig)), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'bad signature', status: 401 };
    if (row.ip_allow) {
      const ip = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
      if (!row.ip_allow.split(',').map(s => s.trim()).includes(ip)) return { error: `ip ${ip} not allowed`, status: 403 };
    }
    (await boDb.prepare('UPDATE api_keys SET last_used=? WHERE id=?').run(new Date().toISOString(), row.id));
    return { key: { ...row, scopes: JSON.parse(row.scopes) } };
  }
  const need = (k, scope) => k.scopes.includes(scope) ? null : { error: `scope ${scope} required`, status: 403 };

  function gameViewOf(savedRow) { try { const g = JSON.parse(savedRow.state); const { view } = shoeCommand(g, { op: 'state' }, 0); return view.round; } catch { return null; } }
  async function playerFor(k, partnerPlayer, currency) {
    return db.transaction(async () => {
      // Authentication may precede the serialized game transaction. A queued
      // request signed with a rotated/revoked key must not mutate its player.
      const current = await boDb.prepare('SELECT secret,revoked_at FROM api_keys WHERE id=?').get(k.id);
      if (!current || current.revoked_at || current.secret !== k.secret) throw Object.assign(new Error('Partner key unavailable'), { statusCode: 403 });
      const mapping = await db.prepare('SELECT player_id FROM partner_players WHERE key_id=? AND partner_player=?').get(k.id,partnerPlayer);
      if (mapping) {
        const player = await db.prepare('SELECT id,name,currency,balance,status FROM players WHERE id=? FOR UPDATE').get(mapping.player_id);
        if (!player || player.status !== 'active') throw new Error('Player account is unavailable');
        return player;
      }
      const id=randomUUID();
      await db.prepare('INSERT INTO players (id,name,currency,balance,created_at) VALUES (?,?,?,?,?)').run(id,'spelaren',currency||'EUR',0,new Date().toISOString());
      await db.prepare('INSERT INTO partner_players VALUES (?,?,?)').run(k.id,partnerPlayer,id);
      return getPlayer(id);
    });
  }

  async function handleEvents(req, res, url) {
    // GET /api/v1/events?playerId=..&key=..&ts=..&sig=..   sig = HMAC(`${ts}.GET./api/v1/events.${playerId}`)
    const key = url.searchParams.get('key'), ts = url.searchParams.get('ts'), sig = url.searchParams.get('sig'), playerId = url.searchParams.get('playerId');
    const fail = (st, m) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: m })); };
    if (!key || !ts || !sig || !playerId) return (await fail(401, 'key, ts, sig, playerId required'));
    const row = (await boDb.prepare('SELECT * FROM api_keys WHERE key=? AND revoked_at IS NULL').get(key)); if (!row) return (await fail(401, 'unknown or revoked key'));
    if (!Number.isFinite(Number(ts)) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return (await fail(401, 'timestamp outside 5 min window'));
    const expected = createHmac('sha256', row.secret).update(`${ts}.GET./api/v1/events.${playerId}`).digest('hex');
    if (expected.length !== String(sig).length || !timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig)))) return (await fail(401, 'bad signature'));
    if (!JSON.parse(row.scopes).some(scope => scope === 'events' || scope === 'play')) return (await fail(403, 'scope events or play required'));
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: hello\ndata: ${JSON.stringify({ playerId, serverTime: new Date().toISOString() })}\n\n`);
    const c = chan(row.id, playerId); if (!subs.has(c)) subs.set(c, new Set()); subs.get(c).add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
    req.on('close', () => { clearInterval(ping); subs.get(c)?.delete(res); });
  }
  async function handle(req, res, pathname) {
    let body = '';
    for await (const c of req) { body += c; if (body.length > 20000) { res.writeHead(413); res.end(); return; } }
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
    const a = (await authenticate(req, req.method, pathname, body));
    if (a.error) return send(a.status, { error: a.error });
    const k = a.key;
    if (k.wallet_url && ['/api/v1/launch','/api/v1/table','/api/v1/demo-credit','/api/v1/balance'].includes(pathname)) return send(503,{error:'External wallet is not enabled for PostgreSQL; reservation and recovery verification are required'});
    let input = {}; try { input = body ? JSON.parse(body) : {}; } catch { return send(400, { error: 'invalid json' }); }
    try {
      if (pathname === '/api/v1/ping') return send(200, { ok: true, key: k.name, scopes: k.scopes, serverTime: new Date().toISOString() });
      if (pathname === '/api/v1/assets') { const e = need(k, 'lobby'); if (e) return send(e.status, e);
        try { return send(200, await buildAssetsManifest(root, input.dealer ?? 'astrid', publicUrl,{readMetadata,hasPublicMedia})); } catch (err) { return send(err.statusCode===400?400:readMetadata?503:400, { error: err.statusCode===400?'unknown dealer':readMetadata?'assets unavailable':err.message }); } }
      if (pathname === '/api/v1/lobby') { const e = need(k, 'lobby'); if (e) return send(e.status, e);
        if(nativeMode)return send(410,{error:'legacy_lobby_retired',url:'/lobby'});
        return send(200, { tables: [{ id: 'astrid-blackjack', game: 'blackjack', dealer: 'astrid', name: 'Dark Hall', decks: 8, cutAfter: 312, boxes: 7, minBet: 5, maxBet: 2000, sideBets: ['perfectPairs', '21+3'], blackjackPays: '3:2', dealerStandsSoft17: true, aiDealer: true }] }); }
      if (pathname === '/api/v1/launch') { const e = need(k, 'launch'); if (e) return send(e.status, e);
        const { playerId, displayName, currency, language, returnUrl } = input; if (typeof playerId !== 'string' || !playerId) return send(400, { error: 'playerId required' });
        const presentedAs = normalizeDisplayName(displayName);
        const p = (await playerFor(k, playerId, currency));
        const tok = jwtSign({ sub: p.id, partner: k.id, partner_key_stamp: keyStamp(k), displayName: presentedAs, exp: Math.floor(Date.now() / 1000) + 6 * 3600, lang: language ?? 'en', returnUrl: returnUrl ?? null });
        return send(200, { url: `${publicUrl}${publicGamePath}?dealer=astrid&launch=${tok}`, expiresIn: 21600, playerRef: p.id }); }
      if (pathname === '/api/v1/table') {
        const e=need(k,'play');if(e)return send(e.status,e);
        const {playerId,requestId,...cmd}=input;
        if(typeof playerId!=='string'||!playerId)return send(400,{error:'playerId required'});
        if(cmd.op!=='state'&&(typeof requestId!=='string'||!requestId))return send(400,{error:'requestId required (idempotency)'});
        let message;
        const out=await db.transaction(async()=>{
          const p=await playerFor(k,playerId,cmd.currency);
          if(cmd.op!=='state'){
            const old=await db.prepare('SELECT response FROM partner_idem WHERE key_id=? AND request_id=?').get(k.id,requestId);
            if(old){
              const receipt=await db.prepare('SELECT partner_player,op FROM partner_rounds WHERE key_id=? AND request_id=? ORDER BY id DESC LIMIT 1').get(k.id,requestId);
              if(!receipt||receipt.partner_player!==playerId||receipt.op!==cmd.op)throw Error('requestId belongs to another player or operation');
              return JSON.parse(old.response);
            }
          }
          const saved=await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(p.id);
          const g=saved?JSON.parse(saved.state):newGame();
          const req={...cmd,requestId:requestId??'state',version:cmd.version??g.version};
          if(req.op==='start'&&Array.isArray(req.bets)&&req.bets.length!==7){
            const full=Array.from({length:7},()=>({main:0,pp:0,tp:0}));
            for(const bet of req.bets){if(!Number.isInteger(bet?.box)||bet.box<0||bet.box>6)throw Error('bet.box must be 0-6');full[bet.box]={main:Number(bet.main)||0,pp:Number(bet.pp)||0,tp:Number(bet.tp)||0};}req.bets=full;
          }
          const previousView={round:saved?gameViewOf(saved):null};
          const {delta,view}=shoeCommand(g,req,p.balance);
          const presentation=cmd.op==='state'?[]:presentationEvents(previousView,view,cmd.op,{action:cmd.action});
          const balance=Math.round((p.balance+delta)*100)/100;
          await db.prepare('INSERT INTO blackjack_tables VALUES (?,?) ON CONFLICT(player_id) DO UPDATE SET state=excluded.state').run(p.id,JSON.stringify(g));
          await db.prepare('UPDATE players SET balance=? WHERE id=?').run(balance,p.id);
          if(delta)await logTx(p.id,cmd.op,delta,p.currency,'partner:'+k.name);
          const response={...view,balance,requestId:requestId??null,presentation};
          if(cmd.op!=='state'){
            await db.prepare('INSERT INTO partner_rounds (key_id,player_id,partner_player,table_version,shoe_id,op,request_id,stake,delta,currency,view,at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(k.id,p.id,playerId,g.version,g.shoe?.id??null,cmd.op,requestId,cmd.op==='start'?-delta:null,delta,p.currency,JSON.stringify(view.round),new Date().toISOString());
            await db.prepare('INSERT INTO partner_idem VALUES (?,?,?)').run(k.id,requestId,JSON.stringify(response));
            if(presentation.length)message={type:'round',op:cmd.op,requestId,version:view.version,phase:view.round?.phase??null,balance,events:presentation};
          }
          return response;
        });
        if(message)publish(k.id,playerId,message);
        return send(200,out);
      }
      if (pathname === '/api/v1/history') { const e = need(k, 'history'); if (e) return send(e.status, e);
        const { playerId, from, to, limit } = input; const n = Math.min(Number(limit) || 100, 1000);
        const rows = (await db.prepare(`SELECT id, partner_player AS playerId, table_version AS tableVersion, shoe_id AS shoeId, op, request_id AS requestId, stake, delta, currency, view, at FROM partner_rounds WHERE key_id=? ${playerId ? 'AND partner_player=?' : ''} ${from ? 'AND at>=?' : ''} ${to ? 'AND at<=?' : ''} ORDER BY id DESC LIMIT ?`)
          .all(k.id, ...[playerId, from, to].filter(Boolean), n)).map(r => ({ ...r, round: r.view ? JSON.parse(r.view) : null, view: undefined }));
        return send(200, { rounds: rows, count: rows.length }); }
      if (pathname === '/api/v1/demo-credit') { const e = need(k, 'wallet'); if (e) return send(e.status, e); if (k.wallet_url) return send(400, { error: 'not available with seamless wallet' });
        const { playerId, amount } = input; if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return send(400, { error: 'amount 0-100000' });
        const value=await db.transaction(async()=>{const p = (await playerFor(k, playerId, input.currency)); const nb = Math.round((p.balance + amount) * 100) / 100; (await db.prepare('UPDATE players SET balance=? WHERE id=?').run(nb, p.id)); (await logTx(p.id, 'deposit', amount, p.currency, `partner-demo:${k.name}`)); return { playerId, balance: nb, currency: p.currency };});return send(200,value); }
      if (pathname === '/api/v1/balance') { const e = need(k, 'wallet'); if (e) return send(e.status, e);
        const { playerId } = input; const p = (await playerFor(k, playerId, input.currency)); return send(200, { playerId, balance: p.balance, currency: p.currency, note: k.wallet_url ? 'seamless wallet: partner is source of truth' : 'internal demo wallet' }); }
      return send(404, { error: 'unknown endpoint' });
    } catch (e) { return send(400, { error: String(e.message || e) }); }
  }
  // Called only by the native table after a committed, non-replayed command.
  // Session provenance is a separate server argument, never client JSON.
  async function publishNativeRound({ session, playerId, previousView, view, command, balance }) {
    if (!session?.partnerKeyId || session.playerId !== playerId || command.op === 'state') return false;
    const key = (await boDb.prepare('SELECT id, scopes, secret FROM api_keys WHERE id=? AND revoked_at IS NULL').get(session.partnerKeyId));
    if (!key || !JSON.parse(key.scopes).some(scope => scope === 'events' || scope === 'play')) return false;
    if (session.partnerKeyStamp ? session.partnerKeyStamp !== keyStamp(key) : !allowLegacyPartnerSessions) return false;
    const mappings = (await db.prepare('SELECT partner_player FROM partner_players WHERE key_id=? AND player_id=?').all(key.id, playerId));
    // An ambiguous reverse mapping must not broadcast a native player's data.
    if (mappings.length !== 1) return false;
    const events = presentationEvents(previousView, view, command.op, { action: command.action });
    if (!events.length) return false;
    publish(key.id, mappings[0].partner_player, { type: 'round', op: command.op, requestId: command.requestId,
      version: view.version, phase: view.round?.phase ?? null, balance, events });
    return true;
  }
  return { keys, handle, handleEvents, publishNativeRound, SCOPES };
}
