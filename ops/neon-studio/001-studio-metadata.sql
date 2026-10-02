-- Immutable Studio v1. Apply only through the explicit migration runner.
-- No game/auth/zones changes and no old media catalogue import.
CREATE SCHEMA croupier_studio;
REVOKE ALL ON SCHEMA croupier_studio FROM PUBLIC;

CREATE TABLE croupier_studio.storage_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  structure_checksum text NOT NULL CHECK (structure_checksum ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE croupier_studio.documents (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  kind text NOT NULL CHECK (kind IN ('project', 'social-policy', 'administration')),
  revision text NOT NULL CHECK (revision ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'administration' OR (value ? 'revision' AND value->>'revision' = revision)),
  PRIMARY KEY (environment_id, workspace_id, kind)
);

CREATE TABLE croupier_studio.document_history (
  environment_id text NOT NULL,
  workspace_id text NOT NULL,
  kind text NOT NULL,
  revision text NOT NULL,
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  original_updated_at timestamptz NOT NULL,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  replaced_by text NOT NULL,
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 128),
  PRIMARY KEY (environment_id, workspace_id, kind, revision),
  FOREIGN KEY (environment_id, workspace_id, kind)
    REFERENCES croupier_studio.documents(environment_id, workspace_id, kind)
);

CREATE TABLE croupier_studio.audit_events (
  environment_id text NOT NULL,
  workspace_id text NOT NULL,
  event_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('initialize_document', 'save_document', 'import_document', 'register_media', 'classify_media')),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 100),
  revision text NOT NULL,
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 128),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment_id, workspace_id, event_id)
);

CREATE TABLE croupier_studio.media_records (
  environment_id text NOT NULL,
  workspace_id text NOT NULL,
  id uuid NOT NULL,
  revision text NOT NULL,
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object' AND record ?& ARRAY['id','sha256','contentType'] AND record->>'id' = id::text
    AND record->>'sha256' ~ '^[a-f0-9]{64}$' AND record->>'contentType' IN ('video/mp4', 'video/webm')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment_id, workspace_id, id)
);

REVOKE ALL ON croupier_studio.storage_migrations, croupier_studio.documents,
  croupier_studio.document_history, croupier_studio.audit_events,
  croupier_studio.media_records FROM PUBLIC;
