import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { endPartnerSession, partnerSessionDestination } from '../lib/partner-session-actions.mjs';
import { partnerCopy } from '../components/partner/partner-copy.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const defaults = { apiBase: '/studio/api/partner/snapshot', accessClass: 'internal-admin', action: 'switch', returnTo: '/partner/johnsspelbolag/team' };
const response = (status = 200, value = { ok: true }) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

function transport(responses) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift() ?? response(); } };
}

test('account switching uses the server API base and only canonical partner return paths', () => {
  for (const apiBase of ['/studio/api/partner/snapshot', '/api/partner/snapshot']) {
    const login = '/admin/login';
    assert.equal(partnerSessionDestination({ ...defaults, apiBase }), `${login}?returnTo=%2Fpartner%2Fjohnsspelbolag%2Fteam`);
    assert.equal(partnerSessionDestination({ ...defaults, apiBase, action: 'logout' }), login);
    assert.equal(partnerSessionDestination({ ...defaults, apiBase, accessClass: 'partner' }), '/partner/login?returnTo=%2Fpartner%2Fjohnsspelbolag%2Fteam');
  }
  assert.equal(partnerSessionDestination({ ...defaults, returnTo: '/studio/partner/johnsspelbolag/ops' }), '/admin/login?returnTo=%2Fpartner%2Fjohnsspelbolag');
  for (const returnTo of ['https://evil.example/partner/john', '//evil.example', '/partner/login', '/partner/set-password', '/control', '/partner/john?redirect=https://evil.example', '/partner/john#secret']) {
    assert.equal(partnerSessionDestination({ ...defaults, returnTo }), '/admin/login', returnTo);
  }
});

test('invalid API origins, fixture APIs and untrusted access classes cannot start auth requests', async () => {
  const client = transport([]);
  for (const extra of [{ apiBase: '/studio/api/partner-preview' }, { apiBase: 'https://evil.example/api/partner/snapshot' },
    { accessClass: 'internal' }, { accessClass: undefined }, { action: 'login' }]) {
    await assert.rejects(endPartnerSession({ ...defaults, ...extra, fetchImpl: client.fetchImpl }));
  }
  assert.deepEqual(client.calls, []);
});

test('internal admin clears any secondary partner session before confirmed N1 logout, with both cookies', async () => {
  for (const apiBase of ['/studio/api/partner/snapshot', '/api/partner/snapshot']) {
    const prefix = apiBase.startsWith('/studio/') ? '/studio' : '';
    const cookies = new Set(['partner_session', 'bo_jwt', 'lab_session']);
    const calls = [];
    const destination = await endPartnerSession({ ...defaults, apiBase, fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(options.credentials, 'same-origin');
      if (url.endsWith('/partner/logout')) { assert.ok(cookies.has('bo_jwt')); cookies.delete('partner_session'); }
      else { assert.equal(cookies.has('partner_session'), false); cookies.delete('bo_jwt'); cookies.delete('lab_session'); }
      return response();
    } });
    assert.deepEqual(calls, [`${prefix}/api/partner/logout`, `${prefix}/api/auth/logout`]);
    assert.equal(cookies.size, 0);
    assert.ok(destination.startsWith(`/admin/login?returnTo=`));
  }
});

test('an absent secondary partner session is cleared by existing 401 contract; partner logout never assumes that success', async () => {
  const secondary = transport([response(401), response()]);
  await endPartnerSession({ ...defaults, fetchImpl: secondary.fetchImpl });
  assert.deepEqual(secondary.calls.map(call => call.url), ['/studio/api/partner/logout', '/studio/api/auth/logout']);
  const primary = transport([response(401)]);
  await assert.rejects(endPartnerSession({ ...defaults, accessClass: 'partner', fetchImpl: primary.fetchImpl }), { status: 401 });
  assert.equal(primary.calls.length, 1);
});

test('partner session logout uses only its own same-origin endpoint and checked response', async () => {
  const client = transport([response()]);
  assert.equal(await endPartnerSession({ ...defaults, accessClass: 'partner', action: 'logout', apiBase: '/api/partner/snapshot', fetchImpl: client.fetchImpl }), '/partner/login');
  assert.equal(client.calls[0].url, '/api/partner/logout');
  assert.deepEqual(client.calls[0].options, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' });
  for (const value of [{ ok: false }, { ok: true, error: 'unconfirmed' }, null]) {
    await assert.rejects(endPartnerSession({ ...defaults, accessClass: 'partner', fetchImpl: transport([response(200, value)]).fetchImpl }));
  }
});

test('secondary or N1 failure stops switching, and a partial logout can be safely retried', async () => {
  const secondary = transport([response(500)]);
  await assert.rejects(endPartnerSession({ ...defaults, fetchImpl: secondary.fetchImpl }));
  assert.equal(secondary.calls.length, 1);
  const partial = transport([response(), response(500), response(401), response()]);
  await assert.rejects(endPartnerSession({ ...defaults, fetchImpl: partial.fetchImpl }));
  assert.equal(await endPartnerSession({ ...defaults, fetchImpl: partial.fetchImpl }), '/admin/login?returnTo=%2Fpartner%2Fjohnsspelbolag%2Fteam');
  assert.deepEqual(partial.calls.map(call => call.url), ['/studio/api/partner/logout', '/studio/api/auth/logout', '/studio/api/partner/logout', '/studio/api/auth/logout']);
  await assert.rejects(endPartnerSession({ ...defaults, fetchImpl: async () => { throw Error('private network details'); } }));
});

function loadComponent(relative, { hooks = React, context = {}, dependencies = {} } = {}) {
  const sourceUrl = new URL(relative, import.meta.url), module = { exports: {} }, localRequire = createRequire(sourceUrl);
  const code = transformSync(readFileSync(sourceUrl, 'utf8'), { filename: sourceUrl.pathname,
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
  vm.runInNewContext(code, { module, exports: module.exports, ...context, require: name => {
    if (name === 'react') return hooks;
    if (name.endsWith('.css')) return new Proxy({}, { get: (_, property) => property });
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    return localRequire(name);
  } });
  return module.exports;
}

test('both live directory identities expose explicit localized auth buttons', () => {
  const actions = loadComponent('../components/partner-session-actions.tsx');
  for (const language of ['sv', 'en']) {
    const preferences = { usePartnerPreferences: () => ({ language, theme: 'dark', copy: partnerCopy(language), setLanguage() {}, setTheme() {} }) };
    const { PartnerWorkspace } = loadComponent('../components/partner-workspace.tsx', { dependencies: {
      './partner-session-actions': actions, './partner/partner-copy.mjs': preferences,
    } });
    for (const accessClass of ['internal-admin', 'partner']) {
      const html = renderToStaticMarkup(React.createElement(PartnerWorkspace, { user: 'john', operators: [], accessClass, apiBase: defaults.apiBase }));
      assert.ok(html.includes(partnerCopy(language).switchAccount));
      assert.ok(html.includes(partnerCopy(language).logOut));
      assert.match(html, /type="button"/);
      assert.doesNotMatch(html, /href="[^\"]*logout|Demo North|Demo South/);
    }
  }
});

test('auth actions remain clickable on mobile and show localized failure without navigating; retry succeeds', async () => {
  for (const language of ['sv', 'en']) {
    const slots = []; let cursor = 0;
    const hooks = { ...React,
      useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
      useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next; }]; },
    };
    const calls = [], destinations = []; let fail = true;
    const fetchImpl = async url => { calls.push(url); return response(fail ? 500 : 200); };
    const { PartnerSessionActions } = loadComponent('../components/partner-session-actions.tsx', { hooks, dependencies: {
      '../lib/partner-session-actions.mjs': { endPartnerSession: options => endPartnerSession({ ...options, fetchImpl }) },
    }, context: {
      window: { location: { assign: destination => destinations.push(destination) } },
    } });
    const walk = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(walk)];
    const render = () => { cursor = 0; return walk(PartnerSessionActions({ ...defaults, language })); };
    const buttons = () => render().filter(node => node.type === 'button');
    buttons()[0].props.onClick();
    assert.equal(buttons().every(button => button.props.disabled), true);
    buttons()[1].props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 1, 'duplicate clicks do not start concurrent logout');
    assert.deepEqual(destinations, []);
    assert.equal(render().find(node => node.props?.role === 'alert').props.children, partnerCopy(language).logoutError);
    fail = false; buttons()[0].props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(destinations, ['/admin/login?returnTo=%2Fpartner%2Fjohnsspelbolag%2Fteam']);
    assert.equal(render().some(node => node.props?.role === 'alert'), false);
  }
});

test('declined draft warning prevents session mutation and a failed logout restores navigation protection',async()=>{
  const slots=[];let cursor=0,allow=false,resets=0;
  const hooks={...React,useRef:value=>{const index=cursor++;return slots[index]??={current:value};},useState:value=>{const index=cursor++;if(!(index in slots))slots[index]=value;return [slots[index],next=>{slots[index]=next;}];}};
  const calls=[],destinations=[];
  const {PartnerSessionActions}=loadComponent('../components/partner-session-actions.tsx',{hooks,dependencies:{'../lib/partner-session-actions.mjs':{endPartnerSession:async()=>{calls.push('logout');throw Error('offline');}}},context:{window:{location:{assign:path=>destinations.push(path)}}}});
  const walk=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(walk)];
  const buttons=()=>{cursor=0;return walk(PartnerSessionActions({...defaults,language:'sv',beforeNavigate:()=>allow,onNavigationCancelled:()=>resets++})).filter(row=>row.type==='button');};
  buttons()[0].props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,0);assert.deepEqual(destinations,[]);
  allow=true;buttons()[1].props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(resets,1);assert.deepEqual(destinations,[]);
});
