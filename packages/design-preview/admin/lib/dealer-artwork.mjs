// Public, user-supplied portrait gestures from public.zip. These are presentation
// artwork only, never speech takes or a source of dealer/room permissions.
const base = '/admin/_assets/lobby';
const pairs = Object.freeze({
  paow: Object.freeze({ name: 'PAOW', image: `${base}/images/dealers/paow.jpg`, video: `${base}/videos/dealers/paow-hair.mp4` }),
  dragge: Object.freeze({ name: 'Dragge', image: `${base}/images/dealers/dragge.jpg`, video: `${base}/videos/dealers/dragge-shirt.mp4` }),
  marten: Object.freeze({ name: 'Mårten', image: `${base}/images/dealers/marten.jpg`, video: `${base}/videos/dealers/marten-look.mp4` }),
  astrid: Object.freeze({ name: 'Astrid', image: `${base}/images/dealers/astrid.jpg`, video: `${base}/videos/dealers/astrid-look.mp4` }),
});
// Match identities explicitly. A matching display label alone is insufficient.
const identities = Object.freeze({ 'paow-v2': 'paow', astrid: 'astrid' });
const normalizeName = value => typeof value === 'string' ? value.trim().normalize('NFC').toLocaleLowerCase('sv') : '';

export function suppliedDealerArtwork(dealer) {
  const key = dealer && Object.hasOwn(identities, dealer.id) ? identities[dealer.id] : null;
  const pair = key ? pairs[key] : null;
  if (!pair || normalizeName(dealer.name) !== normalizeName(pair.name)) return undefined;
  return { image: pair.image, approvedVideo: { src: pair.video, approved: true, source: 'supplied-portrait' } };
}

export function isSuppliedPortraitVideo(image, video) {
  return video?.approved === true && video.source === 'supplied-portrait'
    && Object.values(pairs).some(pair => pair.image === image && pair.video === video.src);
}
