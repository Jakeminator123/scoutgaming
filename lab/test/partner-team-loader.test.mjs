import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  PartnerTeamLoader, createPartnerTeamAdapter, createPartnerTeamClient, partnerTeamMessage,
  partnerTeamSnapshot, partnerTeamView, readPartnerTeam,
} from '../components/partner-team-loader.mjs';

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
    'Kontot är kopplat till teamet. Ingen e-post har skickats.',
    'Ändringen skulle lämna operatören utan administratör.',
  ]);
  assert.equal(await live.role({ id: '99' }, 'partner-editor'), false);
  const guard = { busy: true };
  const blocked = createPartnerTeamAdapter({ team: team(), client, notify: message => messages.push(message), onTeam: () => {}, guard });
  assert.equal(await blocked.invite('x@y.invalid', 'partner-viewer'), false);
  assert.equal(messages.at(-1), 'Vänta, föregående ändring sparas.');
  assert.equal(calls.length, 5);
  assert.equal(partnerTeamMessage('invite', 422), 'Det finns inget partnerkonto med den e-postadressen.');
  assert.equal(partnerTeamMessage('role', 403), 'Du saknar behörighet för den ändringen.');
  assert.equal(partnerTeamMessage('role', 401), 'Sessionen har gått ut. Logga in igen.');
});

test('a live administrator gets Kevin\'s invite and role controls, limited to what the API allows', () => {
  const live = createPartnerTeamAdapter({ team: team(), client: { read: async () => ({}), write: async () => ({}) }, notify: () => {}, onTeam: () => {} });
  const html = renderToStaticMarkup(React.createElement(TeamView, {
    snapshot: partnerTeamSnapshot(snapshot, team()), runtime: { surface: 'partner', team: live, notify() {} }, surface: 'partner', toast() {},
  }));
  for (const id of ['team-invite-email', 'team-invite-role', 'team-invite-submit']) assert.equal(tag(html, id).includes('disabled'), false, id);
  const [, inviteOptions] = selectFor(html, 'team-invite-role');
  assert.deepEqual([...inviteOptions.matchAll(/value="([^"]+)"/g)].map(match => match[1]), ['partner-editor', 'partner-viewer']);
  assert.match(tag(html, 'team-role-42'), /disabled/);
  assert.equal(tag(html, 'team-role-43').includes('disabled'), false);
  assert.deepEqual([...selectFor(html, 'team-role-43')[1].matchAll(/value="([^"]+)"/g)].map(match => match[1]), ['partner-editor', 'partner-viewer']);
  assert.match(tag(html, 'team-role-44'), /disabled/);
  assert.match(html, /Medlemskap i North/);
  assert.match(html, /ingen e-post skickas/);
  assert.match(html, /avstängd/);
  assert.equal(html.includes('Inbjudan och rollbyte ansluts i nästa steg'), false);
  assert.equal(html.includes('@'), false);
});

test('a live member without team.roles.assign sees the team with every control disabled', () => {
  const live = createPartnerTeamAdapter({ team: team({ admin: false }), client: { read: async () => ({}), write: async () => ({}) }, notify: () => {}, onTeam: () => {} });
  const html = renderToStaticMarkup(React.createElement(TeamView, {
    snapshot: partnerTeamSnapshot(snapshot, team({ admin: false })), runtime: { surface: 'partner', team: live }, surface: 'partner',
  }));
  for (const id of ['team-invite-email', 'team-invite-role', 'team-invite-submit']) assert.match(tag(html, id), /disabled/, id);
  const selects = [...html.matchAll(/<select\b[^>]*>/g)].map(match => match[0]);
  assert.equal(selects.length, 4);
  for (const item of selects) assert.match(item, /disabled/);
  assert.match(html, /Du kan se teamet\. Inbjudan och rollbyte kräver operatörsadministratör\./);
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
  assert.match(loading, /Inbjudan och rollbyte ansluts i nästa steg/);
  assert.match(tag(loading, 'team-invite-submit'), /disabled/);
  const portal = await readFile(new URL('../components/kevin-bo/kevin-backoffice.jsx', import.meta.url), 'utf8');
  assert.match(portal, /teamView:snapshot\.preview===false&&surface==='partner'\?partnerTeamView\(apiBase,TeamView\):TeamView/);
});
