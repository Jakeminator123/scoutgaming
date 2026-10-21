import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as dashboard from '../lib/openclaw-dashboard.mjs';
import * as labUrls from '../lib/lab-url.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function load(file, overrides = {}, globals = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module, exports: module.exports, Request, AbortController, AbortSignal, URL, URLSearchParams, performance,
    fetch() { throw new Error('Unexpected real fetch'); }, ...globals,
    require: name => overrides[name] ?? (name.endsWith('.module.css') ? { __esModule: true, default: {} }
      : name === '../lib/openclaw-dashboard.mjs' ? dashboard : name === '../lib/lab-url.mjs' ? labUrls : require(name)) });
  return module.exports;
}
const { OpenClawWorkspace } = load('./openclaw-workspace.tsx');
const render = props => renderToStaticMarkup(React.createElement(OpenClawWorkspace, props));

function harness(fetchImpl, globals = {}) {
  const hooks = []; const pending = []; const listeners = new Map(); const navigations=[]; let cursor = 0;
  const fakeReact = { ...React,
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }]; },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; },
    useEffect(fn, deps) { const index = cursor++; const old = hooks[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) pending.push(() => { old?.cleanup?.(); hooks[index] = { deps, cleanup: fn() }; }); },
  };
  let current=new URL('https://admin.fixture.invalid/admin/ai/models');
  const window = {crypto:globalThis.crypto,location:{get href(){return current.href;},get pathname(){return current.pathname;},get search(){return current.search;},get hash(){return current.hash;},assign:value=>navigations.push(value)},
    history:{state:null,replaceState(state,_title,href){this.state=state;if(href)current=new URL(href,current);}},
    addEventListener:(type,fn)=>listeners.set(type,fn),
    removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);},
    dispatchEvent:event=>{listeners.get(event.type)?.(event);return !event.defaultPrevented;}};
  const component = load('./openclaw-workspace.tsx', { react: fakeReact }, { fetch: fetchImpl, window, ...globals }).OpenClawWorkspace;
  return {
    listeners, navigations,
    render() { cursor = 0; return component({}); },
    effects() { while (pending.length) pending.shift()(); },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); },
  };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const html = h => renderToStaticMarkup(h.render());
const flush = () => new Promise(resolve => setImmediate(resolve));
const view = h => { const tree = h.render(); h.effects(); return tree; };
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
const before = () => ({ version: 1, baseHash: 'revision-a', gateway: { connected: true, version: '2026.9.5', applied: null },
  agents: [
    { id: 'croupier-director', model: { primary: 'lab-provider/old', fallbacks: ['lab-provider/backup', 'other/backup-two'] } },
    { id: 'croupier-chat', model: { primary: 'lab-provider/old', fallbacks: [] } },
  ],
  models: ['old', 'new', 'third', 'backup'].map(id => ({ id: `lab-provider/${id}`, provider: 'lab-provider' })).concat([{ id: 'other/backup-two', provider: 'other' }]),
});
function updated(primary = 'lab-provider/new') { const next = before(); next.baseHash = 'revision-b'; next.agents[0].model.primary = primary; return next; }
function receipt(body) { return { saved: true, baseHash: 'revision-b', agentId: body.agentId, model: body.model, restartScheduled: true, verifiedAt: '2026-10-04T23:40:00.000Z' }; }
function select(h, id = 'croupier-director') {
  const row = nodes(h.render(), node => node.type === 'article' && node.props['aria-labelledby'] === `agent-${id}`)[0];
  return nodes(row, node => node.type === 'select')[0];
}
function button(h, label) { return nodes(h.render(), node => node.type === 'button' && (node.props['aria-label'] === label || [node.props.children].flat().join('') === label))[0]; }
function change(h, value = 'lab-provider/new', id) { select(h, id).props.onChange({ target: { value } }); view(h); }
async function started(fetchImpl, globals) { const h = harness(fetchImpl, globals); view(h); await flush(); view(h); return h; }

test('load uses same-origin no-store transport; read-only render never writes and unsupported choices stay visible', async () => {
  const calls = []; const initial = before(); initial.models = initial.models.filter(item => item.id !== 'lab-provider/old');
  const h = await started(async (url, init) => { calls.push({ url, init }); return reply(initial); });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, labUrls.labUrl('/api/openclaw/admin'));
  assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(select(h).props.value, 'lab-provider/old'); assert.match(html(h), /nuvarande, saknas i modellistan/);
  assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true);
  assert.doesNotMatch(html(h), /bekräftad|Gateway använder/); h.unmount();
});

test('save preserves ordered fallbacks, locks overlapping requests and confirms only after a real GET', async () => {
  const calls = []; let finish;
  const h = await started(async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'PATCH') return new Promise(resolve => { finish = () => resolve(reply(receipt(JSON.parse(init.body)))); });
    return reply(calls.length === 1 ? before() : updated());
  });
  change(h); change(h, 'lab-provider/third', 'croupier-chat');
  assert.equal(h.listeners.has('beforeunload'), true);
  const save = button(h, 'Spara modell för croupier-director'); save.props.onClick(); save.props.onClick();
  assert.equal(calls.length, 2); assert.equal(select(h).props.disabled, true);
  assert.equal(button(h, 'Ångra alla').props.disabled, true);
  const body = JSON.parse(calls[1].init.body);
  assert.deepEqual(body, { version: 1, baseHash: 'revision-a', agentId: 'croupier-director', model: { primary: 'lab-provider/new', fallbacks: ['lab-provider/backup', 'other/backup-two'] } });
  assert.doesNotMatch(html(h), /sparad och bekräftad/);
  finish(); await flush(); view(h);
  assert.equal(calls[2].init.method, 'GET'); assert.match(html(h), /sparad och bekräftad i OpenClaws inställningar/);
  assert.match(html(h), /Gateway-omstart är planerad/);
  assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true);
  assert.equal(select(h, 'croupier-chat').props.value, 'lab-provider/third');
  assert.equal(button(h, 'Spara modell för croupier-chat').props.disabled, false);
  assert.equal(calls.filter(call=>call.init.method==='PATCH').length,1);
  assert.match(html(h),/Osparade modellval: 1.*Spara varje agent på dess rad/);h.unmount();
});

test('multiple drafts offer only per-agent saves and undo all without writing', async () => {
  const calls=[];
  const h=await started(async (_url, init)=>{calls.push(init.method);return reply(before());});
  try {
    change(h);change(h,'lab-provider/third','croupier-chat');
    assert.match(html(h),/Osparade modellval: 2.*Spara varje agent på dess rad/);
    assert.doesNotMatch(html(h),/Spara alla/);
    const saves=nodes(h.render(),node=>node.type==='button'&&String(node.props['aria-label']??node.props.children).startsWith('Spara'));
    assert.deepEqual(saves.map(node=>node.props['aria-label']),['Spara modell för croupier-director','Spara modell för croupier-chat']);
    button(h,'Ångra alla').props.onClick();view(h);
    assert.equal(select(h).props.value,'lab-provider/old');
    assert.equal(select(h,'croupier-chat').props.value,'lab-provider/old');
    assert.equal(h.listeners.has('beforeunload'),false);
    assert.equal(button(h,'Ångra alla'),undefined);
    assert.deepEqual(calls,['GET']);
  } finally { h.unmount(); }
});

test('revision conflict preserves draft until explicit reload; retry uses fresh revision and fallbacks', async () => {
  const calls = []; const current = before(); current.baseHash = 'revision-other'; current.agents[0].model = { primary: 'lab-provider/third', fallbacks: [] };
  const h = await started(async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'PATCH' && calls.length === 2) return reply({ error: 'openclaw_admin_conflict' }, 409);
    if (init.method === 'PATCH') return reply(receipt(JSON.parse(init.body)));
    return reply(calls.length === 1 ? before() : calls.length === 3 ? current : { ...updated(), agents: [{ ...updated().agents[0], model: { primary: 'lab-provider/new', fallbacks: [] } }, before().agents[1]] });
  });
  change(h); button(h, 'Spara modell för croupier-director').props.onClick(); await flush(); view(h);
  assert.equal(calls.length, 2); assert.match(html(h), /ändrats av någon annan/);
  assert.equal(select(h).props.value, 'lab-provider/new'); assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true);
  button(h, 'Hämta aktuella val').props.onClick(); await flush(); view(h);
  assert.equal(select(h).props.value, 'lab-provider/new'); assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, false);
  button(h, 'Spara modell för croupier-director').props.onClick(); await flush();
  assert.equal(JSON.parse(calls[3].init.body).baseHash, 'revision-other');
  assert.deepEqual(JSON.parse(calls[3].init.body).model.fallbacks, []); h.unmount();
});

test('accepted save with failed readback stays unconfirmed and retains draft until successful reload', async () => {
  let calls = 0;
  const h = await started(async (_url, init) => {
    ++calls; if (init.method === 'PATCH') return reply(receipt(JSON.parse(init.body)));
    if (calls === 3) return reply({ error: 'openclaw_admin_unavailable', secret: 'DO-NOT-REFLECT' }, 503);
    return reply(calls === 1 ? before() : updated());
  });
  change(h); button(h, 'Spara modell för croupier-director').props.onClick(); await flush(); view(h);
  assert.match(html(h), /återläsningen misslyckades/); assert.doesNotMatch(html(h), /sparad och bekräftad|DO-NOT-REFLECT/);
  assert.equal(select(h).props.value, 'lab-provider/new'); assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true);
  button(h, 'Hämta aktuella val').props.onClick(); await flush(); view(h);
  assert.match(html(h), /sparad och bekräftad/); assert.equal(h.listeners.has('beforeunload'), false); h.unmount();
});

test('readback mismatch never claims success and keeps the draft available for explicit reload', async () => {
  const h = await started(async (_url, init) => init.method === 'PATCH' ? reply(receipt(JSON.parse(init.body))) : reply(before()));
  change(h); button(h, 'Spara modell för croupier-director').props.onClick(); await flush(); view(h);
  assert.match(html(h), /kunde inte bekräftas i OpenClaw/); assert.doesNotMatch(html(h), /sparad och bekräftad/);
  assert.equal(select(h).props.value, 'lab-provider/new'); assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true);
  button(h, 'Hämta aktuella val').props.onClick(); await flush(); view(h);
  assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, false); h.unmount();
});

test('reserve model cannot be selected as primary while fallback list is preserved; reset causes no write', async () => {
  let calls = 0; const h = await started(async () => { ++calls; return reply(before()); });
  const reserve = nodes(select(h), node => node.type === 'option' && node.props.value === 'lab-provider/backup')[0];
  assert.equal(reserve.props.disabled, true);
  change(h, 'lab-provider/backup'); button(h, 'Spara modell för croupier-director').props.onClick(); await flush();
  assert.equal(calls, 1); assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true);
  change(h); button(h, 'Återställ modell för croupier-director').props.onClick(); view(h);
  assert.equal(select(h).props.value, 'lab-provider/old'); assert.equal(h.listeners.has('beforeunload'), false); assert.equal(calls, 1); h.unmount();
});

test('safe errors distinguish configuration, pairing, session and privilege without reflecting raw provider data', async () => {
  for (const [status, code, expected] of [
    [503, 'openclaw_admin_not_configured', /inte konfigurerad/],
    [503, 'openclaw_admin_device_not_configured', /inte konfigurerad/],
    [503, 'openclaw_admin_pairing_required', /behöver godkännas/],
    [503, 'openclaw_admin_scope_required', /saknar behörighet/],
    [503, 'openclaw_admin_version_mismatch', /versionen stöder inte/],
    [401, 'studio_login_required', /session har löpt ut/], [403, 'studio_request_rejected', /konto saknar behörighet/],
  ]) {
    const h = await started(async () => reply({ error: code, message: 'DO-NOT-REFLECT', token: 'SECRET-NOT-RENDERED' }, status));
    assert.match(html(h), expected); assert.doesNotMatch(html(h), /DO-NOT-REFLECT|SECRET-NOT-RENDERED|Gateway använder|<select/); h.unmount();
  }
});

test('save uncertainty and malformed receipt never display success or discard changes', async () => {
  for (const result of [reply({ error: 'openclaw_admin_save_uncertain', detail: 'DO-NOT-REFLECT' }, 503), reply({ saved: true }), reply({ saved: false })]) {
    const h = await started(async (_url, init) => init.method === 'PATCH' ? result : reply(before()));
    change(h); button(h, 'Spara modell för croupier-director').props.onClick(); await flush(); view(h);
    assert.equal(select(h).props.value, 'lab-provider/new'); assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true);
    assert.match(html(h), /role="alert"/); assert.doesNotMatch(html(h), /sparad och bekräftad|DO-NOT-REFLECT/); h.unmount();
  }
});

test('Gateway applied status is fact-bound; false and unknown never claim active runtime configuration', async () => {
  for (const [applied, expected] of [[true, /Gateway använder/], [false, /ännu inte tagit dem i bruk/], [null, /Det går inte att bekräfta/]]) {
    const initial = before(); initial.gateway.applied = applied;
    const h = await started(async () => reply(initial)); assert.match(html(h), expected);
    if (applied !== true) assert.doesNotMatch(html(h), /Gateway använder/); h.unmount();
  }
});

test('invalid snapshot fails closed and a failed refresh blocks saving stale choices', async () => {
  for (const value of [{ version: 1 }, { ...before(), gateway: { connected: false } }, { ...before(), agents: [before().agents[0], before().agents[0]] }]) {
    const h = await started(async () => reply(value)); assert.match(html(h), /kunde inte nås/); assert.doesNotMatch(html(h), /<select/); h.unmount();
  }
  let calls = 0; const h = await started(async () => ++calls === 1 ? reply(before()) : reply({ error: 'openclaw_admin_unavailable' }, 503));
  change(h); button(h, 'Hämta aktuella val').props.onClick(); await flush(); view(h);
  assert.equal(select(h).props.value, 'lab-provider/new'); assert.equal(button(h, 'Spara modell för croupier-director').props.disabled, true); h.unmount();
});

test('removed agent keeps its orphaned draft visible and navigation warning until explicitly discarded', async () => {
  let calls = 0; const latest = before(); latest.agents = latest.agents.slice(1);
  const h = await started(async () => reply(++calls === 1 ? before() : latest));
  change(h); button(h, 'Hämta aktuella val').props.onClick(); await flush(); view(h);
  assert.match(html(h), /croupier-director finns inte längre/); assert.match(html(h), /lab-provider\/new/);
  assert.equal(h.listeners.has('beforeunload'), true);
  button(h, 'Ta bort utkast för croupier-director').props.onClick(); view(h);
  assert.equal(h.listeners.has('beforeunload'), false); h.unmount();
});

test('unmount aborts pending reads and prevents a late response from changing state', async () => {
  let resolve, signal; const h = harness(async (_url, init) => { signal = init.signal; return new Promise(done => { resolve = done; }); });
  view(h); h.unmount(); assert.equal(signal.aborted, true); resolve(reply(before())); await flush();
  assert.doesNotMatch(html(h), /<select/);
});

test('initial render uses existing Studio login, native advanced link and makes no connection claim or request', () => {
  const html = render();
  assert.match(html, /Öppna OpenClaws egen dashboard/);
  assert.match(html, /Studio-inloggning/);
  assert.match(html, /Hämtar inställningar/);
  assert.doesNotMatch(html, /<iframe|type="password"|type="hidden"|Gateway använder|bekräftad|Render-konsolen/);
});

test('clip policy remains in Studio and advanced dashboard keeps browser-approval guidance', () => {
  const html = render();
  assert.match(html, /dealerns klipp och regler/);
  assert.ok(html.includes(`href="${labUrls.labUrl('/admin/clips')}"`));
  assert.match(html, /utan lösenord eller terminalkommando/);
  assert.match(html, /egen webbläsarsession/);
  assert.doesNotMatch(html, /Starta om|Stoppa Gateway/);
});

test('embedded models share the Admin landmark and identify the dealer agent link', () => {
  const standalone = render();
  assert.match(standalone, /<main\b[^>]*id="main-content"/);
  assert.match(standalone, />Chatt<\/a>/);
  const embedded = render({ embedded: true, navigation: { models: '/admin/ai/models', chat: '/admin/ai/openclaw', studio: '/admin/clips' } });
  assert.doesNotMatch(embedded, /<main\b/);
  assert.match(embedded, /<section\b[^>]*id="main-content"/);
  assert.match(embedded, /href="\/admin\/ai\/openclaw">Dealerns agent<\/a>/);
  assert.match(embedded, /href="\/admin\/ai\/models" aria-current="page"/);
});

test('invalid explicit dashboard is not replaced with the default or reflected', () => {
  const html = render({ dashboardUrl: 'https://user:secret@bad.invalid/?token=secret' });
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Öppna OpenClaws egen dashboard|bad.invalid|token=secret|user:secret/);
});

test('dashboard button obtains a fresh N1 handoff before navigating and never renders the credential',async()=>{
 const bootstrapToken='a'.repeat(48),browserUrl=dashboard.OPENCLAW_DASHBOARD_URL+'#'+new URLSearchParams({bootstrapToken,bootstrapProfile:'owner',gatewayUrl:'wss://croupier-lab-director.onrender.com/openclaw'});
 let calls=0;const h=await started(async(url,init)=>{calls++;if(init.method==='GET')return reply(before());assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),{version:1,action:'dashboard.open'});return reply({browserUrl,expiresAtMs:Date.now()+590000,remainingLifetimeMs:590000});});
 const open=nodes(h.render(),n=>n.type==='button'&&String(n.props.children).includes('Öppna OpenClaws egen dashboard'))[0];
 open.props.onClick();await flush();view(h);assert.equal(calls,2);assert.deepEqual(h.navigations,[browserUrl]);assert.doesNotMatch(html(h),new RegExp(bootstrapToken));h.unmount();
});
test('dashboard never follows foreign or expired handoff URL and explains a missing deployed helper',async()=>{
 for(const value of [{browserUrl:'https://evil.invalid/#token=secret',expiresAtMs:Date.now()+50000,remainingLifetimeMs:50000},{browserUrl:dashboard.OPENCLAW_DASHBOARD_URL,expiresAtMs:0,remainingLifetimeMs:0},{error:'openclaw_dashboard_unavailable'}]) {
  const h=await started(async(url,init)=>init.method==='GET'?reply(before()):reply(value,value.error?503:200));
  nodes(h.render(),n=>n.type==='button'&&String(n.props.children).includes('Öppna OpenClaws egen dashboard'))[0].props.onClick();await flush();view(h);assert.equal(h.navigations.length,0);assert.match(html(h),/role="alert"/);assert.doesNotMatch(html(h),/evil.invalid|token=secret/);h.unmount();
 }
});

test('dashboard uses server lifetime when the browser clock is ahead or behind Gateway', async () => {
 const browserUrl=dashboard.OPENCLAW_DASHBOARD_URL+'#'+new URLSearchParams({bootstrapToken:'a'.repeat(43),bootstrapProfile:'owner',gatewayUrl:'wss://croupier-lab-director.onrender.com/openclaw'});
 const serverNow=Date.now(),expiresAtMs=serverNow+590000;
 for(const skew of [-300000,300000,900000]) {
  const h=await started(async(_url,init)=>reply(init.method==='GET'?before():{browserUrl,expiresAtMs,remainingLifetimeMs:590000}),{Date:class extends Date {static now(){return serverNow+skew;}}});
  nodes(h.render(),n=>n.type==='button'&&String(n.props.children).includes('Öppna OpenClaws egen dashboard'))[0].props.onClick();
  await flush();view(h);assert.deepEqual(h.navigations,[browserUrl]);h.unmount();
 }
});

test('dashboard rejects missing, excessive and elapsed server lifetimes without navigating', async () => {
 const browserUrl=dashboard.OPENCLAW_DASHBOARD_URL+'#'+new URLSearchParams({bootstrapToken:'a'.repeat(43),bootstrapProfile:'owner',gatewayUrl:'wss://croupier-lab-director.onrender.com/openclaw'});
 for(const remainingLifetimeMs of [undefined,0,-1,600001,1.5,'590000',500]) {
  let elapsed=0;
  const h=await started(async(_url,init)=>{if(init.method==='GET')return reply(before());elapsed=1000;return reply({browserUrl,expiresAtMs:Date.now()+590000,remainingLifetimeMs});},{performance:{now:()=>elapsed}});
  nodes(h.render(),n=>n.type==='button'&&String(n.props.children).includes('Öppna OpenClaws egen dashboard'))[0].props.onClick();
  await flush();view(h);assert.equal(h.navigations.length,0);assert.match(html(h),/role="alert"/);h.unmount();
 }
});
