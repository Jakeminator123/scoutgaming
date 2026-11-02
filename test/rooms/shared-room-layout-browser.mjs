// Real Chrome on the built shared-table page (test/rooms/fixtures/shared-room-layout-page.mjs): K04 F12-F15 at the
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
  lastSettlement: { roundId: 'round-a', returned: 50, currency: 'USD', hands: own.map(box => ({ box })) },
  round: { id: 'round-a', phase: 'settled', active: 0, holeDraw: 20, hands: cards(own), dealer: [{ r: '9', s: 'D', shoeDraw: 1 }, { r: '8', s: 'C', shoeDraw: 20 }], legalActions: [] } });

test('Chrome card projection: player and dealer stay at their screen anchors throughout table-local and legacy plane changes', { skip, timeout: 30000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  const { page } = await fixture.open({ width: 1498, height: 1092 });
  const result = await page.evaluate(async () => {
    const { createLocalCardOverlay } = await import('/local-card-overlay.mjs');
    const { calibration } = await import('/packages/presentation/contracts/calibration.mjs');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;width:1498px;height:1092px;pointer-events:none';
    document.body.append(host);
    const overlay = createLocalCardOverlay(host);
    host.firstElementChild.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    const legacy = { x: 478.833, y: 65.704, scale: .5003086, adjusted: false };
    const table = { ...legacy, scale: .6194297, adjusted: true,
      positions: Object.fromEntries(Object.entries(calibration.positions).map(([seat, p]) =>
        [seat, { cx: p.cx * legacy.scale / .6194297, cy: p.cy * legacy.scale / .6194297 }])) };
    const measure = () => [...host.querySelectorAll('.playing-card')].map(card => {
      const rect = card.querySelector('.card-face > rect').getBoundingClientRect();
      return { draw: card.dataset.draw, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    try {
      overlay.setProjection(table, 1498, 1092);
      overlay.restore({ phase: 'decisions', active: 0, holeDraw: null,
        dealer: [{ r: '9', s: '♦', shoeDraw: 1 }],
        hands: [{ box: 3, cards: [{ r: 'K', s: '♠', shoeDraw: 2 }] }] });
      const initial = measure(), samples = [];
      // Both directions, every painted frame and past the former 220 ms
      // animation: no delayed transform may restore the old local position.
      for (const projection of [legacy, table]) {
        overlay.setProjection(projection, 1498, 1092);
        samples.push(measure());
        const start = performance.now();
        do {
          await new Promise(requestAnimationFrame);
          samples.push(measure());
        } while (performance.now() - start < 300);
      }
      return { initial, samples };
    } finally { overlay.close(); host.remove(); }
  });
  assert.equal(result.initial.length, 2);
  assert.ok(result.samples.length > 4, 'sample both plane changes across animation frames');
  for (const sample of result.samples) for (const expected of result.initial) {
    const actual = sample.find(card => card.draw === expected.draw);
    assert.ok(actual, `draw ${expected.draw} remains visible`);
    assert.ok(Math.abs(actual.x - expected.x) < .01 && Math.abs(actual.y - expected.y) < .01,
      `draw ${expected.draw} moved from (${expected.x}, ${expected.y}) to (${actual.x}, ${actual.y})`);
  }
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
});

test('Chrome shared-table layout: no control covers another at 1440, 1920, 390 and 320 px with one, two and seven own seats', { skip, timeout: 300000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  for (const viewport of viewports) {
    const phone = viewport.width < 860;
    for (const [label, snapshot, plane] of [
      ['one own seat with a bet', tableSnapshot({ own: [3], bets: { 3: { main: 25 } }, others: { 1: 'bob' } })],
      ['legacy wallet without currency', tableSnapshot({ own: [3], currency: null, bets: { 3: { main: 25 } } })],
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
        leave: [...document.querySelectorAll('#shared-room-controls button')].find(node => node.textContent === 'Sluta spela')?.checkVisibility() ?? false,
        windows: document.getElementById('shared-room-window').checkVisibility(),
        windowText: document.getElementById('shared-room-window').selectedOptions[0]?.textContent,
        decisionBars: [...document.querySelectorAll('[data-act="hit"]')].filter(node => node.checkVisibility()).length,
        nativeBar: document.getElementById('actions').checkVisibility(),
        pause: document.getElementById('pitboss').checkVisibility(),
        heading: document.getElementById('table-profile').textContent,
        chat: document.querySelector('#shared-room-controls .room-chat-toggle')?.checkVisibility() ?? false,
      }));
      // The folded chat is one of the seat controls, so measureLayout above proves it covers nothing (PR 4a fix).
      assert.equal(state.chat, true, `${viewport.width}, ${label}: Chatt sits with the seat controls`);
      // "Bordsvy" only where the table shows three boxes; "Sluta spela" only for a seated player.
      assert.equal(state.windows, phone, `${viewport.width}: seat window chooser`);
      if (phone) assert.match(state.windowText, /^Bordsvy \d–\d$/);
      assert.equal(state.leave, snapshot.me.seats.length > 0, `${viewport.width}, ${label}: Sluta spela`);
      assert.equal(state.pause, true, `${viewport.width}, ${label}: Ta paus is reachable in every phase`);
      assert.equal(state.heading, 'Privé Blackjack');
      // K04 F15: one decision panel, never the native mini bar beside it.
      assert.equal(state.nativeBar, false);
      assert.equal(state.decisionBars, label.includes('decision') || label.includes('in a round') ? 1 : 0, `${viewport.width}, ${label}: decision panels`);
      if (state.decisionBars) {
        const covered = await page.evaluate(() => {
          const panel = document.getElementById('actions-top').getBoundingClientRect();
          return [...document.querySelectorAll('#local-card-overlay .card-face > rect')].map(node => node.getBoundingClientRect())
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
      // The opened chat is an overlay with its own close; Escape closes it too, and focus returns to Chatt.
      await page.getByRole('button', { name: /^Chatt/ }).click();
      await page.getByRole('textbox', { name: 'Meddelande till dealern' }).waitFor();
      await button('Stäng chatten').click(); await page.locator('#shared-room-chat-body').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: /^Chatt/ }).click(); await page.keyboard.press('Escape');
      await page.locator('#shared-room-chat-body').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.activeElement?.className), 'room-chat-toggle', `${where}: focus returns to Chatt`);
      await button('Välj satsningsruta 4').click(); assert.deepEqual((await last()).seats, [3], `${where}: join`);
      await show(tableSnapshot({ version: 2, own: [3] }));
      await button('Satsningsruta 4, huvudinsats, 0 USD').click(); assert.deepEqual(await last(), { op: 'bet', windowId: 'window-a', seat: 3, field: 'main', chip: 5 });
      await pauses('betting');
      await show(tableSnapshot({ version: 3, own: [3], bets: { 3: { main: 5 } } }));
      await button('Satsningsruta 4, par, 0 USD').click(); assert.equal((await last()).field, 'pp');
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
    const other = page.getByRole('button', { name: 'Välj satsningsruta 4, din ruta', exact: true });
    await other.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.seat[data-seat="3"]').classList.contains('primary'));
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Välj satsningsruta 4, din ruta', `${viewport.width}: circle keeps focus`);
    assert.equal(await other.getAttribute('aria-disabled'), 'true');
    if (viewport.width < 860) {
      await page.getByRole('button', { name: 'Satsningsruta 4, huvudinsats, 0 USD', exact: true }).focus();
      await show(decision([2, 3], 2));
      assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY', 'the emptied dock hands focus on');
    }
    await context.close();
  }
});

test('Chrome betting boxes: selection never bets or moves the view; the dock bets on every available box and respects a competing owner', { skip, timeout: 120000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const { page, context, show } = await fixture.open(viewport, { plane: 'table' });
    let version = 1; const own = [3], bets = {};
    await show(tableSnapshot({ version, own, bets }));
    const picker = page.getByLabel('Välj satsningsruta', { exact: true });
    const state = () => page.evaluate(() => ({
      sent: window.fixture.sent.length, focus: window.fixture.app.controller.state.focusSeat,
      selected: window.fixture.app.controller.state.betSeat,
      own: window.fixture.app.controller.state.snapshot.me.seats,
      visible: [...document.querySelectorAll('.seat:not([hidden])')].map(node => Number(node.dataset.seat)),
    }));
    const initial = await state();
    for (const seat of [3, 0, 1, 2, 4, 5, 6]) {
      const before = await state();
      await picker.selectOption(String(seat));
      assert.deepEqual(await state(), { ...before, selected: seat }, `${viewport.width}: selection changes no ownership, bet or view`);
      assert.deepEqual(await page.evaluate(measureLayout), [], `${viewport.width}: free or owned box ${seat + 1} dock`);
      await page.getByRole('button', { name: `Satsningsruta ${seat + 1}, huvudinsats, 0 USD`, exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.fixture.sent.at(-1)), { op: 'bet', windowId: 'window-a', seat, field: 'main', chip: 5 });
      assert.deepEqual((await state()).own, before.own, 'the command reply cannot claim a box locally');
      if (!own.includes(seat)) own.push(seat); own.sort((a, b) => a - b); bets[seat] = { main: 5 };
      await show(tableSnapshot({ version: ++version, own, bets }));
      const after = await state();
      assert.deepEqual(after.visible, initial.visible); assert.equal(after.focus, initial.focus);
      assert.equal(after.selected, seat, 'the dock stays on the chosen box after authoritative ownership');
    }
    assert.deepEqual((await state()).own, [0, 1, 2, 3, 4, 5, 6], 'one player can bet all seven boxes');
    // A freshly free selection can be taken by another player before a bet.
    await show(tableSnapshot({ version: ++version, own: [3], bets: { 3: { main: 5 }, 6: { main: 5 } }, others: { 6: 'bob' } }));
    await picker.selectOption('5');
    const beforeRace = await state();
    await show(tableSnapshot({ version: ++version, own: [3], bets: { 3: { main: 5 }, 5: { main: 10 }, 6: { main: 5 } }, others: { 5: 'carol', 6: 'bob' } }));
    assert.equal((await state()).selected, 3, 'a competing authoritative owner closes the selected free dock');
    assert.equal(await picker.locator('option[value="5"]').isDisabled(), true);
    assert.equal(await picker.locator('option[value="6"]').isDisabled(), true);
    await page.evaluate(() => window.fixture.app.controller.dispatch('bet', { seat: 5, field: 'main' }));
    assert.equal((await state()).sent, beforeRace.sent, 'no command can target another player');
    assert.deepEqual(await page.evaluate(measureLayout), [], `${viewport.width}: ownership changed`);
    // Losing the last unbet choice leaves membership and the viewing position intact.
    await show(tableSnapshot({ version: ++version, own: [], active: true, bets: { 3: { main: 5 } }, others: { 3: 'bob', 5: 'carol' } }));
    await picker.selectOption('5');
    assert.equal((await state()).sent, beforeRace.sent, 'choosing another member\'s empty box sends nothing');
    assert.equal((await state()).focus, initial.focus);
    await page.getByRole('button', { name: 'Satsningsruta 6, huvudinsats, 0 USD', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.fixture.sent.at(-1)), { op: 'bet', windowId: 'window-a', seat: 5, field: 'main', chip: 5 });
    assert.deepEqual((await state()).own, [], 'the lost last box does not require another join');
    assert.equal(await page.getByRole('button', { name: 'Sluta spela', exact: true }).isEnabled(), true);
    assert.deepEqual(await page.evaluate(measureLayout), [], `${viewport.width}: active member without boxes`);
    await context.close();
  }
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
});

// Platsbrickorna (2026-10-29): on a table with published geometry the seat circle stands centred under the box where
// the cards land, just below the hand total, in a 16:9, 16:10 and 21:9 window and on a phone (box 4 in the middle of 3-5).
test('Chrome shared-table seat circles: centred under the cards\' box at 16:9, 16:10, 21:9 and on a phone', { skip, timeout: 180000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  for (const viewport of [{ width: 1600, height: 900 }, { width: 1280, height: 800 }, { width: 2560, height: 1080 }, { width: 390, height: 844 }]) {
    const { page, context, show } = await fixture.open(viewport, { plane: 'table' });
    await show(decision([3]));
    const where = `${viewport.width}x${viewport.height}`;
    const m = await page.evaluate(() => {
      const box = rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, x: rect.left + rect.width / 2 });
      const scene = document.getElementById('scene').getBoundingClientRect(), stage = window.fixture.stage();
      return { circle: box(document.querySelector('.seat[data-seat="3"] .seat-shared-join').getBoundingClientRect()),
        total: box(document.querySelector('#local-card-overlay .card-totals [data-seat="4"]').getBoundingClientRect()),
        landing: scene.left + stage.x + 540 * stage.scale };
    });
    assert.ok(Math.abs(m.circle.x - m.landing) <= 1, `${where}: the circle is centred on box 4 (${m.circle.x} vs ${m.landing})`);
    assert.ok(Math.abs(m.total.x - m.landing) <= 1, `${where}: the hand total is centred on box 4`);
    const gap = m.circle.top - m.total.bottom;
    assert.ok(gap >= 6 && gap <= 12, `${where}: the circle is ${gap.toFixed(1)} px below the hand total`);
    assert.deepEqual(await page.evaluate(measureLayout), [], `${where}: no control covers another`);
    await context.close();
  }
});

// The tall live window used to strand the controls far below the cards. The dock
// also stays clickable on a small phone; pending commands preserve the decision row.
test('Chrome shared-table dock: labelled bets, split clearance and stable pending decisions', { skip, timeout: 180000 }, async t => {
  const fixture = await openLayoutFixture(browserModule, { channel });
  t.after(() => fixture.close());
  for (const viewport of [{ width: 1690, height: 1348 }, { width: 2288, height: 1493 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const { page, context, show, delay } = await fixture.open(viewport, { plane: 'table' });
    await show(tableSnapshot({ own: [3, 4], bets: { 3: { main: 5 }, 4: { main: 10 } } }));
    assert.deepEqual(await page.evaluate(measureLayout), [], `${viewport.width}: betting controls`);
    assert.match(await page.locator('#shared-room-dock').textContent(), /Ruta 4/);
    await page.getByRole('button', { name: 'Välj satsningsruta 5, din ruta', exact: true }).click();
    assert.match(await page.locator('#shared-room-dock').textContent(), /Ruta 5/);
    await context.close();
    // Restore an authoritative mid-round snapshot, including a split at box 4.
    const game = await fixture.open(viewport, { plane: 'table' });
    const snapshot = decision([3, 4]);
    snapshot.round.hands.splice(1, 0, { box: 3, cards: [{ r: '8', s: 'D', shoeDraw: 10 }, { r: '3', s: 'S', shoeDraw: 11 }] });
    await game.show(snapshot);
    assert.deepEqual(await game.page.evaluate(measureLayout), [], `${viewport.width}: split controls`);
    const geometry = await game.page.evaluate(() => {
      const rect = node => node.getBoundingClientRect();
      const circles = [...document.querySelectorAll('.seat:not([hidden]) .seat-shared-join')].map(rect);
      const ink = [...document.querySelectorAll('#local-card-overlay .card-totals [data-seat]')].map(rect);
      return { overlaps: circles.some(a => ink.some(b => Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)),
        gap: rect(document.getElementById('actions-top')).top-Math.max(...circles.map(r=>r.bottom)), cards: ink.length };
    });
    assert.ok(geometry.cards > 0, 'the clearance test measures actual restored cards');
    assert.equal(geometry.overlaps, false, `${viewport.width}: markers clear split hands and totals`);
    if(viewport.width>860)assert.ok(geometry.gap>=8&&geometry.gap<70, `${viewport.width}: decisions beside the hands (${geometry.gap})`);
    await game.delay(1200);
    await game.page.locator('#actions-top [data-act="hit"]').click();
    assert.equal(await game.page.locator('#actions-top').isVisible(), true, 'sending never removes the decision row');
    assert.equal(await game.page.locator('#actions-top [data-act="hit"]').isDisabled(), true, 'pending decisions remain server-gated');
    await game.context.close();
  }
  assert.deepEqual(fixture.unexpected, []); assert.deepEqual(fixture.pageErrors, []);
});
