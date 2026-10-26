import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeFilmedCoverageSequences, requiredNativeFilmedTakes } from '../packages/presentation/runtime/filmed-deal-coverage.mjs';
import { orderFilmedPresentationEvents, planFilmedDealSequence, planFilmedDealSequences } from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import { filmedDealTarget, validateFilmedDealProfile } from '../packages/presentation/contracts/filmed-profile.mjs';
import { PAOW_KEVIN_PROFILE } from '../packages/presentation/contracts/filmed-profiles/kevin-paow-c7138759.mjs';
import { DRAGAN_KEVIN_PROFILE } from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import { presentationEvents } from '../services/game/partner-presentation.mjs';
import { Round } from '../services/game/games/blackjack/round.mjs';
import { publicView } from '../services/game/games/blackjack/core.mjs';

const dealerId = 'coverage-fixture';
const transitionCases = [{}, { toShoe: { id: 'to' } }, { fromShoe: { id: 'from' } }, { toShoe: { id: 'to' }, fromShoe: { id: 'from' } }];
const inventoryFor = (profile, keys = profile.takes.map(take => take.key)) => ({ videos: profile.takes.filter(take => keys.includes(take.key)).map(take => ({
  id: take.key, sha256: take.sha256, available: true, classification: { dealerId },
})) });
const plan = (profile, events, transitions = {}, inventory = inventoryFor(profile)) => planFilmedDealSequence({
  profile, dealerId, events: orderFilmedPresentationEvents(events), transitions, inventory,
});
const neighborhoods = events => {
  const targets = orderFilmedPresentationEvents(events).map(filmedDealTarget);
  return targets.flatMap((target, index) => target ? [JSON.stringify([targets[index - 1] ?? null, target, targets[index + 1] ?? null])] : []);
};

// Small synthetic profiles vary poses and suffixes without importing or changing
// any real media. Their exact keys/hashes are still validated by the real planner.
function syntheticProfile({ suffix = 'u', poses = {} } = {}) {
  const targets = ['1', '2', '3', '4', '5', '6', '7', 'dealer', 'hole', 'flip'];
  let id = 0;
  const takes = targets.flatMap(target => {
    const [startPose, endPose] = poses[target] ?? (target === 'flip' ? ['VILA', 'VILA'] : target === 'hole' ? ['REDO', 'VILA'] : ['REDO', 'REDO']);
    return (startPose === 'REDO' ? ['', 'i'] : ['']).flatMap(entry => (endPose === 'REDO' ? ['', suffix] : ['']).map(exit => {
      const variant = entry + exit;
      return { key: `${target}:${variant || 'base'}`, target, variant, track: target + (exit === 'v' ? 'v' : ''),
        sha256: (++id).toString(16).padStart(64, '0'), repositoryPath: `synthetic/${target}-${variant || 'base'}.mp4`,
        frames: 4, offsetFrames: 0, startPose: entry ? 'VILA' : startPose, endPose: exit ? 'VILA' : endPose,
        firstFaceFrame: 0, contactFrame: 0, landFrame: 1, clearFrame: 2 };
    }));
  });
  const quad = [[0, 0], [1, 0], [1, 1], [0, 1]];
  return validateFilmedDealProfile({ version: 1, id: 'synthetic-coverage', game: 'blackjack',
    source: { commit: '1'.repeat(40), sources: [{ path: 'synthetic/coverage.json', sha256: '2'.repeat(64) }] },
    plane: { width: 100, height: 100, fps: 24 }, card: { width: 10, height: 15 },
    positions: Object.fromEntries(targets.slice(0, 8).map((target, index) => [target, { cx: (index + 1) * 10, cy: 50 }])),
    tracks: Object.fromEntries([...new Set(takes.map(take => take.track))].map(track => [track, { firstFrame: 0, frames: [{ q: quad, p: quad, body: quad, paper: [0, 0, 0] }] }])),
    takes, timingEvidence: 'synthetic-test',
  });
}

test('frozen comparison banks require only their reachable takes for each selected transition direction', () => {
  for (const profile of [PAOW_KEVIN_PROFILE, DRAGAN_KEVIN_PROFILE]) {
    const before = structuredClone(profile);
    for (const [index, transitions] of transitionCases.entries()) {
      const coverage = requiredNativeFilmedTakes({ profile, dealerId, transitions });
      assert.equal(coverage.complete, true); assert.equal(coverage.reason, null);
      assert.equal(coverage.requiredTakeKeys.length, [34, 18, 18, 10][index], 'comparison result, not a production count requirement');
      assert.ok(!coverage.requiredTakeKeys.includes('hole:i'), 'native hidden deal always follows a player card');
      const reduced = inventoryFor(profile, coverage.requiredTakeKeys);
      for (const events of nativeFilmedCoverageSequences()) assert.equal(plan(profile, events, transitions, reduced).complete, true);
    }
    assert.deepEqual(profile, before);
  }
});

test('coverage follows different profile suffixes and pose topology, including a bank of only VILA takes', () => {
  const appended = syntheticProfile(), coverage = requiredNativeFilmedTakes({ profile: appended, dealerId });
  assert.equal(coverage.complete, true); assert.ok(coverage.requiredTakeKeys.includes('4:iu'));
  assert.ok(!coverage.requiredTakeKeys.some(key => key.endsWith('v')));
  const changed = syntheticProfile({ poses: { hole: ['REDO', 'REDO'], flip: ['REDO', 'VILA'] } });
  const altered = requiredNativeFilmedTakes({ profile: changed, dealerId });
  assert.equal(altered.complete, true);
  for (const key of ['hole:base', 'hole:u', 'flip:base', 'flip:i']) assert.ok(altered.requiredTakeKeys.includes(key));
  assert.ok(!altered.requiredTakeKeys.includes('hole:i'));
  const resting = syntheticProfile({ poses: Object.fromEntries(changed.takes.map(take => [take.target, ['VILA', 'VILA']])) });
  for (const transitions of [{}, transitionCases[3]]) assert.deepEqual(requiredNativeFilmedTakes({ profile: resting, dealerId, transitions }),
    { complete: true, requiredTakeKeys: resting.takes.map(take => take.key).sort(), reason: null });
});

test('unreachable alternatives are optional while one missing reachable variant refuses the whole coverage result', () => {
  const profile = syntheticProfile({ suffix: 'v' });
  const take = profile.takes.find(row => row.key === '1:base');
  profile.takes.push({ ...take, key: '1:u', variant: 'u', endPose: 'VILA', sha256: 'f'.repeat(64) });
  const coverage = requiredNativeFilmedTakes({ profile, dealerId });
  assert.equal(coverage.complete, true); assert.ok(!coverage.requiredTakeKeys.includes('1:u'));
  assert.ok(!coverage.requiredTakeKeys.includes('hole:i'));
  profile.takes = profile.takes.filter(row => coverage.requiredTakeKeys.includes(row.key));
  assert.deepEqual(requiredNativeFilmedTakes({ profile, dealerId }), coverage);
  profile.takes = profile.takes.filter(row => row.key !== '4:iv');
  assert.deepEqual(requiredNativeFilmedTakes({ profile, dealerId }), { complete: false, requiredTakeKeys: [], reason: 'pose_variant_missing' });
});

test('invalid inputs refuse coverage and returned witnesses cannot modify later calls', () => {
  assert.deepEqual(requiredNativeFilmedTakes(), { complete: false, requiredTakeKeys: [], reason: 'profile_missing' });
  assert.equal(requiredNativeFilmedTakes({ profile: {}, dealerId }).reason, 'profile_invalid');
  assert.equal(requiredNativeFilmedTakes({ profile: syntheticProfile(), dealerId: '' }).reason, 'instructions_invalid');
  const first = nativeFilmedCoverageSequences(), before = structuredClone(first);
  first[0][0].type = 'changed'; first.pop();
  assert.deepEqual(nativeFilmedCoverageSequences(), before);
});

test('batch planning is identical to independent single plans, including invalid sequences and unavailable exact media', () => {
  const profile = syntheticProfile(), sequences = nativeFilmedCoverageSequences().map(orderFilmedPresentationEvents);
  const duplicate = structuredClone(sequences[0]); duplicate.splice(2, 0, structuredClone(duplicate[1]));
  const eventSequences = [...sequences, null, duplicate, Array(129).fill({ type: 'idle' }), [null]];
  for (const transitions of transitionCases) for (const unavailable of [false, true]) {
    const inventory = inventoryFor(profile);
    if (unavailable) inventory.videos.find(video => video.id === '4:base').available = false;
    const input = { profile, dealerId, transitions, inventory, eventSequences }, before = structuredClone(input);
    const expected = eventSequences.map(events => planFilmedDealSequence({ profile, dealerId, transitions, inventory, events }));
    const batch = planFilmedDealSequences(input);
    assert.deepEqual(batch.plans, expected);
    assert.equal(batch.complete, expected.every(result => result.complete));
    assert.equal(batch.reason, expected.find(result => !result.complete)?.reason ?? null);
    assert.deepEqual(input, before);
  }
});

test('each batch validates current profile and inventory without retaining stale state', () => {
  const profile = syntheticProfile(), eventSequences = nativeFilmedCoverageSequences().slice(0, 1).map(orderFilmedPresentationEvents);
  const inventory = inventoryFor(profile), input = { profile, dealerId, inventory, eventSequences };
  const original = planFilmedDealSequences(input); assert.equal(original.complete, true);
  const take = profile.takes.find(row => row.key === '1:i'), frames = take.frames;
  take.frames = 0;
  assert.equal(planFilmedDealSequences(input).reason, 'profile_invalid');
  take.frames = frames;
  const video = inventory.videos.find(row => row.id === '1:i'); video.available = false;
  assert.equal(planFilmedDealSequences(input).reason, 'exact_video_missing');
  video.available = true;
  assert.deepEqual(planFilmedDealSequences(input), original);
  assert.equal(planFilmedDealSequences().reason, 'profile_missing');
  assert.equal(planFilmedDealSequences({ ...input, eventSequences: null }).reason, 'instructions_invalid');
  assert.deepEqual(planFilmedDealSequences({ ...input, eventSequences: [] }), { profileId: profile.id, complete: true, reason: null, plans: [] });
  assert.equal(planFilmedDealSequences({ ...input, eventSequences: [], dealerId: '' }).reason, 'instructions_invalid');
  assert.equal(planFilmedDealSequences({ ...input, eventSequences: [], inventory: null }).reason, 'inventory_missing');
  assert.equal(planFilmedDealSequences({ ...input, eventSequences: Array(1) }).reason, 'instructions_invalid');
});

function roundFor(mask, first, second, dealer, tail = []) {
  const stakes = Array.from({ length: 7 }, (_, box) => mask & (1 << box) ? 5 : 0);
  const seats = stakes.filter(Boolean).length;
  const ranks = [...Array(seats).fill(first), dealer[0], ...Array(seats).fill(second), dealer[1], ...tail];
  let draw = 0;
  return new Round(stakes, { draw() {
    const r = ranks[draw]; assert.ok(r, 'the synthetic shoe must contain every actual draw');
    return { r, s: 'S', shoeDraw: ++draw };
  } });
}
const view = round => publicView({ round, paid: false, shoe: null });
function receipt(round, op, action, run) {
  const before = op === 'start' ? { round: null } : view(round);
  run();
  return presentationEvents(before, view(round), op, { action });
}

test('every actual opening and immediate settlement neighborhood is covered for all nonempty seat sets', () => {
  const covered = new Set(nativeFilmedCoverageSequences().flatMap(neighborhoods));
  for (let mask = 1; mask < 128; mask++) for (const dealer of [['9', '8'], ['K', 'A']]) {
    const round = roundFor(mask, '5', '6', dealer);
    const events = receipt(round, 'start', null, () => round.deal());
    for (const neighborhood of neighborhoods(events)) assert.ok(covered.has(neighborhood), neighborhood);
  }
});

// This exercises the real serializer's complete bounded action grammar, not
// blackjack outcomes. Actual rule-driven long/split rounds are checked below.
function actionReceipt(box, playerDraws, dealerDraws) {
  const card = (r, shoeDraw) => ({ r, s: 'S', shoeDraw });
  const hand = { box, stake: 5, splitFrom: null, cards: [card('5', 3), card('6', 4)] };
  const before = { round: { phase: 'decisions', active: 0, holeDraw: 2, dealer: [card('6', 1)], hands: [hand] } };
  const after = structuredClone(before); after.round.phase = 'settled';
  let draw = 5;
  if (playerDraws === 2) after.round.hands = hand.cards.map((old, index) => ({ ...hand, splitFrom: box, result: 0, cards: [old, card(String(5 + index), draw++)] }));
  else { if (playerDraws) after.round.hands[0].cards.push(card('10', draw++)); after.round.hands[0].result = 0; }
  after.round.dealer.push(card('6', 2), ...Array.from({ length: dealerDraws }, () => card('A', draw++)));
  return presentationEvents(before, after, 'act', { action: playerDraws === 2 ? 'split' : playerDraws ? 'double' : 'stand' });
}

test('the finite witnesses exhaust serializer neighborhoods through the full event limit, not a sampled card count', () => {
  const covered = new Set(nativeFilmedCoverageSequences().flatMap(neighborhoods));
  for (const playerDraws of [0, 1, 2]) for (const box of playerDraws ? [0, 1, 2, 3, 4, 5, 6] : [0]) {
    // Reveal, settle, result speech and (for double) its leading speech.
    const nonDeals = playerDraws === 1 ? 4 : 3;
    for (let dealerDraws = 0; dealerDraws <= 128 - nonDeals - playerDraws; dealerDraws++) {
      const events = actionReceipt(box, playerDraws, dealerDraws);
      assert.ok(events.length <= 128);
      for (const neighborhood of neighborhoods(events)) assert.ok(covered.has(neighborhood), neighborhood);
    }
  }
  const profile = syntheticProfile(), coverage = requiredNativeFilmedTakes({ profile, dealerId });
  assert.equal(plan(profile, actionReceipt(0, 0, 125), {}, inventoryFor(profile, coverage.requiredTakeKeys)).complete, true);
  assert.equal(plan(profile, actionReceipt(0, 0, 126)).reason, 'instructions_invalid');
});

test('legal hit, double, split and repeated command boundaries use only covered takes on every seat', () => {
  const profile = syntheticProfile(), coverage = requiredNativeFilmedTakes({ profile, dealerId });
  const inventory = inventoryFor(profile, coverage.requiredTakeKeys);
  for (let box = 0; box < 7; box++) for (const action of ['hit', 'double', 'split']) {
    const splitting = action === 'split';
    const round = roundFor(1 << box, splitting ? '8' : '5', splitting ? '8' : '6', ['9', '8'], ['2', '3']);
    const opening = receipt(round, 'start', null, () => round.deal());
    assert.equal(plan(profile, opening, {}, inventory).complete, true);
    const acted = receipt(round, 'act', action, () => round.act(action));
    assert.equal(acted.filter(event => event.type === 'deal' && event.to === 'box').length, splitting ? 2 : 1);
    assert.equal(plan(profile, acted, {}, inventory).complete, true);
    while (round.phase === 'decisions') {
      const stood = receipt(round, 'act', 'stand', () => round.act('stand'));
      assert.equal(plan(profile, stood, {}, inventory).complete, true);
    }
  }
});

test('a legal twelve-card S17 dealer run is covered and cannot play with a missing interior take', () => {
  const round = roundFor(1, '9', '9', ['A', 'A'], [...Array(4).fill('A'), '6', ...Array(5).fill('A')]);
  round.deal(); round.resolveInsurance([false]);
  const events = receipt(round, 'act', 'stand', () => round.act('stand'));
  assert.equal(round.phase, 'settled'); assert.equal(round.dealer.length, 12);
  assert.equal(events.filter(event => event.type === 'deal').length, 10);
  const profile = syntheticProfile(), coverage = requiredNativeFilmedTakes({ profile, dealerId });
  const inventory = inventoryFor(profile, coverage.requiredTakeKeys);
  assert.equal(plan(profile, events, {}, inventory).complete, true);
  inventory.videos = inventory.videos.filter(video => video.id !== 'dealer:base');
  assert.equal(plan(profile, events, {}, inventory).reason, 'exact_video_missing');
});
