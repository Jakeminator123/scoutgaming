-- Additive request-owned fullfile costs. No legacy backfill, zero seed or refund.
-- The explicit operator bootstrap/import supplies reviewed bounds separately.
CREATE TABLE croupier_studio.fullfile_budget_policies (
  environment_id text PRIMARY KEY CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  version integer NOT NULL CHECK (version = 1),
  reserve_micro_usd bigint NOT NULL CHECK (reserve_micro_usd BETWEEN 1 AND 10000000),
  reservation_window_ms bigint NOT NULL CHECK (reservation_window_ms = 720000),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  FOREIGN KEY (environment_id) REFERENCES croupier_studio.gpu_budget_policies (environment_id)
);
CREATE TABLE croupier_studio.fullfile_reservations (
  environment_id text NOT NULL,
  request_key text NOT NULL,
  day date NOT NULL,
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd BETWEEN 1 AND 10000000),
  reserved_at_ms bigint NOT NULL CHECK (reserved_at_ms >= 0),
  PRIMARY KEY (environment_id, request_key, day),
  FOREIGN KEY (environment_id, request_key) REFERENCES croupier_studio.speech_requests (environment_id, request_key),
  FOREIGN KEY (environment_id) REFERENCES croupier_studio.fullfile_budget_policies (environment_id)
);
CREATE INDEX fullfile_reservations_day_idx ON croupier_studio.fullfile_reservations (environment_id, day);
REVOKE ALL ON croupier_studio.fullfile_budget_policies, croupier_studio.fullfile_reservations FROM PUBLIC;
