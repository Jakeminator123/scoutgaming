import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { readPartnerPreviewFixture } from './fixtures/partner-preview.mjs';
import { createPartnerPreviewContext } from '../lib/partner-preview-policy.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const babel = require('next/dist/compiled/babel/core');
const source = await readFile(new URL('../components/kevin-bo/views/team.jsx', import.meta.url), 'utf8');
const transformed = babel.transformSync(source, {
  babelrc: false,
  configFile: false,
  presets: [[require('next/dist/compiled/babel/preset-react'), { runtime: 'classic' }]],
  plugins: [require('next/dist/compiled/babel/plugin-transform-modules-commonjs')],
}).code;
const output = { exports: {} };
new Function('require', 'module', 'exports', transformed)(require, output, output.exports);
const { TeamView } = output.exports;

const scope = { environment: 'fixture', workspaceId: 'croupier' };
const north = readPartnerPreviewFixture(createPartnerPreviewContext({
  session: { role: 'admin', user: 'test', scope },
  scope,
  operatorId: 'operator-demo-north',
  previewEnabled: true,
}), { now: () => Date.UTC(2026, 9, 6) });

function render(snapshot, surface = 'partner') {
  const calls = [];
  const runtime = {
    surface,
    snapshot,
    api() { calls.push('api'); throw new Error('sent'); },
    notify(message) { calls.push(message); },
  };
  const html = renderToStaticMarkup(React.createElement(TeamView, { snapshot, runtime, surface, toast: message => calls.push(message) }));
  return { html, calls };
}
function tag(html, id) {
  return html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';
}

test('fixture membership list shows Swedish labels, both roles and only this operator', () => {
  const operator = { id: 'operator-demo-north', name: 'Demo North', slug: 'demo-north' };
  const snapshot = {
    schemaVersion: 1,
    preview: true,
    mode: 'fixture',
    operator,
    operators: [operator],
    roles: [
      { id: 'partner-admin', label: 'Partner administrator' },
      { id: 'partner-editor', label: 'Partner editor' },
    ],
    team: [
      { id: 'north-admin', operatorId: operator.id, name: 'North Admin', email: 'admin@demo-north.invalid', roleId: 'partner-admin', role: 'Partner administrator', status: 'active' },
      { id: 'north-editor', operatorId: operator.id, name: 'North Editor', email: 'editor@demo-north.invalid', roleId: 'partner-editor', role: 'Partner editor', status: 'invited' },
      { id: 'south-admin', operatorId: 'operator-demo-south', name: 'South Only Member', email: 'south@demo-south.invalid', role: 'Partner administrator', status: 'suspended' },
    ],
  };
  const { html, calls } = render(snapshot);
  for (const label of ['Medlemskap', 'Rollprofil', 'Status', 'Partner administrator', 'Partner editor', 'aktiv', 'inbjuden', 'North Admin', 'North Editor']) {
    assert.match(html, new RegExp(label), label);
  }
  assert.equal(html.includes('South Only Member'), false);
  assert.equal(html.includes('south@demo-south.invalid'), false);
  assert.equal(html.includes('avstängd'), false);
  assert.equal(html.includes('Åtgärderna är låsta tills teamåtkomsten har verifierats.'), false);
  assert.equal(tag(html, 'team-invite-email').includes('disabled'), false);
  assert.equal(tag(html, 'team-invite-role').includes('disabled'), false);
  assert.equal(tag(html, 'team-invite-submit').includes('disabled'), false);
  assert.equal(calls.length, 0);
});

test('the demo-north fixture still lists its own members and fixture status', () => {
  const mixed = {
    ...north,
    team: [...north.team, { id: 'foreign', operatorId: 'operator-demo-south', name: 'South Only Member', email: 'south@demo-south.invalid', role: 'partner-admin', status: 'active' }],
  };
  const { html } = render(mixed);
  assert.match(html, /Team &amp; access/);
  assert.match(html, /Personal i Demo North/);
  assert.match(html, /Demo North Admin/);
  assert.match(html, /Demo North Editor/);
  assert.match(html, /admin@demo-north\.invalid/);
  assert.match(html, /editor@demo-north\.invalid/);
  assert.match(html, /Fixture · demo/);
  assert.match(html, /Sök medlemmar/);
  assert.equal(html.includes('South Only Member'), false);
  assert.equal(html.includes('aktiv'), false);
});

test('real membership is read-only and does not pretend an invite was sent', () => {
  const operator = { id: 'op-1', name: 'Nordic Bet', slug: 'nordic-bet' };
  const snapshot = {
    schemaVersion: 1,
    preview: false,
    mode: 'live',
    operator,
    operators: [operator],
    roles: [
      { id: 'role-admin', label: 'Operatörsadmin' },
      { id: 'role-reader', label: 'Läsare' },
    ],
    team: [
      { id: 'user-22', operatorId: 'op-1', name: 'Karin Berg', email: 'karin@op.invalid', roleId: 'role-admin', role: 'Operatörsadmin', status: 'active', revision: 4 },
      { id: 'user-23', operatorId: 'op-1', name: 'Eli Holm', email: 'eli@op.invalid', roleId: 'role-reader', role: 'Läsare', status: 'suspended', revision: 2 },
      { id: 'user-99', operatorId: 'op-2', name: 'Other Operator', email: 'other@op.invalid', roleId: 'role-admin', role: 'Operatörsadmin', status: 'invited', revision: 1 },
    ],
  };
  const { html, calls } = render(snapshot);
  assert.match(html, /Medlemskap i Nordic Bet/);
  assert.match(html, /Åtgärderna är låsta tills teamåtkomsten har verifierats./);
  assert.match(html, /user-22/);
  assert.match(html, /Revision 4/);
  assert.match(html, /aktiv/);
  assert.match(html, /avstängd/);
  assert.equal(html.includes('Other Operator'), false);
  assert.equal(html.includes('inbjuden'), false);
  for (const id of ['team-invite-email', 'team-invite-role', 'team-invite-submit']) {
    assert.match(tag(html, id), /disabled/, id);
  }
  const selects = [...html.matchAll(/<select\b[^>]*>/g)].map(match => match[0]);
  assert.equal(selects.length, 3);
  for (const item of selects) assert.match(item, /disabled/);
  assert.equal(calls.length, 0);
  assert.equal(html.includes('Exempelmedlemmar'), false);
});
