import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';
import { fixtureLaneOperators } from '../lib/operator-package-api.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lib/operator-admin-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, fetch: overrides.fetch ?? globalThis.fetch,
    window: overrides.window ?? new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path), overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

const { ControlLanesPage } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url));
const { ControlOperatorDirectory, operatorDirectoryFailure } = loadTs(new URL('../components/control-operator-directory.tsx', import.meta.url));
const standardRoles = STANDARD_OPERATOR_ROLES.map(role => ({ id: role.id, label: role.label, permissions: [...role.permissions] }));
const roles = STANDARD_OPERATOR_ROLES.map(role => ({ id: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable }));
const directory = {
  standardRoles,
  operators: [
    {
      id: 'nordic-bet', slug: 'nordic-bet', name: 'Nordic Bet', status: 'active', roles, missingRoles: [],
      members: [
        { userId: '42', username: 'north-admin', roleId: 'partner-admin', status: 'active', revision: 2 },
        { userId: '43', username: null, roleId: 'partner-viewer', status: 'suspended', revision: 5 },
      ],
    },
    { id: 'amber-house', slug: 'amber-house', name: 'Amber House', status: 'active', roles: roles.slice(0, 1), missingRoles: ['partner-editor', 'partner-viewer'], members: [] },
  ],
};
function page(extra) {
  return renderToStaticMarkup(React.createElement(ControlLanesPage, {
    initialTab: 'companies',
    initialProject: createSeedProject(),
    initialVideos: { videos: [] },
    initialStatus: { configured: true },
    operators: fixtureLaneOperators(),
    storeAvailable: true,
    ...extra,
  }));
}
const buttons = html => [...html.matchAll(/<button class="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map(match => [match[2], match[1]]);

test('companies show a searchable overview and only the selected company membership editor', () => {
  const overview = page({ directory });
  assert.match(overview, /type="search"/);
  assert.match(overview, /Nordic Bet/); assert.match(overview, /Amber House/);
  assert.doesNotMatch(overview, /north-admin|Roll för/);
  const selected = renderToStaticMarkup(React.createElement(ControlOperatorDirectory, { directory, selectedOperatorId: 'nordic-bet' }));
  for (const value of ['north-admin', 'konto 43', 'aktiv', 'avstängd', 'E-post eller användarnamn', 'Administratör', 'Redaktör', 'Läsare']) assert.ok(selected.includes(value), value);
  assert.doesNotMatch(selected, /revision 2|revision 5|team.roles.assign/);
  assert.match(selected, /operator=nordic-bet/);
  assert.match(selected, /partner-viewer" selected=""/);
  assert.doesNotMatch(selected, /Spara roll/);
  const empty = renderToStaticMarkup(React.createElement(ControlOperatorDirectory, { directory, selectedOperatorId: 'amber-house' }));
  assert.match(empty, /Teamet är tomt/);
  assert.match(empty, /partner-admin" selected=""/);
  assert.match(empty, /Skapa saknade standardroller/);
});

test('without a store the card says so, and without the prop the page renders as before', () => {
  const offline = page({ directory: null, storeAvailable: false });
  assert.match(offline, /Bolag och team kunde inte hämtas/);
  assert.equal(offline.includes('Skapa bolag'), false);
  assert.equal((offline.match(/sg-btn-primary/g)?.length ?? 0), 0);
  assert.match(page({}), /Bolag och team kunde inte hämtas/);
  const alone = renderToStaticMarkup(React.createElement(ControlOperatorDirectory, { directory: { standardRoles, operators: [] } }));
  assert.match(alone, /Inga bolag ännu\./);
});

test('failures name the cause the admin API status allows, without guessing between 409 causes', () => {
  assert.match(operatorDirectoryFailure('create', 409), /redan ett bolag/);
  assert.match(operatorDirectoryFailure('create', 422), /reserverade ord/);
  assert.match(operatorDirectoryFailure('member', 409), /redan medlem, någon annan ändrade medlemskapet, eller .* sista administratören/);
  assert.match(operatorDirectoryFailure('member', 422), /partnerkonto/);
  assert.match(operatorDirectoryFailure('member', 429), /För många inbjudningar/);
  const surface = readFileSync(new URL('../components/workspace-surface-page.tsx', import.meta.url), 'utf8');
  assert.match(surface, /listLaneOperators/);
  assert.match(surface, /nativeStudioAdminEnabled/);
  assert.match(operatorDirectoryFailure('role', 409), /sista administratören/);
  assert.match(operatorDirectoryFailure('member', 403), /Åtkomst nekad/);
  assert.match(operatorDirectoryFailure('create', 503), /Neon-pool/);
  const pageSource = readFileSync(new URL('../app/control/operator-page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /directory=\{directory\}/);
  assert.match(pageSource, /listOperatorDirectory/);
});

test('human input suggests an editable address and selects exactly one membership identity', () => {
  const { suggestOperatorSlug, operatorMemberInput } = loadTs(new URL('../components/control-operator-directory.tsx', import.meta.url));
  assert.equal(suggestOperatorSlug('  Åland & Öresund Casino  '), 'aland-oresund-casino');
  assert.ok(suggestOperatorSlug('a'.repeat(100)).length <= 63);
  const plain = value => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(operatorMemberInput(' person@example.test ')), { email: 'person@example.test', status: 'invited' });
  assert.deepEqual(plain(operatorMemberInput(' north-admin ')), { username: 'north-admin', status: 'active' });
});

function directoryHarness(options={}) {
  const slots = [], requests = []; let cursor = 0;
  const fakeReact = { ...React, useEffect(){},
    useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=typeof initial==='function'?initial():initial; return [slots[i], value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}]; },
    useRef(value) { return slots[cursor++] ??= {current:value}; },
  };
  const { ControlOperatorDirectory: View }=loadTs(new URL('../components/control-operator-directory.tsx',import.meta.url),{
    react:fakeReact, window:options.window??{confirm:()=>true}, fetch:(path,options)=>new Promise(resolve=>requests.push({path,options,resolve})),
  });
  const render=()=>{cursor=0;return View({directory,...options});};
  function all(node,predicate) { if(!node||typeof node!=='object') return [];return [...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>all(child,predicate))]; }
  const nodes=predicate=>all(render(),predicate);
  return { requests, render, nodes, html:()=>renderToStaticMarkup(render()),
    select:name=>nodes(node=>node.type==='button' && node.props.className==='company').find(node=>renderToStaticMarkup(node).includes(name)).props.onClick(),
    input:()=>nodes(node=>node.type==='input'&&node.props.placeholder==='namn@bolag.se')[0],
    submit:()=>nodes(node=>node.type==='form'&&node.props['aria-label']?.startsWith('Lägg till medlem'))[0].props.onSubmit({preventDefault(){}}),
    async reply(index,payload,status=200){requests[index].resolve(Response.json(payload,{status}));await new Promise(resolve=>setImmediate(resolve));},
  };
}
test('company drafts stay separate, writes lock immediately and failed invitations keep the input', async()=>{
  const h=directoryHarness();h.select('Nordic Bet');h.input().props.onChange({target:{value:'person@example.test'}});
  h.select('Amber House');assert.equal(h.input().props.value,'');h.select('Nordic Bet');assert.equal(h.input().props.value,'person@example.test');
  h.submit();h.submit();h.select('Amber House');assert.equal(h.requests.length,1);assert.equal(h.input().props.value,'person@example.test');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{operatorId:'nordic-bet',email:'person@example.test',status:'invited',roleId:'partner-viewer'});
  assert.equal(h.requests[0].options.credentials,'same-origin');
  await h.reply(0,{},409);assert.equal(h.input().props.value,'person@example.test');assert.match(h.html(),/sista administratören/);
  h.input().props.onChange({target:{value:' north-existing '}});h.submit();
  assert.deepEqual(JSON.parse(h.requests[1].options.body),{operatorId:'nordic-bet',username:'north-existing',status:'active',roleId:'partner-viewer'});
  await h.reply(1,{operator:directory.operators[0]});assert.equal(h.input().props.value,'');
});
test('role updates retain the server membership revision and are never applied optimistically', async()=>{
  const h=directoryHarness();h.select('Nordic Bet');
  h.nodes(node=>node.type==='select'&&node.props['aria-label']==='Roll för north-admin')[0].props.onChange({target:{value:'partner-editor'}});
  h.nodes(node=>node.type==='button'&&node.props.children==='Spara roll')[0].props.onClick();
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{operatorId:'nordic-bet',userId:'42',roleId:'partner-editor',status:'active',expectedRevision:2});
  await h.reply(0,{},409);assert.match(h.html(),/Spara roll/);assert.match(h.html(),/sista administratören/);
});


test('membership suspension asks about the concrete person/company before sending the saved revision',()=>{
  let accepted=false;const prompts=[];
  const h=directoryHarness({window:{confirm:message=>{prompts.push(message);return accepted;}}});h.select('Nordic Bet');
  h.nodes(node=>node.type==='button'&&node.props.children==='Stäng av')[0].props.onClick();
  assert.equal(h.requests.length,0);assert.match(prompts[0],/north-admin hos Nordic Bet/);
  accepted=true;h.nodes(node=>node.type==='button'&&node.props.children==='Stäng av')[0].props.onClick();
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{operatorId:'nordic-bet',userId:'42',roleId:'partner-admin',status:'suspended',expectedRevision:2});
});

test('archived companies show their team in read mode while suspended members keep a separate label',()=>{
  const h=directoryHarness({selectedOperatorId:'nordic-bet',lifecycleStatuses:{'nordic-bet':'suspended'},lifecycleArchives:{'nordic-bet':'2026-10-12T00:00:00Z'}});
  const html=h.html();assert.match(html,/Bolaget är arkiverat/);assert.match(html,/avstängd/);
  assert.equal(h.input().props.disabled,true);h.input().props.onChange({target:{value:'person@example.test'}});h.submit();assert.equal(h.requests.length,0);
  h.nodes(node=>node.type==='button'&&node.props.children==='Stäng av')[0].props.onClick();assert.equal(h.requests.length,0);
});

test('foreign mutation receipts cannot replace another company or erase the pending invitation',async()=>{
  const busy=[];const h=directoryHarness({onBusyChange:value=>busy.push(value)});h.select('Nordic Bet');
  h.input().props.onChange({target:{value:'person@example.test'}});h.submit();assert.equal(busy.at(-1),true);
  await h.reply(0,{operator:directory.operators[1]});assert.match(h.html(),/kunde inte bekräftas/);
  assert.equal(h.input().props.value,'person@example.test');assert.equal(busy.at(-1),false);
});
