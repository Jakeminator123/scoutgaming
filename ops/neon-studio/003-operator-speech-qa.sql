-- Additive immutable QA policy storage. Only the explicit frozen-ledger import
-- supplies the original campaign/gate records; runtime cannot reset or enable.
CREATE TABLE croupier_studio.operator_qa_campaigns (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  campaign_id uuid NOT NULL,
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  expires_at_ms bigint NOT NULL CHECK (expires_at_ms > created_at_ms AND expires_at_ms - created_at_ms <= 1800000),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (environment_id, workspace_id, campaign_id)
);
CREATE TABLE croupier_studio.operator_qa_gate (
  environment_id text NOT NULL,
  workspace_id text NOT NULL,
  campaign_id uuid NOT NULL,
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  expires_at_ms bigint NOT NULL CHECK (expires_at_ms > created_at_ms AND expires_at_ms - created_at_ms <= 1800000),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (environment_id, workspace_id),
  FOREIGN KEY (environment_id, workspace_id, campaign_id)
    REFERENCES croupier_studio.operator_qa_campaigns (environment_id, workspace_id, campaign_id)
);
CREATE TABLE croupier_studio.operator_qa_attempts (
  environment_id text NOT NULL,
  workspace_id text NOT NULL,
  campaign_id uuid NOT NULL,
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  turn integer NOT NULL CHECK (turn IN (1, 2)),
  reserved_at_ms bigint NOT NULL CHECK (reserved_at_ms >= 0),
  actor text CHECK (length(actor) BETWEEN 1 AND 128),
  source_sha256 text CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  CHECK ((actor IS NULL) <> (source_sha256 IS NULL)),
  PRIMARY KEY (environment_id, workspace_id, campaign_id, attempt),
  FOREIGN KEY (environment_id, workspace_id, campaign_id)
    REFERENCES croupier_studio.operator_qa_campaigns (environment_id, workspace_id, campaign_id)
);
REVOKE ALL ON croupier_studio.operator_qa_campaigns, croupier_studio.operator_qa_gate,
  croupier_studio.operator_qa_attempts FROM PUBLIC;
