// Public, user-supplied portrait gestures (the lobby's dealer portraits). These are presentation
// artwork only, never speech takes or a source of dealer/room permissions.
const base = '/admin/_assets/lobby';
const pair = (names, image, video) => Object.freeze({ names: Object.freeze(names), image: `${base}/images/dealers/${image}`, video: `${base}/videos/dealers/${video}` });
const pairs = Object.freeze({
  astrid: pair(['Astrid'], 'astrid.jpg', 'astrid-look.mp4'),
  marten: pair(['Mårten', 'Marten'], 'marten.jpg', 'marten-look.mp4'),
  // Dragge is registered as `dragan` (named Dragan) since the Kevin import (apps/studio/lib/dealer-import-kevin-source.json).
  dragge: pair(['Dragge', 'Dragan'], 'dragge.jpg', 'dragge-shirt.mp4'),
  anna: pair(['Anna'], 'anna.png', 'anna.mp4'),
  paow: pair(['Paow'], 'paow.jpg', 'paow-hair.mp4'),
});
// Match identities explicitly: the registered id must be listed here AND the display name must be one of
// the pair's names (case-insensitive, so "PAOW" and "Paow" match). A matching label alone is insufficient.
// Same aliases as the lobby (client/lobby/lib/dealer-portraits.mjs): PAOW was published as `paow-v2`.
const identities = Object.freeze({ astrid: 'astrid', marten: 'marten', dragge: 'dragge', dragan: 'dragge', anna: 'anna', paow: 'paow', 'paow-v2': 'paow' });
const normalizeName = value => typeof value === 'string' ? value.trim().normalize('NFC').toLocaleLowerCase('sv') : '';

export function suppliedDealerArtwork(dealer) {
  const key = dealer && typeof dealer.id === 'string' && Object.hasOwn(identities, dealer.id) ? identities[dealer.id] : null;
  const match = key ? pairs[key] : null;
  const name = normalizeName(dealer?.name);
  if (!match || !name || !match.names.some(candidate => normalizeName(candidate) === name)) return undefined;
  return { image: match.image, approvedVideo: { src: match.video, approved: true, source: 'supplied-portrait' } };
}

export function isSuppliedPortraitVideo(image, video) {
  return video?.approved === true && video.source === 'supplied-portrait'
    && Object.values(pairs).some(row => row.image === image && row.video === video.src);
}
