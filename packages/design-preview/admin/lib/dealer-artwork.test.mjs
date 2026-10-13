import test from 'node:test';
import assert from 'node:assert/strict';
import { suppliedDealerArtwork, isSuppliedPortraitVideo } from './dealer-artwork.mjs';

test('supplied PAOW portrait matches existing published identity and its exact corresponding video', () => {
  const artwork = suppliedDealerArtwork({ id: 'paow-v2', name: 'PAOW' });
  assert.equal(artwork.image, '/admin/_assets/lobby/images/dealers/paow.jpg');
  assert.equal(artwork.approvedVideo.src, '/admin/_assets/lobby/videos/dealers/paow-hair.mp4');
  assert.equal(isSuppliedPortraitVideo(artwork.image, artwork.approvedVideo), true);
  assert.deepEqual(suppliedDealerArtwork({ id: 'paow-v2', name: ' paow ' }), artwork);
});

test('unverified identity, label mismatch and unpublished slots never inherit another person\'s portrait', () => {
  for (const dealer of [{ id: 'other', name: 'PAOW' }, { id: 'paow-v2', name: 'Johanna' },
    { id: '__proto__', name: 'PAOW' }, { id: 'unpublished-1', name: 'Ej publicerad' },
    { id: 'dragge', name: 'Dragge' }, { id: 'marten', name: 'Mårten' }, { id: 'paow', name: 'PAOW' }]) {
    assert.equal(suppliedDealerArtwork(dealer), undefined);
  }
});

test('registered Astrid receives her supplied pair without creating a dealer or publication', () => {
  const artwork = suppliedDealerArtwork({ id: 'astrid', name: 'Astrid' });
  assert.equal(artwork.image, '/admin/_assets/lobby/images/dealers/astrid.jpg');
  assert.equal(artwork.approvedVideo.src, '/admin/_assets/lobby/videos/dealers/astrid-look.mp4');
  assert.equal(isSuppliedPortraitVideo(artwork.image, artwork.approvedVideo), true);
});

test('portrait playback requires an explicit static poster/video pair, no arbitrary URL or private catalogue value', () => {
  const { image, approvedVideo } = suppliedDealerArtwork({ id: 'paow-v2', name: 'PAOW' });
  assert.equal(isSuppliedPortraitVideo('/admin/_assets/lobby/images/dealers/dragge.jpg', approvedVideo), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, src: 'https://private.invalid/take.mp4' }), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, approved: false }), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, source: 'private-catalogue' }), false);
});
