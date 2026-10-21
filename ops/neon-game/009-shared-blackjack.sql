-- J07 additive game schema. Apply only through an explicitly authorized migration.
-- No startup DDL; the adapter refuses to run until this schema is installed.
BEGIN;
CREATE TABLE croupier_game.shared_table_rooms (room_id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE croupier_game.shared_table_members (
 room_id TEXT NOT NULL, player_id TEXT NOT NULL REFERENCES croupier_game.players(id),
 active BOOLEAN NOT NULL, body TEXT NOT NULL, PRIMARY KEY(room_id,player_id)
);
CREATE INDEX shared_table_member_rooms ON croupier_game.shared_table_members(player_id,room_id) WHERE active;
CREATE TABLE croupier_game.shared_table_presence (
 room_id TEXT NOT NULL, player_id TEXT NOT NULL REFERENCES croupier_game.players(id), seen BIGINT NOT NULL,
 PRIMARY KEY(room_id,player_id)
);
CREATE TABLE croupier_game.shared_table_receipts (
 room_id TEXT NOT NULL, player_id TEXT NOT NULL REFERENCES croupier_game.players(id), command_id TEXT NOT NULL,
 body TEXT NOT NULL, PRIMARY KEY(room_id,player_id,command_id)
);
CREATE TABLE croupier_game.shared_table_ticks (tick_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE croupier_game.shared_table_pauses (player_id TEXT PRIMARY KEY REFERENCES croupier_game.players(id), until_ms BIGINT NOT NULL);
CREATE TABLE croupier_game.shared_table_configs (room_id TEXT NOT NULL, version TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(room_id,version));
CREATE TABLE croupier_game.shared_table_config_heads (room_id TEXT PRIMARY KEY, version TEXT NOT NULL,
 FOREIGN KEY(room_id,version) REFERENCES croupier_game.shared_table_configs(room_id,version));
-- Global A lock serializes MAX(seq)+1, so a rolled-back savepoint cannot leave a sequence gap.
CREATE TABLE croupier_game.shared_table_audit (seq BIGINT PRIMARY KEY, room_id TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE croupier_game.shared_table_shoes (shoe_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE croupier_game.shared_table_outbox (
 room_id TEXT NOT NULL, ver BIGINT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered','superseded')), PRIMARY KEY(room_id,ver)
);
CREATE INDEX shared_table_pending_outbox ON croupier_game.shared_table_outbox(room_id,ver) WHERE status='pending';
CREATE TABLE croupier_game.shared_table_delivery (room_id TEXT PRIMARY KEY, ver BIGINT NOT NULL);

COMMIT;
