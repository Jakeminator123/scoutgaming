// Opt-in real-browser acceptance. One coordinated pair, disposable databases,
// no external providers, one game and one Lab tab. Evidence is Git-ignored.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startLocalComparison } from '../tools/start-local-comparison.mjs';
import { prepareProject } from '../lab/start.mjs';
const { chromium } = await import(process.env.CROUPIER_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.CROUPIER_PLAYWRIGHT_MODULE).href : 'playwright');
const output = resolve('lab/data/qa-backoffice-lab'); await mkdir(output, { recursive: true });
const result = { at: new Date().toISOString(), isolated: true, savedDealers: [], rehearsal: [], errors: [], blockedExternalRequests: 0 };
let fixture, browser, context, lab, game, stage = 'fixture';
const checkpoint = value => { stage = value; console.log(`QA ${value}`); };
const redact = value => {
  let text = String(value);
  for (const secret of [fixture?.bo.password, fixture?.credentials.partner.secret, fixture?.credentials.generations.token]) if (secret) text = text.replaceAll(secret, '[private]');
  return text.replace(/https?:\/\/[^\s<>'"]+/g, address => { try { const url = new URL(address); return url.origin + url.pathname; } catch { return '[url]'; } });
};
try {
  fixture = await startLocalComparison({ generationDirectory: resolve('media/dealers/astrid/runtime/presentation'), streamLane: 'lissabon-stream-lane', prepareStudio: prepareProject });
  const labUrl = fixture.labUrl.replace('127.0.0.1', 'localhost');
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability'] });
  context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && [new URL(fixture.gameUrl).port, new URL(labUrl).port].includes(url.port)) return route.continue();
    result.blockedExternalRequests++; return route.abort('blockedbyclient');
  });
  // This only observes media lifecycle. No fake frames, responses or playback.
  await context.addInitScript(() => {
    window.__qaNative = []; window.__qaMedia = []; window.__qaRenderedClips = [];
    addEventListener('message', event => { if (event.data?.type === 'croupier-native-observation') window.__qaNative.push(event.data); });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      const media = this, record = { src: media.currentSrc || media.src, kind: media.tagName.toLowerCase(), maxTime: media.currentTime || 0, frames: 0, ended: false, playing: false, error: null };
      window.__qaMedia.push(record);
      const progress = () => { record.src = media.currentSrc || media.src || record.src; record.maxTime = Math.max(record.maxTime, media.currentTime || 0); };
      const playing = () => { record.playing = true; progress(); };
      const ended = () => { progress(); record.ended = true; cleanup(); };
      const failed = () => { record.error = media.error?.code ?? 'media-error'; cleanup(); };
      let frame;
      const paint = (_, metadata) => { record.frames++; record.maxTime = Math.max(record.maxTime, metadata.mediaTime || 0); if (!record.ended && !record.error) frame = media.requestVideoFrameCallback(paint); };
      const cleanup = () => { media.removeEventListener('timeupdate', progress); media.removeEventListener('playing', playing); media.removeEventListener('ended', ended); media.removeEventListener('error', failed); if (frame !== undefined) media.cancelVideoFrameCallback(frame); };
      media.addEventListener('timeupdate', progress); media.addEventListener('playing', playing); media.addEventListener('ended', ended); media.addEventListener('error', failed);
      if (media.tagName === 'VIDEO' && media.requestVideoFrameCallback) frame = media.requestVideoFrameCallback(paint);
      const promise = play.apply(media, args); promise?.catch(error => { record.error = error.name; cleanup(); }); return promise;
    };
  });
  context.on('page', page => page.on('pageerror', error => result.errors.push(redact(error.message))));
  const requests = { launches: 0, labDecisions: 0 };
  context.on('request', request => {
    if (request.url() === labUrl + '/api/inputs/reference' && request.method() === 'POST' && request.postDataJSON()?.action === 'launch') requests.launches++;
    if (request.url() === labUrl + '/api/presentation/decision' && request.method() === 'POST') requests.labDecisions++;
  });
  checkpoint('Lab save/reload'); lab = await context.newPage(); await lab.goto(labUrl + '/#upload');
  await lab.getByRole('navigation', { name: 'Backoffice/Lab', exact: true }).waitFor();
  const editor = lab.getByRole('region', { name: 'Gemensamma klippval för alla dealers' });
  await editor.getByText('Ordinarie motorkälla:', { exact: false }).waitFor();
  const inventory = await (await lab.request.get(labUrl + '/api/clip-controls')).json();
  assert.deepEqual(inventory.routes.map(row => row.dealerId).sort(), ['amira', 'astrid', 'mei', 'vera']);
  assert.ok(inventory.clips.length >= 100, 'built Lab resolved actual repository media registers');
  for (const dealer of ['vera', 'astrid', 'amira', 'mei']) {
    const candidates = inventory.clips.filter(row => row.dealerId === dealer && row.kind === 'engine' && row.available && row.exactParts.includes('idle'));
    const candidate = candidates.find(row => row.engineKey !== 'idle-1/idle/idle') ?? candidates[0];
    assert.ok(candidate, `${dealer} has an exact registered idle`);
    await editor.getByRole('combobox', { name: /^Croupier/ }).selectOption(dealer);
    await editor.getByLabel(`${dealer} idle`, { exact: true }).selectOption(candidate.id);
    result.savedDealers.push({ dealer, id: candidate.id, engineKey: candidate.engineKey });
  }
  const before = (await (await lab.request.get(labUrl + '/api/project')).json()).project;
  await lab.getByRole('button', { name: 'Spara inställningar', exact: true }).click();
  await lab.getByText('Osparade ändringar', { exact: true }).waitFor({ state: 'hidden' });
  const saved = (await (await lab.request.get(labUrl + '/api/project')).json()).project; assert.notEqual(saved.revision, before.revision);
  for (const row of result.savedDealers) assert.ok(saved.legacyClipPolicy.some(binding => binding.dealerId === row.dealer && binding.part === 'idle' && binding.clipId === row.id));
  await lab.reload(); await editor.getByText('Ordinarie motorkälla:', { exact: false }).waitFor();
  await editor.getByRole('combobox', { name: /^Croupier/ }).selectOption('mei');
  assert.equal(await editor.getByLabel('mei idle', { exact: true }).inputValue(), result.savedDealers.find(row => row.dealer === 'mei').id);
  result.savedRevision = saved.revision; await editor.scrollIntoViewIfNeeded(); await lab.screenshot({ path: resolve(output, 'clip-controls.png'), fullPage: false });

  checkpoint('BO authentication and 14 sections'); await lab.goto(labUrl + '/administration#ops');
  let frame = lab.frameLocator('iframe');
  await frame.locator('#u').fill(fixture.bo.username); await frame.locator('#p').fill(fixture.bo.password);
  await frame.locator('button[type="submit"]').click(); await frame.locator('#title').filter({ hasText: 'Operations' }).waitFor();
  const sections = [['ops', 'Operations'], ['voice', 'Voice Lines'], ['clips', 'Äldre klipp och granskning'], ['gens', 'Generations'], ['apikeys', 'API Keys'], ['emails', 'Emails'], ['users', 'Users'], ['rooms', 'Tables & Rooms'], ['dealers', 'Dealers'], ['pit', 'Pit Bosses'], ['tours', 'Tournaments'], ['players', 'Players'], ['pay', 'Payments'], ['shoes', 'Shoes & Decks']];
  result.backofficeSections = [];
  for (const [section, title] of sections) {
    await lab.goto(labUrl + '/administration#' + section); frame = lab.frameLocator('iframe');
    await frame.locator('#title').filter({ hasText: title }).waitFor();
    await frame.locator('#content table, #content .panel, #content .row').first().waitFor({ timeout: 60000 });
    assert.equal(await frame.locator('#title').innerText(), title); const content = await frame.locator('#content').innerText();
    assert.ok(content.trim().length > 20 && !/^loading/i.test(content.trim()), `BO ${section} loaded actual content`);
    assert.ok(!/403|forbidden|admin role required|superadmin only|Sign in required/i.test(content), `BO ${section} authorization succeeded`);
    result.backofficeSections.push({ section, title, rendered: true });
  }
  const rejectedAssign = await lab.request.post(fixture.gameUrl + '/api/bo/clip-assign', { headers: { origin: fixture.gameUrl }, data: { dealer: 'vera', part: 'idle', clip: result.savedDealers[0].id } });
  assert.equal(rejectedAssign.status(), 410, 'competing BO clip writes are retired after real authentication');
  await lab.screenshot({ path: resolve(output, 'administration.png'), fullPage: false });

  checkpoint('native round and real playback receipts'); await lab.goto(labUrl + '/activity');
  await lab.getByRole('button', { name: 'Anslut', exact: true }).waitFor();
  const popup = lab.waitForEvent('popup'); await lab.getByRole('button', { name: 'Anslut', exact: true }).click(); game = await popup;
  await game.waitForURL(url => url.origin === fixture.gameUrl && !url.searchParams.has('launch')); await game.locator('#deal-now').waitFor();
  if (await game.locator('#gate-enter').isVisible()) await game.locator('#gate-enter').click();
  assert.equal(await lab.getByRole('region', { name: 'Labbets presentation', exact: true }).count(), 0);
  const runtime = await (await game.request.get(fixture.gameUrl + '/api/presentation/legacy-config')).json(); assert.equal(runtime.projectRevision, saved.revision);
  for (const row of result.savedDealers) assert.equal(runtime.dealers[row.dealer].engine.idle, row.engineKey);
  const commands = []; game.on('response', async response => { if (response.url() === fixture.gameUrl + '/api/table' && response.ok()) try { commands.push(await response.json()); } catch {} });
  await game.locator('.seat[data-box="3"] .spot').click(); await game.locator('#deal-now').click();
  const started = Date.now();
  while (Date.now() - started < 90000 && !commands.some(row => row.op === 'collect')) {
    const stand = game.locator('#actions [data-act="stand"]'), insurance = game.locator('#ins-no');
    if (await insurance.isVisible() && await insurance.isEnabled()) await insurance.click();
    else if (await stand.isVisible() && await stand.isEnabled()) await stand.click();
    await new Promise(yes => setTimeout(yes, 400));
  }
  assert.ok(commands.some(row => row.op === 'collect'), 'real synthetic round completed');
  assert.equal(await lab.getByRole('region', { name: 'Labbets presentation', exact: true }).count(), 0);
  const traceView = lab.getByRole('region', { name: 'Spårbar uppspelning', exact: true }); await traceView.waitFor();
  await traceView.getByText(saved.revision, { exact: false }).first().waitFor();
  await traceView.getByText('video-frame', { exact: true }).first().waitFor(); await traceView.getByText('Spelat klart', { exact: true }).first().waitFor();
  const native = await lab.evaluate(() => window.__qaNative);
  const presented = native.filter(row => row.kind === 'playback' && row.payload.state === 'presented' && row.payload.evidence === 'video-frame' && row.payload.projectRevision === saved.revision);
  const completed = native.filter(row => row.kind === 'playback' && row.payload.state === 'end' && row.payload.projectRevision === saved.revision);
  assert.ok(presented.length && completed.length, 'actual renderer frames and end receipts carry the saved revision');
  assert.ok(presented.some(frame => completed.some(end => end.payload.requestId === frame.payload.requestId && end.payload.mediaId === frame.payload.mediaId)), 'a completed clip owns its actual frame');
  assert.equal(requests.labDecisions, 0, 'native observation never starts a second Lab player');
  result.observation = { singlePlayer: true, commands: commands.filter(row => row.op !== 'state').map(row => row.op), presented: presented.length, completed: completed.length };
  await traceView.getByText('Spelat klart', { exact: true }).first().scrollIntoViewIfNeeded();
  await lab.screenshot({ path: resolve(output, 'playback-trace.png'), fullPage: false }); await writeFile(resolve(output, 'native-round.json'), JSON.stringify(native, null, 2));

  checkpoint('reset and reconnect preserve the existing game');
  const boundary = { commands: commands.length, launches: requests.launches, pages: context.pages().length };
  await lab.getByText('Diagnostik · videokarta, anslutning och observationsfiler', { exact: true }).click();
  await lab.getByRole('button', { name: 'Ny observation', exact: true }).click(); await lab.getByText('Ny observation startad', { exact: true }).waitFor();
  await lab.getByRole('button', { name: 'Koppla från', exact: true }).click(); await lab.getByRole('button', { name: 'Anslut', exact: true }).click();
  await lab.getByRole('button', { name: 'Koppla från', exact: true }).waitFor();
  assert.equal(commands.length, boundary.commands); assert.equal(requests.launches, boundary.launches); assert.equal(context.pages().length, boundary.pages);
  assert.equal(await traceView.getByText('Spelat klart', { exact: true }).count(), 0, 'old end receipts are not replayed after reset/reconnect');
  result.observation.reset = true; result.observation.reconnectedWithoutLaunch = true;

  // Reuse the same bound game tab for the ordinary four-dealer playback path.
  const observerUrl = new URL(game.url());
  for (const [dealer, mode] of [['vera', 'original'], ['amira', 'original'], ['mei', 'original'], ['astrid', 'original'], ['astrid', 'studio'], ['astrid', 'v2'], ['amira', 'v2']]) {
    const local = mode === 'studio', green = mode === 'v2';
    checkpoint(`${dealer} ${mode} Play twice`);
    const configurationFrom = await lab.evaluate(() => window.__qaNative.length);
    const url = new URL(green ? '/v2/' : '/', fixture.gameUrl);
    for (const key of ['labObserverOrigin', 'labObserverChannel']) url.searchParams.set(key, observerUrl.searchParams.get(key));
    url.searchParams.set('dealer', dealer); url.searchParams.set('rehearsal', '1'); url.searchParams.set('presentation', local ? 'local' : 'off');
    await game.goto(url.href); await game.locator('#rehearsal-line').waitFor({ timeout: 60000 });
    if (await game.locator('#gate-enter').isVisible()) await game.locator('#gate-enter').click();
    await game.waitForFunction(() => Boolean(window.__croupier));
    await game.evaluate(() => { const engine = window.__croupier.engine, present = engine.onPresentClip; engine.onPresentClip = function (clip, id) { window.__qaRenderedClips.push({ clip, id, evidence: 'presented-frame' }); return present?.call(this, clip, id); }; });
    if (!green) {
      if (!local) assert.equal(await game.evaluate(() => window.__croupier.CLIP.idle), result.savedDealers.find(row => row.dealer === dealer).engineKey);
      await lab.waitForFunction(({ from, revision }) => window.__qaNative.slice(from).some(row => row.kind === 'playback' && row.payload.event === 'configuration' && row.payload.projectRevision === revision), { from: configurationFrom, revision: saved.revision });
    }
    await game.locator('#rehearsal-line').selectOption('goodluck'); const nativeFrom = await lab.evaluate(() => window.__qaNative.length);
    const mediaFrom = await game.evaluate(() => window.__qaMedia.length);
    await game.locator('#rehearsal-repeat').click();
    await lab.waitForFunction(from => window.__qaNative.slice(from).some(row => row.kind === 'playback' && (row.payload.line === 'goodluck' || row.payload.sourceEvent?.line === 'goodluck') && ['start', 'presented'].includes(row.payload.state) && ['media-playing', 'presented-frame', 'video-frame'].includes(row.payload.evidence)), nativeFrom, { timeout: 30000 });
    await game.waitForTimeout(300); await game.screenshot({ path: resolve(output, `${dealer}-${mode}-during.png`) });
    await game.waitForFunction(() => !document.querySelector('#rehearsal-repeat')?.disabled, undefined, { timeout: 60000 });
    const status = await game.locator('#rehearsal-status').textContent(); assert.ok(!status.includes('Playback failed'), status);
    const receipts = await lab.evaluate(from => window.__qaNative.slice(from).filter(row => row.kind === 'playback' && (row.payload.line === 'goodluck' || row.payload.sourceEvent?.line === 'goodluck')), nativeFrom);
    const actualStarts = receipts.filter(row => row.payload.state === 'start' && ['media-playing', 'presented-frame'].includes(row.payload.evidence) || row.payload.state === 'presented' && row.payload.evidence === 'video-frame');
    const ends = receipts.filter(row => row.payload.state === 'end'); assert.equal(ends.length, 2, `${dealer} supplied two real completed goodluck receipts`);
    assert.ok(actualStarts.length >= 2, `${dealer} supplied actual media starts/frames for both takes`);
    const media = await game.evaluate(from => ({ media: window.__qaMedia.slice(from), engine: window.__qaRenderedClips }), mediaFrom);
    const advancing = media.media.filter(row => row.playing && row.ended && row.maxTime > 0.25 && !row.error);
    if (local) { assert.ok(status.includes('2/2 completed'), status); assert.ok(receipts.filter(row => row.payload.state === 'presented' && row.payload.evidence === 'video-frame').length >= 2); }
    else assert.ok(advancing.length >= 2, `${dealer} actual embedded video/audio advanced and ended twice`);
    // Green takes intentionally stop at their calibrated cut-out frame. Their
    // authoritative completion receipt requires both that frame and audio end.
    const videoFrames = media.media.filter(row => row.kind === 'video' && row.playing && row.frames > 0 && row.maxTime > 0.25 && !row.error && (green || row.ended)).length, engineFrames = media.engine.filter(row => row.clip.endsWith('/speak/goodluck')).length;
    assert.ok(videoFrames >= 2 || engineFrames >= 2, `${dealer} has actual recorded-speech video or engine frames`);
    result.rehearsal.push({ dealer, local, mode, projectRevision: green ? null : saved.revision, requestedPlays: 2, status, actualStarts: actualStarts.length, actualEnds: ends.length, advancingMedia: advancing.length, videoFrames, engineFrames, visualApproval: false });
    await writeFile(resolve(output, `${dealer}-${mode}-receipts.json`), JSON.stringify({ receipts, media }, null, 2));
  }
  checkpoint('mobile workspace'); await lab.setViewportSize({ width: 390, height: 844 });
  assert.ok(await lab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile navigation does not overflow');
  await lab.screenshot({ path: resolve(output, 'mobile.png'), fullPage: false }); assert.deepEqual(result.errors, []); assert.equal(context.pages().length, 2);
  result.status = 'passed'; console.log('PASS Backoffice/Lab UI save/reload, BO14, actual native playback/reset/reconnect and seven two-play rehearsals');
} catch (error) {
  result.status = 'failed'; result.failure = { stage, message: redact(error.message) };
  await game?.screenshot({ path: resolve(output, 'failure-game.png') }).catch(() => {}); await lab?.screenshot({ path: resolve(output, 'failure-lab.png') }).catch(() => {});
  throw new Error(`Backoffice/Lab QA failed at ${stage}: ${redact(error.message)}`);
} finally {
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); await context?.close(); await browser?.close(); await fixture?.stop();
}
