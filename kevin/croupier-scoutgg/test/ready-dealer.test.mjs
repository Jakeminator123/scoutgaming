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
  for (const d of [DEALERS.dragge, DEALERS.paow, DEALERS.marten]) {
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
  for (const d of [DEALERS.dragge, DEALERS.paow, DEALERS.marten]) {
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

test('Mårten has no voice yet: no recorded lines, and his idles are his own Kling loops, so nothing of another dealer ever plays over his face', () => {
  const m = DEALERS.marten;
  assert.equal(m.name, 'Mårten');
  assert.equal(m.lines, null);
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
