import { createHash } from 'node:crypto';
import { TableError, WalletDenied } from './ports.mjs';

const first = async (client, sql, args) => (await client.query(sql, args)).rows[0];
const fail = (code, message) => { throw new TableError(code, message); };
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 4096;
function cents(value, zero = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid demo amount');
  const n = Math.round(value * 100);
  if (!Number.isSafeInteger(n) || n < (zero ? 0 : 1) || Math.abs(value * 100 - n) > 0.000001) throw new TypeError('Invalid demo amount');
  return n;
}
function amount(value) {
  const n = Number(value); cents(n, true); return n;
}
const decimal = pennies => `${pennies < 0 ? '-' : ''}${Math.floor(Math.abs(pennies) / 100)}.${String(Math.abs(pennies) % 100).padStart(2, '0')}`;
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// The caller owns BEGIN, sorted R/P locks, A, savepoints and COMMIT. This port
// never opens another client/transaction or acquires a room/global/audit lock.
// Its reads can also be used by store.read, with a pool and no-op assertions.
export function createPostgresTableWallet({ client, assertPlayer, assertRoom }) {
  if (typeof client?.query !== 'function' || typeof assertPlayer !== 'function' || typeof assertRoom !== 'function') throw new TypeError('A locked wallet client and scope assertions are required');
  const player = p => { if (!text(p)) throw new TypeError('Invalid player'); assertPlayer(p); };
  async function account(p) {
    player(p);
    const row = await first(client, `SELECT p.id,p.balance,p.currency,p.status,p.wallet_gen,
      p.balance-COALESCE((SELECT sum(r.amount) FROM croupier_game.shared_wallet_reservations r WHERE r.player_id=p.id),0) AS available
      FROM croupier_game.players p WHERE p.id=$1`, [p]);
    if (!row) fail('PLAYER_UNAVAILABLE', 'Player account is unavailable');
    return row;
  }
  function deny(p, row, reason, reservationId = null) {
    throw new WalletDenied({ playerId: p, reservationId, walletGen: String(row.wallet_gen), reason });
  }
  function active(p, row, reservationId = null, existingObligation = false) {
    if (row.status !== 'active' && !(existingObligation && row.status === 'blocked')) deny(p, row, 'player account is inactive', reservationId);
  }
  async function reservation(id) {
    if (!text(id)) throw new TypeError('Invalid reservation');
    const row = await first(client, 'SELECT player_id,room_id,kind,amount,generation FROM croupier_game.shared_wallet_reservations WHERE reservation_id=$1', [id]);
    if (!row) return null;
    player(row.player_id); assertRoom(row.room_id);
    return { playerId: row.player_id, roomId: row.room_id, kind: row.kind, amount: amount(row.amount), gen: String(row.generation) };
  }
  function keyFor(p, key) {
    let parts;
    try { parts = JSON.parse(key); } catch { throw new TypeError('Invalid ledger key'); }
    if (!text(key) || !Array.isArray(parts) || parts.length !== 6 || !parts.every(text)
        || !['command', 'tick'].includes(parts[0]) || parts[4] !== p || JSON.stringify(parts) !== key) throw new TypeError('Invalid ledger key');
    assertRoom(parts[1]);
    return parts;
  }
  async function previous(p, key, digest) {
    const row = await first(client, 'SELECT id,player_id,amount,source_fingerprint FROM croupier_game.transactions WHERE source_key=$1', [key]);
    if (!row) return null;
    if (row.player_id !== p || row.source_fingerprint !== digest) fail('LEDGER_KEY_REUSED', 'Ledger key belongs to another wallet effect');
    return { ledgerId: String(row.id), amount: amount(Math.abs(Number(row.amount))) };
  }
  async function writeLedger(p, row, kind, pennies, key, digest) {
    // P excludes concurrent balance/reservation changes; source_key additionally
    // protects ledger identity globally across rooms and all effects.
    await client.query('UPDATE croupier_game.players SET balance=balance+$2::numeric WHERE id=$1', [p, decimal(pennies)]);
    const result = await first(client, `INSERT INTO croupier_game.transactions(player_id,type,amount,currency,meta,at,source_key,source_fingerprint)
      VALUES($1,$2,$3::numeric,$4,$5,to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),$6,$7) RETURNING id`,
    [p, kind, decimal(pennies), row.currency, 'shared blackjack demo', key, digest]);
    return { ledgerId: String(result.id) };
  }
  async function change(p, { amount: value, kind, key }, direction) {
    player(p); keyFor(p, key);
    const n = cents(value);
    if (!text(kind)) throw new TypeError('Invalid ledger kind');
    const digest = fingerprint([direction, p, kind, n]);
    const old = await previous(p, key, digest);
    if (old) return { ledgerId: old.ledgerId };
    const row = await account(p); active(p, row, null, direction === 1 && kind === 'payout');
    if (direction < 0 && cents(amount(row.available), true) < n) deny(p, row, 'insufficient available');
    const total = cents(amount(row.balance), true) + direction * n;
    if (!Number.isSafeInteger(total)) throw new RangeError('Demo balance exceeds safe precision');
    return writeLedger(p, row, kind, direction * n, key, digest);
  }
  async function release(p, { reservationId }) {
    player(p);
    const cur = await reservation(reservationId);
    if (!cur) return;
    if (cur.playerId !== p) fail('RESERVATION_OWNER', 'Reservation belongs to another player');
    await client.query('DELETE FROM croupier_game.shared_wallet_reservations WHERE reservation_id=$1', [reservationId]);
  }
  return {
    async available(p) { return amount((await account(p)).available); },
    async gen(p) { return String((await account(p)).wallet_gen); },
    reservation,
    async reserve(p, { reservationId, roomId, kind, amount: value }) {
      player(p); assertRoom(roomId);
      if (!text(roomId) || !text(reservationId) || !['stake', 'insurance'].includes(kind)) throw new TypeError('Invalid reservation identity');
      const n = cents(value, true), cur = await reservation(reservationId);
      if (cur && (cur.playerId !== p || cur.roomId !== roomId || cur.kind !== kind)) fail('RESERVATION_OWNER', 'Reservation belongs to another player, room or kind');
      if (!n) return release(p, { reservationId });
      const row = await account(p); active(p, row, reservationId);
      if (n - (cur ? cents(cur.amount) : 0) > cents(amount(row.available), true)) deny(p, row, 'insufficient available', reservationId);
      if (cur && cents(cur.amount) === n) return;
      await client.query(`INSERT INTO croupier_game.shared_wallet_reservations(reservation_id,player_id,room_id,kind,amount,generation)
        VALUES($1,$2,$3,$4,$5::numeric,0) ON CONFLICT(reservation_id) DO UPDATE SET amount=EXCLUDED.amount`,
      [reservationId, p, roomId, kind, decimal(n)]);
    },
    release,
    async consume(p, { reservationId, key }) {
      player(p); const parts = keyFor(p, key);
      if (!text(reservationId)) throw new TypeError('Invalid reservation');
      // The request fingerprint survives consumption: a replay needs no live reservation.
      const digest = fingerprint(['consume', p, reservationId]);
      const old = await previous(p, key, digest);
      if (old) return old;
      // A blocked account still fulfils an already accepted stake/insurance promise.
      const row = await account(p); active(p, row, reservationId, true);
      const cur = await reservation(reservationId);
      if (!cur || cur.playerId !== p) deny(p, row, 'no reservation', reservationId);
      if (cur.roomId !== parts[1]) fail('RESERVATION_ROOM', 'Reservation belongs to another room');
      const n = cents(cur.amount);
      if (n > cents(amount(row.balance), true)) deny(p, row, 'insufficient balance', reservationId);
      // Delete the hold before debiting; the player trigger then protects every
      // remaining reservation. Both writes and the ledger are in the outer unit.
      await release(p, { reservationId });
      return { ...await writeLedger(p, row, `consume:${cur.kind}`, -n, key, digest), amount: cur.amount };
    },
    debit: (p, input) => change(p, input, -1),
    credit: (p, input) => change(p, input, 1),
    async syncHands(roomId, playerIds) {
      assertRoom(roomId);
      if (!text(roomId) || !Array.isArray(playerIds) || !playerIds.every(text)) throw new TypeError('Invalid hand owners');
      const before = new Set((await client.query('SELECT player_id FROM croupier_game.shared_wallet_hands WHERE room_id=$1', [roomId])).rows.map(r => r.player_id));
      const after = new Set(playerIds);
      const removed = [...before].filter(p => !after.has(p)).sort(), added = [...after].filter(p => !before.has(p)).sort();
      // Check the entire diff before changing any marker. An unchanged marker
      // needs no new P lock on a read-only engine step such as auto-stand.
      for (const p of [...removed, ...added]) player(p);
      for (const p of removed) await client.query('DELETE FROM croupier_game.shared_wallet_hands WHERE room_id=$1 AND player_id=$2', [roomId, p]);
      for (const p of added) await client.query('INSERT INTO croupier_game.shared_wallet_hands(room_id,player_id) VALUES($1,$2)', [roomId, p]);
    },
  };
}
