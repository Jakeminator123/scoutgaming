import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  PartnerTeamLoader, createPartnerTeamAdapter, createPartnerTeamClient, partnerTeamMessage,
  partnerTeamSnapshot, partnerTeamView, readPartnerTeam,
} from '../components/partner-team-loader.mjs';

import { jsxRequire } from './fixtures/jsx-require.mjs';
const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { TeamView } = jsxRequire(import.meta.url)('../components/partner/views/team.jsx');

const operator = { id: 'north', name: 'North', slug: 'north' };
const snapshot = {
  schemaVersion: 1, preview: false, mode: 'live', operator, operators: [operator],
  roles: [], team: [{ id: '42', operatorId: 'north', name: 'north-admin', email: '', roleId: 'partner-admin', role: 'partner-admin', status: 'active' }],
};
const roles = [
  { id: 'partner-admin', label: 'Partner administrator', permissions: ['team.roles.assign'], delegable: false },
  { id: 'partner-editor', label: 'Partner editor', permissions: ['presentations.configure'], delegable: true },
  { id: 'partner-viewer', label: 'Partner viewer', permissions: ['team.read'], delegable: true },
];
function team({ admin = true, revision = 1 } = {}) {
  const none = { role: [], suspend: false, reactivate: false };
  return {
    operatorId: 'north',
    viewer: { userId: '42' },
    can: { invite: admin, role: admin, suspend: admin },
    roles,
    inviteRoles: admin ? ['partner-editor', 'partner-viewer'] : [],
    members: [
      { userId: '42', username: 'north-admin', roleId: 'partner-admin', roleLabel: 'Partner administrator', status: 'active', revision: 1, allowed: none },
      { userId: '43', username: 'north-viewer', roleId: 'partner-viewer', roleLabel: 'Partner viewer', status: 'active', revision,
        allowed: admin ? { role: ['partner-editor'], suspend: true, reactivate: false } : none },
      { userId: '44', username: null, roleId: 'partner-editor', roleLabel: 'Partner editor', status: 'suspended', revision: 3,
        allowed: admin ? { role: [], suspend: false, reactivate: true } : none },
    ],
  };
}
function tag(html, id) {
  return html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';
}
function selectFor(html, id) {
  return html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)</select>`)) || ['', ''];
}
function fakeFetch(replies) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    const [status, body] = replies.shift() ?? [503, { error: 'Authentication unavailable' }];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { calls, fetcher };
}

test('only a well-formed team payload is accepted and e-mail addresses never reach the view', () => {
  assert.equal(readPartnerTeam(team()).operatorId, 'north');
  for (const broken of [null, [], { ...team(), members: null }, { ...team(), inviteRoles: [1] },
    { ...team(), members: [{ ...team().members[0], revision: 0 }] }, { ...team(), roles: [{ id: 'x' }] }]) {
    assert.equal(readPartnerTeam(broken), null);
  }
  const mapped = partnerTeamSnapshot(snapshot, team());
  assert.equal(mapped.preview, false);
  assert.deepEqual(mapped.team.map(member => [member.id, member.name, member.role, member.status, member.revision, member.email]), [
    ['42', 'north-admin', 'Partner administrator', 'active', 1, ''],
    ['43', 'north-viewer', 'Partner viewer', 'active', 1, ''],
    ['44', '44', 'Partner editor', 'suspended', 3, ''],
  ]);
  assert.deepEqual(mapped.roles.map(role => [role.id, role.operatorId]), [['partner-admin', 'north'], ['partner-editor', 'north'], ['partner-viewer', 'north']]);
});

test('the client reads and writes the team beside the snapshot endpoint, same-origin and uncached', async () => {
  const { calls, fetcher } = fakeFetch([[200, team()], [409, { error: 'Conflict', reason: 'member' }]]);
  const client = createPartnerTeamClient({ base: '/studio/api/partner', operatorSlug: 'north', fetcher });
  const read = await client.read();
  assert.equal(read.status, 200);
  assert.equal(read.team.operatorId, 'north');
  const written = await client.write({ action: 'invite', email: 'a@b.invalid', roleId: 'partner-viewer' });
  assert.deepEqual(written, { status: 409, team: null, reason: 'member' });
  assert.deepEqual(calls.map(call => [call.url, call.init.method ?? 'GET', call.init.credentials, call.init.cache]), [
    ['/studio/api/partner/team?operator=north', 'GET', 'same-origin', 'no-store'],
    ['/studio/api/partner/team?operator=north', 'POST', 'same-origin', 'no-store'],
  ]);
  assert.equal(calls[1].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[1].init.body), { action: 'invite', email: 'a@b.invalid', roleId: 'partner-viewer' });
  const offline = createPartnerTeamClient({ base: '/api/partner', operatorSlug: 'north', fetcher: async () => { throw new Error('offline'); } });
  assert.deepEqual(await offline.read(), { status: 0, team: null, reason: null });
});

test('the adapter sends the current revision, refreshes after a conflict and refuses a second write while one is pending', async () => {
  const messages = [], teams = [];
  const { calls, fetcher } = fakeFetch([
    [409, { error: 'Conflict', reason: 'revision' }],
    [200, team({ revision: 2 })],
    [200, { ...team({ revision: 3 }) }],
    [409, { error: 'Conflict', reason: 'last-admin' }],
    [200, team()],
  ]);
  const client = createPartnerTeamClient({ base: '/api/partner', operatorSlug: 'north', fetcher });
  const live = createPartnerTeamAdapter({ team: team(), client, notify: message => messages.push(message), onTeam: next => teams.push(next) });
  assert.deepEqual(live.inviteRoles, ['partner-editor', 'partner-viewer']);
  assert.deepEqual(live.assignable({ id: '43' }), ['partner-editor']);
  assert.deepEqual(live.assignable({ id: '42' }), []);
  assert.equal(await live.role({ id: '43' }, 'partner-editor'), false);
  assert.deepEqual(JSON.parse(calls[0].init.body), { action: 'role', userId: '43', roleId: 'partner-editor', expectedRevision: 1 });
  assert.equal(calls[1].init.method, undefined);
  assert.equal(teams.at(-1).members[1].revision, 2);
  assert.equal(await live.invite('outside@partner.invalid', 'partner-viewer'), true);
  assert.equal(teams.at(-1).members[1].revision, 3);
  assert.equal(await live.invite('outside@partner.invalid', 'partner-viewer'), false);
  assert.deepEqual(messages, [
    'Medlemskapet ändrades av någon annan. Listan är uppdaterad; försök igen.',
    'Inbjudan är registrerad.',
    'Ändringen skulle lämna operatören utan administratör.',
  ]);
  assert.equal(await live.role({ id: '99' }, 'partner-editor'), false);
  const guard = { busy: true };
  const blocked = createPartnerTeamAdapter({ team: team(), client, notify: message => messages.push(message), onTeam: () => {}, guard });
  assert.equal(await blocked.invite('x@y.invalid', 'partner-viewer'), false);
  assert.equal(messages.at(-1), 'Vänta, föregående ändring sparas.');
  assert.equal(calls.length, 5);
  assert.equal(partnerTeamMessage('invite', 422), 'Det finns inget partnerkonto med den e-postadressen.');
  assert.equal(partnerTeamMessage('invite', 429), 'För många inbjudningar den här timmen. Försök igen om en stund.');
  assert.equal(partnerTeamMessage('role', 403), 'Du saknar behörighet för den ändringen.');
  assert.equal(partnerTeamMessage('role', 401), 'Sessionen har gått ut. Logga in igen.');
});

test('a live administrator gets the invite form and an action menu per member, limited to what the API allows', () => {
  const live = createPartnerTeamAdapter({ team: team(), client: { read: async () => ({}), write: async () => ({}) }, notify: () => {}, onTeam: () => {} });
  const html = renderToStaticMarkup(React.createElement(TeamView, {
    snapshot: partnerTeamSnapshot(snapshot, team()), runtime: { surface: 'partner', team: live, notify() {} }, surface: 'partner', toast() {},
  }));
  for (const id of ['team-invite-email', 'team-invite-role', 'team-invite-submit']) assert.equal(tag(html, id).includes('disabled'), false, id);
  const [, inviteOptions] = selectFor(html, 'team-invite-role');
  assert.deepEqual([...inviteOptions.matchAll(/value="([^"]+)"/g)].map(match => match[1]), ['partner-editor', 'partner-viewer']);
  assert.match(inviteOptions, />redaktör<\/option>/); assert.match(inviteOptions, />läsare<\/option>/);
  // The only active administrator gets no menu; the server would refuse the change and the view says why.
  assert.equal(tag(html, 'team-actions-42'), '');
  assert.match(html, /sista administratören/);
  assert.match(tag(html, 'team-actions-43'), /aria-haspopup="menu"/); assert.match(tag(html, 'team-actions-43'), /aria-label="Åtgärder för north-viewer"/);
  assert.match(tag(html, 'team-actions-44'), /aria-haspopup="menu"/);
  assert.equal(tag(html, 'team-actions-43').includes('disabled'), false);
  assert.match(html, /<td>administratör<\/td>/); assert.match(html, /<td>läsare<\/td>/); assert.match(html, /<td>redaktör<\/td>/);
  assert.match(html, /Medlemmar/);
  assert.match(html, /Ett befintligt partnerkonto kopplas utan mejl/);
  assert.match(html, /avstängd/);
  assert.equal(html.includes('Åtgärderna är låsta tills teamåtkomsten har verifierats.'), false);
  assert.equal(html.includes('@'), false);
});

test('a live member without team.roles.assign sees the team with every control disabled', () => {
  const live = createPartnerTeamAdapter({ team: team({ admin: false }), client: { read: async () => ({}), write: async () => ({}) }, notify: () => {}, onTeam: () => {} });
  const html = renderToStaticMarkup(React.createElement(TeamView, {
    snapshot: partnerTeamSnapshot(snapshot, team({ admin: false })), runtime: { surface: 'partner', team: live }, surface: 'partner',
  }));
  for (const id of ['team-invite-email', 'team-invite-role', 'team-invite-submit']) assert.match(tag(html, id), /disabled/, id);
  assert.doesNotMatch(html, /aria-haspopup="menu"/);
  assert.match(html, /Du kan se teamet\. Ändringar kräver rätt administratörsbehörighet\./);
});

test('the portal binds one stable team view per API base and renders Kevin\'s read-only view until the API answers', async () => {
  assert.equal(partnerTeamView('/api/partner-preview', TeamView), TeamView);
  assert.equal(partnerTeamView(undefined, TeamView), TeamView);
  const bound = partnerTeamView('/studio/api/partner/snapshot', TeamView);
  assert.notEqual(bound, TeamView);
  assert.equal(partnerTeamView('/studio/api/partner/snapshot', TeamView), bound);
  assert.notEqual(partnerTeamView('/api/partner/snapshot', TeamView), bound);
  const loading = renderToStaticMarkup(React.createElement(PartnerTeamLoader, {
    snapshot, runtime: { surface: 'partner' }, surface: 'partner', toast() {}, base: '/api/partner', Team: TeamView,
  }));
  assert.match(loading, /Åtgärderna är låsta tills teamåtkomsten har verifierats./);
  assert.match(tag(loading, 'team-invite-submit'), /disabled/);
  const portal = await readFile(new URL('../components/partner/partner-operator-workspace.jsx', import.meta.url), 'utf8');
  assert.match(portal, /teamView:partnerTeamView\(apiBase,TeamView\)/);
});


test('team snapshot preserves real permission grants and delegation policy', () => {
  const mapped = partnerTeamSnapshot(snapshot, team());
  assert.deepEqual(mapped.roles[0].permissions, ['team.roles.assign']);
  assert.equal(mapped.roles[0].delegable, false);
  assert.equal(mapped.roles[1].delegable, true);
});

test('suspension and reactivation use current member revision and unavailable actions do not send', async () => {
  const writes = [], busy = [];
  const live = createPartnerTeamAdapter({ team: team(), client: { write: async body => { writes.push(body); return { status: 200, team: team() }; } },
    notify() {}, onTeam() {}, onBusy: value => busy.push(value) });
  assert.equal(await live.status({ id: '42' }, 'suspend'), false);
  assert.equal(await live.status({ id: '43' }, 'reactivate'), false);
  assert.equal(await live.status({ id: '43' }, 'suspend'), true);
  assert.equal(await live.status({ id: '44' }, 'reactivate'), true);
  assert.deepEqual(writes, [{ action: 'suspend', userId: '43', expectedRevision: 1 }, { action: 'reactivate', userId: '44', expectedRevision: 3 }]);
  assert.deepEqual(busy, [true, false, true, false]);
});

test('revocation and a failed refresh clear stale team grants', async () => {
  const accepted = [];
  const live = createPartnerTeamAdapter({ team: team(), client: { write: async () => ({ status: 403 }), read: async () => ({ status: 503, team: null }) },
    notify() {}, onTeam: next => accepted.push(next) });
  assert.equal(await live.role({ id: '43' }, 'partner-editor'), false);
  assert.deepEqual(accepted, [null, null]);
});

test('live status controls follow server grants, support English and lock during a pending write', () => {
  const live = createPartnerTeamAdapter({ team: team(), client: {}, notify() {}, onTeam() {}, language: 'en' });
  const props = { snapshot: partnerTeamSnapshot(snapshot, team()), runtime: { team: live, teamBusy: true }, language: 'en' };
  const html = renderToStaticMarkup(React.createElement(TeamView, props));
  assert.match(html, /aria-label="Actions for north-viewer"/);
  assert.match(html, /aria-label="Actions for 44"/);
  assert.doesNotMatch(html, /Actions for north-admin/);
  assert.match(html, /last administrator/);
  assert.match(html, /<p class="intro">Members, roles and invitations/); assert.doesNotMatch(html, /North: /, 'the company name stands in the sidebar, not in every intro');
  for (const button of html.matchAll(/<button[^>]+aria-haspopup="menu"[^>]*>/g)) assert.match(button[0], /disabled/);
});
