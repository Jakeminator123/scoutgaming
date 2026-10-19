import test from 'node:test';
import assert from 'node:assert/strict';
import { clipPoseChain } from './clip-pose-chain.mjs';

const deal = { dealerId: 'dragan', eventId: 'deal.player.left', situation: 'box0', kind: 'action' };

test('a declared shoe chain is shown for deal, reveal and transition clips', () => {
  assert.deepEqual(clipPoseChain({ ...deal, startPose: 'VILA', endPose: 'REDO' }), { declared: true, text: 'VILA → REDO' });
  assert.equal(clipPoseChain({ ...deal, eventId: 'reveal.dealer', situation: 'dealer-hole', startPose: 'VILA', endPose: 'VILA' }).text, 'VILA → VILA');
  assert.equal(clipPoseChain({ ...deal, eventId: 'transition.shoe', situation: 'from-shoe', startPose: 'REDO', endPose: 'VILA' }).text, 'REDO → VILA');
});

test('a shoe clip without a complete declared chain is marked as not stated', () => {
  for (const poses of [{}, { startPose: 'VILA' }, { startPose: 'REDO', endPose: 'unverified' }]) {
    assert.deepEqual(clipPoseChain({ ...deal, ...poses }), { declared: false, text: 'Poskedja ej angiven' });
  }
});

test('speech, idle, reaction, roulette and non-video material never get a chain', () => {
  for (const metadata of [
    null,
    { ...deal, eventId: 'speak.goodluck', situation: 'goodluck', kind: 'speech' },
    { ...deal, eventId: 'idle.ready', situation: '', kind: 'idle' },
    { ...deal, eventId: 'settle.win', situation: '', kind: 'reaction' },
    { ...deal, eventId: 'roulette.idle', game: 'roulette', startPose: 'VILA', endPose: 'VILA' },
    { ...deal, mediaType: 'image', startPose: 'VILA', endPose: 'REDO' },
  ]) assert.equal(clipPoseChain(metadata), null);
});
