import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsxRequire } from './fixtures/jsx-require.mjs';

const { TeamView } = jsxRequire(import.meta.url)('../components/partner/views/team.jsx');

function render(snapshot, runtime = {}) {
  const calls = [];
  const html = renderToStaticMarkup(React.createElement(TeamView, { snapshot, runtime: { surface: 'partner', snapshot, notify: message => calls.push(message), ...runtime }, surface: 'partner', toast: message => calls.push(message) }));
  return { html, calls };
}
const tag = (html, id) => html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';

test('without a verified team adapter the view is read-only, names roles with the portal words and hides other companies', () => {
  const operator = { id: 'op-1', name: 'Nordic Bet', slug: 'nordic-bet' };
  const snapshot = { schemaVersion: 2, preview: false, operator, operators: [operator],
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

test('a choice in the ⋯ menu only opens the confirmation; the call runs on confirm and never on cancel', () => {
  // Vyn körs som en vanlig funktion med en egen useState; kitets komponenter är stubbar, så
  // elementträdet visar vilka props ⋯-menyn och ConfirmDialog får.
  const kit = Object.fromEntries(['ActionMenu', 'Badge', 'Card', 'ConfirmDialog', 'Page', 'Rows', 'Tip'].map(name => [name, Object.defineProperty(() => null, 'name', { value: name })]));
  const state = []; let slot = 0;
  const useState = initial => { const index = slot++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; };
  const { TeamView: View } = jsxRequire(import.meta.url, { 'react': { ...React, useState }, './ui.tsx': kit })('../components/partner/views/team.jsx');
  const operator = { id: 'op-1', name: 'Nordic Bet' };
  const snapshot = { operator, roles: [{ id: 'partner-admin', label: 'Partner administrator', permissions: ['team.roles.assign'] }, { id: 'partner-viewer', label: 'Partner viewer', permissions: ['team.read'] }],
    team: [{ id: 'user-22', operatorId: 'op-1', name: 'Karin Berg', roleId: 'partner-admin', status: 'active' },
      { id: 'user-23', operatorId: 'op-1', name: 'Eli Holm', roleId: 'partner-viewer', status: 'active' },
      { id: 'user-24', operatorId: 'op-1', name: 'Mo Ek', roleId: 'partner-viewer', status: 'suspended' }] };
  const calls = [];
  const team = { inviteRoles: ['partner-viewer'], note: '', invite: async () => true,
    assignable: member => member.id === 'user-23' ? ['partner-admin'] : [],
    canSuspend: member => member.id === 'user-23', canReactivate: member => member.status === 'suspended',
    role: (member, roleId) => { calls.push(['role', member.id, roleId]); return Promise.resolve(true); },
    status: (member, action) => { calls.push(['status', member.id, action]); return Promise.resolve(true); } };
  const render = () => { slot = 0; return View({ snapshot, runtime: { team }, language: 'sv' }); };
  const find = (node, type, out = []) => {
    if (Array.isArray(node)) { for (const child of node) find(child, type, out); return out; }
    if (!node || typeof node !== 'object' || !node.props) return out;
    if (node.type === type) out.push(node.props);
    for (const value of Object.values(node.props)) if (value && typeof value === 'object') find(value, type, out);
    return out;
  };
  const menu = id => find(render(), kit.ActionMenu).find(props => props.id === `team-actions-${id}`);
  const dialog = () => find(render(), kit.ConfirmDialog)[0];

  assert.equal(menu('user-23').small, true, 'the team table asks for the small ⋯ button');
  assert.equal(menu('user-22'), undefined, 'no menu without actions');
  assert.equal(dialog().open, false);
  const cases = [['user-23', 'role:partner-admin', ['role', 'user-23', 'partner-admin'], 'Byt roll'], ['user-23', 'suspend', ['status', 'user-23', 'suspend'], 'Stäng av'], ['user-24', 'reactivate', ['status', 'user-24', 'reactivate'], 'Återaktivera']];
  for (const [member, action, call, confirmLabel] of cases) {
    menu(member).actions.find(item => item.id === action).onSelect();
    assert.deepEqual(calls, [], `${action}: selecting only opens the dialog`);
    let open = dialog();
    assert.equal(open.open, true); assert.equal(open.confirmLabel, confirmLabel);
    open.onCancel();
    assert.equal(dialog().open, false); assert.deepEqual(calls, [], `${action}: cancel runs nothing`);
    menu(member).actions.find(item => item.id === action).onSelect();
    open = dialog(); open.onConfirm();
    assert.deepEqual(calls, [call], `${action}: confirm runs the call once`);
    assert.equal(dialog().open, false);
    calls.length = 0;
  }
});
