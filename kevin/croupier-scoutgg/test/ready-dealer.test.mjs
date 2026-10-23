import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// The page picks the dealer from ?dealer=; choose Dragge before dealers.js loads.
globalThis.location = { search: '?dealer=dragge' };
const { dealer, readyVariant, variantOffset, dealerClipUrl, dealerClipVariants, DEALERS } = await import('../public/dealers.js');

const step = (kind, startAt, endAt, clip = { url: '/media/deal/pos4.mp4' }) => ({ kind, startAt, endAt, clip });

test('a ready dealer deals every card as the whole move, so no slot leaves him frozen at the shoe', () => {
  assert.equal(dealer.id, 'dragge');
  const a = step('deal', 0, 3000), b = step('deal', 3080, 6000), c = step('deal', 6080, 9000);
  const plan = { steps: [a, b, c, { kind: 'turn', startAt: 9080, endAt: 9080 }] };
  assert.deepEqual([a, b, c].map(s => readyVariant(plan, s)), ['iu', 'iu', 'iu']);
  const lone = step('deal', 0, 3000);
  assert.equal(readyVariant({ steps: [lone] }, lone), 'iu');
  const s1 = step('deal', 0, 3000), talk = step('speech', 3080, 5000), s2 = step('deal', 5080, 8000);
  assert.deepEqual([s1, s2].map(s => readyVariant({ steps: [s1, talk, s2] }, s)), ['iu', 'iu']);
  assert.equal(readyVariant({ steps: [talk] }, talk), '');
});

test('variant URLs, offsets and files exist for every ready dealer', () => {
  assert.equal(dealerClipUrl('/media/deal/pos4.mp4', 'iu').split('?')[0], '/media/dealers/dragge/v2/pos4-iu.mp4');
  assert.equal(variantOffset('iu'), dealer.ready.in / 24);
  assert.equal(variantOffset('u'), 0);
  // His turn of the hole card is filmed from rest: flip-iu.mp4 is the take itself, so its frames count from 0.
  assert.equal(variantOffset('iu', 'flip'), 0);
  assert.equal(variantOffset('iu', '4'), dealer.ready.in / 24);
  assert.equal(dealerClipVariants(dealerClipUrl('/media/deal/hole.mp4')).length, 4);
  for (const d of [DEALERS.dragge, DEALERS.paow, DEALERS.marten, DEALERS.astrid2]) {
    for (const take of ['pos1', 'pos2', 'pos3', 'pos4', 'pos5', 'pos6', 'pos7', 'posdealer', 'hole', 'flip'])
      for (const v of ['', '-i', '-u', '-iu'])
        assert.ok(existsSync(new URL(`../public${d.clips}${take}${v}.mp4`, import.meta.url)), `${d.id} ${take}${v}`);
    // Emil's rest takes for a card that ends the run: -v (the take) and -iv (in + take), each with its own landing.
    for (const take of ['pos1', 'pos2', 'pos3', 'pos4', 'pos5', 'pos6', 'pos7', 'posdealer'])
      for (const v of ['-v', '-iv'])
        assert.ok(existsSync(new URL(`../public${d.clips}${take}${v}.mp4`, import.meta.url)), `${d.id} ${take}${v}`);
    assert.ok(d.ready.in > 0 && Object.keys(d.land).length === 18 && d.faceTracks['4v'] && d.land.dealerv > 0);
  }
});

test('every run variant ends inside the slot the shared table gives its take', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../public/media/manifest.json', import.meta.url), 'utf8'));
  const slot = Object.fromEntries(manifest.deal.map(d => [d.id.replace('deal_pos', '').replace('deal_', ''), d.dur * 24]));
  for (const d of [DEALERS.dragge, DEALERS.paow, DEALERS.marten, DEALERS.astrid2]) {
    const meta = JSON.parse(readFileSync(new URL(`../public${d.clips}meta.json`, import.meta.url), 'utf8'));
    for (const [take, variants] of Object.entries(meta.frames))
      for (const [v, frames] of Object.entries(variants))
        // Studio and dealer tables time a take on its own frames; on Astrid's slots the player may run it up to 2x.
        assert.ok(frames <= slot[take] * 2, `${d.id} ${take}${v}: ${frames} frames > 2 x ${slot[take]}`);
    assert.deepEqual(d.ready.card, meta.card);
    assert.equal(d.ready.in, meta.in);
  }
});

test('on his own studio table the server names the variant, so the cards join REDO to REDO', () => {
  const a = { ...step('deal', 0, 2208), variant: 'i' }, b = { ...step('deal', 2208, 3291), variant: '' }, c = { ...step('deal', 3291, 5499), variant: 'u' };
  const plan = { steps: [a, b, c] };
  assert.deepEqual([a, b, c].map(s => readyVariant(plan, s)), ['i', '', 'u']);
  assert.equal(variantOffset(readyVariant(plan, b)), 0);
});

test('Mårten speaks his recorded lines in Swedish, English and Spanish, and his idles are his own Kling loops, so nothing of another dealer ever plays over his face', () => {
  const m = DEALERS.marten;
  assert.equal(m.name, 'Mårten');
  assert.deepEqual(m.lines, ['sv', 'en', 'es', 'pt']);
  for (const lang of m.lines) for (const line of ['greeting_1', 'goodluck_1', 'bust_1', 'win_1', 'greet_guest', 'remark_hit17_1', 'table_cash_1'])
    assert.ok(existsSync(new URL(`../public${m.linesDir}${lang}/${line}.mp4`, import.meta.url)), `${lang}/${line}`);
  assert.deepEqual(m.idles.map(i => i.url.split('?')[0]), ['breath', 'glance', 'smile'].map(k => `/media/dealers/marten/idle-v2/${k}.mp4`));
  for (const idle of m.idles) assert.ok(existsSync(new URL(`../public${idle.url.split('?')[0]}`, import.meta.url)));
  // The breathing loop can repeat (app.js pickIdle skips the last gesture unless its weight is 10 or more).
  assert.ok(m.idles[0].vikt >= 10);
  assert.ok(existsSync(new URL(`../public${m.keyed.still.split('?')[0]}`, import.meta.url)));
  assert.ok(existsSync(new URL(`../public${m.face.split('?')[0]}`, import.meta.url)));
});

test('every card he deals or turns follows its planar track from face-up until it rests, then touches down before resting', async () => {
  const { faceAtTime } = await import('../public/card-face-projection.js');
  const { DEAL_CONTACT } = await import('../public/card-table-layout.js');
  assert.ok(dealer.faceTracks.flip, 'his turn of the hole card is tracked too');
  for (const [k, t] of Object.entries(dealer.faceTracks)) {
    assert.ok(t.firstFrame < dealer.land[k] && dealer.land[k] < t.firstFrame + t.frames.length, k);
    assert.equal(faceAtTime(k, t.firstFrame / 24), t.frames[0]);
    assert.equal(faceAtTime(k, (t.firstFrame - 1) / 24), null);
    assert.ok(DEAL_CONTACT[k].contactFrame >= t.firstFrame && DEAL_CONTACT[k].contactFrame <= DEAL_CONTACT[k].clearFrame, k);
    for (const f of t.frames) assert.ok(f.q.length === 4 && f.paper.length === 3);
  }
});

test('Astrid 2.0 plays like Paow: her own takes, rest-to-rest idles and recorded lines in English, under her own name', () => {
  const a = DEALERS.astrid2;
  assert.equal(a.name, 'Astrid');
  assert.equal(a.label, 'Astrid');   // Emil 14 Oct: shown as Astrid
  assert.deepEqual(a.lines, ['en', 'pt', 'ko']);
  for (const idle of a.idles) assert.ok(existsSync(new URL(`../public${idle.url.split('?')[0]}`, import.meta.url)), idle.id);
  // Kevin 23 Oct: her breathing takes and glances are rejected; huvud, huvudb and fingrar stay
  assert.deepEqual(a.idles.map(i => i.id), ['huvud', 'huvudb', 'fingrar']);
  for (const line of ['greeting_1', 'goodluck_1', 'win_1', 'greet_guest', 'greet_emil', 'remark_hit17_1', 'banter_1', 'table_cash_1'])
    assert.ok(existsSync(new URL(`../public${a.linesDir}en/${line}.mp4`, import.meta.url)), line);
  for (const f of [a.keyed.still, a.face, '/studio/assets/astrid2.jpg', '/studio/assets/cut-astrid2.png', '/studio/assets/felt-mask-astrid2-v2.png'])
    assert.ok(existsSync(new URL(`../public${f.split('?')[0]}`, import.meta.url)), f);
});

// the takes without a phase (the H3 v2 ones of 23 Oct have fas bets/decide and their own test)
const plainIdles = id => DEALERS[id].idles.filter(i => !i.fas);
test('Dragan idles on his H3 takes in his own take folder, without the ones Kevin rejected (23 Oct): rest to rest, so a line he says at rest can run over a chain of them', () => {
  const d = { ...DEALERS.dragge, idles: plainIdles('dragge') };
  assert.deepEqual(d.idles.slice(0, 4).map(i => i.id), ['andas', 'djupandetag', 'blickhoger', 'fingrar'], 'no glance to the left (Kevin 20 Oct), no andasb, blickhogerb, huvud or huvudb (23 Oct)');
  assert.deepEqual(d.idles.slice(4).map(i => i.id), ['vikt6103', 'vridhoger7105', 'vridvanster6101', 'vridvanster6103'], 'the new takes he kept (vridvanster6103 back, his later pick)');
  for (const idle of d.idles.slice(4)) assert.equal(idle.vikt, 6, `${idle.id}: plain weight, no head rule for Dragan (Kevin 23 Oct)`);
  for (const idle of d.idles) { assert.ok(idle.url.startsWith('/media/dealers/dragge/v2/'), idle.id); assert.equal(idle.dur, 1.625, 'Emil\'s length, 39 frames'); assert.ok(existsSync(new URL(`../public${idle.url.split('?')[0]}`, import.meta.url)), idle.id); }
  assert.ok(d.idles[0].vikt >= 10);
});

test('Paow idles on her seven H3 takes in v2/ (the two glances to the right derailed and are left out), weighted like the others', () => {
  const d = { ...DEALERS.paow, idles: plainIdles('paow') };
  assert.deepEqual(d.idles.slice(0, 7).map(i => i.id), ['andas', 'andasb', 'djupandetag', 'blickvanster', 'huvud', 'huvudb', 'fingrar']);
  assert.deepEqual(d.idles.slice(7).map(i => i.id), ['rakrygg6101', 'vikt6103', 'vikt6105', 'vridhoger6101', 'vridvanster6101', 'vridvanster6105'], 'the new takes she kept (Kevin 23 Oct)');
  //ridvanster6105'], 'plus the sixteen Kevin picked (21 Oct), axlar6105 included');
  for (const idle of d.idles.slice(7).filter(i => i.calm)) assert.equal(idle.vikt, 6, idle.id);
  for (const idle of d.idles) { assert.ok(idle.url.startsWith('/media/dealers/paow/v2/'), idle.id); assert.equal(idle.dur, 1.625); assert.ok(existsSync(new URL(`../public${idle.url.split('?')[0]}`, import.meta.url)), idle.id); }
  assert.equal(d.idles.find(i => i.id === 'andas').vikt, 20);
});

test('the calm takes are marked for the wait while the player decides (Kevin 21 Oct): breathing, shoulders, back, weight, fingers; not turns, glances, nods or leaning', () => {
  const calmOf = d => plainIdles(d).filter(i => i.calm).map(i => i.id), livelyOf = d => plainIdles(d).filter(i => !i.calm).map(i => i.id);
  assert.deepEqual(calmOf('dragge'), ['andas', 'djupandetag', 'fingrar', 'vikt6103']);
  assert.deepEqual(livelyOf('dragge'), ['blickhoger', 'vridhoger7105', 'vridvanster6101', 'vridvanster6103']);
  assert.deepEqual(calmOf('paow'), ['andas', 'andasb', 'djupandetag', 'fingrar', 'rakrygg6101', 'vikt6103', 'vikt6105']);
  assert.deepEqual(livelyOf('paow'), ['blickvanster', 'huvud', 'huvudb', 'vridhoger6101', 'vridvanster6101', 'vridvanster6105']);
  assert.deepEqual(calmOf('astrid2'), ['fingrar'], 'her only calm take left (Kevin 23 Oct)');
});

// Kevin 23 Oct (clip studio on staging): 27 rejected idles are out of every rotation; their files stay on disk.
test('the 29 idles Kevin rejected never play, and their files are kept', () => {
  const rejected = { astrid2: ['idle-v2/andas', 'idle-v2/andasb', 'idle-v2/blickhoger', 'idle-v2/blickhogerb', 'idle-v2/blickvanster', 'idle-v2/djupandetag'],
    dragge: ['v2/andasb', 'v2/axlar6101', 'v2/axlar6103', 'v2/blickhogerb', 'v2/blicksvep6101', 'v2/huvud', 'v2/huvudb', 'v2/nick6101', 'v2/rakrygg6101', 'v2/rakrygg6103', 'v2/vikt6101', 'v2/vikt7105', 'v2/vridhoger6101'],
    paow: ['v2/axlar6101', 'v2/axlar6103', 'v2/axlar6104', 'v2/axlar6105', 'v2/lutfram6103', 'v2/nick6101', 'v2/nick6103', 'v2/nick6105', 'v2/rakrygg6105', 'v2/vikt6101'] };
  assert.equal(Object.values(rejected).flat().length, 29);
  for (const [dealer, takes] of Object.entries(rejected)) {
    const played = new Set(DEALERS[dealer].idles.map(i => i.url.split('?')[0]));
    for (const take of takes) {
      const url = `/media/dealers/${dealer}/${take}.mp4`;
      assert.ok(!played.has(url), `${url} still in the rotation`);
      assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `${url} file kept`);
    }
    assert.ok(DEALERS[dealer].idles.length >= 3 && DEALERS[dealer].idles.some(i => i.calm), `${dealer} keeps idles and a calm one for the wait`);
  }
});

// Kevin 23 Oct: "his head is moving too much": head takes (turns, glances, nods) at most about every 4th-5th idle, never two
// in a row, the calm ones dominate; all four dealers. The head takes stay in the rotation.
test('head takes are a fifth of the weight, never two in a row and at least four apart, in chains and random idles alike', async () => {
  const { layChain, isHead, pickWeighted, restingPool } = await import('../public/idle-chain.js');
  for (const id of ['paow', 'astrid2', 'marten']) {
    const idles = plainIdles(id), head = idles.filter(i => isHead(i.id)).reduce((n, i) => n + i.vikt, 0), all = idles.reduce((n, i) => n + i.vikt, 0);
    assert.ok(idles.some(i => isHead(i.id)), `${id} keeps head takes`);
    assert.ok(Math.abs(head / all - .2) < .005, `${id}: ${(head / all).toFixed(3)}`);
    const takes = idles.map(i => ({ take: i.id, frames: 39, vikt: i.vikt, head: i.head }));
    assert.ok(idles.filter(i => isHead(i.id)).every(i => i.head), `${id}: its head takes are marked`);
    for (let s = 0; s < 60; s++) {
      const chain = layChain(takes, 0, 30000, `${id}${s}`), at = chain.map((c, i) => isHead(c.take) ? i : -1).filter(i => i >= 0);
      for (let k = 1; k < at.length; k++) assert.ok(at[k] - at[k - 1] >= 4, `${id} chain ${s}: head takes at ${at[k - 1]} and ${at[k]}`);
    }
    let last = '', since = Infinity, prevHeadAt = -99;
    for (let k = 0; k < 600; k++) {
      const c = pickWeighted(restingPool(idles), last, Math.random, x => x.id, { sinceHead: since });
      if (isHead(c.id)) { assert.ok(k - prevHeadAt >= 4, `${id} random idles: head at ${prevHeadAt} and ${k}`); prevHeadAt = k; since = 0; } else since++;
      last = c.id;
    }
  }
  assert.equal(DEALERS.paow.idles.find(i => i.id === 'andas').vikt, 20, 'calm weights unchanged');
});

// Kevin 23 Oct, for Dragan instead of the head rule: blickhoger at most once in an idle period, his other idles plain
test('Dragan: blickhoger is said at most once in a chain and never twice in a row; his other idles are plain ones', async () => {
  const { layChain } = await import('../public/idle-chain.js');
  const idles = DEALERS.dragge.idles, takes = idles.map(i => ({ take: i.id, frames: 39, vikt: i.vikt, calm: i.calm, head: i.head, once: i.once }));
  assert.ok(idles.find(i => i.id === 'blickhoger').once); assert.ok(!idles.some(i => i.head), 'no head rule for Dragan');
  let seen = 0;
  for (let s = 0; s < 200; s++) {
    const chain = layChain(takes, 0, 60000, `d${s}`);
    const n = chain.filter(c => c.take === 'blickhoger').length;
    assert.ok(n <= 1, `chain ${s}: blickhoger ${n} times`); seen += n;
  }
  assert.ok(seen > 20, 'it does come, once in a period');
});
