import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { DEALERS } from '../public/dealers.js';
import { bettingIdles, phasePool, pickWeighted, PHASE_SHARE } from '../public/idle-chain.js';

// Kevin 23 Oct: e2e's H3 v2 idles after the Evolution references, the ones he picked, colour-matched into v2/.
const PICKED = {
  dragge: ['knappin5101', 'knappin5102', 'knappandas5102', 'knappaxlar5102', 'knapput5101', 'knapput5102', 'plattaxlar5101', 'lutfram5101'],
  paow: ['knappin5101', 'knappin5102', 'knappandas5101', 'knappandas5102', 'knappaxlar5101', 'knappaxlar5102', 'knapput5101', 'knapput5102', 'plattandas5101', 'plattandas5102', 'plattaxlar5101'],
};

test('Dragan and Paow have the H3 v2 takes Kevin picked, in v2/, with their phase and pose', () => {
  for (const [id, takes] of Object.entries(PICKED)) {
    const own = DEALERS[id].idles.filter(i => i.fas);
    assert.deepEqual(own.map(i => i.id), takes, id);
    for (const i of own) {
      assert.ok(existsSync(new URL(`../public${i.url.split('?')[0]}`, import.meta.url)), i.url);
      assert.equal(i.dur, 1.625); assert.ok(i.calm); assert.ok(!i.head, 'no head take');
      const pose = i.id.startsWith('knappin') ? ['vila', 'knappt'] : i.id.startsWith('knapput') ? ['knappt', 'vila'] : i.id.startsWith('knapp') ? ['knappt', 'knappt'] : ['vila', 'vila'];
      assert.deepEqual([i.from, i.to], pose, i.id);
      assert.equal(i.fas, i.id.startsWith('knapp') ? 'bets' : 'decide', i.id);
    }
  }
  assert.ok(!DEALERS.astrid2.idles.some(i => i.fas), 'Astrid 2.0 keeps her takes');
});

test('while the table bets a clasped run starts on VILA with knappin and ends on VILA with knapput, and the clasped hands dominate', () => {
  for (const id of ['dragge', 'paow']) {
    const idles = DEALERS[id].idles;
    const atVila = bettingIdles(idles, 'vila').map(i => i.id), clasped = bettingIdles(idles, 'knappt').map(i => i.id);
    assert.ok(atVila.some(t => t.startsWith('knappin')) && atVila.every(t => !/^knapp(andas|axlar|ut)|^platt|^lutfram/.test(t)), `${id} at VILA: ${atVila}`);
    assert.ok(clasped.length && clasped.every(t => /^knapp(andas|axlar|ut)/.test(t)), `${id} clasped: ${clasped}`);
    assert.deepEqual(bettingIdles(idles, 'knappt', 3000).map(i => i.id).filter(t => !t.startsWith('knapput')), [], 'within 4 s of a card he goes back to VILA');
    assert.ok(!bettingIdles(idles, 'vila', 6000).some(i => i.id.startsWith('knappin')), 'no run starts within 8 s of a card');
    // a long betting countdown: every run is knappin, takes that stay, knapput; most of the time his hands are clasped
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let pose = 'vila', last = '', claspedClips = 0, runs = 0; const seq = [];
    for (let n = 0; n < 3000; n++) {
      const c = pickWeighted(bettingIdles(idles, pose), last, rnd, x => x.id);
      assert.equal(c.from ?? 'vila', pose, `${c.id} follows ${pose}`);
      if (c.id.startsWith('knappin')) runs++;
      if (c.fas === 'bets') claspedClips++;
      pose = c.to ?? 'vila'; last = c.id; seq.push(c.id);
    }
    assert.ok(runs > 100, `${id}: ${runs} runs`);
    assert.ok(claspedClips / 3000 > .6, `${id}: clasped ${Math.round(claspedClips / 30)} % of the takes`);
  }
});

test('in the wait for the player the flat hands and the lean dominate (phasePool decide); the clasped takes stay out', () => {
  for (const id of ['dragge', 'paow']) {
    const calm = DEALERS[id].idles.filter(i => i.calm && !i.fas), decide = DEALERS[id].idles.filter(i => i.fas === 'decide');
    const pool = phasePool([...calm, ...decide], 'decide'), w = p => p.reduce((n, i) => n + i.vikt, 0);
    assert.ok(!pool.some(i => i.fas === 'bets'));
    assert.ok(Math.abs(w(pool.filter(i => i.fas === 'decide')) / w(pool) - PHASE_SHARE.decide) < .01, id);
  }
});

test('a plan that comes while his hands are clasped makes him unclasp first (knapput, sped up to fit before the first take)', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /warmPlan:plan=>\{unclaspFor\(plan\);/);
  const fn = app.slice(app.indexOf('function unclaspFor'), app.indexOf('const idleItem'));
  assert.match(fn, /onItem\.to === 'knappt'/);
  assert.match(fn, /i\.from === 'knappt' && i\.to === 'vila'/);
  assert.match(fn, /Math\.min\(2\.5, Math\.max\(1, out\.dur \/ Math\.max\(\.3, lead\)\)\)/);
  assert.match(app, /if \(item\.rate\) v\.playbackRate = item\.rate;/);
  assert.match(app, /const unclasp=manifest\.idle\.filter\(c=>c\.from==='knappt'&&c\.to==='vila'\),next=unclasp\.find/, 'knapput is preloaded first');
  assert.match(app, /idlePose = item\.kind === 'idle' && !item\.chain && \(v\.ended/);
});
