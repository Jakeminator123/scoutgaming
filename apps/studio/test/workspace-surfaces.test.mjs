import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_PREVIEW_VIEWS, PARTNER_PREVIEW_VIEWS, resolveWorkspaceSurfacePath, workspaceSurfacePath, isPartnerSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';

test('public and native documents resolve to the same surface and exact Studio destination', () => {
  for (const surface of ['control', 'partner']) {
    const route = resolveWorkspaceSurfacePath('/' + surface);
    assert.equal(route.surface, surface); assert.equal(route.view, 'ops'); assert.equal(route.operatorSlug, null);
    assert.equal(route.studioPath, '/studio/' + surface);
    assert.deepEqual(resolveWorkspaceSurfacePath('/studio/' + surface), route);
  }
  for (const section of PARTNER_PREVIEW_VIEWS) {
    const route = resolveWorkspaceSurfacePath('/partner/demo-north/' + section);
    assert.equal(route.view, section); assert.equal(route.operatorSlug, 'demo-north');
    assert.equal(route.studioPath, '/studio/partner/demo-north/' + section);
    assert.deepEqual(resolveWorkspaceSurfacePath(route.studioPath), route);
  }
  for (const section of CONTROL_PREVIEW_VIEWS.filter(view => view !== 'ops')) {
    assert.equal(resolveWorkspaceSurfacePath('/control/' + section).view, section);
  }
});

test('friendly sections keep source view IDs while existing internal tools retain their native routes', () => {
  for (const [section, view] of [['overview', 'ops'], ['presentation', 'theme'], ['integration', 'api'], ['tables', 'bj']]) {
    assert.equal(resolveWorkspaceSurfacePath('/partner/demo-south/' + section).view, view);
  }
  assert.equal(resolveWorkspaceSurfacePath('/control/tables').view, 'tables');
  assert.equal(resolveWorkspaceSurfacePath('/control/overview').view, 'ops');
  for (const [section, studioPath, legacyPath] of [['studio', '/studio', '/control'], ['admin', '/studio/administration', '/control/administration'],
    ['ops', '/studio/admin/openclaw', '/admin/openclaw'], ['lab', '/studio', '/control']]) {
    const route = resolveWorkspaceSurfacePath('/control/' + section);
    assert.equal(route.studioPath, studioPath); assert.equal(route.legacyPath, legacyPath);
    assert.equal(route.view, null);
    assert.equal(route.legacyPath.startsWith('/studio'), false);
  }
  for (const tool of ['clips', 'administration', 'tree', 'videos', 'openclaw', 'activity', 'guide', 'zones', 'events', 'probe', 'operator-chat', 'preview', 'lanes']) {
    const route = resolveWorkspaceSurfacePath('/control/' + tool);
    assert.equal(route.canonicalPath, '/control/' + tool);
    assert.equal(route.studioPath, '/studio/control/' + tool);
    assert.equal(route.legacyPath, null);
  }
});

test('partner document list cannot expose internal production views or become an API proxy', () => {
  for (const section of ['archive', 'voice', 'clips', 'media', 'tree', 'gen', 'admin', 'studio', 'lab']) {
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
  for(const surface of ['control','partner'])for(const view of surface==='partner'?PARTNER_PREVIEW_VIEWS:CONTROL_PREVIEW_VIEWS){
    const path=workspaceSurfacePath(surface,view,'demo-south');
    const route=resolveWorkspaceSurfacePath(path);
    assert.equal(route.view,view,path);assert.equal(route.canonicalPath,path);
    assert.equal(route.operatorSlug,surface==='partner'?'demo-south':null);
  }
  assert.equal(resolveWorkspaceSurfacePath('/partner/demo-south').view,'ops');
  assert.equal(workspaceSurfacePath('partner','theme','demo-south'),'/partner/demo-south/presentation');
  for(const slug of ['api','login','../other','other/team','Demo','a--b','a'.repeat(64),null])assert.equal(workspaceSurfacePath('partner','team',slug),null);
  assert.equal(resolveWorkspaceSurfacePath('/partner/login'), null);
  assert.equal(resolveWorkspaceSurfacePath('/studio/partner/login'), null);
  assert.equal(workspaceSurfacePath('partner','gen','demo-south'),null);
});

test('disconnected control previews are unknown while partner previews and control redirects stay', () => {
  // /control/preview was Kevin's dead "Provbord" slug; since 1f1c14d6 it is the staff layer preview page.
  for (const section of ['pit-bosses', 'presentation', 'table-design', 'roulette', 'baccarat', 'statistics', 'reports', 'generations', 'pit', 'theme', 'design', 'test', 'stats', 'gen']) {
    assert.equal(resolveWorkspaceSurfacePath('/control/' + section), null, section);
  }
  assert.equal(resolveWorkspaceSurfacePath('/control/preview').view, null);
  for (const section of ['roulette', 'baccarat', 'presentation', 'reports', 'statistics', 'preview', 'pit-bosses', 'table-design']) {
    const route = resolveWorkspaceSurfacePath('/partner/demo-north/' + section);
    assert.equal(route.surface, 'partner', section);
  }
  assert.equal(workspaceSurfacePath('control', 'roulette'), null);
  assert.equal(workspaceSurfacePath('control', 'gen'), null);
  assert.equal(workspaceSurfacePath('partner', 'roulette', 'demo-north'), '/partner/demo-north/roulette');
  assert.equal(resolveWorkspaceSurfacePath('/control/backgrounds').view, 'background');
  assert.equal(resolveWorkspaceSurfacePath('/control/overview').view, 'ops');
});

test('game rooms have a canonical partner address while existing table links still resolve',()=>{
  assert.equal(workspaceSurfacePath('partner','bj','north'),'/partner/north/rooms');
  for(const section of ['rooms','tables','game-tables']){
    const route=resolveWorkspaceSurfacePath('/partner/north/'+section);
    assert.equal(route.view,'bj');assert.equal(route.canonicalPath,'/partner/north/rooms');
  }
  for(const section of ['companies','rooms','compositions','rehearsal']){
    const route=resolveWorkspaceSurfacePath('/control/'+section);
    assert.equal(route.view,null);assert.equal(route.canonicalPath,'/control/'+section);
  }
});
