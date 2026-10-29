// A built shared-table page in real Chrome for layout checks: the production HTML, view, controller,
// presentation layout and card overlay, fed snapshots directly. No socket, command, media or database runs here,
// so this proves where controls land and what covers them, not table rules or K04 media acceptance.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../../apps/web/tools/player-ui-build.mjs';
import { decorateGameEntryHtml } from '../../services/game/public/game-entry-contract.mjs';
import { withSharedRoomEntry } from '../../services/game/shared-room-entry.mjs';

export const roomId = 'layout-room', actorId = 'layout-alice';
const selection = { lane: 'layout-lane', dealer: 'paow', localDealer: 'paow', presentation: 'local', operator: 'fixture',
  packageRevision: 1, branding: {}, roomId, registeredDealers: [{ id: 'paow', label: 'PAOW' }] };
const pageScript = `
  const root=document.documentElement;delete root.dataset.sharedRoom;
  const {mountSharedRoomApp}=await import('/shared-room-app.mjs');
  const {mountSharedRoomPresentation}=await import('/shared-room-presentation.mjs');
  const {createLocalCardOverlay}=await import('/local-card-overlay.mjs');
  root.dataset.sharedRoom='1';
  const selection=${JSON.stringify(selection)};
  // sendDelay: milliseconds before a command's reply, so a test sees the pending state (every control closed) in frames.
  let restore,sendDelay=0;const connection=new AbortController(),sent=[];
  class Player{dispose(){}}
  // ?plane=film: a composition plane without table geometry, the film contain-fitted to the scene (no Admin boxes).
  const plane=new URLSearchParams(location.search).get('plane')==='film';
  const composition=plane?{referencePlane(){const scene=document.getElementById('scene').getBoundingClientRect(),scale=Math.min(scene.width/1080,scene.height/1920);
      return{x:(scene.width-1080*scale)/2,y:(scene.height-1920*scale)/2,scale,sourceAligned:true};},onGeometryChange:()=>()=>{},setBackground(){},setTable(){},close(){}}:null;
  const app=await mountSharedRoomApp({
    fetchImpl:async url=>{const query=new URL(url,location.origin).searchParams;
      return Response.json({owner:'web',roomId:selection.roomId,configVersion:query.get('configVersion'),windowId:query.get('windowId'),
        presentationContext:{operatorSlug:selection.operator,roomId:selection.roomId,packageRevision:selection.packageRevision,dealerId:selection.dealer},selection});},
    createCommands:()=>({state:'idle',async send(intent){if(sendDelay>0)await new Promise(done=>setTimeout(done,sendDelay));sent.push(intent);return{status:'ok',result:{op:intent.op,version:0,...(intent.op==='pause'?{pausedUntil:0}:{})}};},retry(){},stop(){this.state='stopped';}}),
    createSocket:options=>{restore=options.restoreSnapshot;return{start(){},stop(){},reconnect(){},status:()=>({state:'running'})};},
    createPresentation:async options=>mountSharedRoomPresentation({...options,createComposition:()=>composition,
      loadAdapters:async()=>[{PerformancePlayer:Player},{createLocalPresentation:async media=>({state(){},prepareSequence(){},present:async()=>true,close(){},start(){media.onIdle();}})},{createLocalCardOverlay}]})});
  window.fixture={app,sent,push:snapshot=>restore(snapshot,{signal:connection.signal,receivedAt:Date.now()}),delay:ms=>{sendDelay=ms;},ready:true};
`;

export function tableSnapshot({ version = 1, own = [], others = {}, phase = 'bets', bets = {}, round = null, plan = null, settings = {}, lastSettlement = null } = {}) {
  const owners = Array.from({ length: 7 }, (_, i) => own.includes(i) ? actorId : others[i] ?? null);
  const players = [...(own.length ? [{ id: actorId, seats: [...own], ready: false, leaving: false }] : []),
    ...[...new Set(Object.values(others))].map(id => ({ id, seats: owners.flatMap((owner, i) => owner === id ? [i] : []), ready: false, leaving: false }))];
  return { contract: 'blackjack-table/1', roomId, version, presentationVer: 0, configVersion: 'layout-config', windowId: 'window-a',
    phase, roundId: phase === 'bets' ? null : 'round-a', turnSeq: 0, owners, seatGen: owners.map(owner => owner ? 1 : 0),
    bets: Array.from({ length: 7 }, (_, i) => ({ main: 0, pp: 0, tp: 0, ...bets[i] })), players, deadline: null, actionDeadline: null,
    plan, round, shoe: null, serverNow: Date.now(),
    settings: { configVersion: 'layout-config', language: 'sv', betMs: 20000, actionMs: 15000,
      limits: { min: 5, max: 2000, sideMax: 200 }, chips: [5, 10, 25, 50, 100, 500], refill: 1000, ...settings },
    me: { id: actorId, seats: [...own], memberGen: own.length ? 1 : 0, active: own.length > 0, available: 1000, pausedUntil: 0, insuranceDue: false, lastSettlement } };
}

// Serves one built page per call; close() stops the server, the browser and removes the temporary build.
export async function openLayoutFixture(browserModule, { channel } = {}) {
  const output = await mkdtemp(join(tmpdir(), 'croupier-shared-layout-'));
  const outputRoot = resolve(output);
  await build({ origin: 'http://127.0.0.1:1', local: true, frontendPreview: true, output: pathToFileURL(output + sep) });
  const originalHtml = await readFile(new URL('../../services/game/public/index.html', import.meta.url), 'utf8');
  const html = withSharedRoomEntry(decorateGameEntryHtml(originalHtml, {}, selection, { offline: true }), { enabled: true, selection })
    .replace(/<link\b[^>]*href="https?:\/\/[^>]*>/g, '')
    .replace('<script src="/studio/assistant-widget.js" defer></script>', '')
    .replace('src="/shared-room-app.mjs"', 'src="/fixture.mjs"');
  const unexpected = [];
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      if (pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return; }
      if (pathname === '/fixture.mjs') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(pageScript); return; }
      if (/\.(?:png|jpg|webp)$/.test(pathname)) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')); return; }
      const file = resolve(outputRoot, '.' + pathname);
      if (!file.startsWith(outputRoot + sep)) throw Error('Outside temporary layout fixture');
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': ['.mjs', '.js'].includes(extname(file)) ? 'text/javascript' : extname(file) === '.css' ? 'text/css'
        : extname(file) === '.svg' ? 'image/svg+xml' : 'application/json' }); res.end(content);
    } catch (error) { unexpected.push({ path: req.url, error: error.code ?? error.message }); res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}),
    args: ['--disable-background-networking', '--disable-component-update', '--disable-domain-reliability'] });
  const pageErrors = [];
  async function open(viewport, { plane = null } = {}) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 860, hasTouch: viewport.width < 860, serviceWorkers: 'block' });
    context.setDefaultTimeout(7000);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue()
      : (unexpected.push({ external: route.request().url() }), route.abort('blockedbyclient')));
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(origin + (plane ? `/?plane=${plane}` : '')); await page.waitForFunction(() => window.fixture?.ready);
    return { page, context,
      // Replies to commands wait this long from now on (0 answers at once).
      delay: ms => page.evaluate(value => window.fixture.delay(value), ms),
      async show(snapshot) {
        await page.evaluate(value => window.fixture.push(value), snapshot);
        await page.waitForFunction(version => window.fixture.app.controller.state.snapshot?.version === version
          && window.fixture.app.controller.state.connected, snapshot.version);
        // Two frames: the view lays out after its render and again on the presentation's first frame.
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      } };
  }
  return { open, unexpected, pageErrors,
    async close() { await browser.close(); await new Promise(done => server.close(done)); server.closeAllConnections?.();
      if (outputRoot.startsWith(resolve(tmpdir()) + sep)) await rm(outputRoot, { recursive: true, force: true }); } };
}

// Every visible control must be the topmost element at its own centre, no two controls may overlap, and the
// status line may cover none of them. Returns readable findings, empty when the layout holds.
export function measureLayout() {
  const shown = node => { for (let el = node; el; el = el.parentElement) { const style = getComputedStyle(el);
    if (el.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false; } return true; };
  const name = node => node.getAttribute('aria-label') || node.textContent.trim().replace(/\s+/g, ' ') || node.id || node.tagName;
  const controls = [...document.querySelectorAll('#scene button, #scene select, #scene a[href], #dealer-picker a[href]')]
    .filter(node => shown(node)).map(node => ({ node, rect: node.getBoundingClientRect(), label: name(node) }))
    .filter(item => item.rect.width > 0 && item.rect.height > 0);
  const findings = [];
  const inside = rect => rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= innerWidth + 0.5 && rect.bottom <= innerHeight + 0.5;
  for (const { node, rect, label } of controls) {
    if (!inside(rect)) { findings.push(`${label}: utanför skärmen`); continue; }
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (hit !== node && !node.contains(hit)) findings.push(`${label}: täckt av ${hit ? name(hit.closest('button,select,a,[id]') ?? hit) : 'inget'}`);
    // The table's own controls (seats, seat bar, dock, action zone) keep 44 px touch targets.
    if (rect.height < 43.5 && node.closest('#seats,#shared-room-controls,#shared-room-dock,#shared-room-actions,#shared-room-connection')) findings.push(`${label}: ${Math.round(rect.height)} px hög`);
  }
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++)
    if (!controls[i].node.contains(controls[j].node) && !controls[j].node.contains(controls[i].node) && overlap(controls[i].rect, controls[j].rect))
      findings.push(`${controls[i].label} överlappar ${controls[j].label}`);
  const banner = document.getElementById('banner');
  if (banner && shown(banner)) for (const { rect, label } of controls) if (overlap(banner.getBoundingClientRect(), rect)) findings.push(`statusraden täcker ${label}`);
  if (document.documentElement.scrollWidth > innerWidth + 0.5) findings.push(`vågrät scroll: ${document.documentElement.scrollWidth} > ${innerWidth}`);
  return findings;
}
