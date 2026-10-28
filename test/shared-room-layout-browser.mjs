// Real Chrome on the built shared-table page (test/fixtures/shared-room-layout-page.mjs): K04 F12-F15 at the
// sizes where they were found. Every visible control must be the topmost element at its centre, no two controls
// overlap, the status line covers none, and the page never scrolls sideways; with one, two and seven own seats,
// without and with a composition plane, and through a played round with real clicks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openLayoutFixture, tableSnapshot, measureLayout } from './fixtures/shared-room-layout-page.mjs';

const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE, channel = process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL;
const skip = !browserModule && 'Browser layout NOT RUN: set CROUPIER_BROWSER_FIXTURE_MODULE to installed Playwright.';
const viewports = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 320, height: 568 }];
const cards = own => own.map((box, i) => ({ box, cards: [{ r: 'K', s: 'S', shoeDraw: 2 + i * 2 }, { r: '7', s: 'H', shoeDraw: 3 + i * 2 }] }));
const past = () => { const now = Date.now(); return { turnAt: now - 3000, endAt: now - 1000 }; };
const decision = (own, version = 2) => tableSnapshot({ version, own, phase: 'round', bets: Object.fromEntries(own.map(i => [i, { main: 25 }])), plan: past(),
  round: { id: 'round-a', phase: 'decisions', active: 0, holeDraw: 20, hands: cards(own), dealer: [{ r: '9', s: 'D', shoeDraw: 1 }], legalActions: ['hit', 'stand', 'double'] } });
const insurance = (own, version) => { const s = tableSnapshot({ version, own, phase: 'round', bets: Object.fromEntries(own.map(i => [i, { main: 25 }])), plan: past(),
  round: { id: 'round-a', phase: 'insurance', active: 0, holeDraw: 20, hands: cards(own), dealer: [{ r: 'A', s: 'D', shoeDraw: 1 }], legalActions: [] } });
  s.me.insuranceDue = true; return s; };
const settled = (own, version) => tableSnapshot({ version, own, phase: 'settled', bets: Object.fromEntries(own.map(i => [i, { main: 25 }])), plan: past(),
  lastSettlement: { roundId: 'round-a', returned: 50, hands: own.map(box => ({ box })) },
  round: { id: 'round-a', phase: 'settled', active: 0, holeDraw: 20, hands: cards(own), dealer: [{ r: '9', s: 'D', shoeDraw: 1 }, { r: '8', s: 'C', shoeDraw: 20 }], legalActions: [] } });

test('Chrome shared-table layout: no control covers another at 1440, 1920, 390 and 320 px with one, two and seven own seats', { skip, timeout: 300000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  for (const viewport of viewports) {
    const phone = viewport.width < 860;
    for (const [label, snapshot, plane] of [
      ['one own seat with a bet', tableSnapshot({ own: [3], bets: { 3: { main: 25 } }, others: { 1: 'bob' } })],
      ['two own neighbouring seats', tableSnapshot({ own: [2, 3], bets: { 2: { main: 10 }, 3: { main: 25, pp: 5 } } })],
      ['seven own seats', tableSnapshot({ own: [0, 1, 2, 3, 4, 5, 6], bets: { 3: { main: 25 } } })],
      ['no own seat', tableSnapshot({ others: { 1: 'bob', 5: 'carol' } })],
      ['a decision', decision([3])],
      ['seven own seats in a round', decision([0, 1, 2, 3, 4, 5, 6])],
      ['insurance', insurance([3], 2)],
      ['a settled round', settled([3], 2)],
      ['two own seats on a composition plane', tableSnapshot({ own: [2, 3], bets: { 3: { main: 25 } } }), 'film'],
      ['a decision on a composition plane', decision([3]), 'film'],
    ]) {
      const { page, context, show } = await fixture.open(viewport, { plane });
      await show(snapshot);
      assert.deepEqual(await page.evaluate(measureLayout), [], `${viewport.width}x${viewport.height}, ${label}`);
      const state = await page.evaluate(() => ({
        leave: [...document.querySelectorAll('#shared-room-controls button')].find(node => node.textContent === 'Lämna platser')?.checkVisibility() ?? false,
        windows: document.getElementById('shared-room-window').checkVisibility(),
        windowText: document.getElementById('shared-room-window').selectedOptions[0]?.textContent,
        decisionBars: [...document.querySelectorAll('[data-act="hit"]')].filter(node => node.checkVisibility()).length,
        nativeBar: document.getElementById('actions').checkVisibility(),
        pause: document.getElementById('pitboss').checkVisibility(),
        heading: document.getElementById('table-profile').textContent,
      }));
      // "Visa platser" only where the table shows three boxes; "Lämna platser" only for a seated player.
      assert.equal(state.windows, phone, `${viewport.width}: seat window chooser`);
      if (phone) assert.match(state.windowText, /^Visa platser \d–\d$/);
      assert.equal(state.leave, snapshot.me.seats.length > 0, `${viewport.width}, ${label}: Lämna platser`);
      assert.equal(state.pause, true, `${viewport.width}, ${label}: Ta paus is reachable in every phase`);
      assert.equal(state.heading, 'Privé Blackjack');
      // K04 F15: one decision panel, never the native mini bar beside it.
      assert.equal(state.nativeBar, false);
      assert.equal(state.decisionBars, label.includes('decision') || label.includes('in a round') ? 1 : 0, `${viewport.width}, ${label}: decision panels`);
      if (state.decisionBars) {
        const covered = await page.evaluate(() => {
          const panel = document.getElementById('actions-top').getBoundingClientRect();
          return [...document.querySelectorAll('#local-card-overlay .card-face')].map(node => node.getBoundingClientRect())
            .filter(card => card.width > 0 && Math.min(card.right, panel.right) > Math.max(card.left, panel.left) && Math.min(card.bottom, panel.bottom) > Math.max(card.top, panel.top)).length;
        });
        assert.equal(covered, 0, `${viewport.width}, ${label}: the decision panel covers no card`);
      }
      await context.close();
    }
  }
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
});

// Review of #536: sit, bet, get ready, decide, insure and settle through real clicks (Playwright refuses a click that
// lands on another element), the 24-hour pause in every phase, and cards that stay put between phases on a plane.
test('Chrome shared-table play path: every phase\'s controls take a real click and the confirmed 24-hour pause works mid-round', { skip, timeout: 300000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    for (const plane of [null, 'film']) {
      const { page, context, show } = await fixture.open(viewport, { plane });
      const last = () => page.evaluate(() => window.fixture.sent.at(-1));
      const button = name => page.getByRole('button', { name, exact: true });
      // The 24-hour pause asks first: Avbryt and Escape send nothing and give focus back, Ja, pausa sends it.
      const pauses = async phase => {
        const before = await page.evaluate(() => window.fixture.sent.length), dialog = page.getByRole('dialog', { name: 'Pausa spelet i 24 timmar?' });
        await button('Ta paus i 24 timmar').click(); await dialog.waitFor();
        assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Avbryt', `${viewport.width} ${phase}: focus starts on Avbryt`);
        assert.match(await dialog.textContent(), /Du kan inte spela vid bordet förrän pausen gått ut./);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        await button('Ta paus i 24 timmar').click(); await button('Avbryt').click(); await dialog.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.fixture.sent.length), before, `${viewport.width} ${phase}: cancel sends nothing`);
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'pitboss', `${viewport.width} ${phase}: focus returns to the pause`);
        await button('Ta paus i 24 timmar').click(); await button('Ja, pausa').click();
        assert.equal((await last()).op, 'pause', `${viewport.width} ${phase}: pause`);
      };
      const where = `${viewport.width}${plane ? ' plane' : ''}`;
      await show(tableSnapshot({ version: 1, others: { 1: 'bob' } }));
      await button('Välj plats 4').click(); assert.deepEqual((await last()).seats, [3], `${where}: join`);
      await show(tableSnapshot({ version: 2, own: [3] }));
      await button('Plats 4, huvudinsats, 0').click(); assert.deepEqual(await last(), { op: 'bet', windowId: 'window-a', seat: 3, field: 'main', chip: 5 });
      await pauses('betting');
      await show(tableSnapshot({ version: 3, own: [3], bets: { 3: { main: 5 } } }));
      await button('Plats 4, par, 0').click(); assert.equal((await last()).field, 'pp');
      await button('Redo').click(); assert.equal((await last()).op, 'ready', `${where}: ready`);
      const transform = () => page.evaluate(() => document.getElementById('local-card-plane').getAttribute('transform'));
      await show(decision([3], 4));
      const dealt = await transform();
      await page.locator('#actions-top [data-act="hit"]').click(); assert.equal((await last()).action, 'hit', `${where}: hit`);
      await pauses('decision');
      await show(insurance([3], 5));
      await button('Ja').click(); assert.deepEqual([(await last()).op, (await last()).take], ['insurance', true], `${where}: insurance`);
      await show(settled([3], 6));
      await button('Nästa runda').click(); assert.equal((await last()).op, 'next', `${where}: next round`);
      await pauses('settlement');
      // K04 review (3): the cards' plane is the same in every phase of the round.
      assert.equal(await transform(), dealt, `${where}: the cards stay put between phases`);
      assert.deepEqual(await page.evaluate(measureLayout), [], `${where}: settled`);
      await context.close();
    }
  }
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
});

// Review of #536 (4): choosing another own seat keeps focus on its circle; a phone's dock hands focus on when it empties.
test('Chrome shared-table focus: choosing another own seat and a round that empties the dock never drop focus to the page', { skip, timeout: 120000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { page, context, show } = await fixture.open(viewport);
    await show(tableSnapshot({ version: 1, own: [2, 3], bets: { 2: { main: 10 } } }));
    const other = page.getByRole('button', { name: 'Plats 4, din plats', exact: true });
    await other.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.seat[data-seat="3"]').classList.contains('primary'));
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Plats 4, din plats', `${viewport.width}: circle keeps focus`);
    assert.equal(await other.getAttribute('aria-disabled'), 'true');
    if (viewport.width < 860) {
      await page.getByRole('button', { name: 'Plats 4, huvudinsats, 0', exact: true }).focus();
      await show(decision([2, 3], 2));
      assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY', 'the emptied dock hands focus on');
    }
    await context.close();
  }
});
