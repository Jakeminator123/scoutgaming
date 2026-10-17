import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createPublicationChain, company, otherCompany, compositionId} from './fixtures/admin-publication-chain.mjs';
import {createPresentationRoomClient, createPresentationRoomController} from '../lab/lib/presentation-room-client.mjs';
import {readPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {loadLobbyCatalog, lobbySelection, playUrlFor} from '../lab/client/runtime/public-lobby-catalog.mjs';
import {gameLaneFromDocument} from '../packages/presentation/contracts/game-selection.mjs';
import {resolvePlayerSelection} from '../packages/presentation/runtime/player-choices.mjs';

// One package crosses actual N1/N2/public/game selectors. Only storage, account
// rows, provider metadata and runtime capabilities are synthetic. This does not
// start a game engine, prove player login, play media or certify production SQL.
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../lab/package.json', import.meta.url));
const {build} = require('esbuild');
const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const roomEndpoint = '/studio/api/admin/presentation-room';
const partnerPath = slug => '/studio/api/partner/snapshot?operator=' + slug;
let bundlePromise;

function browserBundle() {
  return bundlePromise ??= build({stdin: {contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {PresentationRoomCreate} from './lab/components/presentation-room-create.tsx';
    import {PartnerOperatorWorkspace} from './lab/components/kevin-bo/partner-operator-workspace.jsx';
    import {LobbyProvider} from './lab/client/lobby/components/lobby-provider.tsx';
    import {OperatorsSection} from './lab/client/lobby/components/sections/operators-section.tsx';
    import {RoomsSection} from './lab/client/lobby/components/sections/rooms-section.tsx';
    import {DealersSection} from './lab/client/lobby/components/sections/dealers-section.tsx';
    import {SelectionTicket} from './lab/client/lobby/components/selection-ticket.tsx';
    const props = JSON.parse(document.getElementById('fixture-data').textContent);
    createRoot(document.getElementById('root')).render(props.surface === 'partner'
      ? <PartnerOperatorWorkspace {...props}/> : location.pathname === '/lobby'
      ? <LobbyProvider><OperatorsSection/><RoomsSection/><DealersSection/><SelectionTicket/></LobbyProvider>
      : <PresentationRoomCreate {...props}/>);
  `, resolveDir: root, loader: 'tsx'}, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
  outfile: resolve(root, 'fixture.js'), external: ['/composition-runtime/compositor.js'],
  // Match Next's static-image import shape without reading or serving media.
  plugins: [{name: 'fixture-image-metadata', setup(plugin) {
    plugin.onLoad({filter: /\.(?:png|jpg)$/}, () => ({contents: 'export default {src:"/fixture-image"}', loader: 'js'}));
  }}],
  nodePaths: [resolve(root, 'lab/node_modules'), resolve(root, 'lab/client/node_modules')],
  alias: {'@/lib/catalog.mjs': resolve(root, 'lab/client/runtime/public-lobby-catalog.mjs'),
    '@': resolve(root, 'lab/client/lobby'),
    'react': resolve(root, 'lab/node_modules/react'), 'react-dom': resolve(root, 'lab/node_modules/react-dom'),
    'next/link': resolve(root, 'lab/client/runtime/navigation.tsx'),
    'next/navigation': resolve(root, 'lab/client/runtime/navigation.tsx'),
    'next/image': resolve(root, 'lab/client/runtime/image.ts')},
  define: {'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_LAB_BASE_PATH': '"/studio"',
    'process.env.NEXT_PUBLIC_ADMIN_WORKSPACE': '"1"'}, logLevel: 'silent'});
}

async function publishWithExistingController(f, {operator = company, name = 'C6 publicerat rum'} = {}) {
  const previousBase = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  process.env.NEXT_PUBLIC_LAB_BASE_PATH = '/studio';
  const client = createPresentationRoomClient({fetchImpl: async (path, options) => f.handle(new Request(
    new URL(path, f.origin), {...options, headers: {...options?.headers, cookie: f.auth.admin,
      ...(options?.method === 'POST' ? {origin: f.origin, 'sec-fetch-site': 'same-origin'} : {})}}))});
  const controller = createPresentationRoomController({client});
  try {
    await controller.configure({...f.props, operator});
    assert.equal(controller.getSnapshot().preflight?.ready, true, JSON.stringify(controller.getSnapshot()));
    controller.setName(name);
    await controller.create(controller.getSnapshot().key);
    assert.equal(controller.getSnapshot().status, 'success', JSON.stringify(controller.getSnapshot()));
    return controller.getSnapshot().receipt;
  } finally {
    controller.cancel();
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = previousBase;
  }
}

function decodeEntry(html) {
  const dataset = {};
  for (const [, attribute, value] of html.matchAll(/data-(game-[a-z-]+)="([^"]*)"/g))
    dataset[attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value.replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  return gameLaneFromDocument(dataset);
}

async function assertPublishedChain(f, receipt) {
  assert.equal(receipt.packageRevision, 1);
  assert.notEqual(receipt.room.id, compositionId);
  assert.equal(receipt.room.operatorId, company.id);
  assert.equal(receipt.room.presentationLaneId, compositionId);
  const pack = await f.store.getCurrentPackage(company.id), frozen = readPackagePresentation(pack);
  assert.equal(pack.revision, receipt.packageRevision);
  assert.deepEqual(pack.tables, [receipt.room.id]);
  assert.equal(frozen.projectRevision, f.props.projectRevision);
  assert.equal(f.operators.tables.operator_packages.length, 1, 'only the N1 publication created a package');

  const response = await f.request(partnerPath(company.slug), {cookie: f.auth.north});
  assert.equal(response.status, 200);
  const partner = await response.json();
  assert.equal(partner.accessClass, 'partner');
  assert.equal(partner.packageRevision, String(receipt.packageRevision));
  assert.deepEqual(partner.presentation, frozen, 'N2 receives the exact newly frozen package');
  assert.deepEqual(partner.tables, [{id: receipt.room.id, name: receipt.room.name, operatorId: company.id,
    game: 'blackjack', status: 'active', presentationId: compositionId}]);

  const publicRooms = await f.publicRooms.read(company.slug);
  assert.equal(publicRooms.packageRevision, receipt.packageRevision);
  assert.equal(publicRooms.rooms[0].id, receipt.room.id);
  assert.equal(publicRooms.rooms[0].presentation.id, compositionId);

  // A foreign company with its own usable package must still be unable to
  // launch North's room; otherwise a missing package could mask the room guard.
  const southReceipt = await publishWithExistingController(f, {operator: otherCompany, name: 'C6 South rum'});
  const southPack = await f.store.getCurrentPackage(otherCompany.id);
  assert.equal(southReceipt.room.operatorId, otherCompany.id);
  assert.notEqual(southReceipt.room.id, receipt.room.id);
  assert.notEqual(southReceipt.room.id, compositionId);
  assert.equal(southPack.revision, southReceipt.packageRevision);
  assert.deepEqual(southPack.tables, [southReceipt.room.id]);
  assert.equal(f.operators.tables.operator_packages.length, 2, 'each N1 publication created its own company package');
  assert.deepEqual(await f.store.getCurrentPackage(company.id), pack, 'South publication does not republish North');
  const catalog = await loadLobbyCatalog({fetchImpl: path => f.request(path, {cookie: ''})});
  assert.deepEqual(catalog.operators.map(row => row.id), [company.slug, otherCompany.slug]);
  const selected = lobbySelection(catalog, {operatorId: company.slug,
    roomKey: `${company.slug}:${receipt.room.id}`, dealerId: 'astrid'});
  assert.equal(selected.room.id, receipt.room.id);
  const href = playUrlFor(selected);
  const launch = await f.request(href, {cookie: ''});
  assert.equal(launch.status, 200);
  const entry = decodeEntry(await launch.text());
  assert.equal(entry.operator, company.slug);
  assert.equal(entry.packageRevision, receipt.packageRevision);
  assert.equal(entry.roomId, receipt.room.id);
  assert.equal(entry.dealer, 'astrid');
  assert.equal(entry.lane, receipt.room.gameLaneId);

  const southSelection = lobbySelection(catalog, {operatorId: otherCompany.slug,
    roomKey: `${otherCompany.slug}:${southReceipt.room.id}`, dealerId: 'astrid'});
  const southLaunch = await f.request(playUrlFor(southSelection), {cookie: ''});
  assert.equal(southLaunch.status, 200, 'South can launch its own published room before the cross-company denial');
  const southEntry = decodeEntry(await southLaunch.text());
  assert.equal(southEntry.operator, otherCompany.slug);
  assert.equal(southEntry.roomId, southReceipt.room.id);
  assert.equal(southEntry.packageRevision, southReceipt.packageRevision);
  assert.equal(southEntry.dealer, 'astrid');

  const before = structuredClone(f.operators.tables.operator_packages), administration = await f.repository.readDocument('administration');
  assert.equal((await f.request(partnerPath(company.slug), {cookie: f.auth.south})).status, 403, 'foreign membership cannot read N2');
  const south = await f.request(partnerPath(otherCompany.slug), {cookie: f.auth.south});
  assert.equal(south.status, 200);
  const southPartner = await south.json();
  assert.equal(southPartner.packageRevision, String(southReceipt.packageRevision));
  assert.deepEqual(southPartner.tables, [{id: southReceipt.room.id, name: southReceipt.room.name, operatorId: otherCompany.id,
    game: 'blackjack', status: 'active', presentationId: compositionId}]);
  const wrongCompany = new URL(href, f.origin); wrongCompany.searchParams.set('operator', otherCompany.slug);
  assert.equal((await f.request(wrongCompany.pathname + wrongCompany.search)).status, 404, 'foreign company cannot launch this room');
  const wrongRoom = new URL(href, f.origin); wrongRoom.searchParams.set('table', compositionId);
  assert.equal((await f.request(wrongRoom.pathname + wrongRoom.search)).status, 404, 'a composition ID is not a room');
  const body = f.publications.find(row => row.status === 200).body;
  assert.equal((await f.request(roomEndpoint, {cookie: f.auth.north, body})).status, 401, 'N2 session cannot publish through N1');
  const role = f.operators.tables.operator_roles.find(row => row.operator_id === company.id && row.role_id === 'partner-admin');
  const permissions = role.permissions; role.permissions = '[]';
  try {assert.equal((await f.request(partnerPath(company.slug), {cookie: f.auth.north})).status, 403, 'fresh role without overview permission is denied');}
  finally {role.permissions = permissions;}
  assert.deepEqual(f.operators.tables.operator_packages, before, 'denied requests never republish');
  assert.deepEqual(await f.store.getCurrentPackage(company.id), pack, 'North retains the exact revision followed through the chain');
  assert.deepEqual(await f.repository.readDocument('administration'), administration, 'denied requests never change room ownership');
  return {href, partner, pack};
}

test('C6 existing publication controller and APIs carry one new frozen revision through N2, lobby and game entry', async () => {
  const bundle = await browserBundle();
  assert.ok(bundle.outputFiles.some(file => file.path.endsWith('.js') && file.contents.length), 'real browser components remain importable in CI');
  const f = await createPublicationChain();
  const receipt = await publishWithExistingController(f);
  await assertPublishedChain(f, receipt);
});

test('C5/C6 actual N1 form, N2 room draft and reviewed publication reach the public lobby and game entry',
  {skip: browserModule ? false : 'Set CROUPIER_BROWSER_FIXTURE_MODULE to run the isolated C6 browser chain', timeout: 60_000}, async t => {
    const {chromium} = await import(pathToFileURL(browserModule).href);
    const channel = process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL;
    const browser = await chromium.launch({headless: true, ...(channel ? {channel} : {}),
      args: ['--disable-background-networking', '--disable-component-update', '--disable-domain-reliability']});
    let server, f, origin;
    t.after(async () => {await browser.close(); if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));});
    const errors = [], escaped = [], bundle = await browserBundle();
    const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
    const css = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
    server = createServer(async (incoming, outgoing) => {
      try {
        const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
        const body = Buffer.concat(chunks), request = new Request(origin + incoming.url,
          {method: incoming.method, headers: incoming.headers, ...(body.length ? {body} : {})});
        const path = new URL(request.url).pathname;
        let response;
        if (['/admin/publication', '/lobby'].includes(path) || /^\/(?:studio\/)?partner\//.test(path)) {
          const props = path.includes('/partner/') ? await f.partnerPageProps(request) : f.props;
          response = new Response(
          '<!doctype html><html lang="sv"><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div>'
          + '<script id="fixture-data" type="application/json">' + JSON.stringify(props).replaceAll('<', '\\u003c') + '</script>'
          + '<script type="module" src="/fixture.js"></script></html>', {headers: {'content-type': 'text/html; charset=utf-8'}});
        } else if (path === '/fixture.js') response = new Response(js, {headers: {'content-type': 'application/javascript'}});
        else if (path === '/fixture.css') response = new Response(css, {headers: {'content-type': 'text/css'}});
        // The flow does not load or accept media; decorative local image requests
        // are blank in this fixture. No media provider is reachable.
        else if (path.startsWith('/admin/_assets/lobby/') || path === '/fixture-image' || path === '/favicon.ico') response = new Response(null, {status: 204});
        else response = await f.handle(request);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        if ([401, 403, 404].includes(error.statusCode)) {outgoing.writeHead(error.statusCode); outgoing.end('Workspace unavailable');}
        else {errors.push(error.message); outgoing.writeHead(500); outgoing.end();}
      }
    });
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
    origin = 'http://127.0.0.1:' + server.address().port; f = await createPublicationChain(origin, {roomAppearance: true});
    const context = await browser.newContext({viewport: {width: 1280, height: 900}, serviceWorkers: 'block'});
    context.setDefaultTimeout(10_000);
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      escaped.push(route.request().url()); return route.abort('blockedbyclient');
    });
    const useCookie = async value => {
      await context.clearCookies(); const split = value.indexOf('=');
      await context.addCookies([{name: value.slice(0, split), value: value.slice(split + 1), url: origin}]);
    };
    await useCookie(f.auth.admin);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith('/studio/api/') && response.status() >= 400) errors.push('Unexpected API response ' + response.status() + ' ' + path);
    });
    await page.goto(origin + '/admin/publication');
    await page.getByLabel('Rumsnamn', {exact: true}).fill('C6 publicerat rum');
    const created = page.waitForResponse(response => response.url() === origin + roomEndpoint && response.request().method() === 'POST');
    await page.getByRole('button', {name: 'Skapa spelrum', exact: true}).click();
    const published = await created; assert.equal(published.status(), 200);
    const receipt = await published.json(), chain = await assertPublishedChain(f, receipt);
    await useCookie(f.auth.north);
    const partner = await page.evaluate(async path => {const response = await fetch(path); return {status: response.status, body: await response.json()};}, partnerPath(company.slug));
    assert.equal(partner.status, 200); assert.deepEqual(partner.body.presentation, chain.partner.presentation);
    assert.equal(partner.body.packageRevision, String(receipt.packageRevision));
    // Unlike an API-only receipt, this mounts the complete N2 workspace from
    // authenticated production page data and follows its actual navigation.
    const overview = '/partner/' + company.slug, rooms = overview + '/rooms';
    const roomQuery = '?room=' + receipt.room.id;
    const beforePartner = structuredClone(f.operators.tables.operator_packages);
    const beforeAdministration = await f.repository.readDocument('administration');
    assert.equal((await page.goto(origin + overview + roomQuery)).status(), 200);
    const workspace = page.locator('[data-surface="partner"]');
    await workspace.getByRole('heading', {name: 'Översikt', exact: true}).waitFor();
    assert.equal(await workspace.locator('.kevin-package-revision').first().textContent(), 'Paketversion ' + receipt.packageRevision);
    assert.equal(await workspace.locator('.side-role').textContent(), 'Operatörspersonal');
    const staffLinks = () => workspace.locator('a[href="/admin"], a[href^="/lobby"]');
    assert.equal(await staffLinks().count(), 0, 'ordinary N2 never receives staff portal links');
    const nav = workspace.getByRole('navigation');
    const brandingRead = page.waitForResponse(response => new URL(response.url()).pathname === '/studio/api/partner/branding');
    await nav.getByRole('link', {name: 'Spelrum', exact: true}).click();
    const brandingResponse = await brandingRead;
    assert.equal(brandingResponse.status(), 200);
    const branding = await brandingResponse.json();
    assert.equal(branding.operatorId, company.id); assert.equal(branding.packageRevision, receipt.packageRevision);
    assert.equal(branding.canConfigure, true); assert.deepEqual(branding.presentation, chain.partner.presentation);
    assert.ok(branding.rooms.some(room => room.id === receipt.room.id));
    await page.waitForURL(origin + rooms + roomQuery);
    const assertRoom = async (packageRevision = receipt.packageRevision) => {
      const picker = workspace.getByRole('combobox', {name: 'Spelrum', exact: true});
      await picker.waitFor(); assert.equal(await picker.inputValue(), receipt.room.id);
      const publishedRoom = workspace.getByRole('region', {name: 'Publicerad sammansättning', exact: true});
      assert.equal(await publishedRoom.getByRole('heading', {level: 2}).textContent(), receipt.room.name);
      assert.equal(await publishedRoom.locator('.kevin-package-revision').textContent(), 'Version ' + packageRevision);
      const play = publishedRoom.getByRole('link', {name: 'Provspela ' + receipt.room.name + ' ↗', exact: true});
      const url = new URL(await play.getAttribute('href'), origin);
      assert.equal(url.searchParams.get('operator'), company.slug); assert.equal(url.searchParams.get('table'), receipt.room.id);
      const appearance = workspace.getByRole('region', {name: 'Utkast och publicering', exact: true});
      await appearance.waitFor();
      assert.equal(await appearance.getByRole('combobox', {name: 'Sammansättning', exact: true}).inputValue(), compositionId);
      assert.equal(await staffLinks().count(), 0);
    };
    await assertRoom();
    await page.reload(); await assertRoom();
    await nav.getByRole('link', {name: 'Översikt', exact: true}).click();
    await page.waitForURL(origin + overview + roomQuery);
    await workspace.getByRole('heading', {name: 'Översikt', exact: true}).waitFor();
    await page.goBack(); await page.waitForURL(origin + rooms + roomQuery); await assertRoom();
    await page.goForward(); await page.waitForURL(origin + overview + roomQuery);
    await workspace.getByRole('heading', {name: 'Översikt', exact: true}).waitFor();
    await nav.getByRole('link', {name: 'Spelrum', exact: true}).click(); await assertRoom();
    await workspace.getByRole('combobox', {name: 'Spelrum', exact: true}).selectOption('');
    await page.waitForURL(origin + rooms + '?scope=company');
    await page.reload();
    assert.equal(await workspace.getByRole('combobox', {name: 'Spelrum', exact: true}).inputValue(), '');
    await page.goBack(); await page.waitForURL(origin + rooms + roomQuery); await assertRoom();
    await page.goForward(); await page.waitForURL(origin + rooms + '?scope=company');
    assert.equal(await workspace.getByRole('combobox', {name: 'Spelrum', exact: true}).inputValue(), '');
    assert.equal((await page.goto(origin + '/partner/' + otherCompany.slug + '/rooms' + roomQuery)).status(), 403);
    assert.equal(await page.locator('[data-surface="partner"]').count(), 0, 'foreign page never renders a workspace');
    // The same real loader distinguishes N1 from membership-bound N2; the
    // positive control ensures absence above is not just a missing header.
    await useCookie(f.auth.admin);
    assert.equal((await page.goto(origin + '/studio' + rooms + roomQuery)).status(), 200);
    await workspace.getByRole('link', {name: 'Admin ↗', exact: true}).waitFor();
    assert.equal(await workspace.getByRole('link', {name: 'Spelarlobby ↗', exact: true}).getAttribute('href'), '/lobby?operator=' + company.slug + '&room=' + receipt.room.id);
    assert.deepEqual(f.operators.tables.operator_packages, beforePartner, 'workspace visits never republish');
    assert.deepEqual(await f.repository.readDocument('administration'), beforeAdministration, 'workspace visits never change room ownership');
    // Write through the real N2 workspace and HTTP handler. The selected room
    // owns the override; the frozen composition and company defaults stay intact.
    await useCookie(f.auth.north);
    await page.goto(origin + rooms + roomQuery); await assertRoom();
    const appearance = workspace.getByRole('region', {name: 'Utkast och publicering', exact: true});
    const color = '#445566', endpoint = origin + '/studio/api/partner/branding?operator=' + company.slug;
    const expectedBranding = {...branding.branding, roomOverrides: {[receipt.room.id]: {color}}};
    const southBefore = await f.store.getCurrentPackage(otherCompany.id);
    const oldEntry = decodeEntry(await (await f.request(chain.href, {cookie: ''})).text());
    assert.notEqual(oldEntry.branding.color, color);
    assert.equal(branding.draft, null);
    assert.equal(branding.draftRevision, 0);
    assert.ok(branding.presentation.lanes.find(lane => lane.id === compositionId).layers.table.colors.includes(color));
    const publishButton = appearance.getByRole('button', {name: 'Publicera granskat utkast', exact: true});
    assert.equal(await publishButton.isDisabled(), true);
    await appearance.getByRole('combobox', {name: 'Bordsfärg', exact: true}).selectOption(color);
    await appearance.getByText('Du har osparade ändringar.', {exact: true}).waitFor();
    assert.equal(await publishButton.isDisabled(), true, 'unsaved changes cannot be published');
    const command = async (name, action) => {
      const pending = page.waitForResponse(response => response.url() === endpoint
        && response.request().method() === 'POST' && response.request().postDataJSON().action === action);
      await appearance.getByRole('button', {name, exact: true}).click();
      const response = await pending; assert.equal(response.status(), 200, await response.text());
      return response.json();
    };
    const draft = await command('Spara utkast', 'save-draft');
    await appearance.getByText('Utkastet är sparat. Publicerad version är oförändrad.', {exact: true}).waitFor();
    assert.equal(draft.packageRevision, receipt.packageRevision);
    assert.equal(draft.draftRevision, 1);
    assert.equal(draft.draft.basePackageRevision, receipt.packageRevision);
    assert.deepEqual(draft.draft.branding, expectedBranding);
    assert.deepEqual(draft.branding, branding.branding);
    assert.deepEqual(f.operators.tables.operator_packages, beforePartner, 'saving a draft never publishes');
    assert.deepEqual(decodeEntry(await (await f.request(chain.href, {cookie: ''})).text()), oldEntry,
      'the public game entry keeps the published choices while a draft exists');
    const reloaded = page.waitForResponse(response => response.url() === endpoint && response.request().method() === 'GET');
    await page.reload(); await assertRoom();
    assert.deepEqual((await (await reloaded).json()).draft, draft.draft);
    assert.equal(await appearance.getByRole('combobox', {name: 'Bordsfärg', exact: true}).inputValue(), color);
    assert.equal(await appearance.getByRole('button', {name: 'Spara utkast', exact: true}).isDisabled(), true,
      'reloaded saved changes are clean');
    assert.equal(await publishButton.isDisabled(), true, 'reload cannot manufacture a publication review');
    const reviewed = await command('Granska publicering', 'review');
    await appearance.getByText('Granskningen är klar. Kontrollera ändringar och berörda rum innan publicering.', {exact: true}).waitFor();
    assert.equal(reviewed.packageRevision, receipt.packageRevision);
    assert.equal(reviewed.draftRevision, draft.draftRevision);
    assert.deepEqual(reviewed.branding, expectedBranding);
    assert.deepEqual(reviewed.affectedRooms, [receipt.room.id]);
    assert.deepEqual(reviewed.changes, [{roomId: receipt.room.id, key: 'color', before: null, after: color}]);
    const reviewPanel = appearance.getByRole('region', {name: 'Granskning före publicering', exact: true});
    assert.match(await reviewPanel.textContent(), new RegExp(receipt.room.name));
    assert.match(await reviewPanel.textContent(), /#445566/);
    assert.deepEqual(f.operators.tables.operator_packages, beforePartner, 'review never publishes');
    const saved = await command('Publicera granskat utkast', 'publish');
    const nextRevision = receipt.packageRevision + 1;
    assert.equal(saved.packageRevision, nextRevision);
    assert.equal(saved.draft, null); assert.equal(saved.draftRevision, draft.draftRevision + 1);
    assert.deepEqual(saved.branding, expectedBranding);
    await workspace.getByRole('region', {name: 'Publicerad sammansättning', exact: true})
      .getByText('Version ' + nextRevision, {exact: true}).waitFor();
    await assertRoom(nextRevision);
    assert.equal(await publishButton.isDisabled(), true, 'successful publication cannot be repeated without a new draft');
    const current = await f.store.getCurrentPackage(company.id);
    assert.equal(current.revision, nextRevision);
    assert.deepEqual(current.tables, chain.pack.tables);
    assert.deepEqual(current.games, chain.pack.games);
    assert.deepEqual(current.lanes, chain.pack.lanes);
    assert.deepEqual(readPackagePresentation(current), readPackagePresentation(chain.pack), 'N2 never changes frozen N1 media or geometry');
    assert.deepEqual(current.branding.roomOverrides, expectedBranding.roomOverrides);
    const {roomOverrides, ...unchangedBranding} = current.branding;
    assert.deepEqual(unchangedBranding, chain.pack.branding, 'room override does not change company defaults');
    assert.deepEqual(await f.store.getCurrentPackage(otherCompany.id), southBefore);
    assert.equal(f.operators.tables.operator_packages.length, beforePartner.length + 1, 'exactly one package version was added');
    assert.deepEqual(await f.repository.readDocument('administration'), beforeAdministration, 'N2 never changes room ownership');
    assert.deepEqual(f.brandingCommands.map(row => row.body.action), ['save-draft', 'review', 'publish']);
    for (const row of f.brandingCommands) {
      assert.equal(row.status, 200); assert.equal(row.origin, origin); assert.equal(row.site, 'same-origin');
      assert.equal(row.body.expectedPackageRevision, receipt.packageRevision);
    }
    assert.equal(f.brandingCommands[2].body.reviewToken, reviewed.reviewToken);
    // A valid South room draft sent with North's cookie must fail at the same
    // real partner handler, without creating a draft or republishing South.
    const southDraftBefore = await f.store.getBrandingDraft(otherCompany.id);
    const foreignWrite = await f.request('/studio/api/partner/branding?operator=' + otherCompany.slug, {
      cookie: f.auth.north, body: {action: 'save-draft', expectedPackageRevision: southBefore.revision,
        expectedDraftRevision: southDraftBefore?.revision ?? 0,
        branding: {roomOverrides: {[southBefore.tables[0]]: {color}}}},
    });
    assert.equal(foreignWrite.status, 403, 'North cannot save South room appearance');
    assert.deepEqual(await f.store.getBrandingDraft(otherCompany.id), southDraftBefore);
    assert.deepEqual(await f.store.getCurrentPackage(otherCompany.id), southBefore);

    await page.reload(); await assertRoom(nextRevision);
    assert.equal(await appearance.getByRole('combobox', {name: 'Bordsfärg', exact: true}).inputValue(), color);
    assert.equal(await publishButton.isDisabled(), true);
    assert.equal((await f.publicRooms.read(company.slug)).packageRevision, nextRevision);
    await context.clearCookies();
    await page.goto(origin + '/lobby');
    // Keyboard activation tests the real controls without claiming visual/pointer
    // acceptance for this component fixture, which does not build Tailwind.
    const choose = async button => {
      const element = await button.elementHandle();
      await page.waitForFunction(element => !element.disabled, element);
      await button.press('Enter');
      await page.waitForFunction(element => element.getAttribute('aria-pressed') === 'true', element);
    };
    await choose(page.getByRole('list', {name: 'Spelbolag', exact: true}).getByRole('button', {name: /C6 North/}));
    await choose(page.getByRole('list', {name: 'Spelrum', exact: true}).getByRole('button', {name: /C6 publicerat rum/}));
    await choose(page.getByRole('button', {name: 'Välj Astrid', exact: true}));
    const play = page.getByRole('dialog', {name: 'Astrid', exact: true}).getByRole('link', {name: 'Spela med Astrid', exact: true});
    assert.equal(await play.getAttribute('href'), chain.href);
    await play.press('Enter');
    const dataset = await page.locator('html').evaluate(element => ({...element.dataset}));
    const entry = gameLaneFromDocument(dataset);
    assert.equal(entry.roomId, receipt.room.id); assert.equal(entry.packageRevision, nextRevision);
    assert.equal(entry.operator, company.slug); assert.equal(entry.dealer, 'astrid');
    assert.equal(entry.branding.color, color, 'validated game entry resolves the published room override');
    const playerChoice = resolvePlayerSelection({choices: entry.choices, branding: entry.branding,
      currentDealer: entry.dealer, composition: entry.composition});
    assert.equal(playerChoice.tableColor, color, 'the actual player choice resolver consumes the published selection');
    const write = f.publications.find(row => row.status === 200);
    assert.equal(write.origin, origin); assert.equal(write.site, 'same-origin', 'real HTTP preserves Fetch Metadata/CSRF protection');
    assert.deepEqual(errors, []); assert.deepEqual(escaped, []);
  });
