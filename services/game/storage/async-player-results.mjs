// PostgreSQL implementation; explicit schema is installed before service initialization.
// Read only the selected profile's authoritative round results. Deposits, starting
// credit, refills, currency conversions and old client balance sync are not wins.
//
// Two sources, merged in time order:
// - native table: the ledger rows 'server blackjack' start/act/insurance/collect,
//   grouped from one start to the next (a zero return has no collect row);
// - shared table: one audited 'wallet.settlement' per player and settled round,
//   written in the same transaction as its payout. Its stake already includes
//   doubles, splits, side bets and insurance. Rounds still in play are absent.
const money = value => Math.round(value * 100) / 100;
const time = value => {
  const at = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(at) ? at : null;
};

const SHARED_AUDIT = 'croupier_game.shared_table_audit';
// The audit has no player column: restrict it to the player's own rooms first.
const SHARED_SETTLEMENTS = `SELECT a.seq, a.room_id, a.body FROM croupier_game.shared_table_audit a
  WHERE a.room_id IN (SELECT m.room_id FROM croupier_game.shared_table_members m WHERE m.player_id=?)
    AND a.body::jsonb->>'type'='wallet.settlement'
    AND (a.body::jsonb->>'payload')::jsonb->>'playerId'=?
  ORDER BY a.seq`;

async function readNativeRounds(db, playerId) {
  const rows = (await db.prepare(`SELECT id, type, amount, currency, at FROM transactions
    WHERE player_id=? AND meta='server blackjack' AND type IN ('start','act','insurance','collect')
    ORDER BY id`).all(playerId));
  const rounds = [];
  let round = null;
  for (const row of rows) {
    if (row.type === 'start') {
      // A new start is allowed only after the previous round was collected.
      // Zero-return collections have no money transaction of their own.
      if (round) rounds.push(round);
      round = { roundId: `native-ledger-${row.id}`, currency: row.currency, wagered: 0, returned: 0, at: null };
    }
    if (!round || row.currency !== round.currency) continue;
    round.at = time(row.at) ?? round.at;
    if (row.amount < 0) round.wagered = money(round.wagered - row.amount);
    else if (row.type === 'collect') round.returned = money(round.returned + row.amount);
  }
  return { rounds, open: round };
}

// The shared schema is an additive migration; without it there are no shared rounds.
async function readSharedRounds(db, playerId, currency) {
  const ready = (await db.prepare(`SELECT to_regclass('${SHARED_AUDIT}') AS ready`).all())[0]?.ready;
  if (!ready) return [];
  const rounds = [];
  for (const row of await db.prepare(SHARED_SETTLEMENTS).all(playerId, playerId)) {
    const event = JSON.parse(row.body), payload = JSON.parse(event.payload);
    if (event.type !== 'wallet.settlement' || payload?.playerId !== playerId) continue;
    const { roundId, staked, returned, settledAt } = payload;
    if (typeof roundId !== 'string' || !roundId || ![staked, returned].every(value => Number.isFinite(value) && value >= 0))
      throw new Error('Invalid shared table settlement');
    // The demo wallet holds one profile currency; shared ledger rows carry the same.
    rounds.push({ roundId: `shared-${event.room ?? row.room_id}-${roundId}`, currency,
      wagered: money(staked), returned: money(returned), at: time(settledAt) ?? time(event.at) });
  }
  return rounds;
}

export async function readPlayerResults(db, playerId, game, currency) {
  const totals = new Map();
  const bucket = code => {
    if (!totals.has(code)) totals.set(code, { currency: code, rounds: 0, won: 0, lost: 0, net: 0, wagered: 0, returned: 0 });
    return totals.get(code);
  };
  const native = await readNativeRounds(db, playerId);
  const pending = Boolean(game.round && !game.paid);
  const completed = [...native.rounds, ...(!pending && native.open ? [native.open] : [])];
  // Stable time order; a round without a readable time keeps its source order first.
  const rounds = [...completed, ...await readSharedRounds(db, playerId, currency)]
    .map((round, index) => ({ round, index, at: round.at ?? -Infinity }))
    .sort((a, b) => a.at - b.at || a.index - b.index).map(item => item.round);
  let lastRound = null;
  for (const round of rounds) {
    const item = bucket(round.currency), net = money(round.returned - round.wagered);
    lastRound = { roundId: round.roundId, currency: round.currency, wagered: round.wagered,
      returned: round.returned, net, outcome: net > 0 ? 'win' : net < 0 ? 'loss' : 'push' };
    item.rounds++;
    item.won = money(item.won + Math.max(0, net));
    item.lost = money(item.lost + Math.max(0, -net));
    item.net = money(item.net + net);
    item.wagered = money(item.wagered + round.wagered);
    item.returned = money(item.returned + round.returned);
  }
  bucket(currency);
  return { scope: 'saved-demo-profile', accounting: 'collected-rounds', currencies: [...totals.values()], lastRound,
    currentRound: pending && native.open ? { currency: native.open.currency, wagered: native.open.wagered, phase: game.round.phase } : null };
}
