-- Versioned Studio runner owns the transaction/schema/ledger. No implicit cost seed.
CREATE TABLE croupier_studio.speech_execution_leases (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  resource text NOT NULL CHECK (resource IN ('fullfile-provider', 'stream-session', 'operator-qa')),
  holder_id text NOT NULL CHECK (holder_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  fence bigint NOT NULL CHECK (fence BETWEEN 1 AND 9007199254740991),
  expires_at_ms bigint NOT NULL CHECK (expires_at_ms >= 0),
  recovery_only boolean NOT NULL DEFAULT false,
  PRIMARY KEY (environment_id, resource)
);
CREATE TABLE croupier_studio.speech_requests (
  environment_id text NOT NULL,
  request_key text NOT NULL CHECK (request_key ~ '^[a-f0-9]{64}$'),
  owner_hash text NOT NULL CHECK (owner_hash ~ '^[a-f0-9]{64}$'),
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  capability text NOT NULL CHECK (capability IN ('fullfile', 'stream')),
  state text NOT NULL CHECK (state IN ('reserved', 'submission_started', 'submission_uncertain', 'completed', 'failed')),
  lease_resource text NOT NULL,
  holder_id text NOT NULL,
  lease_fence bigint NOT NULL CHECK (lease_fence >= 1),
  package_id text,
  package_metadata jsonb,
  safe_error text,
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms bigint NOT NULL CHECK (updated_at_ms >= created_at_ms),
  PRIMARY KEY (environment_id, request_key),
  UNIQUE (environment_id, owner_hash, request_id),
  FOREIGN KEY (environment_id, lease_resource) REFERENCES croupier_studio.speech_execution_leases (environment_id, resource),
  CHECK ((package_id IS NULL) = (package_metadata IS NULL)),
  CHECK (package_metadata IS NULL OR (jsonb_typeof(package_metadata) = 'object' AND octet_length(package_metadata::text) <= 32768)),
  CHECK ((state = 'completed' AND capability = 'fullfile') = (package_id IS NOT NULL)),
  CHECK (safe_error IS NULL OR safe_error ~ '^(generated_speech_|invalid_generated_speech_|speech_|gpu_)[a-z_]{1,100}$')
);
CREATE TABLE croupier_studio.gpu_budget_policies (
  environment_id text PRIMARY KEY CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  version integer NOT NULL CHECK (version = 1),
  daily_budget_micro_usd bigint NOT NULL CHECK (daily_budget_micro_usd BETWEEN 1 AND 10000000),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0)
);
CREATE TABLE croupier_studio.gpu_sessions (
  environment_id text NOT NULL,
  session_id text NOT NULL CHECK (session_id ~ '^[a-f0-9]{32}$'),
  endpoint_id text NOT NULL CHECK (endpoint_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  worker_id text NOT NULL CHECK (worker_id = 'croupier-' || session_id),
  holder_id text NOT NULL,
  lease_resource text NOT NULL DEFAULT 'stream-session' CHECK (lease_resource = 'stream-session'),
  lease_fence bigint NOT NULL CHECK (lease_fence >= 1),
  state text NOT NULL CHECK (state IN ('reserved', 'submission_started', 'submission_uncertain', 'running', 'cancelling', 'terminal')),
  job_id text CHECK (job_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  cancel_requested_at_ms bigint,
  terminal_status text CHECK (terminal_status IN ('COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT')),
  terminal_reason text CHECK (terminal_reason IN ('provider', 'expired_missing_status')),
  released_at_ms bigint,
  PRIMARY KEY (environment_id, session_id),
  UNIQUE (environment_id, worker_id),
  FOREIGN KEY (environment_id, lease_resource) REFERENCES croupier_studio.speech_execution_leases (environment_id, resource),
  CHECK ((state = 'terminal') = (terminal_status IS NOT NULL)),
  CHECK ((terminal_status IS NULL) = (terminal_reason IS NULL)),
  CHECK (released_at_ms IS NULL OR (terminal_status IS NOT NULL AND released_at_ms >= created_at_ms)),
  CHECK (cancel_requested_at_ms IS NULL OR cancel_requested_at_ms >= created_at_ms)
);
CREATE UNIQUE INDEX gpu_sessions_open_idx ON croupier_studio.gpu_sessions (environment_id) WHERE released_at_ms IS NULL;
CREATE UNIQUE INDEX gpu_sessions_provider_job_idx ON croupier_studio.gpu_sessions (environment_id, endpoint_id, job_id) WHERE job_id IS NOT NULL;
-- Append-only through the adapter; no update/delete/refund API exists.
CREATE TABLE croupier_studio.gpu_reservations (
  environment_id text NOT NULL,
  session_id text NOT NULL,
  day date NOT NULL,
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd BETWEEN 1 AND 10000000),
  PRIMARY KEY (environment_id, session_id, day),
  FOREIGN KEY (environment_id, session_id) REFERENCES croupier_studio.gpu_sessions (environment_id, session_id),
  FOREIGN KEY (environment_id) REFERENCES croupier_studio.gpu_budget_policies (environment_id)
);
CREATE INDEX gpu_reservations_day_idx ON croupier_studio.gpu_reservations (environment_id, day);
REVOKE ALL ON croupier_studio.speech_execution_leases, croupier_studio.speech_requests,
  croupier_studio.gpu_budget_policies, croupier_studio.gpu_sessions, croupier_studio.gpu_reservations FROM PUBLIC;
