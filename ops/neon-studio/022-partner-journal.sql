-- Optional 022: the partner's own actions as company journal entries: pausing or
-- opening a table (room.state), saving a game settings draft (room.settings) and
-- requesting material or a key rotation (request.material, request.key-rotation).
-- Widens only the action CHECK of operator_audit_events (006). No table, column, row or
-- other constraint changes, no seed and no backfill; every existing row satisfies the wider list.
-- Tolerant code first: without 022 in the ledger those partner API actions answer
-- 503 studio_migration_required and write nothing. Apply only after Jakob's explicit yes.
-- Rollback (only while no such rows exist): restore the 006 list with the same
-- DROP/ADD CONSTRAINT and delete the 022 ledger row.
ALTER TABLE croupier_studio.operator_audit_events DROP CONSTRAINT operator_audit_events_action_check,
  ADD CONSTRAINT operator_audit_events_action_check CHECK (action IN ('operator.create','role.save','membership.create','membership.update','team.invite','team.role','team.suspend','team.reactivate','membership.activate','membership.compensate','package.publish','room.state','room.settings','request.material','request.key-rotation'));
