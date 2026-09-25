// Read only the selected profile's authoritative native-table ledger. Deposits,
// starting credit, currency conversions and old client balance sync are not wins.
export function readPlayerResults(db, playerId, game, currency) {
  const rows = db.prepare(`SELECT type, amount, currency FROM transactions
    WHERE player_id=? AND meta='server blackjack' AND type IN ('start','act','insurance','collect')
    ORDER BY id`).all(playerId);
  const totals = new Map();
  const money = value => Math.round(value * 100) / 100;
  const bucket = code => {
    if (!totals.has(code)) totals.set(code, { currency: code, rounds: 0, won: 0, lost: 0, net: 0, wagered: 0, returned: 0 });
    return totals.get(code);
  };
  let round = null;
  const finish = () => {
    if (!round) return;
    const item = bucket(round.currency), net = money(round.returned - round.wagered);
    item.rounds++;
    item.won = money(item.won + Math.max(0, net));
    item.lost = money(item.lost + Math.max(0, -net));
    item.net = money(item.net + net);
    item.wagered = money(item.wagered + round.wagered);
    item.returned = money(item.returned + round.returned);
  };
  for (const row of rows) {
    if (row.type === 'start') {
      // A new start is allowed only after the previous round was collected.
      // Zero-return collections have no money transaction of their own.
      finish(); round = { currency: row.currency, wagered: 0, returned: 0 };
    }
    if (!round || row.currency !== round.currency) continue;
    if (row.amount < 0) round.wagered = money(round.wagered - row.amount);
    else if (row.type === 'collect') round.returned = money(round.returned + row.amount);
  }
  const pending = Boolean(game.round && !game.paid);
  if (!pending) finish();
  bucket(currency);
  return { scope: 'saved-demo-profile', accounting: 'collected-rounds', currencies: [...totals.values()],
    currentRound: pending && round ? { currency: round.currency, wagered: round.wagered, phase: game.round.phase } : null };
}
