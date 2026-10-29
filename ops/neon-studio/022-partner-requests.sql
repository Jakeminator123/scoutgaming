-- Optional 022: partner requests (material, key rotation) as company journal entries.
-- Widens only the action CHECK of operator_audit_events (006) with 'request.material'
-- and 'request.key-rotation'. No table, column, row or other constraint changes, no seed
-- and no backfill; every existing row satisfies the wider list.
-- Tolerant code first: without 022 in the ledger the partner API answers
-- 503 studio_migration_required and writes nothing. Apply only after Jakob's explicit yes.
-- Rollback (only while no request rows exist): restore the 006 list with the same
-- DROP/ADD CONSTRAINT and delete the 022 ledger row.
ALTER TABLE croupier_studio.operator_audit_events DROP CONSTRAINT operator_audit_events_action_check,
  ADD CONSTRAINT operator_audit_events_action_check CHECK (action IN ('operator.create','role.save','membership.create','membership.update','team.invite','team.role','team.suspend','team.reactivate','membership.activate','membership.compensate','package.publish','request.material','request.key-rotation'));
