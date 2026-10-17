-- Schema capacity only; no budget is raised and no reservation is rewritten.
-- A separate, explicit append-only amendment authorizes an existing budget ID.
ALTER TABLE croupier_studio.moving_speech_bindings DROP CONSTRAINT moving_speech_bindings_budget_limit_micro_usd_check, ADD CONSTRAINT moving_speech_bindings_budget_limit_micro_usd_check CHECK (budget_limit_micro_usd BETWEEN 1 AND 15000000);
CREATE TABLE croupier_studio.moving_speech_budget_amendments (
  environment_id text NOT NULL,
  workspace_id text NOT NULL,
  budget_id text NOT NULL CHECK (budget_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  amendment_id uuid NOT NULL,
  previous_limit_micro_usd bigint NOT NULL CHECK (previous_limit_micro_usd BETWEEN 1 AND 15000000),
  budget_limit_micro_usd bigint NOT NULL CHECK (budget_limit_micro_usd BETWEEN 1 AND 15000000),
  reserved_before_micro_usd bigint NOT NULL CHECK (reserved_before_micro_usd >= 0),
  amendment jsonb NOT NULL CHECK (jsonb_typeof(amendment) = 'object' AND octet_length(amendment::text) <= 4096),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  PRIMARY KEY (environment_id, budget_id, amendment_id),
  UNIQUE (environment_id, budget_id, previous_limit_micro_usd),
  CHECK (reserved_before_micro_usd <= previous_limit_micro_usd),
  CHECK (budget_limit_micro_usd > previous_limit_micro_usd)
);
REVOKE ALL ON croupier_studio.moving_speech_budget_amendments FROM PUBLIC;
