-- Optional while moving speech is disabled. No mutation of Astrid's journals.
-- Each reservation is permanently spent, including failed/unknown submissions.
CREATE TABLE croupier_studio.moving_speech_bindings (
  environment_id text NOT NULL,
  workspace_id text NOT NULL,
  session_id text NOT NULL,
  request_key text NOT NULL,
  project_revision text NOT NULL,
  binding jsonb NOT NULL CHECK (jsonb_typeof(binding) = 'object' AND octet_length(binding::text) <= 4096),
  media_references jsonb NOT NULL CHECK (jsonb_typeof(media_references) = 'array' AND jsonb_array_length(media_references) BETWEEN 1 AND 128 AND octet_length(media_references::text) <= 131072),
  budget_id text NOT NULL CHECK (budget_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  budget_limit_micro_usd bigint NOT NULL CHECK (budget_limit_micro_usd BETWEEN 1 AND 5000000),
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd BETWEEN 1 AND 5000000),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  PRIMARY KEY (environment_id, session_id),
  UNIQUE (environment_id, request_key),
  FOREIGN KEY (environment_id, session_id) REFERENCES croupier_studio.gpu_sessions (environment_id, session_id),
  FOREIGN KEY (environment_id, request_key) REFERENCES croupier_studio.speech_requests (environment_id, request_key),
  CHECK (reserved_micro_usd <= budget_limit_micro_usd)
);
REVOKE ALL ON croupier_studio.moving_speech_bindings FROM PUBLIC;
