-- K04 additive schema: the durable presentation receiver (sink of the J07 shared-table outbox).
-- Apply only through an explicitly authorized migration, after 009. No startup DDL; the receiver
-- refuses to run until this table exists. One row per room: the last accepted outbox version and
-- that row's body, which is also the room's current presentation for reconnect/transport (root).
BEGIN;
CREATE TABLE croupier_game.shared_table_presentation_receiver (
 room_id TEXT PRIMARY KEY, ver BIGINT NOT NULL CHECK(ver > 0), fingerprint TEXT NOT NULL, body TEXT NOT NULL
);
COMMIT;
