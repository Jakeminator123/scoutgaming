-- Optional 021: a company's own backgrounds and table graphics (Bolagets eget material).
-- Additive: no existing table, row or constraint changes, no seed and no backfill.
-- The application reads these tables only after this version is ledgered; without
-- 021 every publication behaves exactly as before (empty material, fixed write code).
-- Apply only after Jakob's explicit yes ("ja 021").
--
-- operator_materials is an append-only journal like 007: a new state is a new
-- revision row (pending -> approved | rejected, approved -> revoked). The rows are
-- also the durable audit events. asset is the exact canonical LayerAsset JSON from
-- layer-asset-contract.mjs; role and material_id repeat its own fields.
-- table_binding is the dealer landing template a table graphic was drawn for
-- (dealerId, profileId, laneId, templateSha256); a background has none.
-- A material id belongs to exactly one company in its workspace: revision 1 is
-- unique per workspace and every later revision refers to its own company's
-- revision 1 (first_revision). The server creates the id; ids already used by
-- Admin's project are refused by the application.
-- Retain indefinitely until an explicit retention policy is approved. No application delete path.
CREATE TABLE croupier_studio.operator_materials (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  material_id text NOT NULL CHECK (material_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  revision bigint NOT NULL CHECK (revision >= 1),
  state text NOT NULL CHECK (state IN ('pending','approved','rejected','revoked')),
  source text NOT NULL CHECK (source IN ('upload','ai')),
  role text NOT NULL CHECK (role IN ('background','table')),
  asset text NOT NULL CHECK (length(asset) BETWEEN 2 AND 4000),
  table_binding text CHECK (length(table_binding) BETWEEN 2 AND 1000),
  event_id text NOT NULL CHECK (event_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  actor_id text NOT NULL CHECK (actor_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  access_class text NOT NULL CHECK (access_class IN ('internal-admin','partner','system')),
  occurred_at_ms bigint NOT NULL CHECK (occurred_at_ms >= 0),
  request_id text NOT NULL CHECK (request_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  first_revision bigint NOT NULL CHECK (first_revision = 1),
  CHECK ((revision = 1) = (state = 'pending')),
  CHECK ((role = 'table') = (table_binding IS NOT NULL)),
  CHECK ((asset::jsonb ->> 'id') = material_id AND (asset::jsonb ->> 'role') = role),
  PRIMARY KEY (environment_id, workspace_id, operator_id, material_id, revision),
  UNIQUE (environment_id, workspace_id, material_id, revision),
  UNIQUE (environment_id, workspace_id, operator_id, event_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id, material_id, first_revision)
    REFERENCES croupier_studio.operator_materials (environment_id, workspace_id, operator_id, material_id, revision)
);
CREATE INDEX operator_materials_time_idx ON croupier_studio.operator_materials (environment_id, workspace_id, operator_id, occurred_at_ms DESC, event_id DESC);
-- One row per company. A missing row means daily AI limit 0 (off) and not blocked.
-- blocked stops new material and AI attempts; approved material stays until revoked.
CREATE TABLE croupier_studio.operator_material_policies (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  revision bigint NOT NULL CHECK (revision >= 1),
  daily_ai_limit integer NOT NULL CHECK (daily_ai_limit BETWEEN 0 AND 100),
  blocked boolean NOT NULL,
  actor_id text NOT NULL CHECK (actor_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  access_class text NOT NULL CHECK (access_class IN ('internal-admin','system')),
  updated_at_ms bigint NOT NULL CHECK (updated_at_ms >= 0),
  PRIMARY KEY (environment_id, workspace_id, operator_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id)
);
-- Counted under the company row lock before any provider call; a failed or
-- abandoned generation still counts. day is the UTC calendar day.
CREATE TABLE croupier_studio.operator_ai_attempts (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  attempt_id text NOT NULL CHECK (attempt_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  day date NOT NULL,
  actor_id text NOT NULL CHECK (actor_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  access_class text NOT NULL CHECK (access_class IN ('internal-admin','partner','system')),
  occurred_at_ms bigint NOT NULL CHECK (occurred_at_ms >= 0),
  PRIMARY KEY (environment_id, workspace_id, operator_id, attempt_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id)
);
CREATE INDEX operator_ai_attempts_day_idx ON croupier_studio.operator_ai_attempts (environment_id, workspace_id, operator_id, day);
REVOKE ALL ON croupier_studio.operator_materials, croupier_studio.operator_material_policies,
  croupier_studio.operator_ai_attempts FROM PUBLIC;
