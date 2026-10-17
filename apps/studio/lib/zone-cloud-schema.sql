-- Apply explicitly to the dedicated CROUPIER_ZONES_DATABASE_URL database.
-- Never apply this schema to the game or generic Preview database.
BEGIN;
CREATE SCHEMA IF NOT EXISTS croupier_zones;
CREATE TABLE IF NOT EXISTS croupier_zones.clips (
  id uuid PRIMARY KEY,
  width integer NOT NULL CHECK (width BETWEEN 4 AND 1080),
  height integer NOT NULL CHECK (height BETWEEN 4 AND 1920),
  media jsonb NOT NULL CHECK (jsonb_typeof(media) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS croupier_zones.documents (
  dealer text PRIMARY KEY CHECK (dealer = 'astrid'),
  revision integer NOT NULL CHECK (revision > 0),
  zones jsonb NOT NULL CHECK (jsonb_typeof(zones) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
