import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {createStudioDocumentApi} from '../apps/studio/lib/studio-document-api.mjs';
import {createSeedProject, validateProject} from '../packages/presentation/contracts/studio-model.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';

// No product server, provider, saved login or real database is used. The browser
// mounts the component used by /admin/events and calls the real document API.
// Only authentication, media verification and the SQL pool are synthetic here;
// this is draft acceptance, not production authorization or media acceptance.
const origin = 'https://admin-drafts.example.invalid';
const eventId = 'deal.player.left';
const scope = {environment: 'test', workspaceId: 'admin-drafts-fixture'};
const pagePath = '/admin/events?dealer=vera&operator=fixture-company&table=fixture-room&composition=fixture-composition&game=blackjack&event=' + eventId + '&tab=event';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../apps/studio/package.json', import.meta.url));
const {build} = require('esbuild');
const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
let bundlePromise;

function browserBundle() {
  return bundlePromise ??= build({
    stdin: {contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {ControlEventsPage} from './apps/studio/components/control-events-page.tsx';
      async function mount() {
        const response = await fetch('/studio/api/project');
        if (!response.ok) throw Error('Fixture project could not be read');
        const {project} = await response.json();
        const query = new URLSearchParams(location.search);
        createRoot(document.getElementById('root')).render(<ControlEventsPage
          initialProject={project} initialVideos={{videos: []}}
          initialStatus={{configured: true}} initialDealerId={query.get('dealer')}
          initialEventId={query.get('event')} initialTab={query.get('tab')}
        />);
      }
      mount().catch(error => {document.getElementById('root').textContent = error.message; throw error;});
    `, resolveDir: root, loader: 'tsx'},
    bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
    external: ['/composition-runtime/compositor.js'],
    outfile: resolve(root, 'fixture.js'), nodePaths: [resolve(root, 'apps/studio/node_modules')],
    alias: {'react': resolve(root, 'apps/studio/node_modules/react'), 'react-dom': resolve(root, 'apps/studio/node_modules/react-dom'),
      'next/link': resolve(root, 'apps/studio/client/runtime/navigation.tsx'),
      'next/navigation': resolve(root, 'apps/studio/client/runtime/navigation.tsx'),
      'next/image': resolve(root, 'apps/studio/client/runtime/image.ts')},
    define: {'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_LAB_BASE_PATH': '"/studio"', 'process.env.NEXT_PUBLIC_ADMIN_WORKSPACE': '"1"'},
    logLevel: 'silent',
  });
}

async function fixture(requestOrigin = origin) {
  const pool = createStudioMemoryPool();
  const repository = createStudioRepository({pool, scope});
  const initial = await repository.initializeDocument('project', {value: createSeedProject(), actor: 'fixture-seed'});
  const api = createStudioDocumentApi({repository,
    config: {scope, apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
      allowedOrigins: [requestOrigin, 'https://studio-drafts.example.invalid'],
      publicHosts: [new URL(requestOrigin).host, 'studio-drafts.example.invalid']},
    authorize: async () => ({user: 'FixtureAdmin', role: 'admin', scope}),
    validateProjectBindings: async project => validateProject(project),
    mutationTransaction: async work => work(),
  });
  return {pool, repository, api, initial: initial.value};
}

function apiRequest(project, expectedRevision = project?.revision) {
  return new Request(origin + '/studio/api/project', project ? {
    method: 'PUT', headers: {origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json'},
    body: JSON.stringify({project, expectedRevision}),
  } : undefined);
}

test('Admin draft fixture bundles the existing editor and reads/writes through native document CAS', async () => {
  const bundle = await browserBundle();
  assert.ok(bundle.outputFiles.some(file => file.path.endsWith('.js') && file.contents.length));
  const {api, repository, initial, pool} = await fixture();
  const read = await api.handle(apiRequest());
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual((await read.json()).project, initial);
  const draft = structuredClone(initial);
  draft.events.find(row => row.id === eventId).label = 'Isolated fixture draft';
  const response = await api.handle(apiRequest(draft));
  assert.equal(response.status, 200);
  const saved = (await response.json()).project;
  assert.notEqual(saved.revision, initial.revision);
  assert.equal((await api.handle(apiRequest(draft))).status, 409);
  assert.deepEqual((await repository.readDocument('project')).value, saved);
  assert.equal(pool.snapshot().history.length, 1);
  assert.equal(pool.snapshot().audits.at(-1).actor, 'FixtureAdmin');
});

// NOT RUN anywhere: the page opens dealer=vera, but the seed project now holds only Astrid, and with
// Astrid the page also calls /studio/api/social. Rewrite with a neutral seeded dealer after the clean
// slate before removing this skip; CI's browser job runs every file that reads the fixture.
const browserOptions = {timeout: 90_000,
  skip: 'NOT RUN: the fixture dealer vera left the seed project; rewrite with a neutral seeded dealer'};

async function browserFixture(t) {
  const {chromium} = await import(pathToFileURL(browserModule).href);
  const channel = process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL;
  const browser = await chromium.launch({headless: true, ...(channel ? {channel} : {}),
    args: ['--disable-background-networking', '--disable-component-update', '--disable-domain-reliability']});
  let server;
  const releaseReads = [];
  t.after(async () => {
    releaseReads.forEach(release => release());
    await browser.close();
    if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, serviceWorkers: 'block'});
  context.setDefaultTimeout(10_000);
  const bundle = await browserBundle();
  const javascript = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
  const errors = [], unexpectedRequests = [], writes = [], traffic = [], consoleErrors = [];
  let nextRead, data, localOrigin;
  async function respond(request) {
    const url = new URL(request.url);
    if (url.pathname === '/studio/api/project') {
      const submitted = request.method === 'PUT' ? await request.clone().json() : null;
      const response = await data.api.handle(request);
      if (submitted) writes.push({status: response.status, body: submitted,
        origin: request.headers.get('origin'), site: request.headers.get('sec-fetch-site')});
      if (request.method === 'GET' && nextRead) {
        const held = nextRead; nextRead = null; held.arrived(); await held.wait;
      }
      return response;
    }
    if (request.method === 'GET' && url.pathname === '/admin/events') return new Response(
      '<!doctype html><html lang="sv"><meta charset="utf-8"><title>Isolated Admin draft fixture</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>', {headers: {'content-type': 'text/html; charset=utf-8'}});
    if (request.method === 'GET' && url.pathname === '/fixture.js') return new Response(javascript, {headers: {'content-type': 'application/javascript'}});
    if (request.method === 'GET' && url.pathname === '/fixture.css') return new Response(css, {headers: {'content-type': 'text/css'}});
    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});
    unexpectedRequests.push(request.url); return new Response(null, {status: 404});
  }
  // Real HTTP retains browser-added Fetch Metadata headers, which are absent
  // from Playwright's pre-network interception. The native guard stays intact.
  server = createServer(async (incoming, outgoing) => {
    try {
      const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request(localOrigin + incoming.url, {method: incoming.method, headers: incoming.headers,
        ...(body.length ? {body} : {})});
      const response = await respond(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (cause) { errors.push(cause.message); outgoing.writeHead(500); outgoing.end(); }
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  localOrigin = 'http://127.0.0.1:' + server.address().port;
  data = await fixture(localOrigin);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    traffic.push(request.method() + ' ' + request.url());
    if (url.origin === localOrigin) return route.continue();
    unexpectedRequests.push(request.url()); return route.abort('blockedbyclient');
  });
  async function page() {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') consoleErrors.push(message.text());});
    await page.goto(localOrigin + pagePath);
    try { await page.getByLabel('Eventets visningsnamn', {exact: true}).waitFor(); }
    catch (cause) { throw new Error('Fixture editor did not mount: ' + JSON.stringify({text: (await page.locator('body').innerText()).slice(0, 2000), traffic, errors, consoleErrors}), {cause}); }
    return page;
  }
  function holdRead() {
    let arrived, release;
    const received = new Promise(resolve => {arrived = resolve;});
    const wait = new Promise(resolve => {release = resolve;});
    nextRead = {arrived, wait};
    releaseReads.push(release);
    return {received, release};
  }
  t.after(() => {
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    assert.deepEqual(unexpectedRequests, [], 'all traffic stayed inside the explicit fixture');
    assert.ok(writes.every(write => write.origin === localOrigin && write.site === 'same-origin'), 'real HTTP delivered same-origin Origin and Sec-Fetch-Site for every PUT');
  });
  return {...data, page, writes, holdRead};
}

const eventName = page => page.getByLabel('Eventets visningsnamn', {exact: true});
const saveButton = page => page.getByRole('button', {name: 'Spara projekt', exact: true});
async function save(page, expectedStatus = 200) {
  const endpoint = new URL('/studio/api/project', page.url()).href;
  const response = page.waitForResponse(response => response.url() === endpoint && response.request().method() === 'PUT');
  await saveButton(page).click();
  const result = await response;
  assert.equal(result.status(), expectedStatus);
  await saveButton(page).waitFor();
  if (expectedStatus === 200) await page.getByText('Projektet är sparat.', {exact: true}).waitFor();
  else await page.getByText('Projektet har ändrats i en annan vy.', {exact: true}).waitFor();
}

test('Admin saves/reloads, retains a rejected draft, resolves an explicit conflict and protects a real unsaved edit', browserOptions, async t => {
  const f = await browserFixture(t), first = await f.page();
  assert.equal(await saveButton(first).isDisabled(), true);
  await eventName(first).fill('C5 sparat utkast'); await save(first);
  const persisted = (await f.repository.readDocument('project')).value;
  assert.notEqual(persisted.revision, f.initial.revision);
  const expected = structuredClone(f.initial);
  expected.revision = persisted.revision; expected.events.find(row => row.id === eventId).label = 'C5 sparat utkast';
  assert.deepEqual(persisted, expected, 'saving the label preserves every other project field');
  await first.reload(); await eventName(first).waitFor();
  assert.equal(await eventName(first).inputValue(), 'C5 sparat utkast');

  const second = await f.page();
  await eventName(first).fill('C5 mitt konfliktutkast');
  await eventName(second).fill('C5 annan redaktör'); await save(second);
  const remote = (await f.repository.readDocument('project')).value;
  await save(first, 409);
  assert.equal(await eventName(first).inputValue(), 'C5 mitt konfliktutkast');
  assert.deepEqual((await f.repository.readDocument('project')).value, remote);
  assert.equal(f.pool.snapshot().history.length, 2, 'rejected write creates no history');
  await first.getByRole('button', {name: 'Hämta senaste · behåll mitt utkast', exact: true}).click();
  await first.getByText('Val som krockar: events', {exact: true}).waitFor();
  await first.getByRole('button', {name: 'Behåll mina val där det krockar', exact: true}).click();
  assert.deepEqual((await f.repository.readDocument('project')).value, remote, 'resolving is still only a draft');
  await save(first);
  const resolved = (await f.repository.readDocument('project')).value;
  assert.equal(resolved.events.find(row => row.id === eventId).label, 'C5 mitt konfliktutkast');
  assert.equal(f.writes.at(-1).body.expectedRevision, remote.revision);
  await first.reload(); await eventName(first).waitFor();
  assert.equal(await eventName(first).inputValue(), 'C5 mitt konfliktutkast');

  await eventName(first).fill('C5 verkligt osparat');
  const dialogPromise = first.waitForEvent('dialog');
  const reload = first.reload().catch(error => error);
  const dialog = await dialogPromise;
  assert.equal(dialog.type(), 'beforeunload'); await dialog.dismiss();
  await reload;
  assert.equal(await eventName(first).inputValue(), 'C5 verkligt osparat');
  assert.deepEqual((await f.repository.readDocument('project')).value, resolved);
  await eventName(first).fill('C5 mitt konfliktutkast');
  assert.equal(await saveButton(first).isDisabled(), true, 'reverting the actual edit clears dirty state');
  const unexpectedDialogs = [];
  first.on('dialog', async dialog => {unexpectedDialogs.push(dialog.type()); await dialog.dismiss();});
  await first.reload(); await eventName(first).waitFor();
  assert.deepEqual(unexpectedDialogs, [], 'a clean form reloads without a draft warning');
});

test('edits made while a conflict revision is loading survive the merge and the next save', browserOptions, async t => {
  const f = await browserFixture(t), first = await f.page(), second = await f.page();
  await eventName(first).fill('C5 utkast före hämtning');
  await second.getByRole('tab', {name: /^Varianter/}).click();
  await second.getByLabel('Variantens namn', {exact: true}).fill('C5 annat fält'); await save(second);
  const remote = (await f.repository.readDocument('project')).value;
  await save(first, 409);
  const held = f.holdRead();
  await first.getByRole('button', {name: 'Hämta senaste · behåll mitt utkast', exact: true}).click();
  await held.received;
  await eventName(first).fill('C5 nyare utkast under hämtning');
  held.release();
  await first.getByText('Utkastet är sammanslaget. Granska dina val och spara.', {exact: true}).waitFor();
  assert.equal(await eventName(first).inputValue(), 'C5 nyare utkast under hämtning');
  assert.deepEqual((await f.repository.readDocument('project')).value, remote, 'merging never saves implicitly');
  await save(first);
  const saved = (await f.repository.readDocument('project')).value;
  assert.equal(saved.events.find(row => row.id === eventId).label, 'C5 nyare utkast under hämtning');
  assert.deepEqual(saved.lines, remote.lines, 'unrelated remote variant edits survive');
  assert.equal(f.writes.at(-1).body.expectedRevision, remote.revision);
});
