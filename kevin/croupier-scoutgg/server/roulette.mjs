// Roulette table (Kevin 14 Oct: "kan du påbörja roulette?"). European single zero after the back office spec: a 15 s
// betting window from the first chip, the server draws the pocket when bets close, the wheel spins for SPIN_MS on every
// screen to that pocket, then the table pays and shows the result before the next round opens. One shared room per
// session; every guest has a demo wallet per room, keyed by the same guest cookie as blackjack. The draw is
// crypto.randomInt and happens only after bets close, so nothing a client sees before then can predict it.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { guestToken, sameOrigin } from './request-safety.mjs';
import { BET_BY_ID, settle, pocketColor } from '../public/roulette/rules.js';
import { sessionName, cleanPlayerName } from './shared-table.mjs';

export const BET_MS = 15000, RESULT_MS = 6000;
// the wheel animation (wheel-motion.js) runs 8.5–12 s by round ID; the spin phase outlasts the longest one
export const SPIN_MS = 12500;
// back office Roulette limit tiers (pP.roulette: Classic 1–1,000, High roller 25–25,000)
export const ROULETTE_LIMITS = Object.freeze({ min: 1, max: 1000, chips: [1, 5, 25, 100, 500], balance: 1000 });
const money = n => `$${n.toLocaleString('en-US')}`;
const keyFor = token => createHash('sha256').update(token).digest('hex');
const total = placed => Object.values(placed ?? {}).reduce((n, v) => n + v, 0);

export function createRoulette(filename, { now = Date.now, draw = () => randomInt(37), limitsFor = () => ROULETTE_LIMITS } = {}) {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS roulette_rooms (id TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS roulette_players (room TEXT NOT NULL, token TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, balance REAL NOT NULL, seen REAL NOT NULL, PRIMARY KEY(room,token));
    CREATE TABLE IF NOT EXISTS roulette_requests (room TEXT NOT NULL, token TEXT NOT NULL, id TEXT NOT NULL, input TEXT NOT NULL, PRIMARY KEY(room,token,id));
    CREATE TABLE IF NOT EXISTS roulette_rounds (room TEXT NOT NULL, round_id TEXT NOT NULL, number INTEGER NOT NULL, at INTEGER NOT NULL, bets TEXT NOT NULL, PRIMARY KEY(room,round_id));`);
  // an append-only ledger like blackjack's (transactions.mjs), its own table so a roulette room never reads as a blackjack one
  db.exec(`CREATE TABLE IF NOT EXISTS roulette_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, player_id TEXT NOT NULL,
      name TEXT NOT NULL, round_id TEXT, at INTEGER NOT NULL, kind TEXT NOT NULL, amount_cents INTEGER NOT NULL, before_cents INTEGER NOT NULL, after_cents INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS roulette_transactions_no_update BEFORE UPDATE ON roulette_transactions BEGIN SELECT RAISE(ABORT,'Transactions are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS roulette_transactions_no_delete BEFORE DELETE ON roulette_transactions BEGIN SELECT RAISE(ABORT,'Transactions are append-only'); END;`);
  const cents = n => Math.round(n * 100);
  const transactions = { record: (room, p, roundId, kind, before, after) => db.prepare('INSERT INTO roulette_transactions(room,player_id,name,round_id,at,kind,amount_cents,before_cents,after_cents) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(room, p.id, p.name, roundId ?? null, now(), kind, cents(after) - cents(before), cents(before), cents(after)) };
  const fresh = () => ({ roundId: randomUUID(), phase: 'bets', closesAt: null, bets: {}, order: [], number: null, history: [], lastBets: {}, results: {}, version: 0 });
  const load = id => { const row = db.prepare('SELECT state FROM roulette_rooms WHERE id=?').get(id); return row ? JSON.parse(row.state) : fresh(); };
  const save = (id, r) => db.prepare('INSERT INTO roulette_rooms VALUES (?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(id, JSON.stringify(r));
  const player = (id, key) => db.prepare('SELECT * FROM roulette_players WHERE room=? AND token=?').get(id, key);
  const byId = (id, pid) => db.prepare('SELECT * FROM roulette_players WHERE room=? AND id=?').get(id, pid);
  const amount = (id, pid, delta, kind, roundId = null) => {
    const before = byId(id, pid);
    db.prepare('UPDATE roulette_players SET balance=ROUND(balance+?,2) WHERE room=? AND id=?').run(delta, id, pid);
    transactions.record(id, before, roundId, kind, before.balance, byId(id, pid).balance);
  };

  // Moves the room along the clock: bets close → the pocket is drawn → the spin ends and the table pays → next round.
  function advance(id, r) {
    for (;;) {
      const t = now();
      if (r.phase === 'bets' && r.closesAt !== null && t >= r.closesAt) {
        r.number = draw(); r.phase = 'spin'; r.spinEndsAt = r.closesAt + SPIN_MS; r.version++;
        db.prepare('INSERT INTO roulette_rounds VALUES (?,?,?,?,?)').run(id, r.roundId, r.number, r.closesAt, JSON.stringify(r.bets));
      } else if (r.phase === 'spin' && t >= r.spinEndsAt) {
        r.results = {};
        for (const [pid, placed] of Object.entries(r.bets)) {
          const { returned, wins } = settle(placed, r.number);
          r.results[pid] = { staked: total(placed), returned, wins };
          if (returned && byId(id, pid)) amount(id, pid, returned, 'payout', r.roundId);
        }
        r.history = [r.number, ...r.history].slice(0, 12);
        r.phase = 'result'; r.resultEndsAt = r.spinEndsAt + RESULT_MS; r.version++;
      } else if (r.phase === 'result' && t >= r.resultEndsAt) {
        for (const [pid, placed] of Object.entries(r.bets)) if (total(placed)) r.lastBets[pid] = placed;
        Object.assign(r, { roundId: randomUUID(), phase: 'bets', closesAt: null, bets: {}, order: [], number: null, results: {}, version: r.version + 1 });
        delete r.spinEndsAt; delete r.resultEndsAt;
      } else return;
    }
  }

  function placeBet(id, r, p, betId, chip, L) {
    const bet = BET_BY_ID[betId];
    if (!bet) throw new Error('Unknown bet');
    if (!Number.isFinite(chip) || chip <= 0 || !L.chips.includes(chip)) throw new Error('Choose a chip');
    const mine = r.bets[p.id] ??= {};
    const next = (mine[betId] ?? 0) + chip;
    if (next > L.max) throw new Error(`Maximum ${money(L.max)} per bet`);
    if (next < L.min) throw new Error(`Minimum ${money(L.min)} per bet`);
    if (chip > byId(id, p.id).balance) throw new Error('Insufficient demo balance');
    mine[betId] = next; r.order.push([p.id, betId, chip]);
    amount(id, p.id, -chip, 'stake', r.roundId);
    r.closesAt ??= now() + BET_MS;   // the window opens on the table's first chip (back office: "Betting window 15 s")
  }
  function removeBets(id, r, p, which) {   // which: 'last' | 'all'
    const mine = r.bets[p.id] ?? {};
    const mineOrder = r.order.map((o, i) => [o, i]).filter(([o]) => o[0] === p.id);
    const take = which === 'last' ? mineOrder.slice(-1) : mineOrder;
    for (const [[, betId, chip], i] of take.reverse()) {
      mine[betId] -= chip; if (!mine[betId]) delete mine[betId];
      r.order.splice(i, 1); amount(id, p.id, chip, 'stake_return', r.roundId);
    }
    if (!Object.keys(mine).length) delete r.bets[p.id];
  }

  function view(id, r, p) {
    const t = now(), L = limitsFor(id);
    const others = Object.keys(r.bets).filter(pid => pid !== p?.id);
    return {
      game: 'roulette', session: id, roundId: r.roundId, version: r.version, phase: r.phase, serverNow: t,
      closesIn: r.phase === 'bets' && r.closesAt !== null ? Math.max(0, r.closesAt - t) : null,
      spinLeft: r.phase === 'spin' ? Math.max(0, r.spinEndsAt - t) : null, spinMs: SPIN_MS,
      // the pocket only exists once bets have closed
      number: r.phase === 'bets' ? null : r.number, color: r.phase === 'bets' ? null : pocketColor(r.number),
      history: r.history, limits: { min: L.min, max: L.max, chips: L.chips, refill: L.balance },
      players: Object.keys(r.bets).length, othersStaked: others.reduce((n, pid) => n + total(r.bets[pid]), 0),
      me: p ? { name: p.name, balance: p.balance, bets: r.bets[p.id] ?? {}, staked: total(r.bets[p.id]),
        canRepeat: Boolean(r.lastBets[p.id]), result: r.phase === 'result' ? r.results[p.id] ?? null : null } : null,
    };
  }

  function run(token, input = {}) {
    const id = sessionName(input.session), key = keyFor(token);
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = load(id);
      advance(id, r);
      let p = player(id, key);
      if (p) db.prepare('UPDATE roulette_players SET seen=? WHERE room=? AND token=?').run(now(), id, key);
      const op = input.op ?? 'state';
      if (op !== 'state') {
        if (typeof input.requestId !== 'string' || !input.requestId || input.requestId.length > 100) throw new Error('Request ID required');
        const previous = db.prepare('SELECT input FROM roulette_requests WHERE room=? AND token=? AND id=?').get(id, key, input.requestId);
        if (previous) { if (previous.input !== JSON.stringify(input)) throw new Error('Request ID reused with different input'); }
        else {
          const L = limitsFor(id);
          if (op === 'join') {
            const name = cleanPlayerName(input.name);
            if (!p) {
              db.prepare('INSERT INTO roulette_players VALUES (?,?,?,?,?,?)').run(id, key, randomUUID(), name, L.balance, now());
              p = player(id, key); transactions.record(id, p, null, 'opening_credit', 0, L.balance);
            } else db.prepare('UPDATE roulette_players SET name=? WHERE room=? AND token=?').run(name, id, key);
          } else {
            if (!p) throw new Error('Enter your name first');
            if (op === 'refill') {
              if (p.balance >= L.min || total(r.bets[p.id])) throw new Error('Refill is for an empty balance');
              amount(id, p.id, L.balance, 'demo_refill');
            } else {
              if (r.phase !== 'bets') throw new Error('No more bets');
              if (op === 'bet') placeBet(id, r, p, String(input.bet), Number(input.chip), L);
              else if (op === 'undo') removeBets(id, r, p, 'last');
              else if (op === 'clear') removeBets(id, r, p, 'all');
              else if (op === 'repeat') {
                const last = r.lastBets[p.id];
                if (!last) throw new Error('No previous bets');
                if (total(last) > byId(id, p.id).balance) throw new Error('Insufficient demo balance');
                for (const [betId, sum] of Object.entries(last)) {
                  // a repeated bet goes on as one stack; it was within the limits last round and the limits are the same
                  const mine = r.bets[p.id] ??= {};
                  if ((mine[betId] ?? 0) + sum > L.max) throw new Error(`Maximum ${money(L.max)} per bet`);
                  mine[betId] = (mine[betId] ?? 0) + sum; r.order.push([p.id, betId, sum]);
                  amount(id, p.id, -sum, 'stake', r.roundId);
                }
                r.closesAt ??= now() + BET_MS;
              } else throw new Error('Unknown action');
              if (!r.order.length) r.closesAt = null;   // everyone took their chips back: the window waits for a new first chip
            }
          }
          r.version++;
          db.prepare('INSERT INTO roulette_requests VALUES (?,?,?,?)').run(id, key, input.requestId, JSON.stringify(input));
          p = player(id, key);
        }
      }
      save(id, r);
      db.exec('COMMIT');
      return view(id, r, p);
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  // POST /api/roulette: the blackjack table's guest cookie (table-service.mjs), so one visitor has one identity
  function handle(req, res, input) {
    const reply = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
    if (req.headers.origin && !sameOrigin(req)) return reply(403, { error: 'Invalid origin' });
    const token = guestToken(req.headers) ?? randomBytes(32).toString('hex');
    if (!/(?:^|;\s*)astrid_guest=[a-f0-9]{64}(?:;|$)/.test(req.headers.cookie ?? '')) {
      const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `astrid_guest=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}`);
    }
    try { return reply(200, run(token, input ?? {})); } catch (e) { return reply(400, { error: e.message }); }
  }
  return { run, handle, close: () => db.close() };
}
