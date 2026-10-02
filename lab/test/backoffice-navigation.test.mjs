import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFFICE_SECTIONS, backofficeSection, backofficeOrigin, backofficeFrameUrl } from '../lib/backoffice-navigation.mjs';
import { canOpenLab, workspaceUrl, isEmbeddedWorkspace } from '../../web/public/bo/workspace-navigation.mjs';

test('all fourteen existing Backoffice surfaces have a stable administration destination', () => {
  assert.deepEqual(BACKOFFICE_SECTIONS.map(section => section.id), ['ops','voice','clips','gens','apikeys','emails','users','rooms','dealers','pit','tours','players','pay','shoes']);
  for (const section of BACKOFFICE_SECTIONS) {
    const url = new URL(backofficeFrameUrl('http://127.0.0.1:4200', section.id));
    assert.equal(url.origin, 'http://127.0.0.1:4200');
    assert.equal(url.pathname, '/bo/');
    assert.equal(url.search, '?workspace=lab');
    assert.equal(url.hash, `#${section.id}`);
  }
});

test('hash navigation cannot introduce a credential, arbitrary path or HTML', () => {
  for (const value of ['users?token=private', '//evil.test/', 'clips/../../api', '<script>', '#unknown', null, {}]) {
    assert.equal(backofficeSection(value), 'ops');
    assert.equal(backofficeFrameUrl('https://scout.example', value), 'https://scout.example/bo/?workspace=lab#ops');
  }
  assert.equal(backofficeFrameUrl(null, 'ops'), null);
});

test('local administration requires the explicitly configured loopback product origin', () => {
  assert.equal(backofficeOrigin({}), null);
  assert.equal(backofficeOrigin({CROUPIER_GAME_ORIGIN:'http://127.0.0.1:4200'}), 'http://127.0.0.1:4200');
  assert.equal(backofficeOrigin({BETTALOTTO_PARTNER_BASE_URL:'http://localhost:4200'}), 'http://localhost:4200');
  for (const value of ['https://external.test', 'http://evil.test', 'http://user:secret@127.0.0.1:4200', 'http://127.0.0.1:4200/?secret=1', 'http://127.0.0.1:4200/path', 'http://127.0.0.1:4200#voice', '']) {
    assert.equal(backofficeOrigin({CROUPIER_GAME_ORIGIN:value}), null);
  }
  assert.equal(backofficeOrigin({CROUPIER_GAME_ORIGIN:'',BETTALOTTO_PARTNER_BASE_URL:'http://localhost:4200'}), null);
});

test('cloud administration preserves an existing BO host and does not route credentials through Lab', () => {
  const env={LAB_PUBLIC_URL:'https://lab.example',CROUPIER_GAME_ORIGIN:'https://game.example',BO_URL:'https://bo.example'};
  assert.equal(backofficeOrigin(env),'https://bo.example');
  assert.equal(backofficeFrameUrl(backofficeOrigin(env),'users'),'https://bo.example/bo/?workspace=lab#users');
  for(const BO_URL of ['http://bo.example','https://bo.example/api','https://user:secret@bo.example','https://bo.example?token=private','']) assert.equal(backofficeOrigin({...env,BO_URL}),null);
});

test('reader and staff retain administration without advertising admin-only Studio access', () => {
  for(const role of ['reader','staff',undefined,'player','ADMIN','']) assert.equal(canOpenLab(role),false);
  assert.equal(canOpenLab('admin'),true);assert.equal(canOpenLab('superadmin'),true);
  assert.equal(workspaceUrl('https://scout.example/bo/?workspace=lab#users'),'https://scout.example/studio');
  assert.equal(workspaceUrl('http://127.0.0.1:4200/bo/#players'),'http://127.0.0.1:4201/');
  assert.equal(workspaceUrl('http://localhost:4194/bo/?workspace=lab#clips'),'http://localhost:4192/');
  assert.equal(workspaceUrl('http://127.0.0.1:4194/bo/?private=ignored#users'),'http://127.0.0.1:4192/');
  assert.equal(workspaceUrl('http://127.0.0.1:4999/bo/'),null);
  assert.equal(workspaceUrl('http://user:secret@localhost:4194/bo/'),null);
  assert.equal(workspaceUrl('http://external.example:4194/bo/'),null);
});

test('embedded mode requires a matching workspace; a query alone cannot remove standalone navigation', () => {
  assert.equal(isEmbeddedWorkspace('https://scout.example/bo/?workspace=lab','https://scout.example/studio/administration',true),true);
  assert.equal(isEmbeddedWorkspace('https://scout.example/bo/?workspace=lab','https://evil.example/administration',true),false);
  assert.equal(isEmbeddedWorkspace('https://scout.example/bo/?workspace=lab','https://scout.example/studio/administration',false),false);
  assert.equal(isEmbeddedWorkspace('http://127.0.0.1:4200/bo/','http://127.0.0.1:4201/',true),true);
  assert.equal(isEmbeddedWorkspace('http://localhost:4194/bo/?workspace=lab','http://localhost:4192/',true),true);
  assert.equal(isEmbeddedWorkspace('http://localhost:4194/bo/?workspace=lab','http://127.0.0.1:4192/',true),false);
  assert.equal(isEmbeddedWorkspace('http://localhost:4194/bo/?workspace=lab','http://localhost:4201/',true),false);
  assert.equal(isEmbeddedWorkspace('http://localhost:4194/bo/?workspace=lab','http://user:secret@localhost:4192/',true),false);
  assert.equal(isEmbeddedWorkspace('http://127.0.0.1:4200/bo/','http://127.0.0.1:4999/',true),false);
  assert.equal(isEmbeddedWorkspace('https://scout.example/bo/','invalid',true),false);
});
