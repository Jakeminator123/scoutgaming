// Opt-in browser acceptance against disposable databases only.
// Build lab first. Set CROUPIER_PLAYWRIGHT_MODULE to a Playwright index.mjs
// when Playwright is supplied by the host instead of this repository.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startLocalComparison } from '../tools/start-local-comparison.mjs';
import { buildPresentationSequence } from '../lab/lib/presentation-sequence.mjs';
import { readFile } from 'node:fs/promises';

const modulePath = process.env.CROUPIER_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const output = resolve('.croupier-inbox/qa-20260922/browser');
await mkdir(output, { recursive: true });
const project = JSON.parse(await readFile(new URL('../lab/policies/project.seed.json', import.meta.url), 'utf8'));
const onlyRehearsal = process.argv.includes('--rehearsal-only');
const onlyBo = process.argv.includes('--bo-only');
const fixture = await startLocalComparison({ startLab: !onlyRehearsal && !onlyBo,
  generationDirectory: process.env.CROUPIER_COMPARISON_MEDIA_DIR });
const browser = await chromium.launch({ channel: process.env.CROUPIER_BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] });
const result = { at: new Date().toISOString(), isolated: true, rehearsal: [], comparison: null, backoffice: null };
let context;
const errors = [];
try {
  context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  // Deterministic, clearly synthetic chat response; real model capability is
  // checked separately. No play commands or SSE data are mocked in this test.
  await context.route('**/chat', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Isolated QA reply.', say: null }) }));
  await context.addInitScript(() => {
    window.__qaNative = [];
    window.__qaLabCompleted = new Set();
    new MutationObserver(() => {
      for (const item of document.querySelectorAll('li[data-status="completed"]')) {
        if (item.textContent.includes('Labbets spelare')) {
          const run = [...item.querySelectorAll('small')].find(el => el.textContent.includes('Förlopp sequence-'));
          if (run) window.__qaLabCompleted.add(run.textContent);
        }
      }
    }).observe(document, { childList: true, subtree: true });
    addEventListener('message', event => {
      if (event.data?.type === 'croupier-native-observation') window.__qaNative.push(event.data);
    });
  });
  context.on('page', page => page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR:', error.message); }));
  if (!onlyRehearsal && !onlyBo) {
    const lab = await context.newPage();
    const accepted = [], decisions = [], launches = [], streams = [];
    context.on('request', request => {
      if (request.url() === fixture.labUrl + '/api/inputs/events') streams.push(request.url());
      if (request.url() === fixture.labUrl + '/api/inputs/reference' && request.postDataJSON()?.action === 'launch') launches.push(request.url());
    });
    context.on('response', async response => {
      try {
        if (response.url() === fixture.gameUrl + '/api/table' && response.ok()) accepted.push(await response.json());
        if (response.url() === fixture.labUrl + '/api/presentation/decision' && response.ok()) decisions.push(await response.json());
      } catch { /* Closed pages cannot produce evidence. */ }
    });
    await lab.goto(fixture.labUrl + '/activity', { waitUntil: 'networkidle' });
    const connect = lab.getByRole('button', { name: 'Anslut', exact: true });
    await connect.waitFor();
    const popupReady = lab.waitForEvent('popup');
    await connect.click();
    const game = await popupReady;
    await game.waitForURL(url => url.origin === fixture.gameUrl && !url.searchParams.has('launch'));
    await game.locator('#deal-now').waitFor();
    if (await game.locator('#gate-enter').isVisible()) await game.locator('#gate-enter').click();
    await lab.waitForFunction(() => window.__qaNative.some(m => m.kind === 'status'));
    assert.equal(await lab.getByRole('region', { name: 'Originalspelet', exact: true }).count(), 1);
    assert.equal(await lab.getByRole('region', { name: 'Labbets presentation', exact: true }).count(), 1);
    await game.locator('#chat-input').fill('Great table, thank you!');
    await game.locator('#chat-send').click();
    await lab.waitForFunction(() => window.__qaNative.some(m => m.kind === 'chat' && m.payload.role === 'user'));
    await game.locator('.seat[data-box="3"] .spot').click();
    await game.locator('#deal-now').click();
    await lab.waitForFunction(() => window.__qaNative.some(m => m.kind === 'command' && m.payload.op === 'start'));
    const initial = await lab.evaluate(() => window.__qaNative.find(m => m.kind === 'command' && m.payload.op === 'start').payload.view);
    await lab.getByRole('region', { name: 'Mottaget offentligt bord' }).getByText('Plats 4', { exact: true }).waitFor();
    const visibleCards = await lab.getByRole('region', { name: 'Mottaget offentligt bord' }).textContent();
    for (const card of initial.round.hands[0].cards) assert.ok(visibleCards.includes(card.r + card.s), 'lab table shows the exact public engine cards');
    // Wait for the real scene before choosing the real UI action. A natural
    // blackjack can settle without presenting an action button.
    const startedAt = Date.now();
    while (Date.now() - startedAt < 90000) {
      if (accepted.some(value => value.op === 'collect')) break;
      const stand = game.locator('#actions [data-act="stand"]');
      const noInsurance = game.locator('#insurance-no');
      if (await noInsurance.isVisible() && await noInsurance.isEnabled()) await noInsurance.click();
      else if (await stand.isVisible() && await stand.isEnabled()) await stand.click();
      await new Promise(r => setTimeout(r, 400));
    }
    assert.ok(accepted.some(value => value.op === 'collect'), 'real UI round completed and collected');
    await lab.waitForFunction(() => document.body.innerText.includes('Underlag till presentationsbeslutet'));
    assert.ok(decisions.length > 0, 'lab resolved real received events automatically');
    assert.ok(decisions.some(value => value.decision.context?.observedChat?.messages?.some(m => m.text === 'Great table, thank you!')), 'observed chat reached the local decision boundary');
    assert.ok(await lab.getByText('Originalet ·', { exact: false }).count(), 'native playback receipts displayed');
    await lab.getByText('Diagnostik · videokarta, anslutning och observationsfiler', { exact: true }).click();
    const downloadReady = lab.waitForEvent('download');
    await lab.getByRole('button', { name: 'Exportera observationsprotokoll' }).click();
    const downloaded = await downloadReady;
    const trace = JSON.parse(await readFile(await downloaded.path(), 'utf8'));
    await writeFile(resolve(output, 'observation.json'), JSON.stringify(trace, null, 2));
    const sequence = buildPresentationSequence(trace.records, project);
    await writeFile(resolve(output, 'sequence.json'), JSON.stringify(sequence, null, 2));
    assert.ok(sequence.duplicates > 0, 'SSE/native duplicates recognized');
    const firstRound = trace.records.findIndex(r => r.kind === 'round');
    // A fresh observer explicitly cannot replay events from before connection.
    // Those initial boundaries are expected; later gaps are not.
    assert.equal(sequence.notices.filter(n => ['conflict', 'invalid'].includes(n.kind) || n.kind === 'gap' && n.recordIndex >= firstRound).length, 0, 'no in-session gaps or conflicting commands');
    for (const command of accepted.filter(value => value.op !== 'state')) {
      const matching = sequence.steps.filter(step => step.requestId === command.requestId);
      assert.equal(matching.length, command.presentation.length, 'one lab sequence per accepted command, never a duplicate');
    }
    await lab.waitForFunction(expected => window.__qaLabCompleted.size >= expected, sequence.steps.length, { timeout: 120000 });
    assert.equal(decisions.length, sequence.steps.length, 'the whole sequence resolved exactly once');
    await lab.getByText('Diagnostik · videokarta, anslutning och observationsfiler', { exact: true }).click();
    await lab.evaluate(() => window.scrollTo(0, 0));
    await lab.screenshot({ path: resolve(output, 'comparison-desktop.png'), fullPage: false });
    await lab.setViewportSize({ width: 390, height: 844 });
    await lab.screenshot({ path: resolve(output, 'comparison-mobile.png'), fullPage: false });
    assert.ok(await lab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile has no horizontal overflow');
    result.comparison = { acceptedCommands: accepted.filter(v => v.op !== 'state').map(v => ({ op: v.op, version: v.version, events: v.presentation.length })),
      decisions: decisions.length, deduplicated: sequence.duplicates, sequenceSteps: sequence.steps.length,
      nativeReceipts: trace.records.filter(r => r.source === 'native' && r.kind === 'playback').length,
      completedLabSteps: await lab.evaluate(() => window.__qaLabCompleted.size),
      chatContext: true, model: 'off; synthetic chat response; real provider tested separately' };
    await writeFile(resolve(output, 'observation.json'), JSON.stringify(trace, null, 2));
    await lab.getByText('Diagnostik · videokarta, anslutning och observationsfiler', { exact: true }).click();
    const beforeReset = { accepted: accepted.length, launches: launches.length, streams: streams.length, pages: context.pages().length };
    await lab.getByRole('button', { name: 'Ny observation', exact: true }).click();
    await lab.getByText('Ny observation startad', { exact: true }).waitFor();
    const resetDownload = lab.waitForEvent('download');
    await lab.getByRole('button', { name: 'Exportera observationsprotokoll' }).click();
    const fresh = JSON.parse(await readFile(await (await resetDownload).path(), 'utf8'));
    assert.ok(fresh.records.some(r => r.data?.state === 'observation-reset' && r.data.gap), 'new protocol explicitly marks discarded history');
    assert.equal(fresh.records.filter(r => r.kind === 'round').length, 0);
    assert.deepEqual({ accepted: accepted.length, launches: launches.length, streams: streams.length, pages: context.pages().length }, beforeReset, 'reset makes no game command, launch, duplicate SSE or new popup');
    result.comparison.newObservation = true;
    await game.close(); await lab.close();
    console.log('PASS live comparison, native/SSE deduplication, automatic playback, bounded chat, mobile layout');
  }
  for (const [dealer, route] of (onlyBo ? [] : [['vera','/'], ['astrid','/'], ['amira','/'], ['mei','/'], ['astrid','/v2/'], ['amira','/v2/']])) {
    const page = await context.newPage();
    const messages = [];
    page.on('console', message => { if (message.text().includes('[speech]') || message.text().includes('[voice]')) messages.push(message.text()); });
    await page.goto(`${fixture.gameUrl}${route}?dealer=${dealer}&rehearsal=1`);
    await page.locator('#rehearsal-line').waitFor({ timeout: 60000 });
    if (await page.locator('#gate-enter').isVisible()) await page.locator('#gate-enter').click();
    await page.locator('#rehearsal-line').selectOption('goodluck');
    await page.locator('#rehearsal-repeat').click();
    await page.waitForFunction(() => document.querySelector('#rehearsal-repeat')?.disabled === false, undefined, { timeout: 60000 });
    const status = await page.locator('#rehearsal-status').textContent();
    assert.ok(!status.includes('Playback failed'), status);
    await page.screenshot({ path: resolve(output, `${dealer}-${route === '/' ? 'original' : 'v2'}.png`) });
    result.rehearsal.push({ dealer, route, requestedPlays: 2, status, messages, visualApproval: false });
    await page.close();
    console.log(`PASS ${dealer} ${route} actual-player Play twice`);
  }
  const bo = await context.newPage();
  await bo.goto(fixture.gameUrl + '/bo/login.html');
  await bo.locator('#u').fill(fixture.bo.username);
  await bo.locator('#p').fill(fixture.bo.password);
  await bo.locator('button[type="submit"]').click();
  await bo.waitForURL(url => url.pathname === '/bo/' || url.pathname === '/bo/index.html');
  await bo.goto(fixture.gameUrl + '/bo/#gens');
  try { await bo.locator('#g-q').waitFor(); } catch (error) { console.log('BO screen:', (await bo.locator('body').innerText()).slice(0,1800)); throw error; }
  assert.ok(await bo.locator('video[data-bo-preview]').count(), 'generation library populated');
  await bo.screenshot({ path: resolve(output, 'backoffice-generations.png') });
  await bo.locator('#g-swipe').click();
  await bo.waitForFunction(() => [...document.querySelectorAll('video')].filter(v => !v.paused).length <= 1);
  const generationSrc = await bo.locator('[data-card] video').getAttribute('src');
  const generationAvailable = (await bo.request.head(fixture.gameUrl + generationSrc)).ok();
  if (generationAvailable) {
    await bo.locator('[data-card] video').evaluate(video => video.play());
    await bo.waitForFunction(() => document.querySelector('[data-card] video')?.currentTime > 0);
  }
  await bo.keyboard.press('Escape');
  await bo.goto(fixture.gameUrl + '/bo/#clips');
  await bo.locator('#content [data-clip]').first().waitFor();
  const clips = bo.locator('#content video[data-bo-preview]'), playable = [];
  for (let i = 0; i < Math.min(await clips.count(), 20) && playable.length < 2; i++) {
    const src = await clips.nth(i).getAttribute('src');
    if ((await bo.request.get(fixture.gameUrl + src, { headers: { Range: 'bytes=0-0' } })).ok()) playable.push(i);
  }
  assert.equal(playable.length, 2, 'two in-checkout BO clips are available for real playback sampling');
  for (const index of playable) {
    await clips.nth(index).evaluate(video => video.play());
    await bo.waitForFunction(i => document.querySelectorAll('#content video[data-bo-preview]')[i].currentTime > 0, index);
  }
  assert.ok(await clips.nth(playable[0]).evaluate(video => video.paused), 'starting second BO clip stops first');
  assert.equal(await bo.evaluate(() => [...document.querySelectorAll('video')].filter(v => !v.paused).length), 1);
  result.backoffice = { login: true, generations: true, generationVideoSample: generationAvailable ? 'played' : 'not present in local checkout; remote catalog metadata only',
    dealingClips: true, actualClipSamples: playable.length, singleActivePreview: true };
  result.pageErrors = errors;
  assert.deepEqual(errors, [], 'no browser JavaScript errors');
  console.log('PASS backoffice authentication, generation preview and dealing clips');
} finally {
  result.pageErrors = errors;
  await writeFile(resolve(output, onlyBo ? 'result-bo.json' : onlyRehearsal ? 'result-rehearsal.json' : 'result.json'), JSON.stringify(result, null, 2));
  await context?.close(); await browser.close(); await fixture.stop();
}
