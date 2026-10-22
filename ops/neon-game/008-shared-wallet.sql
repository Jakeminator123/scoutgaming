-- Additive demo-wallet schema. Apply explicitly to the dedicated game database,
-- after product-schema.sql; runtime never installs it. No external wallet support.
BEGIN;
ALTER TABLE croupier_game.players ADD COLUMN IF NOT EXISTS wallet_gen BIGINT NOT NULL DEFAULT 0;
ALTER TABLE croupier_game.transactions ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE croupier_game.transactions ADD COLUMN IF NOT EXISTS source_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_key ON croupier_game.transactions(source_key) WHERE source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS croupier_game.shared_wallet_reservations (
  reservation_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES croupier_game.players(id),
  room_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('stake','insurance')),
  amount NUMERIC NOT NULL CHECK(amount > 0 AND amount::text NOT IN ('NaN','Infinity','-Infinity') AND amount=round(amount,2)),
  generation BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS shared_wallet_reservations_player ON croupier_game.shared_wallet_reservations(player_id);
-- A consumed reservation is no longer money on hold, but its unsettled hand still
-- prevents currency changes/account closure. The room writer maintains this set.
CREATE TABLE IF NOT EXISTS croupier_game.shared_wallet_hands (
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES croupier_game.players(id),
  PRIMARY KEY(room_id,player_id)
);
CREATE INDEX IF NOT EXISTS shared_wallet_hands_player ON croupier_game.shared_wallet_hands(player_id);

CREATE OR REPLACE FUNCTION croupier_game.shared_wallet_player_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE held NUMERIC;
BEGIN
  SELECT COALESCE(sum(amount),0) INTO held FROM croupier_game.shared_wallet_reservations WHERE player_id=OLD.id;
  IF NEW.balance::text IN ('NaN','Infinity','-Infinity') OR NEW.balance < held THEN
    RAISE EXCEPTION 'Balance cannot spend reserved funds' USING ERRCODE='23514', CONSTRAINT='shared_wallet_balance_guard';
  END IF;
  IF (NEW.currency IS DISTINCT FROM OLD.currency OR (NEW.status='closed' AND OLD.status IS DISTINCT FROM 'closed'))
     AND (held > 0 OR EXISTS(SELECT 1 FROM croupier_game.shared_wallet_hands WHERE player_id=OLD.id)) THEN
    RAISE EXCEPTION 'Finish shared hands and release reservations first' USING ERRCODE='23514', CONSTRAINT='shared_wallet_account_guard';
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.wallet_gen := OLD.wallet_gen + 1;
  ELSIF NEW.wallet_gen < OLD.wallet_gen THEN
    RAISE EXCEPTION 'Wallet generation cannot decrease' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shared_wallet_player_guard ON croupier_game.players;
CREATE TRIGGER shared_wallet_player_guard BEFORE UPDATE OF balance,currency,status,wallet_gen ON croupier_game.players
  FOR EACH ROW EXECUTE FUNCTION croupier_game.shared_wallet_player_guard();

-- All reservation writers, including explicit maintenance in a separate client,
-- serialize on P. J07 already holds these P locks before A. No trigger takes R/G/A.
CREATE OR REPLACE FUNCTION croupier_game.shared_wallet_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p croupier_game.players%ROWTYPE; held NUMERIC;
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM 1 FROM croupier_game.players WHERE id=OLD.player_id FOR UPDATE;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.reservation_id IS DISTINCT FROM OLD.reservation_id OR NEW.player_id IS DISTINCT FROM OLD.player_id
      OR NEW.room_id IS DISTINCT FROM OLD.room_id OR NEW.kind IS DISTINCT FROM OLD.kind) THEN
    RAISE EXCEPTION 'Reservation identity is immutable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO p FROM croupier_game.players WHERE id=NEW.player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player unavailable' USING ERRCODE='23503'; END IF;
  SELECT COALESCE(sum(amount),0) INTO held FROM croupier_game.shared_wallet_reservations
    WHERE player_id=NEW.player_id AND reservation_id<>NEW.reservation_id;
  IF held+NEW.amount > p.balance THEN
    RAISE EXCEPTION 'Reservation is not funded by available demo money' USING ERRCODE='23514', CONSTRAINT='shared_wallet_reservation_guard';
  END IF;
  IF p.status<>'active' THEN
    IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Player unavailable for a new reservation' USING ERRCODE='23514';
    ELSIF NEW.amount>OLD.amount THEN RAISE EXCEPTION 'Player unavailable for a larger reservation' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN NEW.generation := p.wallet_gen+1;
  ELSIF NEW.amount IS DISTINCT FROM OLD.amount THEN NEW.generation := p.wallet_gen+1;
  ELSE NEW.generation := OLD.generation;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION croupier_game.shared_wallet_reservation_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.amount IS NOT DISTINCT FROM OLD.amount THEN RETURN NULL; END IF;
  UPDATE croupier_game.players SET wallet_gen=wallet_gen+1 WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.player_id ELSE NEW.player_id END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS shared_wallet_reservation_guard ON croupier_game.shared_wallet_reservations;
CREATE TRIGGER shared_wallet_reservation_guard BEFORE INSERT OR UPDATE OR DELETE ON croupier_game.shared_wallet_reservations
  FOR EACH ROW EXECUTE FUNCTION croupier_game.shared_wallet_reservation_guard();
DROP TRIGGER IF EXISTS shared_wallet_reservation_changed ON croupier_game.shared_wallet_reservations;
CREATE TRIGGER shared_wallet_reservation_changed AFTER INSERT OR UPDATE OR DELETE ON croupier_game.shared_wallet_reservations
  FOR EACH ROW EXECUTE FUNCTION croupier_game.shared_wallet_reservation_changed();

CREATE OR REPLACE FUNCTION croupier_game.shared_wallet_hand_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE player_status TEXT;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Hand identity is immutable' USING ERRCODE='23514'; END IF;
  SELECT status INTO player_status FROM croupier_game.players
    WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.player_id ELSE NEW.player_id END FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player unavailable' USING ERRCODE='23503'; END IF;
  -- Blocking stops new funds/commands; a previously accepted stake still needs its marker.
  IF TG_OP='INSERT' AND player_status='closed' THEN
    RAISE EXCEPTION 'Player unavailable for a new hand' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shared_wallet_hand_guard ON croupier_game.shared_wallet_hands;
CREATE TRIGGER shared_wallet_hand_guard BEFORE INSERT OR UPDATE OR DELETE ON croupier_game.shared_wallet_hands
  FOR EACH ROW EXECUTE FUNCTION croupier_game.shared_wallet_hand_guard();
COMMIT;
