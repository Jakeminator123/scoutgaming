// Real Chrome on the built shared-table page (test/fixtures/shared-room-layout-page.mjs): K10's H/S/D/P act only
// while a decision button has focus, send the same command as a click, and keep working from turn to turn because
// the view gives focus back after each snapshot. Builds on #550 (external draft), rewritten for #536's page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openLayoutFixture, tableSnapshot } from './fixtures/shared-room-layout-page.mjs';

const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE, channel = process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL;
const skip = !browserModule && 'Browser shortcuts NOT RUN: set CROUPIER_BROWSER_FIXTURE_MODULE to installed Playwright.';
const past = () => { const now = Date.now(); return { turnAt: now - 3000, endAt: now - 1000 }; };
// The player's box 4 (index 3) decides; `active` 1 hands the turn to bob's box 2 (index 1) instead.
const turn = ({ version, turnSeq = 0, legalActions = ['hit', 'stand', 'double'], active = 0 }) => ({
  ...tableSnapshot({ version, own: [3], others: { 1: 'bob' }, phase: 'round', bets: { 1: { main: 10 }, 3: { main: 25 } }, plan: past(),
    round: { id: 'round-a', phase: 'decisions', active, holeDraw: 20, legalActions, dealer: [{ r: '9', s: 'D', shoeDraw: 1 }],
      hands: [{ box: 3, cards: [{ r: '8', s: 'S', shoeDraw: 2 }, { r: '3', s: 'H', shoeDraw: 4 }] },
        { box: 1, cards: [{ r: 'K', s: 'C', shoeDraw: 3 }, { r: '6', s: 'D', shoeDraw: 5 }] }] } }), turnSeq });

test('Chrome shared-table shortcuts: H/S/D/P act through the decision panel only while one of its buttons has focus', { skip, timeout: 120000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  const { page, context, show } = await fixture.open({ width: 1440, height: 900 });
  const sent = () => page.evaluate(() => window.fixture.sent.length);
  const last = () => page.evaluate(() => window.fixture.sent.at(-1));
  const hit = page.locator('#actions-top [data-act="hit"]');
  const command = (turnSeq, action) => ({ op: 'act', roundId: 'round-a', turnSeq, box: 3, handIndex: 0, action });

  await show(turn({ version: 1 }));
  assert.deepEqual(await page.$$eval('#actions-top [data-act]', nodes => nodes.map(node => [node.dataset.act, node.getAttribute('aria-keyshortcuts'), node.title])),
    [['double', 'D', 'Kortkommando D'], ['hit', 'H', 'Kortkommando H'], ['stand', 'S', 'Kortkommando S'], ['split', 'P', 'Kortkommando P']]);
  // Without focus in the panel a letter is the page's: nothing is sent, also with focus on another table control.
  await page.keyboard.press('h');
  await page.locator('#shared-room-window').focus(); await page.keyboard.press('s');
  await page.getByRole('button', { name: 'Ta paus i 24 timmar', exact: true }).focus(); await page.keyboard.press('d');
  assert.equal(await sent(), 0, 'a letter outside the decision panel decides nothing');
  // Modifiers, a held key and an input method's composition leave the key to the browser.
  await hit.focus();
  for (const chord of ['Shift+H', 'Alt+h', 'Control+h']) await page.keyboard.press(chord);
  const ignored = await page.evaluate(() => ['repeat', 'isComposing'].map(flag => {
    const event = new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true, [flag]: true });
    document.activeElement.dispatchEvent(event); return event.defaultPrevented; }));
  assert.deepEqual(ignored, [false, false]); assert.equal(await sent(), 0, 'modifiers, repeat and composition decide nothing');
  // P is split; split is not legal here, so the key does nothing and is not consumed.
  const split = await page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event); return event.defaultPrevented; });
  assert.equal(split, false); assert.equal(await sent(), 0, 'an illegal action is never sent');

  // With focus on any decision button, each key sends that button's command with the server's round and turn.
  await page.keyboard.press('h'); assert.deepEqual(await last(), command(0, 'hit'));
  // The next snapshot disables and re-enables the panel; the view gives focus back, so the next key works too.
  await show(turn({ version: 2, turnSeq: 1, legalActions: ['hit', 'stand', 'double', 'split'] }));
  assert.equal(await page.evaluate(() => document.activeElement?.closest('#actions-top') !== null), true, 'focus returns to the decision panel');
  await page.keyboard.press('p'); assert.deepEqual(await last(), command(1, 'split'));
  await show(turn({ version: 3, turnSeq: 2 }));
  await page.keyboard.press('d'); assert.deepEqual(await last(), command(2, 'double'));
  await show(turn({ version: 4, turnSeq: 3 }));
  await page.keyboard.press('s'); assert.deepEqual(await last(), command(3, 'stand'));
  const decided = await sent();
  assert.equal(decided, 4);

  // Another player's turn hides the panel: focus leaves it and no key reaches it.
  await show(turn({ version: 5, turnSeq: 4, active: 1 }));
  assert.equal(await page.locator('#actions-top').isHidden(), true);
  for (const key of ['h', 's', 'd', 'p']) await page.keyboard.press(key);
  // The 24-hour pause dialog is modal: with it open, a letter never reaches the table behind it.
  await show(turn({ version: 6, turnSeq: 5 }));
  await hit.focus();
  await page.getByRole('button', { name: 'Ta paus i 24 timmar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Pausa spelet i 24 timmar?' }).waitFor();
  await page.keyboard.press('h'); await page.keyboard.press('Escape');
  assert.equal(await sent(), decided, 'no decision on another player\'s turn or behind the pause dialog');
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
  await context.close();
});
