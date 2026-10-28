import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_PREVIEW_VIEWS, PARTNER_VIEWS, partnerView, resolveWorkspaceSurfacePath, workspaceSurfacePath, isPartnerSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';
import { PARTNER_VIEW_PERMISSIONS, PARTNER_PERMISSIONS } from '../../../packages/studio-access/server/partner-access-policy.mjs';

test('public and native documents resolve to the same surface and exact Studio destination', () => {
  const partner = resolveWorkspaceSurfacePath('/partner');
  assert.equal(partner.surface, 'partner'); assert.equal(partner.view, 'overview'); assert.equal(partner.operatorSlug, null);
  assert.equal(partner.studioPath, '/studio/partner');
  assert.deepEqual(resolveWorkspaceSurfacePath('/studio/partner'), partner);
  // Retired /control documents are only recognised (login return, transport metadata); GET redirects to /admin (admin-workspace.test.mjs).
  assert.equal(resolveWorkspaceSurfacePath('/control').surface, 'control');
  assert.equal(resolveWorkspaceSurfacePath('/studio/control').surface, 'control');
  for (const section of PARTNER_VIEWS) {
    const route = resolveWorkspaceSurfacePath('/partner/demo-north/' + section);
    assert.equal(route.view, section); assert.equal(route.operatorSlug, 'demo-north');
    assert.equal(route.studioPath, '/studio/partner/demo-north/' + section);
    assert.deepEqual(resolveWorkspaceSurfacePath(route.studioPath), route);
  }
  for (const section of CONTROL_PREVIEW_VIEWS.filter(view => view !== 'ops')) {
    assert.equal(resolveWorkspaceSurfacePath('/control/' + section).view, section);
  }
});

test('every partner view names the permission the server checks, and only those seven views exist', () => {
  assert.deepEqual(PARTNER_VIEWS, ['overview', 'rooms', 'players', 'reports', 'team', 'integration', 'help']);
  assert.deepEqual(Object.keys(PARTNER_VIEW_PERMISSIONS), [...PARTNER_VIEWS]);
  for (const permission of Object.values(PARTNER_VIEW_PERMISSIONS)) assert.ok(PARTNER_PERMISSIONS.includes(permission), permission);
  assert.equal(PARTNER_VIEW_PERMISSIONS.team, 'team.read');
  assert.equal(PARTNER_VIEW_PERMISSIONS.players, 'players.read');
  assert.equal(PARTNER_VIEW_PERMISSIONS.rooms, 'tables.read');
});

test('Kevins retired partner addresses land on the nearest new view with a canonical address', () => {
  const expected = {
    overview: 'overview', tables: 'rooms', 'game-tables': 'rooms', presentation: 'rooms', 'table-design': 'rooms', backgrounds: 'rooms',
    lanes: 'rooms', preview: 'rooms', roulette: 'rooms', baccarat: 'rooms', transactions: 'reports', statistics: 'reports',
    'pit-bosses': 'overview', shoes: 'overview',
  };
  for (const [section, view] of Object.entries(expected)) {
    const route = resolveWorkspaceSurfacePath('/partner/demo-south/' + section);
    assert.equal(route.view, view, section);
    assert.equal(route.canonicalPath, workspaceSurfacePath('partner', view, 'demo-south'), section);
    assert.equal(partnerView(section), view, section);
  }
  for (const id of ['ops', 'bj', 'api', 'tx', 'theme', 'design', 'dealers', 'test', 'stats', 'pit']) assert.ok(partnerView(id), id);
  for (const value of ['gen', 'archive', 'voice', 'clips', 'media', 'tree', 'admin', 'unknown', '', null, 7]) assert.equal(partnerView(value), null, String(value));
  assert.equal(resolveWorkspaceSurfacePath('/control/tables').view, 'tables');
  assert.equal(resolveWorkspaceSurfacePath('/control/overview').view, 'ops');
  for (const section of ['studio', 'admin', 'ops', 'lab', 'clips', 'administration', 'tree', 'videos', 'openclaw', 'activity', 'guide', 'zones', 'events', 'probe', 'operator-chat', 'preview', 'lanes']) {
    const route = resolveWorkspaceSurfacePath('/control/' + section);
    assert.equal(route?.surface, 'control', section);
  }
});

test('partner document list cannot expose internal production views or become an API proxy', () => {
  for (const section of ['archive', 'voice', 'clips', 'media', 'tree', 'gen', 'admin', 'studio', 'lab', 'generations', 'legacy-rooms', 'speech']) {
    assert.equal(resolveWorkspaceSurfacePath('/partner/demo-north/' + section), null, section);
  }
  for (const value of [null, {}, [], 1, '', 'control', '/control/', '/partner/', '/control/api/admin', '/partner/api', '/partner/api/users',
    '/partner/login/overview', '/partner/demo-north/overview/extra', '/partner/Demo/overview', '/partner/a--b/overview',
    '/partner/' + 'a'.repeat(64) + '/overview', '/control/unknown', '/partner/demo-north/unknown', '/control/%6dedia', '/control/../admin',
    '/control//media', '/control\\media', '/control/media?token=private', '/control/media#fragment', '/studio/studio/control',
    '//evil.test/control', 'https://evil.test/control', '/studio/control\n']) assert.equal(resolveWorkspaceSurfacePath(value), null, String(value));
  assert.equal(isPartnerSurfacePath('/studio/partner/demo-north/overview'), true);
  for (const value of [null, '/partner-other', '/studio/partner-other', '/control']) assert.equal(isPartnerSurfacePath(value), false);
});

test('each allowed view has one readable address that reloads to the same view and operator', () => {
  for (const view of PARTNER_VIEWS) {
    const path = workspaceSurfacePath('partner', view, 'demo-south');
    const route = resolveWorkspaceSurfacePath(path);
    assert.equal(route.view, view, path); assert.equal(route.canonicalPath, path);
    assert.equal(route.operatorSlug, 'demo-south');
  }
  assert.equal(workspaceSurfacePath('partner', 'overview', 'demo-south'), '/partner/demo-south');
  assert.equal(workspaceSurfacePath('partner', 'reports', 'demo-south'), '/partner/demo-south/reports');
  assert.equal(workspaceSurfacePath('partner', 'help', 'demo-south'), '/partner/demo-south/help');
  assert.equal(resolveWorkspaceSurfacePath('/partner/demo-south').view, 'overview');
  assert.equal(resolveWorkspaceSurfacePath('/partner/demo-south/overview').canonicalPath, '/partner/demo-south');
  for (const slug of ['api', 'login', '../other', 'other/team', 'Demo', 'a--b', 'a'.repeat(64), null]) assert.equal(workspaceSurfacePath('partner', 'team', slug), null);
  assert.equal(resolveWorkspaceSurfacePath('/partner/login'), null);
  assert.equal(resolveWorkspaceSurfacePath('/studio/partner/login'), null);
  for (const view of ['gen', 'bj', 'ops', 'api', 'tables']) assert.equal(workspaceSurfacePath('partner', view, 'demo-south'), null, view);
});

test('disconnected control previews are unknown while control redirects stay', () => {
  // /control/preview was Kevin's dead "Provbord" slug; since 1f1c14d6 it is the staff layer preview page.
  for (const section of ['pit-bosses', 'presentation', 'table-design', 'roulette', 'baccarat', 'statistics', 'reports', 'generations', 'pit', 'theme', 'design', 'test', 'stats', 'gen']) {
    assert.equal(resolveWorkspaceSurfacePath('/control/' + section), null, section);
  }
  assert.equal(resolveWorkspaceSurfacePath('/control/preview').view, null);
  assert.equal(workspaceSurfacePath('control', 'roulette'), null);
  assert.equal(workspaceSurfacePath('control', 'gen'), null);
  assert.equal(workspaceSurfacePath('control', 'ops'), '/control');
  assert.equal(workspaceSurfacePath('control', 'bj'), '/control/game-tables');
  assert.equal(resolveWorkspaceSurfacePath('/control/backgrounds').view, 'background');
  assert.equal(resolveWorkspaceSurfacePath('/control/integration').view, 'api');
  assert.equal(resolveWorkspaceSurfacePath('/control/overview').view, 'ops');
});

test('game rooms have a canonical partner address while existing table links still resolve', () => {
  assert.equal(workspaceSurfacePath('partner', 'rooms', 'north'), '/partner/north/rooms');
  for (const section of ['rooms', 'tables', 'game-tables']) {
    const route = resolveWorkspaceSurfacePath('/partner/north/' + section);
    assert.equal(route.view, 'rooms'); assert.equal(route.canonicalPath, '/partner/north/rooms');
  }
});
