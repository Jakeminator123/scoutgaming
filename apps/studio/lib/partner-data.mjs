import { PARTNER_PERMISSIONS, PARTNER_VIEW_PERMISSIONS } from '../../../packages/studio-access/server/partner-access-policy.mjs';
import { PARTNER_VIEWS } from '../../../packages/navigation/workspace-surfaces.mjs';
import { gameStartPath } from '../../../packages/navigation/game-entry.mjs';
import { allowsWorkspaceResource, internalPartnerContext } from './partner-workspace-access.mjs';
import { assertNativeStudioRequest } from './studio-native-runtime.mjs';
import { normalizeNativeStudioPageRequest } from './studio-native-request.mjs';
import { authorizePartnerWorkspace, partnerApiBase, partnerAuthConfig } from './partner-session.mjs';
import { readPackagePresentation, publicPackageBranding, resolvePackageRoomDealer } from '../../../packages/presentation/server/presentation-package.mjs';
import { partnerPackageProfiles, partnerLayerChoices } from './partner-package-view.mjs';
import { materialLabel } from '../../../packages/presentation/contracts/material-catalog.mjs';
import { gameLaneConfiguration } from '../../../packages/presentation/contracts/game-lanes.mjs';
import { isPresentationRoomLaneCompatible } from '../../../packages/presentation/server/frozen-presentation-capture.mjs';
import {listPackageRooms} from '../../../packages/presentation/server/package-rooms.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { readPartnerReports, readPublishedRoomSettings } from './partner-game-readout.mjs';
import { partnerRoleWord } from '../components/kevin-bo/partner-copy.mjs';

export const INTERNAL_ROLE = Object.freeze({ id: 'internal-admin', label: 'Scoutgamings personal' });

function fail(statusCode = 403) {
  throw Object.assign(new Error('partner_data_rejected'), { statusCode });
}
function sameScope(left, right) {
  return !!left && !!right && left.environment === right.environment && left.workspaceId === right.workspaceId;
}
function canonicalOperator(operator) {
  if (!operator || typeof operator !== 'object') return null;
  const id = operator.id ?? operator.operatorId ?? operator.operator_id;
  const slug = operator.slug;
  if (typeof id !== 'string' || typeof slug !== 'string' || !id || !slug) return null;
  const name = typeof operator.name === 'string' && operator.name.trim() ? operator.name : slug;
  return { id, slug, name, status: operator.status, scope: operator.scope };
}
function parseList(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}
function owned(item, operatorId, fields) {
  if (typeof item === 'string' && item.trim()) return { id: item, name: item, operatorId };
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if (item.operatorId !== undefined && item.operatorId !== operatorId) fail(403);
  const id = item.id ?? item.laneId ?? item.slug;
  if (typeof id !== 'string' || !id) return null;
  const copy = { id, operatorId };
  for (const key of fields) if (item[key] !== undefined) copy[key] = item[key];
  if (typeof copy.name !== 'string' || !copy.name) copy.name = id;
  return copy;
}
function revisionOf(pack) {
  const value = pack?.packageRevision ?? pack?.package_revision ?? pack?.revision;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return '';
}
async function openOperatorStore(config) {
  if (config?.store) return config.store;
  let createOperatorStore;
  try {
    ({ createOperatorStore } = await import('../../../packages/operators/server/operator-store.mjs'));
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') fail(503);
    throw error;
  }
  if (typeof createOperatorStore !== 'function' || typeof config.pool?.query !== 'function') fail(503);
  return await createOperatorStore({
    sql: { query: (text, values) => config.pool.query(text, values) },
    scope: config.scope,
    now: config.now,
  });
}
async function roomAdministration(config) {
  if (typeof config.readAdministration === 'function') return config.readAdministration();
  if (typeof config.pool?.connect !== 'function') fail(503);
  const repository = createStudioRepository({ pool: config.pool, scope: config.scope });
  const document = await repository.readDocument('administration');
  if (!document) fail(503);
  return document.value;
}
async function membershipFor(store, operatorId, userId) {
  if (typeof store.getMembership !== 'function') fail(503);
  return store.getMembership(operatorId, userId);
}
function teamRow(membership, role, session, operatorId) {
  const userId = String(membership.userId || session.accountId);
  return owned({
    id: userId,
    name: typeof membership.name === 'string' && membership.name.trim() ? membership.name : (userId === session.accountId ? session.user : userId),
    email: typeof membership.email === 'string' ? membership.email : '',
    role: role?.label || role?.name || role?.id || membership.roleId,
    status: membership.status,
  }, operatorId, ['name', 'email', 'role', 'status']);
}
async function roleFor(store, operatorId, context) {
  if (typeof store.getRole !== 'function') return context.role;
  const loaded = await store.getRole(operatorId, context.membership.roleId);
  return loaded?.id === context.role?.id ? loaded : context.role;
}
async function teamFromStore(store, operatorId, session) {
  const members = await store.listMemberships(operatorId);
  if (!Array.isArray(members)) fail(503);
  const rows = [];
  for (const membership of members) {
    if (membership?.operatorId && membership.operatorId !== operatorId) fail(403);
    const role = typeof store.getRole === 'function' ? await store.getRole(operatorId, membership.roleId) : null;
    const row = teamRow(membership, role, session, operatorId);
    if (row) rows.push(row);
  }
  return rows;
}
async function memberOperators(store, session) {
  if (typeof store.listOperators !== 'function') fail(503);
  const listed = await store.listOperators();
  if (!Array.isArray(listed)) fail(503);
  const operators = [];
  for (const raw of listed) {
    const operator = canonicalOperator(raw);
    if (!operator || operator.status !== 'active') continue;
    if (operator.scope && !sameScope(operator.scope, session.scope)) continue;
    if (session.accessClass === 'internal-admin') {
      const context = internalPartnerContext(session, operator);
      if (allowsWorkspaceResource(context, 'overview.read', { scope: session.scope, operatorId: operator.id })) {
        operators.push({ id: operator.id, slug: operator.slug, name: operator.name });
      }
      continue;
    }
    const membership = await membershipFor(store, operator.id, session.accountId);
    if (!membership || membership.status !== 'active') continue;
    if (membership.userId && String(membership.userId) !== session.accountId) continue;
    if (membership.scope && !sameScope(membership.scope, session.scope)) continue;
    operators.push({ id: operator.id, slug: operator.slug, name: operator.name });
  }
  return operators;
}
function snapshotBase(session, now) {
  return {
    schemaVersion: 2,
    preview: false,
    mode: 'live',
    accessClass: session.accessClass,
    viewer: { user: session.user, accessClass: session.accessClass },
    generatedAt: new Date(now).toISOString(),
  };
}
function roleOf(session, context) {
  if (session.accessClass === 'internal-admin') return { ...INTERNAL_ROLE };
  const id = typeof context.role?.id === 'string' ? context.role.id : String(context.membership?.roleId ?? '');
  return { id, label: partnerRoleWord(id, typeof context.role?.label === 'string' ? context.role.label : '') };
}
// Tilldelningen ur det frysta paketet: spel, dealers, scenmallar och det material
// mallarna tillåter. Insatsprofiler finns inte i paketet; de läses från rummens
// publicerade spelinställningar när de finns.
function assignmentOf(pack, presentation, settings) {
  const label = (id, role) => { const asset = presentation?.assets?.find(item => item.id === id && item.role === role); return asset ? materialLabel(asset) : id; };
  const materials = role => [...new Set((presentation?.lanes ?? []).flatMap(lane => partnerLayerChoices(lane, role)))].map(id => ({ id, label: label(id, role) }));
  const dealers = presentation?.registeredDealers?.length ? presentation.registeredDealers.map(dealer => ({ id: dealer.id, label: dealer.label ?? dealer.id }))
    : [...new Set((presentation?.lanes ?? []).flatMap(lane => lane.layers?.dealer?.allowed ?? []))].map(id => ({ id, label: id }));
  const limitPresets = [...new Set([...settings.values()].map(row => row.limitPreset))].sort();
  return {
    games: [...(Array.isArray(pack?.games) ? pack.games : [])],
    dealers, lanes: (presentation?.lanes ?? []).map(lane => ({ id: lane.id, label: lane.label })),
    backgrounds: materials('background'), tables: materials('table'),
    ...(limitPresets.length ? { limitPresets } : {}),
  };
}
async function draftOf(store, operatorId) {
  if (typeof store.getBrandingDraft !== 'function') return null;
  const draft = await store.getBrandingDraft(operatorId);
  if (!draft || draft.operatorId !== operatorId || draft.action === 'draft.publish') return null;
  return { revision: draft.revision, basePackageRevision: draft.basePackageRevision, updatedAt: draft.updatedAt ?? null };
}
async function publicationsOf(store, operatorId) {
  if (typeof store.listPackages !== 'function') return [];
  const rows = await store.listPackages(operatorId, { limit: 20 });
  return (Array.isArray(rows) ? rows : []).filter(row => row.operatorId === operatorId).map(row => ({ revision: row.revision, publishedAt: row.publishedAtMs ?? null }));
}

export async function partnerWorkspaceData(request, { operatorSlug, store, config, view = 'overview' } = {}) {
  if (!PARTNER_VIEWS.includes(view)) fail(404);
  const resolved = config ?? await partnerAuthConfig();
  const session = await authorizePartnerWorkspace(request, resolved);
  const operators = store ?? await openOperatorStore(resolved);
  const now = typeof resolved.now === 'function' ? resolved.now() : Date.now();
  const visible = await memberOperators(operators, session);
  if (!operatorSlug) {
    if (!visible.length && session.accessClass !== 'internal-admin') fail(403);
    return { ...snapshotBase(session, now), operators: visible, permissions: [], presentations: [], tables: [], team: [] };
  }
  if (typeof operators.getOperatorBySlug !== 'function' || typeof operators.getCurrentPackage !== 'function') fail(503);
  const operator = canonicalOperator(await operators.getOperatorBySlug(operatorSlug));
  if (!operator || operator.slug !== operatorSlug) fail(404);
  if (operator.scope && !sameScope(operator.scope, session.scope)) fail(403);
  if (operator.status && operator.status !== 'active') fail(403);
  let context, membership;
  if (session.accessClass === 'internal-admin') context = internalPartnerContext(session, operator);
  else {
    if (typeof operators.resolvePartnerContext !== 'function') fail(503);
    context = await operators.resolvePartnerContext({
      account: { userId: session.accountId, role: 'partner', status: 'active' },
      operatorSlug,
    });
    if (!context || context.internalPreview === true) fail(403);
    if (context.operator?.id !== operator.id || (context.operator?.slug && context.operator.slug !== operator.slug)) fail(403);
    if (context.account?.userId !== session.accountId || context.account?.role !== 'partner') fail(403);
    if (context.membership?.status !== 'active' || context.operator?.status !== 'active' || context.account?.status !== 'active') fail(403);
    membership = await membershipFor(operators, operator.id, session.accountId);
    if (!membership || membership.status !== 'active' || (membership.userId && String(membership.userId) !== session.accountId)) fail(403);
    // The role is loaded independently of any cached context, so removing a role
    // or one of its permissions takes effect on the next snapshot.
    context = { ...context, membership, role: typeof operators.getRole === 'function'
      ? await operators.getRole(operator.id, membership.roleId) : context.role };
  }
  const resource = { scope: context.scope, operatorId: context.operator.id };
  const may = permission => allowsWorkspaceResource(context, permission, resource);
  if (!may('overview.read')) fail(403);
  const permissions = PARTNER_PERMISSIONS.filter(may);
  const role = roleOf(session, context);
  // Vyns behörighet avgörs här, på servern. En nekad vy får skalet och ett
  // 403-kort; dess data läses inte (varje avsnitt nedan är gated för sig).
  const required = PARTNER_VIEW_PERMISSIONS[view];
  const denied = may(required) ? null : { view, permission: required, role };
  const team = !may('team.read') ? [] : typeof operators.listMemberships === 'function'
    ? await teamFromStore(operators, operator.id, session)
    : membership ? [teamRow(membership, await roleFor(operators, operator.id, context), session, operator.id)] : [];
  const pack = await operators.getCurrentPackage(operator.id);
  if (pack?.operatorId && pack.operatorId !== operator.id) fail(403);
  const presentation = readPackagePresentation(pack);
  const branding = publicPackageBranding(pack?.branding);
  const presentations = presentation ? partnerPackageProfiles(presentation, branding, operator.id)
    : parseList(pack?.presentations ?? pack?.lanes).map(item => owned(item, operator.id, ['name', 'dealer', 'language', 'background', 'status'])).filter(Boolean);
  const administration = presentation ? await roomAdministration(resolved) : null;
  const gameLanes = presentation ? gameLaneConfiguration(administration).gameLanes : [];
  const query = typeof resolved.pool?.query === 'function' ? (text, values) => resolved.pool.query(text, values) : null;
  const bindings = pack?.branding?.roomGameConfigVersions;
  const rooms = presentation
    ? listPackageRooms({ administration, package: pack, operatorId: operator.id })
      .filter(room => isPresentationRoomLaneCompatible(gameLanes.find(lane => lane.id === room.gameLaneId),
        presentation.lanes.find(lane => lane.id === room.presentationLaneId), presentation,room.game??'blackjack'))
    : [];
  const settings = presentation && may('tables.read')
    ? await readPublishedRoomSettings({ query, operatorId: operator.id, rooms: rooms.map(room => ({ id: room.id, configVersion: bindings?.[room.id] })) }) : new Map();
  const dealerLabel = id => presentation?.registeredDealers?.find(dealer => dealer.id === id)?.label ?? id;
  const tables = presentation
    ? rooms.map(room => {
      const game = room.game ?? 'blackjack', live = room.state === 'live';
      let dealer = null; try { dealer = resolvePackageRoomDealer(pack, room, presentation); } catch { dealer = null; }
      const configVersion = typeof bindings?.[room.id] === 'string' ? bindings[room.id] : null, config = settings.get(room.id);
      return { id: room.id, name: room.name, operatorId: room.operatorId, game, state: room.state,
        status: live ? 'active' : room.state, presentationId: room.presentationLaneId,
        dealer: dealer ? { id: dealer, label: dealerLabel(dealer) } : null, configVersion,
        ...(config ? { settings: { language: config.language, limitPreset: config.limitPreset } } : {}),
        playUrl: live ? gameStartPath({ game, operator: operator.slug, table: room.id }) : null };
    })
    : parseList(pack?.tables).map(item => owned(item, operator.id, ['name', 'game', 'status', 'playerCount', 'presentationId'])).filter(Boolean);
  const revision = revisionOf(pack);
  const current = { id: operator.id, slug: operator.slug, name: operator.name, ...(revision ? { packageRevision: revision } : {}) };
  const choices = visible.some(item => item.id === operator.id) ? visible : [current, ...visible];
  const reports = may('reports.read') && ['overview', 'reports', 'rooms'].includes(view)
    ? await readPartnerReports({ query, operatorId: operator.id, roomIds: tables.map(table => table.id), now }) : null;
  return {
    ...snapshotBase(session, now),
    ...(revision ? { packageRevision: revision } : {}),
    ...(pack?.publishedAtMs ? { publishedAt: pack.publishedAtMs } : {}),
    operator: current,
    role,
    permissions,
    view,
    ...(denied ? { denied } : {}),
    operators: choices.map(item => ({ id: item.id, slug: item.slug, name: item.name })),
    presentations,
    ...(presentation ? { presentation, branding, roomBindings: 'operator-owned-v2' } : {}),
    tables,
    team,
    invitations: team.filter(member => member.status === 'invited').length,
    assignment: assignmentOf(pack, presentation, settings),
    draft: may('tables.read') ? await draftOf(operators, operator.id) : null,
    publications: may('reports.read') ? await publicationsOf(operators, operator.id) : [],
    ...(reports ? { reports } : {}),
    summary: { activeTables: presentation ? tables.filter(table => table.status === 'active').length : tables.length },
  };
}

export async function partnerWorkspaceInitialData(request, { operatorSlug, store, config, view } = {}) {
  const resolved = config ?? await partnerAuthConfig();
  const normalized = normalizeNativeStudioPageRequest(request, resolved);
  assertNativeStudioRequest(normalized, resolved);
  const path = new URL(normalized.url).pathname;
  if (!/^\/(?:studio\/)?partner(?:\/[a-z0-9][a-z0-9-]*){0,2}$/.test(path)) fail(404);
  const snapshot = await partnerWorkspaceData(normalized, { operatorSlug, store, config: resolved, ...(view ? { view } : {}) });
  return {
    snapshot,
    apiBase: `${partnerApiBase(resolved)}/snapshot`,
    session: { user: snapshot.viewer.user, role: snapshot.accessClass === 'internal-admin' ? 'admin' : 'partner', accessClass: snapshot.accessClass },
    ...(snapshot.denied ? { denied: snapshot.denied } : {}),
  };
}
