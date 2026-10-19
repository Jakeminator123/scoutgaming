-- Deployment-optional: the control plane is not connected to a provider or HTTP route.
-- One row per environment, shared by all rooms and both GPU profiles.
CREATE TABLE croupier_studio.moving_drift_control (
  environment_id text PRIMARY KEY CHECK (environment_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  revision bigint NOT NULL CHECK (revision >= 0 AND revision <= 9007199254740991),
  state jsonb NOT NULL CHECK (
    jsonb_typeof(state) = 'object' AND octet_length(state::text) <= 32768
    AND state ?& ARRAY['schemaVersion','revision','desired']
    AND state->>'schemaVersion' = '1'
    AND state->>'revision' = revision::text
  )
);
REVOKE ALL ON croupier_studio.moving_drift_control FROM PUBLIC;
