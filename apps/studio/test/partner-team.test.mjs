import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsxRequire } from './fixtures/jsx-require.mjs';

const { TeamView } = jsxRequire(import.meta.url)('../components/kevin-bo/views/team.jsx');

function render(snapshot, runtime = {}) {
  const calls = [];
  const html = renderToStaticMarkup(React.createElement(TeamView, { snapshot, runtime: { surface: 'partner', snapshot, notify: message => calls.push(message), ...runtime }, surface: 'partner', toast: message => calls.push(message) }));
  return { html, calls };
}
const tag = (html, id) => html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';

test('without a verified team adapter the view is read-only, names roles with the portal words and hides other companies', () => {
  const operator = { id: 'op-1', name: 'Nordic Bet', slug: 'nordic-bet' };
  const snapshot = { schemaVersion: 2, preview: false, mode: 'live', operator, operators: [operator],
    roles: [{ id: 'partner-admin', label: 'Partner administrator', permissions: ['team.roles.assign'], delegable: false }, { id: 'partner-viewer', label: 'Partner viewer', permissions: ['team.read'], delegable: true }],
    team: [
      { id: 'user-22', operatorId: 'op-1', name: 'Karin Berg', email: 'karin@op.invalid', roleId: 'partner-admin', role: 'Partner administrator', status: 'active', revision: 4 },
      { id: 'user-23', operatorId: 'op-1', name: 'Eli Holm', email: 'eli@op.invalid', roleId: 'partner-viewer', role: 'Partner viewer', status: 'suspended', revision: 2 },
      { id: 'user-99', operatorId: 'op-2', name: 'Other Operator', email: 'other@op.invalid', roleId: 'partner-admin', role: 'Partner administrator', status: 'invited', revision: 1 },
    ] };
  const { html, calls } = render(snapshot);
  assert.match(html, /<h1>Team<\/h1>/); assert.match(html, /<p class="intro">Medlemmar, roller och inbjudningar/); assert.doesNotMatch(html, /Nordic Bet:/);
  assert.match(html, /Åtgärderna är låsta tills teamåtkomsten har verifierats\./);
  assert.doesNotMatch(html, /<code>user-22<\/code>|revision 4/, 'account ids and revisions are not shown in the rows'); assert.match(html, /Karin Berg/);
  assert.match(html, /aktiv/); assert.match(html, /avstängd/);
  assert.match(html, /<td>administratör<\/td>/); assert.match(html, /<td>läsare<\/td>/);
  assert.match(html, /Utses bara av Scoutgaming\./); assert.match(html, /Kan tilldelas av bolagets administratör\./);
  assert.equal(html.includes('Other Operator'), false); assert.equal(html.includes('inbjuden'), false);
  assert.equal(html.includes('@'), false, 'e-mail addresses never render');
  for (const id of ['team-invite-email', 'team-invite-role', 'team-invite-submit']) assert.match(tag(html, id), /disabled/, id);
  assert.doesNotMatch(html, /aria-haspopup="menu"|Partner technician|Partner analyst|Fixture|Exempelmedlemmar|Team &amp; access/);
  assert.equal(calls.length, 0);
});
