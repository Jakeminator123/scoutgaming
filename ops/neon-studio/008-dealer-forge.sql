-- Dealer Forge: Runway generation journal for dealer clips, speech, tables and backgrounds.
-- Committed media still lives in media_records / project.layerAssets; these rows only
-- track provider tasks, anchors (still poses) and per-dealer forge settings.
-- Additive. Apply through the explicit migration runner before dependent code is used.
CREATE TABLE croupier_studio.forge_dealers (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  dealer_id text NOT NULL CHECK (dealer_id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' AND length(dealer_id) <= 40),
  revision bigint NOT NULL CHECK (revision >= 1),
  profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment_id, workspace_id, dealer_id)
);

CREATE TABLE croupier_studio.forge_jobs (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  job_id uuid NOT NULL,
  dealer_id text NOT NULL CHECK (dealer_id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' AND length(dealer_id) <= 40),
  slot_id text NOT NULL CHECK (slot_id ~ '^[a-z][a-z0-9.-]{0,60}/[a-z0-9-]{0,40}$'),
  kind text NOT NULL CHECK (kind IN ('clip', 'speech', 'pose', 'table', 'background')),
  status text NOT NULL CHECK (status IN ('prepared', 'submitting', 'submit_unknown', 'queued', 'running', 'generated', 'committing', 'succeeded', 'failed', 'cancelled')),
  provider text NOT NULL CHECK (provider = 'runway'),
  task_id text CHECK (task_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  request jsonb NOT NULL CHECK (jsonb_typeof(request) = 'object'),
  result jsonb CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  error text CHECK (length(error) BETWEEN 1 AND 2000),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms bigint NOT NULL CHECK (updated_at_ms >= 0),
  PRIMARY KEY (environment_id, workspace_id, job_id)
);
CREATE INDEX forge_jobs_dealer_idx ON croupier_studio.forge_jobs (environment_id, workspace_id, dealer_id, created_at_ms DESC);
REVOKE ALL ON croupier_studio.forge_dealers, croupier_studio.forge_jobs FROM PUBLIC;
