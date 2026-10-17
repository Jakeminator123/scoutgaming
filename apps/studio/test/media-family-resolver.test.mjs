import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaSituationForEvent, resolveMediaFamily, resolveMediaFamilySelection } from '../lib/media-family-resolver.mjs';

const families = [
  { id: 'astrid/deal.player.centre/box2', dealerId: 'astrid', eventId: 'deal.player.centre', situation: 'box2', playbackType: 'once', standardIds: ['standard'], variantIds: ['variant'] },
  { id: 'astrid/deal.player.centre/box3', dealerId: 'astrid', eventId: 'deal.player.centre', situation: 'box3', playbackType: 'once', standardIds: ['other-standard'], variantIds: [] },
];
const inventory = { families, videos: [
  { id: 'standard', familyId: families[0].id, role: 'standard', available: true },
  { id: 'variant', familyId: families[0].id, role: 'variant', available: true },
  { id: 'other-standard', familyId: families[1].id, role: 'standard', available: true },
] };

test('published event resolves one exact family and never borrows a neighbouring box', () => {
  assert.equal(mediaSituationForEvent('deal.player.centre', { type: 'deal', to: 'box', box: 2 }), 'box2');
  assert.equal(resolveMediaFamily(inventory, { dealerId: 'astrid', eventId: 'deal.player.centre', event: { type: 'deal', to: 'box', box: 2 } }).id, families[0].id);
  assert.equal(resolveMediaFamily(inventory, { dealerId: 'astrid', eventId: 'deal.player.centre', event: { type: 'deal', to: 'box', box: 4 } }), null);
});

test('card identity stays event data while box alone selects the deal video family', () => {
  const event = { type: 'deal', to: 'box', box: 3, handIndex: 0, faceDown: false, card: { r: '5', s: '♠' } };
  assert.equal(mediaSituationForEvent('deal.player.centre', event), 'box3');
  assert.equal(resolveMediaFamily(inventory, { dealerId: 'astrid', eventId: 'deal.player.centre', event }).id, 'astrid/deal.player.centre/box3');
  assert.deepEqual(event.card, { r: '5', s: '♠' });
  assert.equal(event.handIndex, 0);
});

test('dealer upcard is exact and a hole card does not borrow it', () => {
  assert.equal(mediaSituationForEvent('deal.dealer', { type: 'deal', to: 'dealer', faceDown: false }), 'dealer-up');
  assert.equal(mediaSituationForEvent('deal.dealer', { type: 'deal', to: 'dealer', faceDown: true }), 'dealer-hole');
});

test('zero, unknown, missing and cross-family variants use the exact family standard', () => {
  assert.equal(resolveMediaFamilySelection(inventory, families[0]).selected.id, 'standard');
  assert.equal(resolveMediaFamilySelection(inventory, families[0], 'unknown').selected.id, 'standard');
  assert.equal(resolveMediaFamilySelection(inventory, families[0], 'other-standard').selected.id, 'standard');
  const unavailable = structuredClone(inventory); unavailable.videos.find(item => item.id === 'variant').available = false;
  assert.equal(resolveMediaFamilySelection(unavailable, families[0], 'variant').selected.id, 'standard');
  assert.equal(resolveMediaFamilySelection(inventory, families[0], 'variant').selected.id, 'variant');
});

test('missing standard ends at the 2D boundary without another-family fallback', () => {
  const unavailable = structuredClone(inventory); unavailable.videos.find(item => item.id === 'standard').available = false;
  const result = resolveMediaFamilySelection(unavailable, families[0], 'unknown');
  assert.equal(result.selected, null);
  assert.equal(result.reason, 'standard_unavailable_2d');
});
