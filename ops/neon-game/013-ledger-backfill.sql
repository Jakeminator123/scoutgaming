-- Granskningsunderlag; renderas bara med tools/prepare-ledger-backfill.mjs. Körs aldrig vid start.
-- Bara DML i spelets ledger, ingen DDL: efterhandsrader för spelarprofil 006 och roulettebord 007,
-- som applicerades för hand innan spelversioner fick ledgerrader, för delat bord 008–010, som
-- applicerades med tools/prepare-shared-schema.mjs utan ledgerrad, och en egen rad game-013-ledger-backfill.
-- Raderna skrivs bara när 006:s, 007:s och 008–010:s objekt finns i katalogen, var och en med egen
-- kontroll. Idempotent: finns en rad redan med samma checksumma lämnas den orörd; en rad med annan
-- checksumma nekar hela transaktionen. applied_at är dagen versionen applicerades i målet
-- (--applied-on-006, --applied-on-007 och --applied-on för 008–010); klockslaget är okänt.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL search_path = pg_catalog;
DO $target$
BEGIN
  IF current_database() <> {{database}} OR current_user <> {{role}} OR session_user <> {{role}}
    OR pg_is_in_recovery() OR current_setting('transaction_read_only') <> 'off' THEN
    RAISE EXCEPTION 'ledger_backfill_target_mismatch';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname='croupier_game' AND nspowner=current_user::regrole)
    OR NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname='storage_migrations' AND c.relkind='r' AND c.relpersistence='p'
        AND c.relowner=current_user::regrole AND NOT c.relispartition AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity) THEN
    RAISE EXCEPTION 'ledger_backfill_owner_mismatch';
  END IF;
END $target$;
SELECT pg_advisory_xact_lock(1935897197,813);
-- Blockerar andra skrivare i ledgern men inte motorns läsning av product-v1 vid start.
LOCK TABLE croupier_game.storage_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE tables text[] := ARRAY['shared_wallet_reservations','shared_wallet_hands','shared_table_rooms','shared_table_members',
  'shared_table_presence','shared_table_receipts','shared_table_ticks','shared_table_pauses','shared_table_configs',
  'shared_table_config_heads','shared_table_audit','shared_table_shoes','shared_table_outbox','shared_table_delivery',
  'shared_table_presentation_receiver'];
BEGIN
  IF (SELECT checksum FROM croupier_game.storage_migrations WHERE version='product-v1') IS DISTINCT FROM {{productChecksum}} THEN
    RAISE EXCEPTION 'ledger_backfill_product_mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_trigger WHERE tgrelid='croupier_game.storage_migrations'::regclass AND NOT tgisinternal)
    OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class='croupier_game.storage_migrations'::regclass)
    OR EXISTS (SELECT FROM pg_constraint WHERE conrelid='croupier_game.storage_migrations'::regclass AND contype NOT IN ('n','p')) THEN
    RAISE EXCEPTION 'ledger_backfill_unknown_ledger_hook';
  END IF;
  IF EXISTS (SELECT FROM croupier_game.storage_migrations m
      JOIN (VALUES ('game-006-player-profile',{{playerProfileChecksum}}),('game-007-roulette-tables',{{rouletteTablesChecksum}}),
        ('game-008-shared-wallet',{{sharedWalletChecksum}}),('game-009-shared-blackjack',{{sharedBlackjackChecksum}}),
        ('game-010-presentation-receiver',{{presentationReceiverChecksum}}),('game-013-ledger-backfill',{{migrationChecksum}}))
        AS expected(version,checksum) ON expected.version=m.version
      WHERE m.checksum IS DISTINCT FROM expected.checksum) THEN
    RAISE EXCEPTION 'ledger_backfill_ledger_mismatch';
  END IF;
  -- 006: spelarens namn och språk, med båda kontrollvillkoren.
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='croupier_game.players'::regclass AND NOT attisdropped
      AND attname IN ('display_name','locale') AND atttypid='text'::regtype AND NOT attnotnull) <> 2
    OR (SELECT count(*) FROM pg_constraint WHERE conrelid='croupier_game.players'::regclass AND contype='c' AND convalidated
      AND conname IN ('players_display_name_check','players_locale_check')) <> 2 THEN
    RAISE EXCEPTION 'ledger_backfill_player_profile_mismatch';
  END IF;
  -- 007: roulettebordet med rumsavgränsad primärnyckel och referens till spelaren.
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname='roulette_tables' AND c.relkind='r') <> 1
    OR (SELECT count(*) FROM pg_attribute WHERE attrelid=to_regclass('croupier_game.roulette_tables') AND attnum > 0 AND NOT attisdropped
      AND attname IN ('player_id','operator_id','room_id','state') AND atttypid='text'::regtype AND attnotnull) <> 4
    OR (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM pg_constraint p
      CROSS JOIN LATERAL unnest(p.conkey) WITH ORDINALITY AS k(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=p.conrelid AND a.attnum=k.attnum
      WHERE p.conrelid=to_regclass('croupier_game.roulette_tables') AND p.contype='p')
      IS DISTINCT FROM ARRAY['player_id','operator_id','room_id']
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid=to_regclass('croupier_game.roulette_tables') AND contype='f'
      AND convalidated AND confrelid='croupier_game.players'::regclass) THEN
    RAISE EXCEPTION 'ledger_backfill_roulette_tables_mismatch';
  END IF;
  -- Samma objekt som prepare-shared-schema.mjs kontrollerar efter 008→009→010, utan kravet på tomma tabeller.
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname=ANY(tables) AND c.relkind='r' AND c.relowner=current_user::regrole) <> 15
    OR (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND i.indisvalid AND i.indisready AND c.relname IN ('transactions_source_key',
        'shared_wallet_reservations_player','shared_wallet_hands_player','shared_table_member_rooms','shared_table_pending_outbox')) <> 5
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='croupier_game' AND p.pronargs=0 AND p.prorettype='trigger'::regtype AND NOT p.prosecdef
        AND p.proowner=current_user::regrole AND p.proname IN ('shared_wallet_player_guard','shared_wallet_reservation_guard',
          'shared_wallet_reservation_changed','shared_wallet_hand_guard')) <> 4
    OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE n.nspname='croupier_game' AND t.tgenabled='O' AND NOT t.tgisinternal AND p.proname=t.tgname
        AND (t.tgname,c.relname) IN (('shared_wallet_player_guard','players'),('shared_wallet_reservation_guard','shared_wallet_reservations'),
          ('shared_wallet_reservation_changed','shared_wallet_reservations'),('shared_wallet_hand_guard','shared_wallet_hands'))) <> 4
    OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid='croupier_game.players'::regclass AND attname='wallet_gen'
      AND NOT attisdropped AND atttypid='bigint'::regtype AND attnotnull)
    OR (SELECT count(*) FROM pg_attribute WHERE attrelid='croupier_game.transactions'::regclass AND NOT attisdropped
      AND attname IN ('source_key','source_fingerprint') AND atttypid='text'::regtype AND NOT attnotnull) <> 2
    OR NOT EXISTS (SELECT FROM pg_index WHERE indexrelid=to_regclass('croupier_game.transactions_source_key') AND indisunique) THEN
    RAISE EXCEPTION 'ledger_backfill_structure_mismatch';
  END IF;
END $preflight$;
-- BACKFILL MUTATIONS
INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES
  ('game-006-player-profile',{{playerProfileChecksum}},{{playerProfileEvidence}},{{playerProfileAppliedOn}}),
  ('game-007-roulette-tables',{{rouletteTablesChecksum}},{{rouletteTablesEvidence}},{{rouletteTablesAppliedOn}}),
  ('game-008-shared-wallet',{{sharedWalletChecksum}},{{sharedWalletEvidence}},{{sharedWalletAppliedOn}}),
  ('game-009-shared-blackjack',{{sharedBlackjackChecksum}},{{sharedBlackjackEvidence}},{{sharedBlackjackAppliedOn}}),
  ('game-010-presentation-receiver',{{presentationReceiverChecksum}},{{presentationReceiverEvidence}},{{presentationReceiverAppliedOn}}),
  ('game-013-ledger-backfill',{{migrationChecksum}},{{evidence}},clock_timestamp()::text)
ON CONFLICT (version) DO NOTHING;
DO $postflight$
BEGIN
  IF (SELECT checksum FROM croupier_game.storage_migrations WHERE version='product-v1') IS DISTINCT FROM {{productChecksum}}
    OR (SELECT count(*) FROM croupier_game.storage_migrations m
      JOIN (VALUES ('game-006-player-profile',{{playerProfileChecksum}}),('game-007-roulette-tables',{{rouletteTablesChecksum}}),
        ('game-008-shared-wallet',{{sharedWalletChecksum}}),('game-009-shared-blackjack',{{sharedBlackjackChecksum}}),
        ('game-010-presentation-receiver',{{presentationReceiverChecksum}}),('game-013-ledger-backfill',{{migrationChecksum}}))
        AS expected(version,checksum) ON expected.version=m.version AND expected.checksum=m.checksum) <> 6 THEN
    RAISE EXCEPTION 'ledger_backfill_postflight_failed';
  END IF;
END $postflight$;
COMMIT;
