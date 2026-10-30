-- Optional 023 (plan L3): the published package's own tables, operator_packages.rooms:
-- canonical JSON text of the same v2 room records as administration.rooms[], at most 32.
-- Adds one nullable column with its length CHECK. No other table, column, row or constraint
-- changes, no seed and no backfill: older packages keep rooms NULL and read as before.
-- Tolerant code first: without 023 publishWithin writes no rooms and the readers keep the
-- administration document. Apply only after Jakob's explicit yes, in preview before production.
-- Rollback (only while no package has rooms): drop the column and delete the 023 ledger row.
ALTER TABLE croupier_studio.operator_packages ADD COLUMN rooms text CONSTRAINT operator_packages_rooms_check CHECK (rooms IS NULL OR length(rooms) BETWEEN 2 AND 20000);
