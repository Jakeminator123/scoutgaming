import { validateActor, validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { DEMO_OPERATORS } from '../../web/demo-operators.mjs';

// The list lives in web/ so the game server can serve /api/operators/<slug> without lab/.
export const PARTNER_PREVIEW_OPERATORS = DEMO_OPERATORS;
export const DEFAULT_PARTNER_PREVIEW_OPERATOR = PARTNER_PREVIEW_OPERATORS[0].id;
const deny = (statusCode = 403) => { throw Object.assign(new Error('partner_preview_rejected'), { statusCode }); };
const sameScope = (left, right) => left.environment === right.environment && left.workspaceId === right.workspaceId;

export function partnerPreviewOperator(value) {
  return PARTNER_PREVIEW_OPERATORS.find(operator => operator.id === value || operator.slug === value) ?? null;
}

// This is an internal preview grant, never a real operator membership. No
// legacy reader/staff/player or future partner role is promoted to Studio admin.
export function createPartnerPreviewContext({ session, scope, operatorId, previewEnabled = false } = {}) {
  if (previewEnabled !== true) deny(503);
  if (!session) deny(401);
  if (!['admin', 'superadmin'].includes(session.role)) deny();
  let trustedScope, sessionScope, actor;
  try {
    trustedScope = validateStudioScope(scope);
    sessionScope = validateStudioScope(session.scope);
    actor = validateActor(session.user);
  } catch { deny(); }
  if (!sameScope(trustedScope, sessionScope)) deny();
  const operator = PARTNER_PREVIEW_OPERATORS.find(item => item.id === operatorId);
  if (!operator) deny(404);
  return Object.freeze({ preview: true, accessClass: 'internal', actor, role: 'admin', scope: trustedScope,
    operatorId: operator.id, permissions: Object.freeze(['preview.read']),
    membership: Object.freeze({ operatorId: operator.id, status: 'active', source: 'fixture-preview' }) });
}

// Every adapter resource is checked against the selected context, including
// accidentally mixed fixtures. No wildcard actions, rank comparisons or tenant
// ownership inferred from a UI brand ID. Real membership storage remains absent.
export function assertPartnerPreviewResourceAccess(context, { action, resource } = {}) {
  if (!context || context.preview !== true || context.accessClass !== 'internal' || context.role !== 'admin'
    || action !== 'preview.read' || !Array.isArray(context.permissions) || !context.permissions.includes(action)
    || context.membership?.status !== 'active' || context.membership?.source !== 'fixture-preview'
    || context.membership?.operatorId !== context.operatorId
    || !PARTNER_PREVIEW_OPERATORS.some(operator => operator.id === context.operatorId)
    || resource?.preview !== true || resource.operatorId !== context.operatorId) deny();
}
