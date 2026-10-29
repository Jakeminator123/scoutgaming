-- Granskningsunderlag; renderas bara med tools/prepare-player-operator.mjs (docs/plans/STEG-F.md).
-- Körs aldrig vid start och bara av Jakob. Steg F, första DDL: varje spelare får ett bolag,
-- croupier_game.players.operator_id, samma id som croupier_studio.operators.operator_id i motorns scope.
-- Kolumnen är NULL-bar här (kod som ännu inte skriver bolaget fortsätter fungera); NOT NULL,
-- oföränderlighet och inloggningsnamn per bolag kommer med game-015 i kravsteget.
-- Backfill (Jakobs beslut): partnerspelare får nyckelns bolag; annars bolaget som äger spelarens senaste
-- spelbord (delat bords närvaro eller senaste rouletteinsats, bara bolag som finns i scopet); annars
-- reservbolaget. Idempotent: en ny körning ger bara spelare utan bolag ett bolag enligt samma regel och
-- lämnar ledgerraden orörd; en ledgerrad med annan checksumma eller en handgjord kolumn nekas.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL search_path = pg_catalog;
DO $target$
BEGIN
  IF current_database() <> {{database}} OR current_user <> {{role}} OR session_user <> {{role}}
    OR current_setting('server_version_num')::integer < 160000
    OR pg_is_in_recovery() OR current_setting('transaction_read_only') <> 'off' THEN
    RAISE EXCEPTION 'player_operator_target_mismatch';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname='croupier_game' AND nspowner=current_user::regrole)
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname IN ('players','storage_migrations')
        AND c.relkind='r' AND c.relpersistence='p' AND c.relowner=current_user::regrole AND NOT c.relispartition
        AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity) <> 2 THEN
    RAISE EXCEPTION 'player_operator_owner_or_state_mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_event_trigger WHERE evtenabled <> 'D') THEN
    RAISE EXCEPTION 'player_operator_unknown_event_trigger';
  END IF;
END $target$;
SELECT pg_advisory_xact_lock(1935897197,814);
-- Spelarfrågor väntar högst två sekunder på låset eller så avbryts transaktionen utan ändring.
LOCK TABLE croupier_game.players IN ACCESS EXCLUSIVE MODE;
LOCK TABLE croupier_game.storage_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE player_rel oid := 'croupier_game.players'::regclass;
  applied boolean;
BEGIN
  IF (SELECT checksum FROM croupier_game.storage_migrations WHERE version='product-v1') IS DISTINCT FROM {{productChecksum}}
    OR EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='game-014-player-operator'
      AND checksum IS DISTINCT FROM {{migrationChecksum}}) THEN
    RAISE EXCEPTION 'player_operator_ledger_mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_trigger WHERE tgrelid='croupier_game.storage_migrations'::regclass AND NOT tgisinternal)
    OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class='croupier_game.storage_migrations'::regclass)
    OR EXISTS (SELECT FROM pg_constraint WHERE conrelid='croupier_game.storage_migrations'::regclass AND contype NOT IN ('n','p')) THEN
    RAISE EXCEPTION 'player_operator_unknown_ledger_hook';
  END IF;
  -- Inga regler och ingen UPDATE-trigger som vaknar av operator_id (008:s plånboksvakt gäller andra kolumner).
  IF EXISTS (SELECT FROM pg_rewrite WHERE ev_class=player_rel)
    OR EXISTS (SELECT FROM pg_trigger t WHERE t.tgrelid=player_rel AND NOT t.tgisinternal AND (t.tgtype & 16) <> 0
      AND (cardinality(t.tgattr::int2[]) = 0 OR EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid=player_rel
        AND a.attname='operator_id' AND a.attnum = ANY (t.tgattr::int2[])))) THEN
    RAISE EXCEPTION 'player_operator_unknown_player_hook';
  END IF;
  applied := EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='game-014-player-operator');
  -- Före 014: inget av det 014 skapar finns. Efter 014: exakt det 014 skapar (en ny körning).
  IF NOT applied AND (EXISTS (SELECT FROM pg_attribute WHERE attrelid=player_rel AND attname='operator_id')
      OR to_regclass('croupier_game.players_operator_idx') IS NOT NULL
      OR EXISTS (SELECT FROM pg_constraint WHERE conrelid=player_rel AND conname='players_operator_id_check'))
    OR applied AND (NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid=player_rel AND attname='operator_id' AND NOT attisdropped
        AND NOT attnotnull AND NOT atthasdef AND attidentity='' AND attgenerated='' AND format_type(atttypid,atttypmod)='text')
      OR (SELECT array_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid=player_rel AND conname='players_operator_id_check'
        AND contype='c' AND convalidated) IS DISTINCT FROM ARRAY['CHECK ((operator_id ~ ''^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$''::text))']
      OR (SELECT array_agg(pg_get_indexdef(indexrelid)) FROM pg_index WHERE indrelid=player_rel
        AND indexrelid=to_regclass('croupier_game.players_operator_idx') AND indisvalid AND indisready)
        IS DISTINCT FROM ARRAY['CREATE INDEX players_operator_idx ON croupier_game.players USING btree (operator_id)']) THEN
    RAISE EXCEPTION 'player_operator_structure_mismatch';
  END IF;
  -- Backfillens källor: 007–010, partnernycklarna och bolagen i Studios schema i samma databas.
  IF to_regclass('croupier_game.shared_table_presence') IS NULL OR to_regclass('croupier_game.shared_table_config_heads') IS NULL
    OR to_regclass('croupier_game.shared_table_configs') IS NULL OR to_regclass('croupier_game.roulette_tables') IS NULL
    OR to_regclass('croupier_game.partner_players') IS NULL OR to_regclass('croupier_auth.api_keys') IS NULL
    OR to_regclass('croupier_studio.operators') IS NULL THEN
    RAISE EXCEPTION 'player_operator_backfill_source_missing';
  END IF;
END $preflight$;
DO $fallback$
BEGIN
  IF NOT EXISTS (SELECT FROM croupier_studio.operators WHERE environment_id={{environment}} AND workspace_id={{workspace}}
      AND operator_id={{fallbackOperator}}) THEN
    RAISE EXCEPTION 'player_operator_fallback_unknown';
  END IF;
END $fallback$;
-- Planen räknas under låset och visas innan något skrivs; förkontrollen slutar efter den med ROLLBACK.
CREATE TEMP TABLE player_operator_plan ON COMMIT DROP AS
WITH known AS (
  SELECT operator_id FROM croupier_studio.operators WHERE environment_id={{environment}} AND workspace_id={{workspace}}
), partner AS (
  SELECT DISTINCT ON (m.player_id) m.player_id, to_jsonb(k)->>'operator_id' AS operator_id
  FROM croupier_game.partner_players m JOIN croupier_auth.api_keys k ON k.id=m.key_id
  WHERE to_jsonb(k)->>'operator_id' IN (SELECT operator_id FROM known)
  ORDER BY m.player_id, 2
), tables AS (
  -- Delat bord: närvaron per rum; rummets bolag ur huvudversionens frysta spelinställningar.
  SELECT s.player_id, (c.body::jsonb)->>'operatorId' AS operator_id, to_timestamp(s.seen / 1000.0) AS at, s.room_id
  FROM croupier_game.shared_table_presence s
  JOIN croupier_game.shared_table_config_heads h ON h.room_id=s.room_id
  JOIN croupier_game.shared_table_configs c ON c.room_id=h.room_id AND c.version=h.version
  UNION ALL
  -- Roulette: senaste insatsen per rum (transaktionens meta bär rummet), bolaget ur roulettebordet.
  SELECT r.player_id, r.operator_id, max(CASE WHEN t.at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$' THEN t.at::timestamptz END), r.room_id
  FROM croupier_game.roulette_tables r
  JOIN croupier_game.transactions t ON t.player_id=r.player_id AND t.type='roulette_bet'
    AND substring(t.meta FROM '"roomId":"([^"]+)"')=r.room_id
  GROUP BY r.player_id, r.operator_id, r.room_id
), latest AS (
  SELECT DISTINCT ON (player_id) player_id, operator_id FROM tables
  WHERE at IS NOT NULL AND operator_id IN (SELECT operator_id FROM known)
  ORDER BY player_id, at DESC, operator_id, room_id
)
SELECT p.id AS player_id,
  COALESCE(partner.operator_id, latest.operator_id, {{fallbackOperator}}) AS operator_id,
  CASE WHEN partner.operator_id IS NOT NULL THEN 'partner-key' WHEN latest.operator_id IS NOT NULL THEN 'latest-table' ELSE 'fallback' END AS rule
FROM croupier_game.players p
LEFT JOIN partner ON partner.player_id=p.id
LEFT JOIN latest ON latest.player_id=p.id
WHERE to_jsonb(p)->>'operator_id' IS NULL;
SELECT rule, operator_id, count(*) AS players FROM pg_temp.player_operator_plan GROUP BY 1, 2 ORDER BY 1, 2;
-- MIGRATION MUTATIONS
ALTER TABLE croupier_game.players ADD COLUMN IF NOT EXISTS operator_id text
  CONSTRAINT players_operator_id_check CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$');
CREATE INDEX IF NOT EXISTS players_operator_idx ON croupier_game.players (operator_id);
UPDATE croupier_game.players p SET operator_id=plan.operator_id
FROM pg_temp.player_operator_plan plan WHERE plan.player_id=p.id AND p.operator_id IS NULL;
INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at)
VALUES ('game-014-player-operator',{{migrationChecksum}},{{evidence}},clock_timestamp()::text)
ON CONFLICT (version) DO NOTHING;
DO $postflight$
DECLARE player_rel oid := 'croupier_game.players'::regclass;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid=player_rel AND attname='operator_id' AND NOT attisdropped
      AND NOT attnotnull AND NOT atthasdef AND attidentity='' AND attgenerated='' AND format_type(atttypid,atttypmod)='text')
    OR (SELECT array_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid=player_rel AND conname='players_operator_id_check'
      AND contype='c' AND convalidated) IS DISTINCT FROM ARRAY['CHECK ((operator_id ~ ''^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$''::text))']
    OR (SELECT array_agg(pg_get_indexdef(indexrelid)) FROM pg_index WHERE indrelid=player_rel
      AND indexrelid=to_regclass('croupier_game.players_operator_idx') AND indisvalid AND indisready)
      IS DISTINCT FROM ARRAY['CREATE INDEX players_operator_idx ON croupier_game.players USING btree (operator_id)']
    OR EXISTS (SELECT FROM croupier_game.players WHERE operator_id IS NULL)
    OR NOT EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='product-v1' AND checksum={{productChecksum}})
    OR NOT EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='game-014-player-operator' AND checksum={{migrationChecksum}}) THEN
    RAISE EXCEPTION 'player_operator_postflight_failed';
  END IF;
END $postflight$;
COMMIT;
