import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { partnerCopy, partnerNavigation } from '../components/kevin-bo/partner-copy.mjs';
import { defaultPresentationLane } from '../../../packages/presentation/contracts/studio-model.mjs';
import { PartnerPackageView } from '../components/partner-package-view.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const sourceUrl = new URL('../components/kevin-bo/partner-operator-workspace.jsx', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');
const actionsUrl = new URL('../components/partner-session-actions.tsx', import.meta.url);
const actionsCode = transformSync(readFileSync(actionsUrl, 'utf8'), { filename: 'partner-session-actions.tsx',
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
const actionsModule = { exports: {} }, actionsRequire = createRequire(actionsUrl);
vm.runInNewContext(actionsCode, { module: actionsModule, exports: actionsModule.exports,
  require: name => name.endsWith('.css') ? {} : actionsRequire(name) });

function components({ language = 'sv', theme = 'light' } = {}) {
  const compiled = transformSync(source, { filename: 'partner-operator-workspace.jsx',
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' } });
  const localRequire = createRequire(sourceUrl), module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, structuredClone, URL, URLSearchParams,
    require: name => {
      if (name.endsWith('.css')) return {};
      if (name === '../partner-session-actions') return actionsModule.exports;
      if (name === './assets.mjs') return { assetUrl: path => path };
      if (name === './views/team.jsx') return { TeamView: () => null };
      if (name === './partner-copy.mjs') return { partnerNavigation, usePartnerPreferences: () => ({
        language, theme, copy: partnerCopy(language), setLanguage() {}, setTheme() {},
      }) };
      return localRequire(name);
    },
  }, { filename: 'partner-operator-workspace.jsx' });
  return module.exports;
}

function realSnapshot(overrides = {}) {
  const operator = { id: 'john', slug: 'johnsspelbolag', name: 'Johnsspelbolag', packageRevision: '7' };
  return { preview: false, accessClass: 'internal-admin', viewer: { user: 'jakob', accessClass: 'internal-admin' },
    operator, operators: [operator], permissions: [], packageRevision: '7', generatedAt: '2026-10-11T12:00:00Z',
    presentations: [{ id: 'lane-john', operatorId: 'john', name: 'Johns lane', dealer: 'Nora' }],
    tables: [{ id: 'room-john', operatorId: 'john', name: 'Johns bord', game: 'blackjack', status: 'active', presentationId: 'lane-john' }],
    team: [], players: [], transactions: [], reports: [], unavailableSections: ['players', 'transactions', 'reports'],
    ...overrides };
}

test('real partner headers link staff to Admin and the lobby without granting member navigation', () => {
  for (const language of ['sv', 'en']) {
    const { PartnerOperatorWorkspace } = components({ language });
    const render = accessClass => renderToStaticMarkup(React.createElement(PartnerOperatorWorkspace, {
      surface: 'partner', user: 'jakob', initialSnapshot: realSnapshot({ accessClass }), initialView: 'overview',
    }));
    const staff = render('internal-admin');
    assert.match(staff, /href="\/admin"/);
    assert.match(staff, /href="\/lobby\?operator=johnsspelbolag&amp;room=room-john"/);
    assert.doesNotMatch(staff, /href="\/(?:control|play)"/);
    assert.doesNotMatch(render('partner'), /href="\/(?:admin|lobby|control|play)(?:\?|\/|")/);
  }
});

test('John shell strings are supplied in Swedish and English with a safe fallback', () => {
  const sv = partnerCopy('sv'), en = partnerCopy('en');
  assert.deepEqual(Object.keys(sv), Object.keys(en));
  for (const copy of [sv, en]) for (const [key, value] of Object.entries(copy)) assert.ok(typeof value === 'string' && value, key);
  assert.equal(partnerCopy('unsupported'), sv);
  assert.equal(en.overview, 'Overview');
  assert.equal(sv.overview, 'Översikt');
});

test('real partner navigation has John groups and no legacy fixture product pages', () => {
  const nav = partnerNavigation('en');
  assert.deepEqual([...new Set(nav.map(item => item.group))], ['Operator']);
  for (const id of ['pit', 'roulette', 'baccarat', 'shoes', 'stats', 'voice', 'clips', 'archive']) assert.equal(nav.some(item => item.id === id), false, id);
  assert.equal(nav.some(item => item.id === 'team'), false);
  assert.equal(partnerNavigation('sv', ['team.read']).some(item => item.id === 'team'), true);
  assert.equal(partnerNavigation('sv', ['team.roles.assign']).some(item => item.id === 'team'), false);
});

test('real overview uses actual package and configuration data, not fixture game metrics', () => {
  const { PartnerLiveOverview } = components();
  for (const language of ['sv', 'en']) {
    const copy = partnerCopy(language);
    const html = renderToStaticMarkup(React.createElement(PartnerLiveOverview, { snapshot: realSnapshot(), copy }));
    assert.match(html, />7<\/strong>/);
    assert.match(html, /Johns lane/);
    assert.match(html, /Johns bord/);
    assert.ok(html.includes(copy.configured));
    assert.ok(html.includes(copy.unavailableBody));
    assert.match(html, /href="\/partner\/johnsspelbolag\/rooms"/);
    assert.doesNotMatch(html, /paused|Pausat|GGR|€|EUR|Öppna insatser|Spelare online|Fixture operations/);
  }
});

test('empty unpublished operators do not imply a live package or assigned tables', () => {
  const { PartnerLiveOverview } = components();
  const snapshot = realSnapshot({ operator: { id: 'john', slug: 'johnsspelbolag', name: 'Johnsspelbolag' }, packageRevision: '', presentations: [], tables: [] });
  const html = renderToStaticMarkup(React.createElement(PartnerLiveOverview, { snapshot, copy: partnerCopy('sv') }));
  assert.match(html, /Inget publicerat paket/);
  assert.match(html, /Inga spelrum ännu/);
  assert.doesNotMatch(html, /Johns bord|Johns lane|Konfigurerat/);
});

test('real administrator shell exposes same-account links, theme, language and grouped navigation', () => {
  const { PartnerOperatorWorkspace } = components({ language: 'en', theme: 'dark' });
  const html = renderToStaticMarkup(React.createElement(PartnerOperatorWorkspace, { surface: 'partner', initialSnapshot: realSnapshot(), user: 'jakob', apiBase: '/api/partner/snapshot' }));
  assert.match(html, /data-preview="operator" data-theme="dark" lang="en"/);
  assert.match(html, /href="\/admin"/);
  assert.match(html, /href="\/lobby\?operator=johnsspelbolag&amp;room=room-john"/);
  assert.match(html, /Internal administrator/);
  assert.match(html, /Switch account/);
  assert.match(html, /Log out/);
  assert.match(html, /<h1[^>]*>Overview<\/h1>/);
  assert.equal((html.match(/<details/g) || []).length, 1);
  assert.match(html, /<summary[^>]*>Operator<\/summary>/);
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /Intern förhandsvisning|Exempeloperatör|Fixture operations|Demo North|Demo South/);
});

test('member shell keeps internal links out and unsupported real pages never show fixtures', () => {
  const { PartnerOperatorWorkspace } = components();
  for (const initialView of ['players', 'tx', 'reports', 'api', 'roulette']) {
    const snapshot = realSnapshot({ accessClass: 'partner', viewer: { user: 'john', accessClass: 'partner' } });
    const html = renderToStaticMarkup(React.createElement(PartnerOperatorWorkspace, { surface: 'partner', initialSnapshot: snapshot, user: 'john', apiBase: '/api/partner/snapshot', initialView }));
    assert.match(html, /Inte anslutet/);
    assert.match(html, /Operatörspersonal/);
    assert.match(html, /Byt konto/);
    assert.match(html, /Logga ut/);
    assert.doesNotMatch(html, /href="\/(?:control|play)"|Fixture operations|Intern förhandsvisning|Planerat/);
  }
});

function contrast(front, back) {
  const luminance = hex => {
    const values = hex.replace('#', '').match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  const values = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test('real partner heading overrides the legacy fixed foreground in both themes', () => {
  const legacyCss = readFileSync(new URL('../components/kevin-bo/preview.css', import.meta.url), 'utf8');
  const shellCss = readFileSync(new URL('../components/kevin-bo/john-foundation.css', import.meta.url), 'utf8');
  assert.match(legacyCss, /\.kevin-shell-heading\{[^}]*color:#3E4A45/);
  const heading = shellCss.match(/\.kevin-bo\[data-preview="operator"\] \.kevin-shell-heading\{([^}]+)\}/)?.[1];
  assert.ok(heading, 'authenticated heading has its own scoped rule');
  assert.match(heading, /color:var\(--ink\)/);
  assert.match(shellCss, /\[data-theme="dark"\]\{[^}]*--ink:#F2F1ED/);
  assert.ok(contrast('#F2F1ED', '#0A0B0D') >= 4.5);
});

test('scoped John styles cover entry classes, local fonts, responsive shell and readable palette', () => {
  const entrySource = readFileSync(new URL('../components/partner-workspace.tsx', import.meta.url), 'utf8');
  const entryCss = readFileSync(new URL('../components/partner-workspace.module.css', import.meta.url), 'utf8');
  const shellCss = readFileSync(new URL('../components/kevin-bo/john-foundation.css', import.meta.url), 'utf8');
  for (const [, name] of entrySource.matchAll(/styles\.(\w+)/g)) assert.ok(entryCss.includes(`.${name}`), name);
  for (const css of [entryCss, shellCss]) {
    assert.match(css, /data-theme="dark"/);
    assert.match(css, /--sg-next-body/);
    assert.match(css, /--sg-next-display/);
    assert.match(css, /--sg-next-mono/);
    assert.match(css, /max-width:820px/);
    assert.doesNotMatch(css, /@import|fonts\.googleapis|https?:\/\//);
  }
  assert.match(shellCss, /data-surface="partner"\]\[data-preview="operator"/);
  for (const [front, back] of [['#0A0B0D', '#F2F1ED'], ['#55574F', '#FFFFFF'], ['#4A6200', '#F2F1ED'],
    ['#F2F1ED', '#121418'], ['#A3A59F', '#121418'], ['#D6FF3A', '#0A0B0D'], ['#0A0B0D', '#E3F8A6']]) {
    assert.ok(contrast(front, back) >= 4.5, `${front} on ${back}`);
  }
});


test('all live partner composition names share localized labels while frozen data and room IDs stay unchanged', () => {
  const named = [['mobile-phone','Mobile Phone Lane'],['layer-preview','Layer Preview Lane'],['company-custom','Norrsken']];
  const snapshot = realSnapshot({
    presentations: named.map(([id,name]) => ({id,name,operatorId:'john',dealer:'astrid'})),
    presentation: {schemaVersion:1,projectRevision:'frozen-label-fixture',assets:[],lanes:named.map(([id,label]) => ({...defaultPresentationLane('astrid'),id,label}))},
    branding: {lane:'mobile-phone'}, roomBindings:'operator-owned-v2',
    tables: named.map(([presentationId],index) => ({id:'room-'+index,operatorId:'john',name:'Spelrum '+index,game:'blackjack',status:'active',presentationId})),
  });
  const before=JSON.stringify(snapshot);
  for(const language of ['sv','en']) {
    const {PartnerOperatorWorkspace,PartnerLiveOverview}=components({language}),copy=partnerCopy(language);
    const expected=language==='en'?['Standard composition','Layer composition','Norrsken']:['Standardsammansättning','Lagersammansättning','Norrsken'];
    const page=view=>renderToStaticMarkup(React.createElement(PartnerOperatorWorkspace,{surface:'partner',initialSnapshot:snapshot,user:'jakob',apiBase:'/studio/api/partner/snapshot',initialView:view}));
    const overview=page('ops');
    for(const label of expected) {
      assert.ok(overview.includes('<li>'+label+'</li>'));
      assert.ok(overview.includes('<td>'+label+'</td>'));
    }
    const tableOnly=renderToStaticMarkup(React.createElement(PartnerLiveOverview,{snapshot,copy,language,tablesOnly:true}));
    for(const label of expected) assert.ok(tableOnly.includes('<td>'+label+'</td>'));
    const rooms=page('bj'),integration=page('api');
    assert.ok(rooms.includes('<p>'+expected[0]+'</p>'));
    assert.ok(integration.includes(copy.apiBody));
    for(const markup of [overview,tableOnly,rooms,integration]) assert.doesNotMatch(markup,/Mobile Phone Lane|Layer Preview Lane/);
    for(const [index,room] of snapshot.tables.entries()) {
      const preview=renderToStaticMarkup(React.createElement(PartnerPackageView,{snapshot,view:'test',roomId:room.id,language}));
      assert.ok(preview.includes('<p>'+expected[index]+'</p>'));
      assert.ok(preview.includes('/game?game=blackjack&amp;operator=johnsspelbolag&amp;table='+room.id));
      assert.doesNotMatch(preview,/Mobile Phone Lane|Layer Preview Lane/);
    }
    assert.equal(JSON.stringify(snapshot),before);
  }
});
