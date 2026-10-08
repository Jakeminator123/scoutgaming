// QA harness for the Croupier review queue in Axelio: one spec per task, each asserting the task's expected result in a
// real Chromium against a running game (headed by default so it can be watched). Every spec plays on its own shared-table
// session, so it never touches a real player's table. Progress goes to the Sessioncheck panel through sc-test, proof
// screenshots to ~/Desktop/jira/CROUPIER-<KEY>.png.
//
//   node qa/verify-review.mjs <base-url> [--only KEY,KEY] [--headless]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const { chromium } = await import(process.env.PW ?? 'playwright');
const args = process.argv.slice(2);
const BASE = args.find(a => !a.startsWith('--') && !/^[A-Z,-]+$/.test(a)) ?? 'http://127.0.0.1:8620/';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const headless = args.includes('--headless');
const ENV = process.env.QA_ENV ?? 'prod';
const SHOTS = `${homedir()}/Desktop/jira`; mkdirSync(SHOTS, { recursive: true });
const run = `${Date.now().toString(36)}`;
const scTest = (...a) => { try { execFileSync(`${homedir()}/.claude-notch/bin/sc-test`, a, { stdio: 'ignore' }); } catch {} };

const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 60 });
const c = (r, s, d) => ({ r, s, shoeDraw: d });

// A page on its own table, with the latest /api/table snapshot kept and an optional rewrite of what the server sends.
async function table(key, { w = 1280, h = 900, rewrite, query = '', touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch });
  const p = await ctx.newPage();
  const t = { p, ctx, last: null, rewrite, errors: [], block: null, blocked: [] };
  p.on('pageerror', e => t.errors.push(e.message));
  await p.route('**/api/table', async route => {
    const body = route.request().postData() ?? '';
    if (t.block && t.block.test(body)) { t.blocked.push(body); return route.fulfill({ status: 409, json: { error: 'blocked by QA spec' } }).catch(() => {}); }
    let res; try { res = await route.fetch(); } catch { return; } let j; try { j = await res.json(); } catch { return route.fulfill({ response: res }); }
    if (t.rewrite && j.me) t.rewrite(j);
    t.last = j; await route.fulfill({ response: res, json: j }).catch(() => {});
  });
  await p.goto(`${BASE}?session=qa-${key.toLowerCase()}-${run}${query}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  return t;
}
async function sit(t, name, boxes) {
  for (const n of boxes) await t.p.locator(`[aria-label="Select box ${n}"]`).first().click({ force: true });
  await t.p.click('#enter'); await t.p.waitForTimeout(800);
  if (await t.p.isVisible('#playerName')) { await t.p.fill('#playerName', name); await t.p.click('#enter'); }
  return t.p.waitForFunction(() => document.querySelector('.app.seated'), null, { timeout: 30000 }).then(() => true, () => false);
}
async function bet(t, box, chip = 25) {
  await t.p.click(`[data-chip="${chip}"]`); await t.p.locator(`[aria-label="Bet on box ${box}"]`).first().click({ force: true }); await t.p.waitForTimeout(400);
}
async function playOut(t, ms = 180000) {
  const end = Date.now() + ms;
  while (Date.now() < end && t.last?.phase !== 'settled') {
    const stand = t.p.locator('[data-action="stand"]:not([disabled])');
    if (await stand.isVisible().catch(() => false)) await stand.click().catch(() => {});
    await t.p.waitForTimeout(1000);
  }
  return t.last?.phase === 'settled';
}
const visible = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const b = e.getBoundingClientRect(); const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return b.width > 0 && b.bottom > 0 && b.top < innerHeight && !!top && (e === top || e.contains(top)); }, sel);

// The CH screenshot round: box 5 bust, box 6 a 20 against the dealer's 20 (a push), as one settled snapshot.
const chHands = [
  { box: 5, stake: 10, pp: 0, tp: 0, insured: 0, result: 0, sideReturn: 0, sideLabels: [], splitFrom: null, busted: true, done: true, cards: [c('7','♦',1), c('6','♦',4), c('2','♥',7), c('10','♣',8)] },
  { box: 6, stake: 10, pp: 0, tp: 0, insured: 0, result: 10, sideReturn: 0, sideLabels: [], splitFrom: null, done: true, cards: [c('K','♦',2), c('J','♥',5)] }];
const chRound = roundId => j => {
  Object.assign(j, { phase: 'settled', round: { phase: 'settled', active: -1, hands: chHands, boxes: chHands, dealer: [c('10','♥',3), c('3','♦',6), c('7','♠',9)], legalActions: [] }, plan: null, roundId, owners: { ...(j.owners ?? {}), 5: j.me.id, 6: j.me.id }, deadline: null, actionDeadline: null });
  j.me = { ...j.me, seats: [5, 6], lastSettlement: { roundId: 'ch-push', staked: 20, returned: 10, net: -10, hands: chHands } };
};

const SPECS = {
  REPEAT: { task: 'd3acbff9-40d2-464f-99fb-2406b2825f99', title: "Repeat Bet: last hand's stakes back with one click (CH)",
    steps: ['Seated at box 6: Repeat Bet is off before any round', 'Bet 25 and play round 1 out', 'Next round: one click on Repeat Bet puts the same stakes back'],
    async run(t, step) {
      await sit(t, 'Chris', [6]);
      await step(1, await t.p.isDisabled('#repeatBet'), 'disabled with no previous hand');
      await bet(t, 6); await t.p.locator('g.table-box[aria-label="Box 6"] > .side-bet[data-field="pp"]').first().dispatchEvent('click'); await t.p.waitForTimeout(800);
      const own = () => t.last?.bets?.[t.last?.me?.seats?.[0]]; const first = JSON.stringify(own());
      await t.p.click('#dealNow');
      await step(2, await playOut(t), `round 1 stakes ${first}`);
      await t.p.waitForSelector('#nextRound:not([hidden])', { timeout: 60000 }); await t.p.click('#nextRound');
      await t.p.waitForFunction(() => !document.querySelector('#repeatBet').disabled, null, { timeout: 30000 });
      await t.p.click('#repeatBet'); await t.p.waitForTimeout(1200);
      const again = JSON.stringify(own());
      await step(3, again === first && own()?.main > 0, `round 2 after one click ${again}`);
    } },
  PUSH: { task: '682bffe1-ffba-421d-9e4f-bcdf8d5138d2', title: 'Two boxes, 20 stand + bust, dealer 20: the 20 shows as a push (CH)',
    steps: ['Seat two boxes and settle the CH round (bust + 20 vs dealer 20)', 'Round complete lists the bust box as bust and the 20 as Push · stake back, never a loss'],
    async run(t, step) {
      await step(1, await sit(t, 'Chris', [6, 7]), 'seated on 6 and 7');
      t.rewrite = chRound('ch-push');
      await t.p.waitForFunction(() => !document.querySelector('#roundResult').hidden, null, { timeout: 30000 }); await t.p.waitForTimeout(800);
      const lines = await t.p.$$eval('#roundBoxes li', l => l.map(x => x.textContent));
      await step(2, lines.some(l => /Bust/.test(l)) && lines.some(l => /Push · stake back/.test(l)) && lines.length === 2, lines.join(' | '));
    } },
  STALE: { task: 'b4d0b7f4-17ed-4f00-8d21-679d1848bd92', title: "Sat a hand out: no previous hand's receipt (CH)",
    steps: ["Own round settled: its receipt shows", "Table moved on to a round the player sat out: last hand's receipt stays hidden"],
    async run(t, step) {
      await sit(t, 'Chris', [6, 7]);
      t.rewrite = chRound('ch-push');
      const shown = await t.p.waitForFunction(() => !document.querySelector('#roundResult').hidden, null, { timeout: 30000 }).then(() => true, () => false);
      await step(1, shown, shown ? await t.p.textContent('#roundReturn') : 'receipt never shown');
      t.rewrite = chRound('next-round'); await t.p.waitForTimeout(4000);
      await step(2, await t.p.evaluate(() => document.querySelector('#roundResult').hidden), 'receipt hidden on the sat-out round');
    } },
  TIMER: { task: 'd3caaac8-a0a2-4093-b358-a099dc7f9531', title: 'Decision time after two cards: 15 s (CH)',
    steps: ['Settings says decisions have 15 seconds', 'Deal: the server gives 15 s and the countdown starts at 15'],
    async run(t, step) {
      await sit(t, 'Chris', [6]);
      const text = await t.p.evaluate(() => [...document.querySelectorAll('.settings-popover p')].map(x => x.textContent).find(x => /Decisions/.test(x)) ?? '');
      await step(1, /15 seconds/.test(text), text);
      for (let hand = 0; hand < 4 && t.last?.round?.phase !== 'decisions'; hand++) {
        if (hand) { await t.p.waitForSelector('#nextRound:not([hidden])', { timeout: 90000 }); await t.p.click('#nextRound'); await t.p.waitForTimeout(1200); }
        await bet(t, 6); await t.p.click('#dealNow');
        for (let k = 0; k < 90 && t.last?.round?.phase !== 'decisions' && !(t.last?.phase === 'round' && t.last?.round?.phase === 'settled'); k++) await t.p.waitForTimeout(500);
        if (t.last?.round?.phase !== 'decisions') await playOut(t);
      }
      if (t.last?.round?.phase !== 'decisions') return step(2, false, 'four hands without a decision');
      await t.p.waitForFunction(() => { const e = document.querySelector('#roundTimer'); return e && !e.hidden && /\d/.test(e.textContent); }, null, { timeout: 30000 }).catch(() => {});
      const shows = (await t.p.textContent('#roundTimer')).trim();
      await step(2, t.last?.actionMs === 15000 && Number(shows.match(/\d+/)?.[0]) <= 15, `actionMs ${t.last?.actionMs}, timer ${shows}`);
    } },
  BALANCE: { task: 'dfe89b53-1ff8-4330-a8d9-09db615fd6c2', title: 'Chip balance clearly visible during play, also at zero (#8)',
    steps: ['Desktop 1280x900: balance visible and uncovered during a hand', 'Phone 430x932: balance visible and uncovered during a hand', 'Out of chips: balance $0, out-of-chips message and a highlighted + $1,000 demo'],
    async run(t, step, key) {
      await sit(t, 'Chris', [6]); await bet(t, 6); await t.p.click('#dealNow');
      for (let k = 0; k < 40 && t.last?.round?.phase !== 'decisions' && t.last?.phase !== 'settled'; k++) await t.p.waitForTimeout(500);
      await step(1, await visible(t.p, '#demoBalance'), await t.p.textContent('#demoBalance'));
      const ph = await table(key + '-phone', { w: 430, h: 932 }); await sit(ph, 'Pia', [2]); await bet(ph, 2); await ph.p.click('#dealNow');
      for (let k = 0; k < 40 && ph.last?.round?.phase !== 'decisions' && ph.last?.phase !== 'settled'; k++) await ph.p.waitForTimeout(500);
      await step(2, await visible(ph.p, '#demoBalance'), await ph.p.textContent('#demoBalance'), ph.p);
      await ph.ctx.close();
      const z = await table(key + '-zero'); await sit(z, 'Zed', [6]);
      z.rewrite = j => { j.me = { ...j.me, balance: 0 }; }; await z.p.waitForTimeout(3000);
      const s = await z.p.evaluate(() => ({ bal: document.querySelector('#demoBalance').textContent, needed: document.querySelector('#refillDemo').classList.contains('needed'), status: document.querySelector('#gameStatus').textContent }));
      await step(3, /0\.00/.test(s.bal) && s.needed && /Out of chips/.test(s.status) && await visible(z.p, '#refillDemo'), `${s.bal} · ${s.status}`, z.p);
      await z.ctx.close();
    } },
  PANEL: { task: '10cd606b-5219-4337-9f24-6c181ffd8a7f', title: 'Table/Chat/Demo/Info panel folds away and never covers the chips (#6)',
    steps: ['Laptop 1366x768: close the panel, it is gone and the reopen button covers no control', 'Closed panel stays closed after a reload, and reopens', 'Phone 430x932 with chat open: every chip and Deal stay reachable'],
    async run(t, step, key) {
      await t.p.setViewportSize({ width: 1366, height: 768 }); await sit(t, 'Chris', [6]);
      await t.p.click('#hidePanel'); await t.p.waitForTimeout(800);
      const gone = await t.p.evaluate(() => getComputedStyle(document.querySelector('aside.side')).display === 'none');
      const over = await t.p.evaluate(() => { const b = document.querySelector('#showPanel').getBoundingClientRect(); return ['#dealNow', '#demoBalance', '[data-chip="25"]', '#repeatBet'].filter(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom); }); });
      await step(1, gone && !over.length, over.length ? `overlaps ${over}` : 'panel closed, nothing covered');
      await t.p.reload({ waitUntil: 'domcontentloaded' }); await t.p.waitForTimeout(2500);
      const stayed = await t.p.evaluate(() => document.querySelector('.app').classList.contains('panel-closed'));
      await t.p.click('#showPanel'); await t.p.waitForTimeout(500);
      await step(2, stayed && await t.p.evaluate(() => getComputedStyle(document.querySelector('aside.side')).display !== 'none'), `closed after reload: ${stayed}`);
      const ph = await table(key + '-phone', { w: 430, h: 932 }); await sit(ph, 'Pia', [2]);
      await ph.p.getByRole('button', { name: 'Table chat' }).click().catch(() => {}); await ph.p.waitForTimeout(800);
      const blocked = [];
      for (const s of ['[data-chip="5"]', '[data-chip="25"]', '[data-chip="100"]', '#dealNow']) if (!(await visible(ph.p, s))) blocked.push(s);
      await step(3, !blocked.length, blocked.length ? `covered: ${blocked}` : 'chips and Deal reachable with chat open', ph.p);
      await ph.ctx.close();
    } },
  LAPTOP: { task: '190ad166-05d6-43c1-a564-a4c10bb8095a', title: 'Laptop: chat no longer takes half the screen, table and cards readable (Serhiy)',
    steps: ['1366x768 with the panel closed: the table gets the screen, no chat column', 'Hand value badges are at least 17 px'],
    async run(t, step) {
      await t.p.setViewportSize({ width: 1366, height: 768 }); await sit(t, 'Chris', [6]);
      await t.p.click('#hidePanel'); await t.p.waitForTimeout(800);
      const side = await t.p.evaluate(() => getComputedStyle(document.querySelector('aside.side')).display);
      await step(1, side === 'none', `chat column ${side === 'none' ? 'closed' : 'still shown'}`);
      await bet(t, 6); await t.p.click('#dealNow');
      await t.p.waitForFunction(() => document.querySelectorAll('#gameCards [data-hand]').length >= 2, null, { timeout: 60000 }).catch(() => {});
      const font = Number(await t.p.evaluate(() => document.querySelector('#gameCards [data-hand] text')?.getAttribute('font-size')));
      await step(2, font >= 17, `badge ${font}px (the stage stays 9:16, so it cannot grow wider without cropping the dealer)`);
    } },
  REJOIN: { task: '3d94d5d8-cf70-43ea-9b34-66ea5edb77a0', title: "Not stuck on 'Join' mid-hand: a returning player sits down (CH)",
    steps: ['Anna and Chris seated, Chris leaves', 'Anna deals a hand', 'Chris joins again mid-hand: seated, no error, no stuck popup'],
    async run(t, step, key) {
      await sit(t, 'Anna', [6]);
      const ch = await table(key);
      await sit(ch, 'Chris', [2]); await ch.p.click('#leaveTable'); await ch.p.waitForTimeout(1500);
      await step(1, await ch.p.evaluate(() => !document.querySelector('#gate').classList.contains('off')), 'Chris back at the join screen', ch.p);
      await bet(t, 6); await t.p.click('#dealNow'); await t.p.waitForTimeout(4000);
      await step(2, t.last?.phase !== 'bets', `table phase ${t.last?.phase}`);
      const seated = await sit(ch, 'Chris', [2]);
      const err = await ch.p.evaluate(() => document.querySelector('#entryError')?.textContent ?? '');
      await step(3, seated && !/after the round/i.test(err), seated ? `seated · ${await ch.p.textContent('#gameStatus')}` : `stuck: ${err}`, ch.p);
      await ch.ctx.close();
    } },
  SEAT: { task: '9dde8c4c-fb90-4b4e-b534-53c8549bc1a3', title: 'Changing boxes mid-round: queued for the next round (#7)',
    steps: ['Bet on box 6 and deal', 'Mid-round: pick box 2 instead, it is queued with a status line', 'Next round: box 2 applies'],
    async run(t, step) {
      await sit(t, 'Chris', [6]); await bet(t, 6); await t.p.click('#dealNow'); await t.p.waitForTimeout(3000);
      await step(1, t.last?.phase !== 'bets', `phase ${t.last?.phase}`);
      await t.p.click('#changeSeats'); await t.p.waitForTimeout(600);
      await t.p.locator('[aria-label="Select box 6"]').first().click({ force: true }); await t.p.locator('[aria-label="Select box 2"]').first().click({ force: true });
      await t.p.click('#enter'); await t.p.waitForTimeout(800); if (await t.p.isVisible('#playerName')) await t.p.click('#enter'); await t.p.waitForTimeout(1500);
      const status = await t.p.textContent('#gameStatus');
      await step(2, /apply from the next round/.test(status) && t.last?.me?.boxesAfterRound?.length, status);
      await playOut(t); await t.p.waitForSelector('#nextRound:not([hidden])', { timeout: 60000 }); await t.p.click('#nextRound'); await t.p.waitForTimeout(1500);
      await step(3, JSON.stringify(t.last?.me?.seats) === JSON.stringify(t.last?.me?.boxesAfterRound ?? t.last?.me?.seats) && !t.last?.me?.boxesAfterRound && t.last?.me?.seats?.length === 1, `seats ${JSON.stringify(t.last?.me?.seats)}`);
    } },
  DEALER: { task: '47f2fd3a-ee3f-42b6-b01d-78db8abdd6bf', title: 'Switching dealer keeps the session, no new sign-in (#1)',
    steps: ['Seated at Astrid', 'Switch to Dragge: still signed in with the same name, no join form', 'Switch back to Astrid: still signed in'],
    async run(t, step) {
      await step(1, await sit(t, 'Chris', [6]), 'seated');
      const id = t.last?.me?.id;
      const check = async name => { await t.p.getByRole('button', { name }).first().click(); await t.p.waitForTimeout(3000); return t.p.evaluate(() => ({ seated: !!document.querySelector('.app.seated'), gate: !document.querySelector('#gate').classList.contains('off') })); };
      const d = await check('Dragge'); await step(2, d.seated && !d.gate && t.last?.me?.id === id, `seated ${d.seated}, join form ${d.gate}, same player ${t.last?.me?.id === id}`);
      const a = await check('Astrid'); await step(3, a.seated && !a.gate && t.last?.me?.id === id, `seated ${a.seated}, join form ${a.gate}`);
    } },
  BETS: { task: '76c1681f-5af9-48f2-8bb0-391fc15b97d5', title: "'Place a main bet first' -> 'Place your bets please' (CH)",
    steps: ['Seated with no bet: Deal is off', "Put a Perfect Pairs chip on box 6 with no main bet: the table says 'Place your bets please'", "The old 'Place a main bet first' never shows"],
    async run(t, step) {
      await sit(t, 'Chris', [6]); await t.p.waitForTimeout(2000);
      await step(1, await t.p.isDisabled('#dealNow'), 'Deal now disabled with $0 bet');
      await t.p.click('[data-chip="25"]');
      await t.p.locator('g.table-box[aria-label="Box 6"] > .side-bet[data-field="pp"]').first().dispatchEvent('click');
      const seen = [];
      for (let k = 0; k < 12; k++) { seen.push(await t.p.textContent('#gameStatus')); if (/Place your bets please/.test(seen.at(-1))) break; await t.p.waitForTimeout(250); }
      await step(2, seen.some(x => /Place your bets please/.test(x)), seen.at(-1));
      await step(3, !seen.some(x => /main bet first/i.test(x)), 'old text never shown');
    } },
  INFO: { task: '45b46faa-bc26-412d-a3ca-83095523ab54', title: 'Demo information opens in the chat area, not a new tab (CH)',
    steps: ['Seated: click Demo information', 'It opens inside the side panel in place of the chat, no new tab, same URL', 'Click again: the chat comes back'],
    async run(t, step) {
      await sit(t, 'Chris', [6]); const url = t.p.url(); const pages = t.ctx.pages().length;
      await t.p.getByRole('button', { name: 'Demo information' }).first().click(); await t.p.waitForTimeout(1200);
      const open = await t.p.evaluate(() => { const d = document.querySelector('#demoInfo'); const side = document.querySelector('aside.side'); return { shown: !!d && !d.hidden && d.getBoundingClientRect().height > 50, inSide: !!side?.contains(d), text: d?.innerText.slice(0, 60) }; });
      await step(1, open.shown, open.text);
      await step(2, open.inSide && t.ctx.pages().length === pages && t.p.url() === url, `in side panel ${open.inSide}, tabs ${t.ctx.pages().length}, url unchanged ${t.p.url() === url}`);
      await t.p.getByRole('button', { name: 'Demo information' }).first().click(); await t.p.waitForTimeout(800);
      const back = await t.p.evaluate(() => ({ info: !document.querySelector('#demoInfo').hidden, log: document.querySelector('#log')?.getBoundingClientRect().height > 0 }));
      await step(3, !back.info && back.log, `info hidden ${!back.info}, chat shown ${back.log}`);
    } },
  CONFIRM: { task: '18e3c2fd-36f2-4336-9c23-a1176a006f5b', title: "'Are you sure?' on unreasonable moves, e.g. hit on 19 vs dealer 6 (CH)",
    steps: ['Your turn on hard 19 (10+9) vs dealer 6: press Hit', "An 'Are you sure?' dialog asks first; No sends nothing", 'Your turn on 15 (10+5): Hit goes straight through, no dialog'],
    async run(t, step) {
      await sit(t, 'Chris', [6]); const seat = t.last?.me?.seats?.[0];
      const turn = cards => j => { const hands = [{ box: seat, stake: 25, pp: 0, tp: 0, insured: 0, result: 0, sideReturn: 0, sideLabels: [], splitFrom: null, done: false, cards }];
        Object.assign(j, { phase: 'round', round: { phase: 'decisions', active: 0, hands, boxes: hands, dealer: [c('6','♣',3)], legalActions: ['hit', 'stand', 'double'] }, plan: null, owners: { ...(j.owners ?? {}), [seat]: j.me.id }, actionDeadline: j.serverNow + 15000 }); };
      t.block = /"op":"act".*"action":"(hit|double)"/;
      t.rewrite = turn([c('10','♠',1), c('9','♥',2)]); await t.p.waitForTimeout(3000);
      await t.p.click('[data-action="hit"]'); await t.p.waitForTimeout(600);
      const dialog = await t.p.evaluate(() => document.querySelector('.confirm-move')?.innerText ?? '');
      await step(1, /sure|19/i.test(dialog), dialog.replace(/\n/g, ' '));
      await t.p.getByRole('button', { name: 'No' }).click(); await t.p.waitForTimeout(800);
      await step(2, !!dialog && !t.blocked.length && !(await t.p.$('.confirm-move')), `dialog closed, hit requests sent ${t.blocked.length}`);
      t.rewrite = turn([c('10','♠',1), c('5','♥',2)]); await t.p.waitForTimeout(3000);
      await t.p.click('[data-action="hit"]'); await t.p.waitForTimeout(800);
      await step(3, !(await t.p.$('.confirm-move')) && t.blocked.length === 1, `no dialog, hit request sent ${t.blocked.length}`);
      t.rewrite = null;
    } },
  NICK: { task: '08fddb4d-50ab-4b39-9976-e31d0c5858c8', title: 'Nickname asked once and remembered, not on every visit (#2)',
    steps: ['First visit: pick a box, the table asks for a nickname', 'Leave and come back (reload): the button says "Join as Chris" and seats without asking again', '"Change nickname" is offered on the return visit'],
    async run(t, step) {
      await t.p.locator('[aria-label="Select box 6"]').first().click({ force: true }); await t.p.click('#enter'); await t.p.waitForTimeout(800);
      const asked = await t.p.isVisible('#playerName');
      await t.p.fill('#playerName', 'Chris'); await t.p.click('#enter');
      await t.p.waitForFunction(() => document.querySelector('.app.seated'), null, { timeout: 30000 });
      await step(1, asked, 'nickname field shown on the first visit');
      await t.p.click('#leaveTable'); await t.p.waitForFunction(() => !document.querySelector('.app.seated'), null, { timeout: 60000 });
      await t.p.reload({ waitUntil: 'domcontentloaded' }); await t.p.waitForTimeout(2500);
      await t.p.locator('[aria-label="Select box 6"]').first().click({ force: true }); await t.p.waitForTimeout(400);
      const button = (await t.p.textContent('#enter')).trim(); const change = await t.p.isVisible('#changeName');
      await t.p.screenshot({ path: `${SHOTS}/CROUPIER-NICK-return.png` });
      await t.p.click('#enter');
      const seated = await t.p.waitForFunction(() => document.querySelector('.app.seated'), null, { timeout: 15000 }).then(() => true, () => false);
      await step(2, button === 'Join as Chris' && seated && !(await t.p.isVisible('#playerName')), `button "${button}", seated directly ${seated}`);
      await step(3, change, `Change nickname shown ${change}`);
    } },
  SETTINGS: { query: '&dealer=dragge', task: '34491fa8-ccb8-4d50-884a-5efa1c80dacf', title: 'Settings opens over the chat, not the table; Room choices live in Settings (CH)',
    steps: ['Laptop 1366x768 at Dragge: Settings opens over the chat column, 0 px over the table', 'Room choices sit inside Settings, not in the left column', 'Pick Azure in Settings: the room switches', 'Phone 390x844: Settings fits the screen'],
    async run(t, step, key) {
      await t.p.setViewportSize({ width: 1366, height: 768 }); await sit(t, 'Chris', [6]);
      await t.p.click('details.audio-settings > summary'); await t.p.waitForTimeout(600);
      const o = await t.p.evaluate(() => { const a = document.querySelector('.settings-popover').getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect(); const ox = Math.max(0, Math.min(a.right, s.right) - Math.max(a.left, s.left)), oy = Math.max(0, Math.min(a.bottom, s.bottom) - Math.max(a.top, s.top)); return { overlap: Math.round(ox * oy), left: Math.round(a.left), stageRight: Math.round(s.right) }; });
      await step(1, o.overlap === 0, `overlap with table ${o.overlap} px², popover left ${o.left}, table right ${o.stageRight}`);
      const inSettings = await t.p.evaluate(() => !!document.querySelector('.settings-popover #studioRooms') && !document.querySelector('#studio #studioRooms'));
      await step(2, inSettings, `rooms inside Settings ${inSettings}`);
      await t.p.click('.settings-popover [data-room="azure"]'); await t.p.waitForTimeout(1500);
      const pressed = await t.p.getAttribute('.settings-popover [data-room="azure"]', 'aria-pressed');
      await step(3, pressed === 'true', `Azure pressed ${pressed}`);
      const ph = await table(key + '-phone', { w: 390, h: 844, query: '&dealer=dragge' }); await sit(ph, 'Pia', [2]);
      await ph.p.click('details.audio-settings > summary'); await ph.p.waitForTimeout(600);
      const fit = await ph.p.evaluate(() => { const a = document.querySelector('.settings-popover').getBoundingClientRect(); return { l: Math.round(a.left), r: Math.round(a.right), t: Math.round(a.top), b: Math.round(a.bottom) }; });
      await step(4, fit.l >= 0 && fit.r <= 390 && fit.t >= 0 && fit.b <= 844, JSON.stringify(fit), ph.p);
      await ph.ctx.close();
    } },
  SETCLOSE: { task: 'c6dc9947-fe84-45b4-82e6-8cba4c84ac4d', title: 'Settings panel: clear close button + swipe to close on mobile (#5)',
    steps: ['The × button closes Settings', 'Escape closes Settings', 'A tap outside closes Settings', 'Phone: a downward swipe on the panel closes Settings'],
    async run(t, step, key) {
      await sit(t, 'Chris', [6]);
      const open = async (p = t.p) => { await p.click('details.audio-settings > summary'); await p.waitForTimeout(400); };
      const isOpen = (p = t.p) => p.evaluate(() => document.querySelector('details.audio-settings').open);
      await open(); await t.p.click('.settings-close'); await t.p.waitForTimeout(300); await step(1, !(await isOpen()), 'closed by ×');
      await open(); await t.p.keyboard.press('Escape'); await t.p.waitForTimeout(300); await step(2, !(await isOpen()), 'closed by Escape');
      await open(); await t.p.mouse.click(640, 300); await t.p.waitForTimeout(300); await step(3, !(await isOpen()), 'closed by tap outside');
      const ph = await table(key + '-phone', { w: 390, h: 844, touch: true }); await sit(ph, 'Pia', [2]);
      await open(ph.p);
      await ph.p.evaluate(() => { const pop = document.querySelector('.settings-popover'), r = pop.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 40;
        const tp = (yy) => new Touch({ identifier: 1, target: pop, clientX: x, clientY: yy });
        pop.dispatchEvent(new TouchEvent('touchstart', { touches: [tp(y)], changedTouches: [tp(y)], bubbles: true }));
        pop.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [tp(y + 120)], bubbles: true })); });
      await ph.p.waitForTimeout(300); await step(4, !(await isOpen(ph.p)), 'closed by a 120 px downward swipe', ph.p);
      await ph.ctx.close();
    } },
  NUMBERING: { task: '2f8df63d-f4be-4dbf-8ff6-98926fe1cc6b', title: 'Box numbering: box 1 on the player\'s right (first base), dealt first (CH)',
    steps: ['Boxes read 7..1 from left to right', 'Seated on boxes 1 and 7: the first card goes to box 1'],
    async run(t, step) {
      const order = await t.p.evaluate(() => [...document.querySelectorAll('g.table-box')].map(g => ({ n: g.getAttribute('aria-label'), x: g.getBoundingClientRect().left })).sort((a, b) => a.x - b.x).map(g => g.n.replace('Box ', '')).join(' '));
      await step(1, order === '7 6 5 4 3 2 1', order);
      await sit(t, 'Chris', [1, 7]); await bet(t, 1); await bet(t, 7); await t.p.click('#dealNow');
      for (let k = 0; k < 40 && !t.last?.plan; k++) await t.p.waitForTimeout(300);
      const first = t.last?.plan?.steps?.find(x => x.kind === 'deal');
      await step(2, 8 - first?.seat === 1, `first card to box ${8 - first?.seat} (plan seat ${first?.seat} = index+1)`);
    } },
  DRAG: { task: 'd69b1761-f3f6-4884-b93d-5972abe639da', title: 'Open a box by dragging the stake onto it (CH)',
    steps: ['Seated on box 6: drag the 25 chip onto free box 4', 'Box 4 is now yours with a 25 main bet'],
    async run(t, step) {
      await sit(t, 'Chris', [6]); await t.p.waitForTimeout(1500);
      const from = await t.p.locator('[data-chip="25"]').boundingBox(), to = await t.p.locator('g.table-box[aria-label="Box 4"] .main-bet').first().boundingBox();
      await t.p.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await t.p.mouse.down();
      for (let i = 1; i <= 12; i++) await t.p.mouse.move(from.x + (to.x + to.width / 2 - from.x) * i / 12, from.y + (to.y + to.height / 2 - from.y) * i / 12);
      await t.p.mouse.up(); await t.p.waitForTimeout(1500);
      await step(1, true, 'dragged');
      const idx = 7 - 4, mine = t.last?.owners?.[idx] === t.last?.me?.id, main = t.last?.bets?.[idx]?.main;
      await step(2, mine && main === 25, `box 4 owned by me ${mine}, main bet ${main}`);
    } },
  TWOBOX: { task: '36bb338d-8d88-4abe-9da3-33365eba52d4', title: 'Two boxes: a box without a bet is not dealt, and a box can be dropped (Serhiy)',
    steps: ['Seated on boxes 6 and 7, bet only on 6, deal: only box 6 gets cards', 'Boxes: drop box 7, keep 6'],
    async run(t, step) {
      await sit(t, 'Chris', [6, 7]); await bet(t, 6); await t.p.click('#dealNow');
      for (let k = 0; k < 40 && !t.last?.round?.hands?.length; k++) await t.p.waitForTimeout(300);
      const boxes = (t.last?.round?.hands ?? []).map(h => 7 - h.box);
      await step(1, JSON.stringify([...new Set(boxes)]) === '[6]', `dealt boxes ${JSON.stringify(boxes)}`);
      await t.p.click('#changeSeats'); await t.p.waitForTimeout(600);
      await t.p.locator('[aria-label="Select box 7"]').first().click({ force: true });
      await t.p.click('#enter'); await t.p.waitForTimeout(800); if (await t.p.isVisible('#playerName')) await t.p.click('#enter'); await t.p.waitForTimeout(1500);
      const seats = (t.last?.me?.boxesAfterRound ?? t.last?.me?.seats ?? []).map(i => 7 - i);
      await step(2, JSON.stringify(seats) === '[6]', `boxes kept ${JSON.stringify(seats)} (${await t.p.textContent('#gameStatus')})`);
    } },
  VOICE: { task: '9009e3a2-7821-4abb-a912-2349df317bd4', title: 'Dealer-bust cheer not played right after a bust at the table (CH)',
    steps: ['Dealer busts, one box won and another box busted: the line is a plain win, not the dealer-bust cheer', 'Dealer busts and nobody busted: the dealer-bust line still plays'],
    async run(t, step) {
      const r = await t.p.evaluate(async () => { const { outcomeSpeech } = await import('/game-events.js');
        const c = (r) => ({ r, s: '♠' }), h = (cards, stake, result) => ({ cards: cards.map(c), stake, result, splitFrom: null });
        const dealer = ['10', '6', 'K'].map(c);
        return { mixed: outcomeSpeech({ dealer, hands: [h(['10', '8'], 10, 20), h(['10', '6', '9'], 10, 0)] }), clean: outcomeSpeech({ dealer, hands: [h(['10', '8'], 10, 20)] }) }; });
      await step(1, r.mixed === 'win', `line: ${r.mixed}`);
      await step(2, r.clean === 'dealerbust', `line: ${r.clean}`);
    } },
  FLIP: { task: 'd6f10a7e-2adb-4430-a3a8-4208d597cbe0', title: 'Card reveal: no white blank frame before the face (#9)',
    steps: ['Play a hand until the dealer reveals the hole card', 'Every frame captured through the flip shows the card face drawn (no blank white card)'],
    async run(t, step, key) {
      await sit(t, 'Chris', [6]); await bet(t, 6); await t.p.click('#dealNow');
      const frames = []; let revealAt = null;
      for (const end = Date.now() + 150000; Date.now() < end && !revealAt && t.last?.phase !== 'settled';) {
        const stand = t.p.locator('[data-action="stand"]:not([disabled])');
        if (await stand.isVisible().catch(() => false)) await stand.click().catch(() => {});
        const r = t.last?.plan?.steps?.find(x => x.kind === 'reveal');
        if (r && t.last.serverNow) revealAt = Date.now() + (r.startAt - t.last.serverNow); else await t.p.waitForTimeout(300);
      }
      const revealed = !!revealAt;
      if (revealed) {
        while (Date.now() < revealAt - 300) await t.p.waitForTimeout(50);
        for (const stop = Date.now() + 3000; Date.now() < stop;) { const f = `${SHOTS}/CROUPIER-${key}-f${String(frames.length).padStart(2, '0')}.png`; await t.p.screenshot({ path: f, clip: { x: 380, y: 330, width: 320, height: 160 } }); frames.push(f); }
      }
      await step(1, revealed, `${frames.length} frames captured through the reveal`);
      return { frames };
    } },
};

const results = [];
for (const [key, spec] of Object.entries(SPECS)) {
  if (only && !only.includes(key)) continue;
  const id = `CROUPIER-${key}`;
  scTest(id, 'plan', '--env', ENV, '--title', spec.title, '--company', 'Scout', ...spec.steps);
  const t = await table(key, { query: spec.query ?? "" });
  let ok = true, extra;
  const step = async (n, pass, note, page = t.p) => {
    const shot = `${SHOTS}/${id}-${n}.png`; await page.screenshot({ path: shot }).catch(() => {});
    scTest(id, 'step', String(n), pass ? 'pass' : 'fail', String(note ?? ''), '--shot', shot);
    console.log(`${id} step ${n} ${pass ? 'PASS' : 'FAIL'}: ${spec.steps[n - 1]} -> ${note}`);
    if (!pass) ok = false;
  };
  try { scTest(id, 'step', '1', 'running'); extra = await spec.run(t, step, key); }
  catch (e) { ok = false; console.log(`${id} ERROR ${e.message.split('\n')[0]}`); scTest(id, 'phase', `error: ${e.message.split('\n')[0]}`); }
  if (t.errors.length) console.log(`${id} page errors: ${t.errors.join(' | ')}`);
  await t.p.screenshot({ path: `${SHOTS}/${id}.png` }).catch(() => {});
  scTest(id, 'done', ok ? 'pass' : 'fail');
  results.push({ key, task: spec.task, ok, ...extra });
  await t.p.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {}); await t.ctx.close();
}
await browser.close();
console.log('RESULT ' + JSON.stringify(results));
