-- Additive game-database migration; run explicitly against CROUPIER_GAME_DATABASE_URL.
-- Never against Studio/zones. Runtime does not apply this DDL or alter existing data.
BEGIN;
CREATE TABLE IF NOT EXISTS croupier_game.roulette_tables (
  player_id TEXT NOT NULL REFERENCES croupier_game.players(id),
  operator_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (player_id,operator_id,room_id)
);
COMMIT;
