// Read-only aggregate for the signed-in player. No HTTP and no identifiers.
export function createPlayerHistoryHandler({ getPlayer, readGame, readPlayerResults, db }) {
  return async playerId => {
    const player = await getPlayer(playerId);
    if (!player || typeof player.currency !== 'string') return { error: 'no such player' };
    const game = (await readGame(playerId)) ?? { round: null, paid: false };
    const result = await readPlayerResults(db, playerId, game, player.currency);
    const last = result?.lastRound;
    const current = result?.currentRound;
    return {
      scope: result.scope,
      accounting: result.accounting,
      currencies: (result.currencies ?? []).map(row => ({
        currency: row.currency,
        rounds: row.rounds,
        won: row.won,
        lost: row.lost,
        net: row.net,
        wagered: row.wagered,
        returned: row.returned,
      })),
      // roundId is native-ledger-<transaction id> and stays off this response.
      lastRound: last ? {
        currency: last.currency,
        wagered: last.wagered,
        returned: last.returned,
        net: last.net,
        outcome: last.outcome,
      } : null,
      currentRound: current ? {
        currency: current.currency,
        wagered: current.wagered,
        phase: current.phase,
      } : null,
    };
  };
}
