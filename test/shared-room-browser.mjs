// Real Chrome + built browser modules + production HTML/view/controller/HTTP/WS
// clients. Only the isolated service data and media decoding/card ports are fake.
// This proves browser wiring and lifecycle, not K04 media or database acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../apps/web/tools/player-ui-build.mjs';
import { decorateGameEntryHtml } from '../services/game/public/game-entry-contract.mjs';
import { withSharedRoomEntry } from '../services/game/shared-room-entry.mjs';
import { createSharedRoomCommand } from '../services/game/shared-room-command.mjs';
import { handleSharedRoomHttp } from '../services/game/shared-room-http.mjs';
import { createSharedRoomChat } from '../services/game/shared-room-chat.mjs';

const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const roomId = 'browser-room', actorId = 'browser-alice', cookie = 'fixture_session=isolated-browser';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Browser fixture event timed out')), 10000); })]); }
  finally { clearTimeout(timer); }
}
function initial() {
  return { contract: 'blackjack-table/1', roomId, version: 0, presentationVer: 0, configVersion: 'browser-config', windowId: 'window-a',
    phase: 'bets', roundId: null, turnSeq: 0, owners: Array(7).fill(null), seatGen: Array(7).fill(0),
    bets: Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 })), players: [], deadline: null, actionDeadline: null,
    plan: null, round: null, shoe: null, unopened: true, serverNow: Date.now(),
    settings: { configVersion: 'browser-config', language: 'sv', betMs: 20000, actionMs: 15000,
      limits: { min: 1, max: 2000, sideMax: 100 }, chips: [1, 5, 25], refill: 1000 },
    me: { id: actorId, seats: [], memberGen: 0, active: false, available: 1000, currency: 'USD', pausedUntil: 0, insuranceDue: false, lastSettlement: null } };
}
const browserFixture = `
  // Import without the automatic mount so only decoding/media ports can be
  // injected. All app/view/controller/command/WebSocket implementations are real.
  const root=document.documentElement;delete root.dataset.sharedRoom;
  const {mountSharedRoomApp}=await import('/shared-room-app.mjs');
  const {mountSharedRoomPresentation}=await import('/shared-room-presentation.mjs');
  const {createSharedRoomClient}=await import('/shared-room-client.mjs');
  const {createSharedRoomCommandClient}=await import('/shared-room-command-client.mjs');
  root.dataset.sharedRoom='1';
  const trace=[],timers=new Set(),listeners=new Map(),resources={mediaClosed:0,cardsClosed:0,playerDisposed:0};
  const nativeSet=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window);
  window.setTimeout=(fn,ms,...args)=>{const id=nativeSet(()=>{timers.delete(id);fn(...args);},ms);timers.add(id);return id;};
  window.clearTimeout=id=>{timers.delete(id);nativeClear(id);};
  const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
  window.addEventListener=(event,fn,...args)=>{if(['pagehide','resize'].includes(event)){let group=listeners.get(event);if(!group)listeners.set(event,group=new Set());group.add(fn);}return add(event,fn,...args);};
  window.removeEventListener=(event,fn,...args)=>{listeners.get(event)?.delete(fn);return remove(event,fn,...args);};
  let app,socket,commands;
  window.fixture={trace,resources,get app(){return app;},get socket(){return socket;},get commands(){return commands;},
    cleanup(){return {timers:timers.size,listeners:[...listeners.values()].reduce((n,set)=>n+set.size,0),...resources};}};
  class Player {dispose(){resources.playerDisposed++;}}
  const cards={restore(round){trace.push({kind:'cards-restore',roundId:round?.id??null});},sync(){trace.push({kind:'cards-sync'});},clear(){trace.push({kind:'cards-clear'});},
    begin(_video,source){trace.push({kind:'card-begin',draw:source.shoeDraw});return source.shoeDraw;},frame(){},finish(){},show(){},reveal(){},
    setProjection(value){window.fixture.boxes=[...value.boxes];},close(){resources.cardsClosed++;}};
  app=await mountSharedRoomApp({createCommands:options=>commands=createSharedRoomCommandClient(options),
    createSocket:options=>socket=createSharedRoomClient(options),
    createPresentation:async options=>{
      const media={state(){},prepareSequence(){},start(){options.onReady(options.selection.dealer);},
        async present(event,{signal,onSelected,onFrame}){signal.throwIfAborted();trace.push({kind:'media-present',type:event.type,draw:event.shoeDraw??null});
          onSelected?.({id:'isolated-media'},event);onFrame?.(0);return true;},close(){resources.mediaClosed++;}};
      const presentation=await mountSharedRoomPresentation({...options,createComposition:()=>null,
        loadAdapters:async()=>[{PerformancePlayer:Player},{createLocalPresentation:async()=>media},{createLocalCardOverlay:()=>cards}]});
      return {...presentation,restoreSnapshot:async(value,meta)=>{trace.push({kind:'restore',version:value.version,presentationVer:value.presentationVer});return presentation.restoreSnapshot(value,meta);},
        present:async(value,meta)=>{trace.push({kind:'present',ver:value.ver});return presentation.present(value,meta);}};
    }});
  window.fixture.ready=true;
`;

test('Chrome built shared-room mount: desktop/mobile DOM, HTTP intent/retry, WS restore-before-presentation and close cleanup', {
  skip: !browserModule && 'Browser acceptance NOT RUN: set CROUPIER_BROWSER_FIXTURE_MODULE to installed Playwright.', timeout: 90000,
}, async t => {
  const wsRequire = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url));
  const { WebSocketServer } = wsRequire('ws');
  const output = await mkdtemp(join(tmpdir(), 'croupier-shared-browser-'));
  const outputRoot = resolve(output), outputUrl = pathToFileURL(output + sep);
  let browser, server, wss, origin, port, closed = false, snapshot, presentation, loseBet, effects, receipts;
  const sockets = new Set(), rawSockets = new Set(), requests = [], httpBodies = [], bindingReads = [], unexpected = [], pageErrors = [], wsConnections = [];
  t.after(async () => {
    await browser?.close();
    for (const socket of sockets) socket.terminate();
    if (wss) await new Promise(resolve => wss.close(resolve));
    if (server) {
      const stopped = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server.closeAllConnections(); for (const socket of rawSockets) socket.destroy(); await bounded(stopped);
      assert.equal(server.listening, false);
      const refusal = await new Promise((resolve, reject) => {
        const probe = connect({ host: '127.0.0.1', port });
        probe.once('connect', () => { probe.destroy(); reject(Error('Owned browser fixture port still open')); });
        probe.once('error', error => { probe.destroy(); resolve(error.code); });
      });
      assert.equal(refusal, 'ECONNREFUSED'); closed = true;
    }
    // The only removed tree is the exact directory returned by mkdtemp above.
    assert.ok(outputRoot.startsWith(resolve(tmpdir()) + sep));
    await rm(outputRoot, { recursive: true, force: true });
    console.info('Browser resources:', JSON.stringify({ pid: process.pid, host: '127.0.0.1', port, closed,
      browserClosed: !browser?.isConnected(), temporaryBuildRemoved: outputRoot, wsVersion: wsRequire('ws/package.json').version }));
  });
  await build({ origin: 'http://127.0.0.1:1', local: true, frontendPreview: true, output: outputUrl });
  const originalHtml = await readFile(new URL('../services/game/public/index.html', import.meta.url), 'utf8');
  const selection = { lane: 'browser-lane', dealer: 'astrid', localDealer: 'astrid', presentation: 'local', operator: 'fixture',
    packageRevision: 1, branding: {}, roomId, registeredDealers: [{ id: 'astrid', label: 'Isolated Astrid' }] };
  const html = withSharedRoomEntry(decorateGameEntryHtml(originalHtml, selection, { offline: true }), { enabled: true, selection })
    .replace(/<link\b[^>]*href="https?:\/\/[^>]*>/g, '')
    .replace('<script src="/studio/assistant-widget.js" defer></script>', '')
    .replace('src="/shared-room-app.mjs"', 'src="/fixture.mjs"');
  const stateFrame = () => JSON.stringify({ type: 'shared-room-state', roomId, snapshot, presentation });
  const broadcast = () => { snapshot.serverNow = Date.now(); for (const socket of sockets) socket.send(stateFrame()); };
  const nextRequest = () => { const wait = deferred(); requests.push(wait); return bounded(wait.promise); };
  let command, chat, chatSettings = {};
  const chatAsked = [];
  server = createServer(async (req, res) => {
    try {
      if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return; }
      if (req.url === '/fixture.mjs') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(browserFixture); return; }
      const url=new URL(req.url,origin);
      if(url.pathname===`/api/presentation/shared-room/${roomId}/binding`){
        // This fixture owns only its synthetic room/session. Product access and
        // media authorization remain covered by the server integration suites.
        const headers={'content-type':'application/json','cache-control':'private, no-store'};
        if(req.method!=='GET'){res.writeHead(405,{...headers,Allow:'GET'});res.end();return;}
        if(req.headers.cookie!==cookie||req.headers.authorization||req.headers.origin&&req.headers.origin!==origin){res.writeHead(403,headers);res.end();return;}
        if(url.searchParams.size!==2||!['configVersion','windowId'].every(key=>url.searchParams.getAll(key).length===1)){
          res.writeHead(400,headers);res.end();return;
        }
        if(!snapshot||url.searchParams.get('configVersion')!==snapshot.configVersion||url.searchParams.get('windowId')!==snapshot.windowId){
          res.writeHead(409,headers);res.end();return;
        }
        const binding={owner:'web',roomId,configVersion:snapshot.configVersion,windowId:snapshot.windowId,
          presentationContext:{operatorSlug:selection.operator,roomId,packageRevision:selection.packageRevision,dealerId:selection.dealer},selection};
        bindingReads.push({configVersion:binding.configVersion,windowId:binding.windowId,cookie:req.headers.cookie});
        res.writeHead(200,headers);res.end(JSON.stringify(binding));return;
      }
      if (req.url.startsWith('/api/shared-room/')) {
        await handleSharedRoomHttp(req, res, { engineOrigin: origin, chat, command: async request => {
          const bytes = await request.clone().text();
          httpBodies.push({ bytes, cookie: request.headers.get('cookie'), origin: request.headers.get('origin'), url: request.url });
          requests.shift()?.resolve();
          const result = await command(request);
          if (loseBet && JSON.parse(bytes).op === 'bet') { loseBet = false; return Response.json({ error: 'shared_room_command_unavailable' }, { status: 503 }); }
          return result;
        } }); return;
      }
      const pathname = new URL(req.url, origin).pathname;
      if (/\.(?:png|jpg|webp)$/.test(pathname)) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')); return; }
      const file = resolve(outputRoot, '.' + pathname);
      if (!file.startsWith(outputRoot + sep)) throw Error('Outside temporary browser fixture');
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': ['.mjs', '.js'].includes(extname(file)) ? 'text/javascript' : extname(file) === '.css' ? 'text/css' : 'application/json' }); res.end(content);
    } catch (error) { unexpected.push({ path: req.url, error: error.code ?? error.message }); res.writeHead(404); res.end(); }
  });
  server.on('connection', socket => { rawSockets.add(socket); socket.once('close', () => rawSockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); port = server.address().port; origin = `http://127.0.0.1:${port}`;
  command = createSharedRoomCommand({ origin, service: { async command(request, { input }) {
    assert.equal(request.headers.get('cookie'), cookie); assert.equal(input.roomId, roomId);
    const prior = receipts.get(input.commandId);
    if (prior) { assert.equal(prior.bytes, JSON.stringify(input)); return { ...prior.output, replay: true }; }
    snapshot.version++; snapshot.unopened = false;
    let result;
    if (input.op === 'join') {
      snapshot.owners = snapshot.owners.map((owner, i) => input.seats.includes(i) ? actorId : owner === actorId ? null : owner);
      snapshot.me.seats = [...input.seats]; snapshot.me.memberGen++; snapshot.me.active = true;
      for (const i of input.seats) snapshot.seatGen[i]++;
      snapshot.players = [{ id: actorId, seats: [...input.seats], ready: false, leaving: false, online: true }];
      result = { op: 'join', version: snapshot.version, memberGen: snapshot.me.memberGen, seats: [...input.seats], seatGen: [...snapshot.seatGen] };
    } else if (input.op === 'bet') {
      effects++; snapshot.bets[input.seat][input.field] += input.chip; snapshot.me.available -= input.chip;
      result = { op: 'bet', version: snapshot.version, reserved: input.chip };
    } else assert.fail('Unexpected fixture command: ' + input.op);
    const output = { result, replay: false, snapshot: structuredClone(snapshot) };
    receipts.set(input.commandId, { bytes: JSON.stringify(input), output }); return output;
  } } });
  // Real chat route and NDJSON; only the room service and OpenClaw are fixture ports.
  const chatFrame = (room, entry) => JSON.stringify({ type: 'shared-room-chat', roomId: room, lineId: entry.lineId, requestId: entry.requestId,
    who: entry.actorId === null ? 'dealer' : entry.actorId === actorId ? 'you' : 'player', seat: entry.seat, text: entry.text, at: entry.at });
  chat = createSharedRoomChat({ origin, cooldownMs: 0, settingsProvider: () => chatSettings,
    decide: async request => { chatAsked.push(request.message); return { kind: 'generatedText', requestId: request.requestId, exactText: 'Lycka till vid bordet.' }; },
    service: { async chatMember(request) { assert.equal(request.headers.get('cookie'), cookie);
      return { binding: { actorId, sessionId: 'browser-session', roomId }, snapshot: structuredClone(snapshot) }; },
    async chatContext(request) { assert.equal(request.headers.get('cookie'), cookie);
      return { binding: { actorId, sessionId: 'browser-session', roomId }, dealerId: 'astrid', snapshot: structuredClone(snapshot) }; },
    emitChat: (room, entry) => { for (const socket of sockets) socket.send(chatFrame(room, entry)); } } });
  wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    assert.equal(req.url, `/shared-room/${roomId}`); assert.equal(req.headers.origin, origin); assert.equal(req.headers.cookie, cookie);
    wss.handleUpgrade(req, socket, head, client => {
      sockets.add(client); const connection = { client, close: deferred() }; wsConnections.push(connection);
      client.once('close', () => { sockets.delete(client); connection.close.resolve(); }); client.send(stateFrame());
    });
  });
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const channel = process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL;
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}),
    args: ['--disable-background-networking', '--disable-component-update', '--disable-domain-reliability'] });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    snapshot = initial(); presentation = null; loseBet = true; effects = 0; receipts = new Map(); httpBodies.length = 0; bindingReads.length = 0;
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 860, serviceWorkers: 'block' });
    context.setDefaultTimeout(7000);
    await context.addCookies([{ name: 'fixture_session', value: 'isolated-browser', url: origin }]);
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      unexpected.push({ external: route.request().url() }); return route.abort('blockedbyclient');
    });
    const page = await context.newPage(), imported = new Set();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => { if (response.url().endsWith('.mjs') && response.status() === 200) imported.add(new URL(response.url()).pathname); });
    await page.goto(origin); await page.waitForFunction(() => window.fixture?.ready && window.fixture.app.controller.state.snapshot?.version === 0);
    assert.deepEqual(bindingReads,[1,2].map(()=>({configVersion:snapshot.configVersion,windowId:snapshot.windowId,cookie})),
      'the actual browser verifies the same active binding before and after its media port loads');
    assert.equal(await page.locator('#balance').textContent(), '1 000 USD demo');
    assert.ok(imported.has('/packages/presentation/contracts/shared-room-replay.mjs'), 'actual built canonical replay import loaded');
    assert.equal(imported.has('/app.mjs'), false, 'legacy writer is never imported by shared mount');
    const picker = page.getByLabel('Välj eller lämna plats', { exact: true });
    for (const seat of [0, 6]) {
      const received = nextRequest(); await picker.selectOption(String(seat)); await received;
      await page.waitForFunction(() => window.fixture.app.controller.state.waiting !== null);
      assert.deepEqual(await page.evaluate(() => window.fixture.app.controller.state.snapshot.me.seats), seat === 0 ? [] : [0], 'HTTP reply cannot replace WS snapshot');
      broadcast(); await page.waitForFunction(version => window.fixture.app.controller.state.snapshot.version === version
        && window.fixture.app.controller.state.waiting === null, snapshot.version);
    }
    assert.deepEqual(await page.evaluate(() => window.fixture.app.controller.state.snapshot.me.seats), [0, 6]);
    // Chat panel: folded by default, a missing OpenClaw key is a notice only, the answer reaches the log.
    chatSettings = {}; chatAsked.length = 0;
    const chatToggle = page.locator('.room-chat-toggle'), chatBody = page.locator('#shared-room-chat-body');
    assert.equal(await chatBody.isVisible(), false);
    await chatToggle.click(); await chatBody.waitFor({ state: 'visible' });
    const chatInput = page.getByLabel('Meddelande till dealern', { exact: true });
    await chatInput.fill('Hej dealern'); await chatInput.press('Enter');
    await page.locator('.room-chat-status', { hasText: 'Dealerns chatt är inte inkopplad i den här miljön' }).waitFor();
    assert.equal(await chatInput.inputValue(), 'Hej dealern'); assert.deepEqual(chatAsked, []);
    chatSettings = { speechUrl: 'https://director.invalid', speechToken: 'fixture-token' };
    await chatInput.press('Enter');
    await page.locator('.room-chat-dealer', { hasText: 'Lycka till vid bordet.' }).waitFor();
    for (const socket of sockets) socket.send(chatFrame(roomId, { lineId: 'q-' + 'b'.repeat(24), requestId: 'chat-other', actorId: 'browser-bob', seat: 3, text: '<img src=x>Hej från trean', at: Date.now() }));
    await page.locator('.room-chat-player').waitFor();
    assert.equal(await page.locator('#shared-room-chat img').count(), 0, 'chat text is never parsed as HTML');
    assert.deepEqual(await page.locator('.room-chat-who').allTextContents(), ['du', 'dealern', 'plats 3']);
    assert.equal(await chatInput.inputValue(), ''); assert.equal(chatAsked.at(-1), 'Hej dealern');
    const chatBox = await page.locator('#shared-room-chat').boundingBox();
    assert.ok(chatBox.x >= 0 && chatBox.x + chatBox.width <= viewport.width, 'chat panel stays inside the viewport');
    await chatToggle.click(); await chatBody.waitFor({ state: 'hidden' });
    // A phone chooses which three boxes it shows; a wide screen shows all seven and has no chooser.
    const windows = page.getByLabel('Visa platser på bordet', { exact: true });
    if (viewport.width < 860) {
      for (const [start, seats] of [['0', [0, 1, 2]], ['4', [4, 5, 6]]]) {
        await windows.selectOption(start);
        const visible = await page.locator('.seat').evaluateAll(nodes => nodes.filter(node => !node.hidden).map(node => Number(node.dataset.seat)));
        assert.deepEqual(visible, seats);
        assert.equal(await page.locator(`.seat[data-seat="${seats.at(start === '0' ? 0 : -1)}"] .spot`).isVisible(), true);
      }
      await windows.selectOption('0');
    } else {
      assert.equal(await windows.isVisible(), false);
      const visible = await page.locator('.seat').evaluateAll(nodes => nodes.filter(node => !node.hidden).map(node => Number(node.dataset.seat)));
      assert.deepEqual(visible, [0, 1, 2, 3, 4, 5, 6]);
      for (const seat of [0, 6]) assert.equal(await page.locator(`.seat[data-seat="${seat}"] .spot`).isVisible(), true);
    }
    const wager = page.getByRole('button', { name: 'Plats 1, huvudinsats, 0 USD', exact: true });
    let received = nextRequest(); await wager.focus(); await wager.press('Enter'); await received;
    await page.locator('#shared-room-retry').waitFor({ state: 'visible' });
    assert.equal(await wager.isDisabled(), true); assert.equal(await page.locator('#balance').textContent(), '1 000 USD demo');
    assert.equal(httpBodies.length, 3); assert.equal(effects, 1);
    const uncertainBody = httpBodies[2].bytes;
    received = nextRequest(); await page.locator('#shared-room-retry').focus(); await page.locator('#shared-room-retry').press('Enter'); await received;
    await page.waitForFunction(() => window.fixture.commands.state === 'idle' && window.fixture.app.controller.state.waiting !== null);
    assert.equal(httpBodies[3].bytes, uncertainBody); assert.equal(effects, 1, 'explicit retry replays exactly one fixture effect');
    assert.ok(httpBodies.every(call => call.cookie === cookie && call.origin === origin && call.url === `${origin}/api/shared-room/${roomId}/command`));
    broadcast(); await page.waitForFunction(() => window.fixture.app.controller.state.waiting === null && window.fixture.app.controller.state.snapshot.me.available === 999);
    assert.equal(await page.locator('#balance').textContent(), '999 USD demo');
    snapshot.version++; snapshot.presentationVer = 1; snapshot.phase = 'round'; snapshot.roundId = 'round-a';
    snapshot.round = { id: 'round-a', phase: 'decisions', active: 0, hands: [{ box: 0, cards: [{ r: 'A', s: 'S', shoeDraw: 1 }] }], dealer: [], legalActions: ['stand'] };
    presentation = { roomId, ver: 1, talkId: 'talk-a', auditSeq: 1, status: 'ready', kind: 'plan', configVersion: snapshot.configVersion,
      windowId: snapshot.windowId, language: 'sv', startAt: Date.now(), endAt: Date.now() + 30000,
      events: [{ type: 'deal', to: 'box', box: 0, handIndex: 0, faceDown: false, shoeDraw: 1, card: { r: 'A', s: 'S' } }], lines: [] };
    broadcast(); await page.waitForFunction(() => window.fixture.trace.some(item => item.kind === 'media-present' && item.type === 'deal'));
    let trace = await page.evaluate(() => window.fixture.trace);
    assert.ok(trace.findIndex(item => item.kind === 'restore' && item.version === 4) < trace.findIndex(item => item.kind === 'present' && item.ver === 1));
    assert.ok(trace.some(item => item.kind === 'card-begin' && item.draw === 1));
    const previousConnection = wsConnections.at(-1), previousCount = wsConnections.length;
    previousConnection.client.terminate(); await bounded(previousConnection.close.promise);
    await page.waitForFunction(() => window.fixture.trace.filter(item => item.kind === 'restore' && item.version === 4).length === 2);
    assert.equal(wsConnections.length, previousCount + 1);
    trace = await page.evaluate(() => window.fixture.trace);
    assert.equal(trace.filter(item => item.kind === 'present' && item.ver === 1).length, 1, 'reconnect restores current cards without replaying consumed presentation');
    snapshot.version++; snapshot.presentationVer = 2;
    presentation = { ...presentation, ver: 2, talkId: 'talk-b', auditSeq: 2, events: [{ type: 'speak', line: 'goodluck' }],
      lines: [{ index: 0, line: 'goodluck', lineId: 'a'.repeat(32) }] };
    broadcast(); await page.waitForFunction(() => window.fixture.trace.some(item => item.kind === 'media-present' && item.type === 'speak'));
    trace = await page.evaluate(() => window.fixture.trace);
    assert.ok(trace.findIndex(item => item.kind === 'restore' && item.version === 5) < trace.findIndex(item => item.kind === 'present' && item.ver === 2));
    const current = wsConnections.at(-1), requestsBeforeClose = httpBodies.length;
    await page.evaluate(() => window.fixture.app.close()); await bounded(current.close.promise);
    assert.deepEqual(await page.evaluate(() => ({ ...window.fixture.cleanup(), commands: window.fixture.commands.state,
      ws: window.fixture.socket.status().state, closed: window.fixture.app.controller.state.closed })),
    { timers: 0, listeners: 0, mediaClosed: 1, cardsClosed: 1, playerDisposed: 1, commands: 'stopped', ws: 'stopped', closed: true });
    await page.locator('#add-funds').evaluate(node => node.click()); assert.equal(httpBodies.length, requestsBeforeClose);
    assert.equal(sockets.size, 0);
    console.info('Chrome viewport verified:', JSON.stringify({ ...viewport, commandRequests: httpBodies.length, effects,
      bindingReads:bindingReads.length,postloadBindingChecked:true,modules: imported.size, replayContractImported: true, closeCleanup: true }));
    await context.close();
  }
  assert.deepEqual(unexpected, []); assert.deepEqual(pageErrors, []);
});
