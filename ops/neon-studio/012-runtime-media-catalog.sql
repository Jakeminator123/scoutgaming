-- Additive bridge for the isolated Neon media catalogue and reply registry.
-- Existing runtime paths do not use these tables until the explicit cutover.
CREATE TABLE croupier_studio.runtime_media_catalogs (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  revision text NOT NULL CHECK (revision ~ '^[a-f0-9]{64}$'),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object' AND value ? 'schemaVersion' AND value->>'schemaVersion' = '1'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment_id, workspace_id)
);

CREATE TABLE croupier_studio.speech_reply_records (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  dealer_id text NOT NULL CHECK (dealer_id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' AND length(dealer_id) <= 40),
  id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'
    AND value ?& ARRAY['schemaVersion','dealerId','id','revision']
    AND value->>'schemaVersion' = '1' AND value->>'dealerId' = dealer_id
    AND value->>'id' = id::text AND value->>'revision' = revision::text),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment_id, workspace_id, dealer_id, id)
);
REVOKE ALL ON croupier_studio.runtime_media_catalogs, croupier_studio.speech_reply_records FROM PUBLIC;
