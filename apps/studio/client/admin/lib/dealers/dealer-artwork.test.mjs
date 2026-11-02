import test from 'node:test';
import assert from 'node:assert/strict';
import { suppliedDealerArtwork, isSuppliedPortraitVideo } from './dealer-artwork.mjs';

const lobby = '/admin/_assets/lobby';

test('registered lobby dealers receive their portrait and clip when both id and name match', () => {
  const expected = [
    [{ id: 'paow', name: 'PAOW' }, 'paow.jpg', 'paow-hair.mp4'],
    [{ id: 'paow', name: 'Paow' }, 'paow.jpg', 'paow-hair.mp4'],
    [{ id: 'paow-v2', name: ' paow ' }, 'paow.jpg', 'paow-hair.mp4'],
    [{ id: 'anna', name: 'Anna' }, 'anna.png', 'anna.mp4'],
    [{ id: 'dragge', name: 'Dragge' }, 'dragge.jpg', 'dragge-shirt.mp4'],
    [{ id: 'dragan', name: 'Dragan' }, 'dragge.jpg', 'dragge-shirt.mp4'],
    [{ id: 'marten', name: 'Mårten' }, 'marten.jpg', 'marten-look.mp4'],
    [{ id: 'marten', name: 'MÅRTEN' }, 'marten.jpg', 'marten-look.mp4'],
  ];
  for (const [dealer, image, video] of expected) {
    const artwork = suppliedDealerArtwork(dealer);
    assert.equal(artwork?.image, `${lobby}/images/dealers/${image}`, dealer.id + ' ' + dealer.name);
    assert.equal(artwork.approvedVideo.src, `${lobby}/videos/dealers/${video}`);
    assert.equal(isSuppliedPortraitVideo(artwork.image, artwork.approvedVideo), true);
  }
});

test('unverified identity, label mismatch and unpublished slots never inherit another person\'s portrait', () => {
  for (const dealer of [{ id: 'other', name: 'PAOW' }, { id: 'paow-v2', name: 'Johanna' }, { id: 'paow', name: 'Dragge' }, { id: 'astrid', name: 'Astrid' },
    { id: '__proto__', name: 'PAOW' }, { id: 'constructor', name: 'Anna' }, { id: 'unpublished-1', name: 'Ej publicerad' },
    { id: 'dragan', name: 'Anna' }, { id: 'anna', name: '' }, { id: 'viktor', name: 'Viktor' }, { id: 'new', name: 'Paow' }, null, undefined]) {
    assert.equal(suppliedDealerArtwork(dealer), undefined, JSON.stringify(dealer));
  }
});

test('portrait playback requires an explicit static poster/video pair, no arbitrary URL or private catalogue value', () => {
  const { image, approvedVideo } = suppliedDealerArtwork({ id: 'paow', name: 'Paow' });
  assert.equal(isSuppliedPortraitVideo(`${lobby}/images/dealers/dragge.jpg`, approvedVideo), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, src: 'https://private.invalid/take.mp4' }), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, approved: false }), false);
  assert.equal(isSuppliedPortraitVideo(image, { ...approvedVideo, source: 'private-catalogue' }), false);
});
