// Real Chrome on the built shared-table page (test/fixtures/shared-room-layout-page.mjs): K10's H/S/D/P act only
// while a decision button has focus, send the same command as a click, and keep working from turn to turn because
// the view gives focus back after each snapshot, also when the button that had it is closed by the new turn.
// Builds on #550 (external draft), rewritten for #536's page.
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
  const { page, context, show, delay } = await fixture.open({ width: 1440, height: 900 });
  const sent = () => page.evaluate(() => window.fixture.sent.length);
  const last = () => page.evaluate(() => window.fixture.sent.at(-1));
  const focused = () => page.evaluate(() => [document.activeElement?.closest('#actions-top') !== null, document.activeElement?.dataset.act ?? document.activeElement?.tagName]);
  // A synthetic keydown on the focused element; returns whether the panel consumed it (preventDefault).
  const keydown = init => page.evaluate(init => { const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    if (init.alreadyHandled) event.preventDefault(); document.activeElement.dispatchEvent(event); return event.defaultPrevented; }, init);
  const hit = page.locator('#actions-top [data-act="hit"]'), double = page.locator('#actions-top [data-act="double"]');
  const command = (turnSeq, action) => ({ op: 'act', roundId: 'round-a', turnSeq, box: 3, handIndex: 0, action });
  let decided = 0;

  await show(turn({ version: 1 }));
  assert.deepEqual(await page.$$eval('#actions-top [data-act]', nodes => nodes.map(node => [node.dataset.act, node.getAttribute('aria-keyshortcuts'), node.title])),
    [['double', 'D', 'Kortkommando D'], ['hit', 'H', 'Kortkommando H'], ['stand', 'S', 'Kortkommando S'], ['split', 'P', 'Kortkommando P']]);
  // Without focus in the panel a letter is the page's: nothing is sent, also with focus on other visible table controls.
  await page.keyboard.press('h');
  await page.getByRole('button', { name: 'Lämna platser', exact: true }).focus(); assert.deepEqual(await focused(), [false, 'BUTTON']); await page.keyboard.press('s');
  await page.getByRole('button', { name: 'Ta paus i 24 timmar', exact: true }).focus(); assert.deepEqual(await focused(), [false, 'BUTTON']); await page.keyboard.press('d');
  assert.equal(await sent(), 0, 'a letter outside the decision panel decides nothing');
  // Modifiers, a held key, an input method's composition or key code, and a key someone else handled leave the key alone.
  await hit.focus(); assert.deepEqual(await focused(), [true, 'hit']);
  for (const chord of ['Shift+H', 'Alt+h', 'Control+h', 'Meta+h']) await page.keyboard.press(chord);
  const ignored = [];
  for (const init of [{ key: 's', repeat: true }, { key: 's', isComposing: true }, { key: 's', keyCode: 229 }, { key: 's', alreadyHandled: true }]) ignored.push(await keydown(init));
  assert.deepEqual(ignored, [false, false, false, true], 'only the key handled before the panel stays prevented');
  assert.equal(await sent(), 0, 'modifiers, repeat, composition and a handled key decide nothing');
  // P is split; split is not legal here, so the key does nothing and is not consumed. Nor is a letter without a decision.
  assert.equal(await keydown({ key: 'p' }), false); assert.equal(await keydown({ key: 'x', code: 'KeyH' }), false, 'a typed Latin letter decides, never the key under it');
  assert.equal(await sent(), 0, 'an illegal action is never sent');

  // With focus on any decision button, each key sends that button's command with the server's round and turn,
  // and the panel consumes the key.
  assert.equal(await keydown({ key: 'h' }), true, 'a decision consumes its key'); assert.deepEqual(await last(), command(0, 'hit')); decided++;
  // The next snapshot disables and re-enables the panel; the view gives focus back, so the next key works too.
  await show(turn({ version: 2, turnSeq: 1, legalActions: ['hit', 'stand', 'double', 'split'] }));
  assert.deepEqual(await focused(), [true, 'hit'], 'focus returns to the decision panel');
  await page.keyboard.press('p'); assert.deepEqual(await last(), command(1, 'split')); decided++;
  await show(turn({ version: 3, turnSeq: 2 }));
  await page.keyboard.press('d'); assert.deepEqual(await last(), command(2, 'double')); decided++;
  await show(turn({ version: 4, turnSeq: 3 }));
  await page.keyboard.press('s'); assert.deepEqual(await last(), command(3, 'stand')); decided++;
  // A layout without Latin letters types none (Cyrillic р on the H key); then the physical key stands in.
  await show(turn({ version: 5, turnSeq: 4 }));
  assert.equal(await keydown({ key: 'р', code: 'KeyS' }), true); assert.deepEqual(await last(), command(4, 'stand')); decided++;
  assert.equal(await sent(), decided);

  // The button that had focus can be closed by the new turn: Double is gone after a hit. With the reply delayed,
  // the pending command first closes every button (Chrome drops focus to the page), then the new snapshot keeps
  // Double closed. Focus must land on an open decision button, else the next key is lost.
  await delay(150);
  await show(turn({ version: 6, turnSeq: 5 }));
  await double.focus(); assert.deepEqual(await focused(), [true, 'double']);
  await page.keyboard.press('h');
  await page.waitForFunction(count => window.fixture.sent.length === count, decided + 1); decided++;
  assert.deepEqual(await last(), command(5, 'hit'));
  await show(turn({ version: 7, turnSeq: 6, legalActions: ['hit', 'stand'] }));
  assert.equal(await double.isDisabled(), true);
  assert.deepEqual(await focused(), [true, 'hit'], 'a closed decision button hands focus to the panel\'s first open one');
  await page.keyboard.press('s');
  await page.waitForFunction(count => window.fixture.sent.length === count, decided + 1); decided++;
  assert.deepEqual(await last(), command(6, 'stand'));
  await delay(0);

  // Another player's turn hides the panel: focus leaves it and no key reaches it, not even one aimed at its button.
  await show(turn({ version: 8, turnSeq: 7, active: 1 }));
  assert.equal(await page.locator('#actions-top').isHidden(), true);
  for (const key of ['h', 's', 'd', 'p']) await page.keyboard.press(key);
  assert.equal(await page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true });
    document.querySelector('#actions-top [data-act="hit"]').dispatchEvent(event); return event.defaultPrevented; }), false);
  // The 24-hour pause dialog is modal: with it open, a letter never reaches the table behind it.
  await show(turn({ version: 9, turnSeq: 8 }));
  await hit.focus();
  await page.getByRole('button', { name: 'Ta paus i 24 timmar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Pausa spelet i 24 timmar?' }).waitFor();
  await page.keyboard.press('h'); await page.keyboard.press('Escape');
  assert.equal(await sent(), decided, 'no decision on another player\'s turn or behind the pause dialog');
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
  await context.close();
});
