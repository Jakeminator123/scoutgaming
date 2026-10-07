-- Additive operator tenants. No seed and no backfill.
-- operator_memberships.user_id stores croupier_auth.users.id as text.
-- It is not a username and not a username digest. Usernames can change.
-- permissions, lanes, games, tables and branding are canonical JSON text.
CREATE TABLE croupier_studio.operators (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  slug text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' AND length(slug) <= 63),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status text NOT NULL CHECK (status IN ('active', 'suspended')),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  PRIMARY KEY (environment_id, workspace_id, operator_id),
  UNIQUE (environment_id, workspace_id, slug)
);
CREATE TABLE croupier_studio.operator_roles (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  role_id text NOT NULL CHECK (role_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  permissions text NOT NULL CHECK (length(permissions) BETWEEN 2 AND 4000),
  delegable boolean NOT NULL,
  PRIMARY KEY (environment_id, workspace_id, operator_id, role_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id)
);
CREATE TABLE croupier_studio.operator_memberships (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  user_id text NOT NULL CHECK (user_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  role_id text NOT NULL CHECK (role_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'invited')),
  revision bigint NOT NULL CHECK (revision >= 1),
  created_at_ms bigint NOT NULL CHECK (created_at_ms >= 0),
  PRIMARY KEY (environment_id, workspace_id, operator_id, user_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id),
  FOREIGN KEY (environment_id, workspace_id, operator_id, role_id)
    REFERENCES croupier_studio.operator_roles (environment_id, workspace_id, operator_id, role_id)
);
CREATE TABLE croupier_studio.operator_packages (
  environment_id text NOT NULL CHECK (environment_id ~ '^[a-z][a-z0-9_-]{0,62}$'),
  workspace_id text NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  operator_id text NOT NULL CHECK (operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'),
  package_revision bigint NOT NULL CHECK (package_revision >= 1),
  lanes text NOT NULL CHECK (length(lanes) BETWEEN 2 AND 8000),
  games text NOT NULL CHECK (length(games) BETWEEN 2 AND 8000),
  tables text NOT NULL CHECK (length(tables) BETWEEN 2 AND 8000),
  branding text NOT NULL CHECK (length(branding) BETWEEN 2 AND 8000),
  published_at_ms bigint NOT NULL CHECK (published_at_ms >= 0),
  PRIMARY KEY (environment_id, workspace_id, operator_id, package_revision),
  FOREIGN KEY (environment_id, workspace_id, operator_id)
    REFERENCES croupier_studio.operators (environment_id, workspace_id, operator_id)
);
CREATE INDEX operator_memberships_user_idx ON croupier_studio.operator_memberships (environment_id, workspace_id, user_id);
REVOKE ALL ON croupier_studio.operators, croupier_studio.operator_roles,
  croupier_studio.operator_memberships, croupier_studio.operator_packages FROM PUBLIC;
