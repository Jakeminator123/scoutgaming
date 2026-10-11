-- Append-only operator configuration journal. No backfill, seed or business-data changes.
-- Retain indefinitely until an explicit retention policy is approved. No application delete path.
-- Membership/package revisions are native revisions; operator/role revisions are NULL.
-- Changes contain only server-selected IDs, grants and statuses, never credentials or mail addresses.
CREATE TABLE croupier_studio.operator_audit_events (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  event_id text NOT NULL CHECK (event_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  actor_id text NOT NULL CHECK (actor_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  access_class text NOT NULL CHECK (access_class IN ('internal-admin','partner','activation','system')),
  action text NOT NULL CHECK (action IN ('operator.create','role.save','membership.create','membership.update','team.invite','team.role','team.suspend','team.reactivate','membership.activate','membership.compensate','package.publish')),
  resource_type text NOT NULL CHECK (resource_type IN ('operator','role','membership','package')),
  resource_id text NOT NULL CHECK (resource_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  before_revision bigint CHECK (before_revision >= 1),
  after_revision bigint CHECK (after_revision >= 1),
  occurred_at_ms bigint NOT NULL CHECK (occurred_at_ms >= 0),
  request_id text NOT NULL CHECK (request_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  changes text NOT NULL CHECK (length(changes) BETWEEN 2 AND 10000),
  PRIMARY KEY (environment_id, workspace_id, operator_id, event_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id)
);
CREATE INDEX operator_audit_events_time_idx ON croupier_studio.operator_audit_events (environment_id, workspace_id, operator_id, occurred_at_ms DESC, event_id DESC);
REVOKE ALL ON croupier_studio.operator_audit_events FROM PUBLIC;
