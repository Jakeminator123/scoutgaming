-- Player display name and language. Apply on the game database only
-- (schema croupier_game, the CROUPIER_GAME_DATABASE_URL Neon branch).
-- Do not apply it to the zones database. Do not edit product-schema.sql.
-- Jakob runs this against production Neon before the Render deploy that
-- writes the columns. Until then the profile route stays read-only and
-- /play/profil says the editor is not available yet.
ALTER TABLE croupier_game.players
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS locale text;

ALTER TABLE croupier_game.players
  DROP CONSTRAINT IF EXISTS players_display_name_check,
  ADD CONSTRAINT players_display_name_check CHECK (
    display_name IS NULL OR (
      char_length(display_name) BETWEEN 2 AND 40
      AND display_name = btrim(display_name)
      AND display_name !~ '[[:cntrl:]]'
    )
  ),
  DROP CONSTRAINT IF EXISTS players_locale_check,
  ADD CONSTRAINT players_locale_check CHECK (
    locale IS NULL OR locale IN ('sv', 'en')
  );
