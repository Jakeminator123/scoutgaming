-- Immutable draft revisions are also the durable draft audit events.
-- Publication appends its marker in the same transaction as the published package and package audit.
-- Retain indefinitely until an explicit retention policy is approved. No application deletion path.
CREATE TABLE croupier_studio.operator_branding_drafts (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  draft_revision bigint NOT NULL CHECK (draft_revision >= 1),
  base_package_revision bigint NOT NULL CHECK (base_package_revision >= 1),
  branding text NOT NULL CHECK (length(branding) BETWEEN 2 AND 8000),
  source_package_revision bigint CHECK (source_package_revision >= 1),
  published_package_revision bigint CHECK (published_package_revision >= 1),
  action text NOT NULL CHECK (action IN ('draft.save','draft.restore','draft.publish')),
  event_id text NOT NULL CHECK (event_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  actor_id text NOT NULL CHECK (actor_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  access_class text NOT NULL CHECK (access_class IN ('internal-admin','partner','system')),
  occurred_at_ms bigint NOT NULL CHECK (occurred_at_ms >= 0),
  request_id text NOT NULL CHECK (request_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  changes text NOT NULL CHECK (length(changes) BETWEEN 2 AND 10000),
  CHECK ((action = 'draft.publish') = (published_package_revision IS NOT NULL)),
  CHECK ((action = 'draft.restore') = (source_package_revision IS NOT NULL)),
  PRIMARY KEY (environment_id, workspace_id, operator_id, draft_revision),
  UNIQUE (environment_id, workspace_id, operator_id, event_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id, base_package_revision)
    REFERENCES croupier_studio.operator_packages (environment_id, workspace_id, operator_id, package_revision),
  FOREIGN KEY (environment_id, workspace_id, operator_id, source_package_revision)
    REFERENCES croupier_studio.operator_packages (environment_id, workspace_id, operator_id, package_revision),
  FOREIGN KEY (environment_id, workspace_id, operator_id, published_package_revision)
    REFERENCES croupier_studio.operator_packages (environment_id, workspace_id, operator_id, package_revision)
);
CREATE INDEX operator_branding_drafts_time_idx ON croupier_studio.operator_branding_drafts (environment_id, workspace_id, operator_id, occurred_at_ms DESC, event_id DESC);
REVOKE ALL ON croupier_studio.operator_branding_drafts FROM PUBLIC;
