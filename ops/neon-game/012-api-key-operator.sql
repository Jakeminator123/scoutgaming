-- Optional review artifact; render only with prepare-api-key-operator.mjs (docs/plans/NYCKEL-BOLAG.md).
-- Never run on startup. Binds every partner key to exactly one company: api_keys.operator_id,
-- the same identifier as croupier_studio.operators.operator_id. The table must be empty, so the
-- column is NOT NULL from the start and nothing is backfilled. A company never changes on a key.
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
    RAISE EXCEPTION 'api_key_operator_target_mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_namespace WHERE nspname IN ('croupier_auth','croupier_game') AND nspowner=current_user::regrole) <> 2
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE (n.nspname='croupier_auth' AND c.relname='api_keys' OR n.nspname='croupier_game' AND c.relname='storage_migrations')
        AND c.relkind='r' AND c.relpersistence='p' AND c.relowner=current_user::regrole AND NOT c.relispartition
        AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity) <> 2 THEN
    RAISE EXCEPTION 'api_key_operator_owner_or_state_mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_event_trigger WHERE evtenabled <> 'D') THEN
    RAISE EXCEPTION 'api_key_operator_unknown_event_trigger';
  END IF;
END $target$;
SELECT pg_advisory_xact_lock(1935897197,812);
LOCK TABLE croupier_auth.api_keys,croupier_game.storage_migrations IN ACCESS EXCLUSIVE MODE;
DO $preflight$
DECLARE keys oid := 'croupier_auth.api_keys'::regclass;
BEGIN
  IF (SELECT checksum FROM croupier_game.storage_migrations WHERE version='product-v1') IS DISTINCT FROM {{productChecksum}}
    OR EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='game-012-api-key-operator') THEN
    RAISE EXCEPTION 'api_key_operator_ledger_mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_trigger WHERE tgrelid='croupier_game.storage_migrations'::regclass AND NOT tgisinternal)
    OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class='croupier_game.storage_migrations'::regclass)
    OR EXISTS (SELECT FROM pg_constraint WHERE conrelid='croupier_game.storage_migrations'::regclass AND contype NOT IN ('n','p')) THEN
    RAISE EXCEPTION 'api_key_operator_unknown_ledger_hook';
  END IF;
  -- The product-v1 shape exactly: no operator column yet, no hooks a new column could wake up.
  IF (SELECT array_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid=keys AND a.attnum>0 AND NOT a.attisdropped)
      IS DISTINCT FROM ARRAY['id:text:true','name:text:true','key:text:true','secret:text:true','scopes:text:true',
        'wallet_url:text:false','ip_allow:text:false','created_by:text:false','created_at:text:true','last_used:text:false','revoked_at:text:false']
    OR EXISTS (SELECT FROM pg_attribute WHERE attrelid=keys AND attnum>0 AND (attisdropped OR atthasdef OR attidentity<>'' OR attgenerated<>''))
    OR (SELECT array_agg(pg_get_constraintdef(oid) ORDER BY pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid=keys AND contype<>'n')
      IS DISTINCT FROM ARRAY['PRIMARY KEY (id)','UNIQUE (key)']
    OR (SELECT count(*) FROM pg_index WHERE indrelid=keys) <> 2
    OR to_regclass('croupier_auth.api_keys_operator_idx') IS NOT NULL
    OR EXISTS (SELECT FROM pg_inherits WHERE inhrelid=keys OR inhparent=keys)
    OR EXISTS (SELECT FROM pg_trigger WHERE tgrelid=keys AND NOT tgisinternal)
    OR EXISTS (SELECT FROM pg_rewrite WHERE ev_class=keys)
    OR EXISTS (SELECT FROM pg_policy WHERE polrelid=keys)
    OR EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='croupier_auth' AND p.proname='api_key_operator_immutable') THEN
    RAISE EXCEPTION 'api_key_operator_structure_mismatch';
  END IF;
  -- Delete test keys first (preview, staging); a key without a company cannot be given one afterwards.
  IF EXISTS (SELECT FROM croupier_auth.api_keys) THEN
    RAISE EXCEPTION 'api_key_operator_not_empty';
  END IF;
END $preflight$;
-- MIGRATION MUTATIONS
ALTER TABLE croupier_auth.api_keys ADD COLUMN operator_id text NOT NULL
  CONSTRAINT api_keys_operator_id_check CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$');
CREATE INDEX api_keys_operator_idx ON croupier_auth.api_keys (operator_id);
CREATE FUNCTION croupier_auth.api_key_operator_immutable() RETURNS trigger LANGUAGE plpgsql
  SET search_path = pg_catalog AS $immutable$
BEGIN
  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    RAISE EXCEPTION 'api_key_operator_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $immutable$;
REVOKE ALL ON FUNCTION croupier_auth.api_key_operator_immutable() FROM PUBLIC;
CREATE TRIGGER api_keys_operator_immutable BEFORE UPDATE OF operator_id ON croupier_auth.api_keys
  FOR EACH ROW EXECUTE FUNCTION croupier_auth.api_key_operator_immutable();
INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at)
VALUES ('game-012-api-key-operator',{{migrationChecksum}},{{evidence}},clock_timestamp()::text);
DO $postflight$
DECLARE keys oid := 'croupier_auth.api_keys'::regclass;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid=keys AND attname='operator_id' AND NOT attisdropped
      AND attnotnull AND format_type(atttypid,atttypmod)='text')
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid=keys AND conname='api_keys_operator_id_check' AND contype='c' AND convalidated)
    OR NOT EXISTS (SELECT FROM pg_index WHERE indrelid=keys AND indexrelid=to_regclass('croupier_auth.api_keys_operator_idx') AND indisvalid)
    OR NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid=keys AND tgname='api_keys_operator_immutable' AND NOT tgisinternal AND tgenabled='O')
    OR EXISTS (SELECT FROM croupier_auth.api_keys)
    OR NOT EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='product-v1' AND checksum={{productChecksum}})
    OR NOT EXISTS (SELECT FROM croupier_game.storage_migrations WHERE version='game-012-api-key-operator' AND checksum={{migrationChecksum}}) THEN
    RAISE EXCEPTION 'api_key_operator_postflight_failed';
  END IF;
END $postflight$;
COMMIT;
