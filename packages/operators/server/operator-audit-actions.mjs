// Bolagsjournalens åtgärder (croupier_studio.operator_audit_events.action).
// Listan speglar tabellens CHECK: 006 skapade den, Studio-migrering 022 utökar
// den med partnerns begäran (material, nyckelrotation). operator-store.mjs och
// ops/neon-studio/migrations.mjs läser härifrån, så att lagret, migreringens
// källa och strukturbeviset aldrig glider isär.
export const OPERATOR_AUDIT_ACTIONS_006 = Object.freeze(['operator.create', 'role.save', 'membership.create', 'membership.update',
  'team.invite', 'team.role', 'team.suspend', 'team.reactivate', 'membership.activate', 'membership.compensate', 'package.publish']);
export const PARTNER_REQUEST_ACTIONS = Object.freeze(['request.material', 'request.key-rotation']);
export const OPERATOR_AUDIT_ACTIONS = Object.freeze([...OPERATOR_AUDIT_ACTIONS_006, ...PARTNER_REQUEST_ACTIONS]);
// Tolerant kod före 022: utan versionen i ledgern skriver lagret ingen begäran
// och svarar 503 studio_migration_required.
export const PARTNER_REQUEST_STORAGE_VERSION = '022';
export const OPERATOR_AUDIT_ACTION_CONSTRAINT = 'operator_audit_events_action_check';
// Migreringens enda sats, exakt (blanktecken normaliserade), och CHECK:en som
// PostgreSQL återger den (pg_get_constraintdef) före och efter 022.
const quoted = actions => actions.map(action => `'${action}'`).join(',');
export const PARTNER_REQUEST_ALTER = `ALTER TABLE croupier_studio.operator_audit_events DROP CONSTRAINT ${OPERATOR_AUDIT_ACTION_CONSTRAINT}, ADD CONSTRAINT ${OPERATOR_AUDIT_ACTION_CONSTRAINT} CHECK (action IN (${quoted(OPERATOR_AUDIT_ACTIONS)}))`;
export const operatorAuditActionCheck = actions => `CHECK (action = ANY (ARRAY[${actions.map(action => `'${action}'::text`).join(', ')}]))`;
