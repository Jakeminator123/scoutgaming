-- Optional 020: extend immutable presentation envelopes without changing old rows.
-- Ordinary editable branding remains bounded to 8000 bytes in the application.
ALTER TABLE croupier_studio.operator_packages DROP CONSTRAINT operator_packages_branding_check, ADD CONSTRAINT operator_packages_branding_check CHECK (length(branding) BETWEEN 2 AND 32768);
ALTER TABLE croupier_studio.operator_branding_drafts DROP CONSTRAINT operator_branding_drafts_branding_check, ADD CONSTRAINT operator_branding_drafts_branding_check CHECK (length(branding) BETWEEN 2 AND 32768);
