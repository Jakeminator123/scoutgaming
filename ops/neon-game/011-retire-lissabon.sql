-- Optional review artifact; render only with prepare-lissabon-retirement.mjs.
-- Never run on startup. Requires target-specific authorization and drained writers.
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
    RAISE EXCEPTION 'lissabon_retirement_target_mismatch';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname='croupier_game' AND nspowner=current_user::regrole)
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname IN ('lissabon_profiles','lissabon_profile_sessions','storage_migrations')
        AND c.relkind='r' AND c.relpersistence='p' AND c.relowner=current_user::regrole AND NOT c.relispartition
        AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity) <> 3 THEN
    RAISE EXCEPTION 'lissabon_retirement_owner_or_state_mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_event_trigger WHERE evtenabled <> 'D') THEN
    RAISE EXCEPTION 'lissabon_retirement_unknown_event_trigger';
  END IF;
END $target$;
SELECT pg_advisory_xact_lock(1935897197,811);
LOCK TABLE croupier_game.lissabon_profiles,croupier_game.lissabon_profile_sessions,croupier_game.storage_migrations IN ACCESS EXCLUSIVE MODE;
DO $preflight$
DECLARE tables oid[] := ARRAY['croupier_game.lissabon_profiles'::regclass,'croupier_game.lissabon_profile_sessions'::regclass];
BEGIN
  IF (SELECT count(*) FROM pg_class WHERE oid=ANY(tables) AND relkind='r' AND relpersistence='p'
      AND relowner=current_user::regrole AND NOT relispartition AND NOT relrowsecurity AND NOT relforcerowsecurity) <> 2
    OR NOT EXISTS (SELECT FROM pg_namespace WHERE nspname='croupier_game' AND nspowner=current_user::regrole)
    OR EXISTS (SELECT FROM pg_event_trigger WHERE evtenabled <> 'D') THEN
    RAISE EXCEPTION 'lissabon_retirement_owner_or_state_mismatch';
  END IF;
  IF (SELECT checksum FROM croupier_game.storage_migrations WHERE version='product-v1') IS DISTINCT FROM {{productChecksum}}
    OR EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='game-011-retire-lissabon') THEN
    RAISE EXCEPTION 'lissabon_retirement_ledger_mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_trigger WHERE tgrelid='croupier_game.storage_migrations'::regclass AND NOT tgisinternal)
    OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class='croupier_game.storage_migrations'::regclass)
    OR EXISTS (SELECT FROM pg_constraint WHERE conrelid='croupier_game.storage_migrations'::regclass AND contype NOT IN ('n','p')) THEN
    RAISE EXCEPTION 'lissabon_retirement_unknown_ledger_hook';
  END IF;
  IF EXISTS (SELECT FROM croupier_game.lissabon_profiles) OR EXISTS (SELECT FROM croupier_game.lissabon_profile_sessions) THEN
    RAISE EXCEPTION 'lissabon_retirement_not_empty';
  END IF;
  -- Reject drift that DROP RESTRICT would silently remove as an owned object.
  IF (SELECT array_agg(c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text ORDER BY c.relname,a.attnum)
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE a.attrelid=ANY(tables) AND a.attnum>0 AND NOT a.attisdropped)
      IS DISTINCT FROM ARRAY['lissabon_profile_sessions.digest:text:true','lissabon_profile_sessions.player_id:text:true','lissabon_profile_sessions.expires:bigint:true','lissabon_profiles.player_id:text:true','lissabon_profiles.name_key:text:true']
    OR EXISTS (SELECT FROM pg_attribute WHERE attrelid=ANY(tables) AND attnum>0 AND (attisdropped OR atthasdef OR attidentity<>'' OR attgenerated<>''))
    OR (SELECT array_agg(c.relname||':'||pg_get_constraintdef(k.oid) ORDER BY c.relname,pg_get_constraintdef(k.oid))
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE k.conrelid=ANY(tables) AND k.contype<>'n')
      IS DISTINCT FROM ARRAY['lissabon_profile_sessions:FOREIGN KEY (player_id) REFERENCES croupier_game.players(id)','lissabon_profile_sessions:PRIMARY KEY (digest)','lissabon_profiles:FOREIGN KEY (player_id) REFERENCES croupier_game.players(id)','lissabon_profiles:PRIMARY KEY (player_id)','lissabon_profiles:UNIQUE (name_key)']
    OR EXISTS (SELECT FROM pg_constraint WHERE conrelid=ANY(tables) AND (NOT convalidated OR condeferrable OR condeferred OR NOT conislocal))
    OR (SELECT count(*) FROM pg_index WHERE indrelid=ANY(tables)) <> 3
    OR EXISTS (SELECT FROM pg_index i WHERE i.indrelid=ANY(tables) AND
      (NOT i.indisunique OR NOT i.indisvalid OR NOT i.indisready OR i.indexprs IS NOT NULL OR i.indpred IS NOT NULL
        OR i.indnatts<>1 OR i.indnkeyatts<>1
        OR NOT EXISTS (SELECT FROM pg_constraint k WHERE k.conrelid=i.indrelid AND k.conindid=i.indexrelid AND k.contype IN ('p','u'))))
    OR EXISTS (SELECT FROM pg_inherits WHERE inhrelid=ANY(tables) OR inhparent=ANY(tables))
    OR EXISTS (SELECT FROM pg_trigger WHERE tgrelid=ANY(tables) AND NOT tgisinternal)
    OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class=ANY(tables))
    OR EXISTS (SELECT FROM pg_policy WHERE polrelid=ANY(tables)) THEN
    RAISE EXCEPTION 'lissabon_retirement_structure_mismatch';
  END IF;
  -- Only internal TOAST, row types, key indexes, own constraints and FK triggers may depend on these tables.
  IF EXISTS (SELECT FROM pg_depend d WHERE d.refclassid='pg_class'::regclass AND d.refobjid=ANY(tables)
    AND NOT (
      (d.classid='pg_type'::regclass AND EXISTS (SELECT FROM pg_type t WHERE t.oid=d.objid AND t.typrelid=d.refobjid))
      OR (d.classid='pg_class'::regclass AND EXISTS (SELECT FROM pg_index i WHERE i.indexrelid=d.objid AND i.indrelid=d.refobjid))
      OR (d.classid='pg_class'::regclass AND d.deptype='i' AND EXISTS (SELECT FROM pg_class c WHERE c.oid=d.refobjid AND c.reltoastrelid=d.objid))
      OR (d.classid='pg_constraint'::regclass AND EXISTS (SELECT FROM pg_constraint k WHERE k.oid=d.objid AND k.conrelid=d.refobjid))
      OR (d.classid='pg_trigger'::regclass AND EXISTS (SELECT FROM pg_trigger t JOIN pg_constraint k ON k.oid=t.tgconstraint
          WHERE t.oid=d.objid AND t.tgisinternal AND k.conrelid=ANY(tables) AND k.contype='f'))))
    OR EXISTS (SELECT FROM pg_depend d JOIN pg_class c ON c.oid=ANY(tables)
      JOIN pg_type row_type ON row_type.oid=c.reltype
      WHERE d.refclassid='pg_type'::regclass AND d.refobjid IN (row_type.oid,row_type.typarray)
        AND NOT (d.classid='pg_type'::regclass AND d.objid=row_type.typarray AND d.refobjid=row_type.oid))
    OR EXISTS (SELECT FROM pg_depend WHERE classid='pg_class'::regclass AND objid=ANY(tables) AND deptype IN ('e','x')) THEN
    RAISE EXCEPTION 'lissabon_retirement_unknown_dependency';
  END IF;
END $preflight$;
-- RETIREMENT MUTATIONS
DROP TABLE croupier_game.lissabon_profile_sessions RESTRICT;
DROP TABLE croupier_game.lissabon_profiles RESTRICT;
INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at)
VALUES ('game-011-retire-lissabon',{{migrationChecksum}},{{evidence}},clock_timestamp()::text);
DO $postflight$
BEGIN
  IF to_regclass('croupier_game.lissabon_profiles') IS NOT NULL OR to_regclass('croupier_game.lissabon_profile_sessions') IS NOT NULL
    OR NOT EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='product-v1' AND checksum={{productChecksum}})
    OR NOT EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='game-011-retire-lissabon' AND checksum={{migrationChecksum}}) THEN
    RAISE EXCEPTION 'lissabon_retirement_postflight_failed';
  END IF;
END $postflight$;
COMMIT;
