import test from 'node:test';
import assert from 'node:assert/strict';
import { suppliedDealerArtwork, isSuppliedPortraitVideo } from './dealer-artwork.mjs';

test('retired Paow identities never inherit a supplied portrait or approved clip', () => {
  for (const id of ['paow', 'paow-v2']) assert.equal(suppliedDealerArtwork({ id, name: 'PAOW' }), undefined);
  assert.equal(isSuppliedPortraitVideo('/admin/_assets/lobby/images/dealers/paow.jpg', { src: '/admin/_assets/lobby/videos/dealers/paow-hair.mp4', approved: true, source: 'supplied-portrait' }), false);
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
  const { image, approvedVideo } = suppliedDealerArtwork({ id: 'astrid', name: 'Astrid' });
  assert.equal(isSuppliedPortraitVideo('/admin/_assets/lobby/images/dealers/dragge.jpg', approvedVideo), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, src: 'https://private.invalid/take.mp4' }), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, approved: false }), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, source: 'private-catalogue' }), false);
});
