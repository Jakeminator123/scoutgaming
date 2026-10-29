// Steg F (docs/plans/STEG-F.md): a player belongs to one company, croupier_game.players.operator_id,
// the croupier_studio.operators id in the engine's scope (game migration 014). Reads are tolerant
// until the krav PR: callers select to_jsonb(p)->>'operator_id', which is null before 014 and for a
// player without a company, so today's behaviour holds. Nothing here refuses a player yet.
export const PLAYER_OPERATOR_VERSION = 'game-014-player-operator';
export const PLAYER_OPERATOR_COLUMN = "SELECT EXISTS (SELECT FROM pg_attribute WHERE attrelid=to_regclass('croupier_game.players') AND attname='operator_id' AND NOT attisdropped) AS present";
const OPERATOR_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;

/** The row's company, or null. A malformed stored value is never trusted (014's CHECK forbids it). */
export function playerOperator(row) {
  const value = row?.operator_id ?? null;
  if (value !== null && (typeof value !== 'string' || !OPERATOR_ID.test(value))) {
    throw Object.assign(new Error('player_operator_invalid'), { code: 'player_operator_invalid', statusCode: 503 });
  }
  return value;
}
