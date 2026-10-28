import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

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
