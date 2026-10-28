// Real Chrome on the built shared-table page (test/fixtures/shared-room-layout-page.mjs): K04 F12-F15 at the
// sizes where they were found. Every visible control must be the topmost element at its centre, no two controls
// overlap, the status line covers none, and the page never scrolls sideways; with one, two and seven own seats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openLayoutFixture, tableSnapshot, measureLayout } from './fixtures/shared-room-layout-page.mjs';

const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const viewports = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 320, height: 568 }];
const decision = own => { const now = Date.now(); return tableSnapshot({ version: 2, own, phase: 'round', bets: Object.fromEntries(own.map(i => [i, { main: 25 }])),
  plan: { turnAt: now - 1000, endAt: now - 500 },
  round: { id: 'round-a', phase: 'decisions', active: 0, holeDraw: 20,
    hands: own.map((box, i) => ({ box, cards: [{ r: 'K', s: 'S', shoeDraw: 2 + i * 2 }, { r: '7', s: 'H', shoeDraw: 3 + i * 2 }] })),
    dealer: [{ r: '9', s: 'D', shoeDraw: 1 }], legalActions: ['hit', 'stand', 'double'] } }); };

test('Chrome shared-table layout: no control covers another at 1440, 1920, 390 and 320 px with one, two and seven own seats', {
  skip: !browserModule && 'Browser layout NOT RUN: set CROUPIER_BROWSER_FIXTURE_MODULE to installed Playwright.', timeout: 240000,
}, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL });
  t.after(() => fixture.close());
  for (const viewport of viewports) {
    const phone = viewport.width < 860;
    for (const [label, snapshot] of [
      ['one own seat with a bet', tableSnapshot({ own: [3], bets: { 3: { main: 25 } }, others: { 1: 'bob' } })],
      ['two own neighbouring seats', tableSnapshot({ own: [2, 3], bets: { 2: { main: 10 }, 3: { main: 25, pp: 5 } } })],
      ['seven own seats', tableSnapshot({ own: [0, 1, 2, 3, 4, 5, 6], bets: { 3: { main: 25 } } })],
      ['no own seat', tableSnapshot({ others: { 1: 'bob', 5: 'carol' } })],
      ['a decision', decision([3])],
    ]) {
      const { page, context, show } = await fixture.open(viewport);
      await show(snapshot);
      assert.deepEqual(await page.evaluate(measureLayout), [], `${viewport.width}x${viewport.height}, ${label}`);
      const state = await page.evaluate(() => ({
        leave: [...document.querySelectorAll('#shared-room-controls button')].find(node => node.textContent === 'Lämna platser')?.checkVisibility() ?? false,
        windows: document.getElementById('shared-room-window').checkVisibility(),
        windowText: document.getElementById('shared-room-window').selectedOptions[0]?.textContent,
        decisionBars: [...document.querySelectorAll('[data-act="hit"]')].filter(node => node.checkVisibility()).length,
        nativeBar: document.getElementById('actions').checkVisibility(),
      }));
      // "Visa platser" only where the table shows three boxes; "Lämna platser" only for a seated player.
      assert.equal(state.windows, phone, `${viewport.width}: seat window chooser`);
      if (phone) assert.match(state.windowText, /^Visa platser \d–\d$/);
      assert.equal(state.leave, snapshot.me.seats.length > 0, `${viewport.width}, ${label}: Lämna platser`);
      // K04 F15: one decision panel, never the native mini bar beside it.
      assert.equal(state.nativeBar, false);
      assert.equal(state.decisionBars, label === 'a decision' ? 1 : 0, `${viewport.width}, ${label}: decision panels`);
      if (label === 'a decision') {
        const covered = await page.evaluate(() => {
          const panel = document.getElementById('actions-top').getBoundingClientRect();
          return [...document.querySelectorAll('#local-card-overlay .playing-card, #local-card-overlay .card-face')].map(node => node.getBoundingClientRect())
            .filter(card => card.width > 0 && Math.min(card.right, panel.right) > Math.max(card.left, panel.left) && Math.min(card.bottom, panel.bottom) > Math.max(card.top, panel.top)).length;
        });
        assert.equal(covered, 0, `${viewport.width}: the decision panel covers no card`);
      }
      await context.close();
    }
  }
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
});
