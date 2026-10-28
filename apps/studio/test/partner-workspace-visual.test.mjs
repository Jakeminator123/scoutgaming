import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { partnerCopy, partnerNavigation } from '../components/kevin-bo/partner-copy.mjs';
import { createPartnerWorkspaceContext, operatorPackageRevision, validatePartnerSnapshot } from '../components/kevin-bo/partner-workspace-context.mjs';
import { PARTNER_PERMISSIONS } from '../../../packages/studio-access/server/partner-access-policy.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lib/operator-admin-api.mjs';
import { defaultPresentationLane } from '../../../packages/presentation/contracts/studio-model.mjs';
import { jsxRequire } from './fixtures/jsx-require.mjs';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const sourceUrl = new URL('../components/kevin-bo/partner-operator-workspace.jsx', import.meta.url);
const actions = jsxRequire(sourceUrl)('../partner-session-actions.tsx');
const DAY = 24 * 60 * 60 * 1000, today = Date.UTC(2026, 9, 28, 12);
const roleOf = id => STANDARD_OPERATOR_ROLES.find(role => role.id === id);

function components({ language = 'sv', theme = 'light', hooks } = {}) {
  const overrides = {
    '../partner-session-actions': actions,
    './views/team.jsx': { TeamView: () => React.createElement('section', { 'data-team': 'stub' }) },
    './partner-copy.mjs': { partnerNavigation, usePartnerPreferences: () => ({ language, theme, copy: partnerCopy(language), setLanguage() {}, setTheme() {} }) },
    ...(hooks ? { react: hooks } : {}),
  };
  return jsxRequire(sourceUrl, overrides)('./partner-operator-workspace.jsx');
}

function days(values) {
  return Array.from({ length: 30 }, (_, index) => {
    const value = values[index - (30 - values.length)] ?? 0;
    return { day: new Date(today - (29 - index) * DAY).toISOString().slice(0, 10), rounds: value, staked: value * 50, returned: value * 45 };
  });
}
function realSnapshot(overrides = {}) {
  const operator = { id: 'john', slug: 'johnsspelbolag', name: 'Johns Bet', packageRevision: '7' };
  return { schemaVersion: 2, preview: false, mode: 'live', accessClass: 'partner', viewer: { user: 'john-admin', accessClass: 'partner' },
    operator, operators: [operator], role: { id: 'partner-admin', label: 'administratör' }, permissions: [...PARTNER_PERMISSIONS], view: 'overview',
    packageRevision: '7', publishedAt: Date.UTC(2026, 9, 20, 9), generatedAt: '2026-10-28T12:00:00Z',
    presentations: [{ id: 'lane-john', operatorId: 'john', name: 'Johns lane', dealer: 'paow' }],
    tables: [
      { id: 'room-john', operatorId: 'john', name: 'Johns bord', game: 'blackjack', state: 'live', status: 'active', presentationId: 'lane-john', dealer: { id: 'paow', label: 'PAOW' }, configVersion: 'config-3', settings: { language: 'en', limitPreset: 'casual' }, playUrl: '/game?game=blackjack&operator=johnsspelbolag&table=room-john' },
      { id: 'room-vip', operatorId: 'john', name: 'VIP-bordet', game: 'blackjack', state: 'pending', status: 'pending', presentationId: 'lane-john', dealer: { id: 'paow', label: 'PAOW' }, configVersion: null, playUrl: null },
    ],
    team: [], invitations: 0, draft: null, publications: [{ revision: 7, publishedAt: Date.UTC(2026, 9, 20, 9) }, { revision: 6, publishedAt: Date.UTC(2026, 9, 1) }],
    assignment: { games: ['blackjack'], dealers: [{ id: 'paow', label: 'PAOW' }], lanes: [{ id: 'lane-john', label: 'Johns lane' }], backgrounds: [{ id: 'bg-lounge', label: 'Lounge' }], tables: [{ id: 'oak', label: 'Oak' }, { id: 'felt', label: 'Green felt' }] },
    reports: { status: 'ready', from: today - 30 * DAY, to: today, windowDays: 30, currency: 'USD', truncated: false,
      rooms: [{ roomId: 'room-john', rounds: 12, staked: 600, returned: 540, net: 60, days: days([0, 3, 2, 1, 2, 3, 1]) }, { roomId: 'room-vip', rounds: 0, staked: 0, returned: 0, net: 0, days: days([]) }] },
    summary: { activeTables: 1 }, ...overrides };
}
const render = (props, options) => renderToStaticMarkup(React.createElement(components(options).PartnerOperatorWorkspace, { surface: 'partner', user: 'john-admin', apiBase: '/studio/api/partner/snapshot', initialSnapshot: realSnapshot(), ...props }));
const menuOf = html => [...(html.match(/<nav aria-label="Meny">[\s\S]*?<\/nav>/)?.[0] ?? '').matchAll(/<span class="label">([^<]+)</g)].map(match => match[1]);

test('the shell names the company, Partnerportalen, the assignment version and the role word; the menu follows the role', () => {
  const editor = render({ initialSnapshot: realSnapshot({ role: { id: 'partner-editor', label: 'redaktör' }, permissions: [...roleOf('partner-editor').permissions] }) });
  assert.deepEqual(menuOf(editor), ['Översikt', 'Spelbord', 'Hjälp och kontakt']);
  assert.match(editor, /class="name">Johns Bet</); assert.match(editor, /class="sub">Partnerportalen</);
  assert.match(editor, /Tilldelning från Scoutgaming/); assert.match(editor, /<b>Version 7<\/b>/);
  assert.match(editor, /1 dealer · 1 bakgrund · 2 bordsgrafik/); assert.doesNotMatch(editor, /scenmall|revision 7/);
  assert.match(editor, /class="small">redaktör</);
  assert.match(editor, /aria-current="page"[^>]*>[\s\S]*?<span class="label">Översikt</);
  assert.match(editor, /aria-keyshortcuts="Control\+K Meta\+K"/, 'the ⌘K palette is offered in the shell');
  const viewer = render({ initialSnapshot: realSnapshot({ role: { id: 'partner-viewer', label: 'läsare' }, permissions: [...roleOf('partner-viewer').permissions] }) });
  // Spelare stays out of the menu until players belong to the company; the server still guards the address.
  assert.deepEqual(menuOf(viewer), ['Översikt', 'Spelbord', 'Ekonomi', 'Team', 'Integration', 'Hjälp och kontakt']);
  assert.match(viewer, /class="small">läsare</);
  for (const [, href] of viewer.matchAll(/class="nav" href="([^"]+)"/g)) assert.match(href, /^\/partner\/johnsspelbolag(?:\/|$)/);
  for (const html of [editor, viewer]) {
    assert.doesNotMatch(html, /Planerat|Spelrum|Sammansättning|Operatörspersonal|Intern administratör|Nivå 2|Spelbolag|Partnerportal[^e]|kevin-bo/);
    assert.doesNotMatch(html, /href="\/(?:admin|lobby|control|play)(?:\?|\/|")/);
    assert.match(html, /Byt konto/); assert.match(html, /Logga ut/);
  }
  assert.deepEqual(partnerNavigation('sv', ['team.roles.assign']).map(item => item.id), []);
  assert.deepEqual(partnerNavigation('en', ['overview.read', 'team.read']).map(item => item.label), ['Overview', 'Help and contact', 'Team'].sort((a, b) => ['Overview', 'Team', 'Help and contact'].indexOf(a) - ['Overview', 'Team', 'Help and contact'].indexOf(b)));
});

test('a denied view renders the 403 card with role and permission inside the shell, never the view or its data', () => {
  const denied = { view: 'team', permission: 'team.read', role: { id: 'partner-editor', label: 'redaktör' } };
  const html = render({ initialView: 'team', denied, initialSnapshot: realSnapshot({ role: denied.role, permissions: [...roleOf('partner-editor').permissions], view: 'team', denied }) });
  assert.match(html, /role="alert"/); assert.match(html, />403</);
  assert.match(html, /Rollen redaktör får inte se teamet\./); assert.match(html, /<code>team\.read<\/code>/, 'the permission code name sits under Tekniska detaljer');
  assert.match(html, /href="\/partner\/johnsspelbolag"[^>]*>Till översikten</);
  assert.doesNotMatch(html, /data-team="stub"/);
  // The shell stays: company, menu for the role and the role word.
  assert.deepEqual(menuOf(html), ['Översikt', 'Spelbord', 'Hjälp och kontakt']); assert.match(html, /class="name">Johns Bet</); assert.match(html, /class="small">redaktör</);
  const allowed = render({ initialView: 'team' });
  assert.match(allowed, /data-team="stub"/); assert.doesNotMatch(allowed, />403</);
  // A denial for another view than the one shown does not hide the shown view.
  assert.doesNotMatch(render({ initialView: 'overview', denied }), />403</);
});

test('a role without a section sees no such section, never invented rooms or assignment', () => {
  // A role that lacks tables.read or presentations.read gets a snapshot without those sections.
  const narrow = render({ initialSnapshot: realSnapshot({ role: { id: 'overview-only', label: 'Nattskift' }, permissions: ['overview.read'], tables: [], presentations: [], assignment: undefined, presentation: undefined, branding: undefined, reports: undefined, summary: {} }) });
  assert.doesNotMatch(narrow, />Var ni är publicerade<\/h2>|>Er tilldelning<\/h2>|spelbord öppna i lobbyn/);
  assert.doesNotMatch(narrow, /0 av 0/); assert.doesNotMatch(narrow, /Oak|Lounge|Johns bord/);
  assert.deepEqual(menuOf(narrow), ['Översikt', 'Hjälp och kontakt']);
  const allowed = render({ initialView: 'team' });
  assert.match(allowed, /data-team="stub"/); assert.doesNotMatch(allowed, />403</);
});

test('internal staff get Admin and lobby links; company members do not', () => {
  for (const language of ['sv', 'en']) {
    const staff = render({ user: 'jakob', initialSnapshot: realSnapshot({ accessClass: 'internal-admin', viewer: { user: 'jakob', accessClass: 'internal-admin' }, role: { id: 'internal-admin', label: 'Scoutgamings personal' } }) }, { language });
    assert.match(staff, /href="\/admin"/);
    assert.match(staff, /href="\/lobby\?operator=johnsspelbolag&amp;room=room-john"/);
    assert.match(staff, /Scoutgamings personal/);
    assert.doesNotMatch(staff, /href="\/(?:control|play)"/);
    assert.doesNotMatch(render({}, { language }), /href="\/(?:admin|lobby|control|play)(?:\?|\/|")/);
  }
  const dark = render({}, { language: 'en', theme: 'dark' });
  assert.match(dark, /class="partner-portal" data-surface="partner" data-theme="dark" lang="en"/);
  assert.match(dark, /Switch account/); assert.match(dark, /Log out/);
  const several = render({ initialSnapshot: realSnapshot({ operators: [realSnapshot().operator, { id: 'amber', slug: 'amber-house', name: 'Amber House' }] }) });
  assert.match(several, /id="partner-operator"/); assert.match(several, /Amber House/);
  assert.doesNotMatch(render({}), /id="partner-operator"/);
});

test('the overview shows real figures from the game journal and says Inte anslutet otherwise', () => {
  const html = render({});
  assert.match(html, /<h1>Översikt<\/h1>/);
  assert.match(html, /1 av 2<\/span><span class="l">spelbord öppna i lobbyn/);
  assert.match(html, /class="v">12<\/span><span class="l">rundor senaste 7 dagarna/);
  assert.match(html, /600 USD/); assert.match(html, /60 USD/);
  assert.match(html, /href="\/game\?game=blackjack&amp;operator=johnsspelbolag&amp;table=room-john"/);
  assert.match(html, /öppet/); assert.match(html, /pausat/); assert.match(html, /inte i lobbyn/);
  assert.match(html, /PAOW · Casual · engelska/); assert.doesNotMatch(html, /config-3|Johns lane|Johns Bet ·/, 'no technical ids, no scene template names, no repeated company name');
  assert.match(html, /Lounge/); assert.match(html, /Oak, Green felt/);
  assert.match(html, /Senaste tilldelning: version 7/); assert.match(html, /20 okt\. 2026/);
  assert.match(html, /Rundor och netto per dag/);
  assert.doesNotMatch(html, /Spelkoppling återstår|playersToday|roundsToday|Planerat/);
  const unconnected = render({ initialSnapshot: realSnapshot({ reports: { status: 'not-connected', reason: 'table-missing' }, draft: { revision: 3, basePackageRevision: 7 }, invitations: 2 }) });
  // Only what works: without the aggregate the round and money figures are simply not shown.
  assert.doesNotMatch(unconnected, /rundor senaste 7 dagarna|insatser · 7 d|Rundor och netto per dag/);
  assert.doesNotMatch(unconnected, /shared_table_audit|spelets journal|steg F|O03/i, 'no table names or plan words in user text');
  assert.doesNotMatch(unconnected, /600 USD|class="v">12</);
  assert.match(unconnected, /Ett sparat utkast väntar/); assert.match(unconnected, /2 inbjudningar väntar på svar/);
  assert.match(unconnected, /href="\/partner\/johnsspelbolag\/rooms"[^>]*class="row link"/);
  const withoutRight = render({ initialSnapshot: realSnapshot({ reports: undefined, role: { id: 'partner-editor', label: 'redaktör' }, permissions: [...roleOf('partner-editor').permissions] }) });
  assert.doesNotMatch(withoutRight, /rundor senaste 7 dagarna|reports\.read/);
});

test('Spelare, Ekonomi, Integration and Hjälp render honest content without invented numbers', () => {
  const players = render({ initialView: 'players' });
  assert.match(players, /<h1>Spelare<\/h1>/); assert.match(players, /Era spelare visas här när de kopplats till er\./); assert.doesNotMatch(players.replace(/<svg[\s\S]*?<\/svg>/g, ''), /<td|preview-area|\d+ USD|\d{4,}|steg F|O03|Det här kommer att visas/);
  const reports = render({ initialView: 'reports' });
  assert.match(reports, /<h1>Ekonomi<\/h1>/); assert.match(reports, /Rundor och netto per dag/); assert.match(reports, /600 USD/); assert.match(reports, /540 USD/);
  assert.doesNotMatch(reports, /Publiceringar|revision 6|steg F|Avräkning|Per spelare|spelets journal/, 'no placeholders, publications live in the table history');
  assert.match(reports, /aria-pressed="true"[^>]*>7 dagar/);
  // Two currencies in the period: amounts per currency, never one added-up sum.
  const base = realSnapshot().reports, withAmounts = (room, code) => ({ ...room, days: room.days.map(day => ({ ...day, amounts: day.rounds ? { [code]: { staked: day.staked, returned: day.returned } } : {} })) });
  const mixedRooms = [withAmounts(base.rooms[0], 'USD'), withAmounts({ ...base.rooms[1], rounds: 1, staked: 20, returned: 0, net: 20, days: days([0, 0, 0, 0, 0, 0, 1]).map(day => ({ ...day, staked: day.rounds * 20, returned: 0 })) }, 'EUR')];
  const mixed = render({ initialView: 'reports', initialSnapshot: realSnapshot({ reports: { ...base, currency: null, currencies: ['EUR', 'USD'], rooms: mixedRooms } }) });
  // One currency at a time: a switch at the top, the largest currency first, never a mixed line or a sum.
  assert.match(mixed, /aria-pressed="true"[^>]*>USD</); assert.match(mixed, /aria-pressed="false"[^>]*>EUR</);
  assert.match(mixed, /600 USD/); assert.doesNotMatch(mixed, /20 EUR · 600 USD|· \d+ EUR|620/);
  // The read window did not reach the whole period: Ekonomi and Översikt both say so, naming the row count only then.
  const cut = { ...base, truncated: true, seqWindow: 100000 };
  for (const view of ['reports', 'overview']) {
    const html = render({ initialView: view, initialSnapshot: realSnapshot({ reports: cut }) });
    assert.match(html, /role="status"[^>]*>Perioden är längre än vad som kunde läsas nu/, view);
    assert.doesNotMatch(render({ initialView: view }), /Perioden är längre/, view + ' without truncation');
  }
  assert.match(render({ initialView: 'reports', initialSnapshot: realSnapshot({ reports: { ...cut, seqWindow: undefined } }) }), /Perioden är längre än vad som kunde läsas nu/);
  const noReports = render({ initialView: 'reports', initialSnapshot: realSnapshot({ reports: { status: 'not-connected', reason: 'read-failed' } }) });
  assert.match(noReports, /Siffror för rundor och insatser finns inte här ännu\./); assert.doesNotMatch(noReports, /600 USD|540 USD/);
  const integration = render({ initialView: 'integration' });
  assert.match(integration, /<h1>Integration<\/h1>/); assert.match(integration, /<code>\/game\?operator=johnsspelbolag<\/code>/);
  assert.match(integration, /Er nyckel hanteras av Scoutgaming/); assert.doesNotMatch(integration, /api_keys|steg F|O03|Spelarkonton för den här operatören|\/admin\/admin\/players/);
  const help = render({ initialView: 'help' });
  assert.match(help, /<h1>Hjälp och kontakt<\/h1>/); assert.match(help, /Begär material/);
  assert.match(help, /href="mailto:\?subject=Beg%C3%A4ran%20om%20material%20fr%C3%A5n%20Johns%20Bet/);
  assert.match(help, /Rollen administratör får/); assert.match(help, /Bestäms av Scoutgaming/);
  // "Önska bakgrund" is only a request by e-mail to Scoutgaming; nothing enters the package from here.
  assert.match(help, /<option value="background-wish" selected="">Önska bakgrund<\/option>/); assert.match(help, /Beskriv bakgrunden/);
  assert.match(help, /Scoutgaming tar fram förslag och lägger det godkända i er tilldelning/); assert.match(help, /href="mailto:\?subject=[^"]*%C3%96nska%20bakgrund/);
  assert.doesNotMatch(help, /steg C|steg F|O03/);
});

test('shell strings exist in both languages and the snapshot validator rejects fixtures and foreign resources', () => {
  const sv = partnerCopy('sv'), en = partnerCopy('en');
  assert.deepEqual(Object.keys(sv), Object.keys(en));
  for (const copy of [sv, en]) for (const [key, value] of Object.entries(copy)) assert.ok(typeof value === 'string' && value, key);
  assert.equal(partnerCopy('unsupported'), sv);
  assert.throws(() => validatePartnerSnapshot({ ...realSnapshot(), preview: true, mode: 'fixture' }));
  assert.throws(() => validatePartnerSnapshot({ ...realSnapshot(), operators: [] }));
  for (const key of ['tables', 'team', 'presentations']) {
    assert.throws(() => validatePartnerSnapshot({ ...realSnapshot(), [key]: [{ id: 'foreign', operatorId: 'other' }] }), key);
    assert.throws(() => validatePartnerSnapshot({ ...realSnapshot(), [key]: null }), key);
  }
  assert.throws(() => createPartnerWorkspaceContext(realSnapshot(), { surface: 'internal', user: 'john-admin' }));
  assert.throws(() => createPartnerWorkspaceContext({ ...realSnapshot(), viewer: { user: 'someone-else' } }, { surface: 'partner', user: 'john-admin' }));
  assert.equal(operatorPackageRevision(realSnapshot()), '7');
  assert.throws(() => render({ initialSnapshot: { ...realSnapshot(), preview: true } }), /verklig partnerarbetsyta/);
});

test('portal CSS is fenced under .partner-portal, loads nothing external, and the directory CSS defines every class it uses', () => {
  const portalCss = readFileSync(new URL('../components/kevin-bo/partner-portal.css', import.meta.url), 'utf8');
  postcss.parse(portalCss).walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    for (const selector of postcss.list.comma(rule.selector)) assert.ok(selector.startsWith('.partner-portal'), selector);
  });
  const entrySource = readFileSync(new URL('../components/partner-workspace.tsx', import.meta.url), 'utf8');
  const entryCss = readFileSync(new URL('../components/partner-workspace.module.css', import.meta.url), 'utf8');
  for (const [, name] of entrySource.matchAll(/styles\.(\w+)/g)) assert.ok(entryCss.includes(`.${name}`), name);
  for (const css of [entryCss, portalCss]) assert.doesNotMatch(css, /@import|fonts\.googleapis|https?:\/\//);
  const workspace = readFileSync(sourceUrl, 'utf8');
  assert.doesNotMatch(workspace, /window\.BO_|ReactDOM|createRoot\(|import\(|fetch\(|new WebSocket|new EventSource|localStorage|normalizeView|INTERNAL_LINKS|owner==='planned'/);
});

function harness(language = 'sv') {
  const slots = []; let cursor = 0;
  const hooks = { ...React,
    useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef: value => { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; },
    useMemo: work => work(), useCallback: work => work, useEffect: () => {} };
  return { hooks, reset: () => { cursor = 0; }, module: components({ language, hooks }) };
}

test('a verified own-company saved receipt updates the package view and clears the waiting draft without replacing team or rooms', () => {
  const { module, reset } = harness();
  const snapshot = realSnapshot({ team: [{ id: 'staff', operatorId: 'john' }], draft: { revision: 2, basePackageRevision: 7 } });
  const props = { surface: 'partner', initialSnapshot: snapshot, apiBase: '/studio/api/partner/snapshot', user: 'john-admin', initialView: 'rooms' };
  const session = module.PartnerOperatorWorkspace(props).type;
  const walk = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(walk)];
  const view = () => { reset(); return walk(session(props)).find(node => node.type?.name === 'PartnerOperatorView'); };
  const before = view().props.runtime.snapshot;
  const lane = defaultPresentationLane('astrid'); lane.dealers = ['astrid', 'vera']; lane.layers.dealer.allowed = ['astrid', 'vera'];
  const receipt = { operatorId: 'john', packageRevision: 8, branding: { lane: lane.id, dealer: 'vera' }, presentation: { schemaVersion: 1, projectRevision: 'frozen-r1', lanes: [lane], assets: [] } };
  view().props.onAppearanceSaved({ ...receipt, operatorId: 'other' }); assert.deepEqual(view().props.runtime.snapshot, before);
  view().props.onAppearanceSaved(receipt); const after = view().props.runtime.snapshot;
  assert.equal(after.packageRevision, '8'); assert.equal(after.operator.packageRevision, '8'); assert.equal(after.presentations[0].dealer, 'vera'); assert.equal(after.draft, null);
  assert.deepEqual(after.team, before.team); assert.deepEqual(after.tables, before.tables); assert.deepEqual(after.operators, before.operators);
  view().props.onAppearanceSaved({ ...receipt, packageRevision: 7, branding: { dealer: 'astrid' } }); assert.deepEqual(view().props.runtime.snapshot, after);
});

test('the room editor keeps its element identity across menu and history view changes', () => {
  const slots = []; let cursor = 0;
  const hooks = { ...React, useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; }, useEffect: callback => callback() };
  const module = components({ hooks });
  const roomSelection = { roomId: 'room-john', unavailable: false }, onRoomSelectionChange = () => {};
  const runtime = createPartnerWorkspaceContext(realSnapshot(), { surface: 'partner', user: 'john-admin', notify() {} });
  const base = { runtime, copy: partnerCopy('sv'), apiBase: '/api/partner', language: 'sv', roomSelection, onRoomSelectionChange, user: 'john-admin' };
  const render = view => { cursor = 0; return module.PartnerOperatorView({ ...base, view }); };
  const room = tree => tree.props.children[0];
  const first = room(render('rooms')), away = room(render('overview')), back = room(render('rooms'));
  assert.equal(first.props.hidden, false); assert.equal(away.props.hidden, true); assert.equal(back.props.hidden, false);
  assert.equal(first.type, away.type); assert.equal(first.props.children.type, away.props.children.type);
  assert.equal(away.props.children.props.active, false); assert.equal(back.props.children.props.active, true);
  assert.equal(back.props.children.props.selection, roomSelection); assert.equal(back.props.children.props.onSelectionChange, onRoomSelectionChange);
});

test('overview and Ekonomi markup are stable across server time zones', () => {
  const previous = process.env.TZ;
  const draw = () => ['overview', 'reports'].map(initialView => render({ initialView })).join('');
  try { process.env.TZ = 'UTC'; const utc = draw(); process.env.TZ = 'Europe/Stockholm'; assert.equal(draw(), utc); }
  finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
