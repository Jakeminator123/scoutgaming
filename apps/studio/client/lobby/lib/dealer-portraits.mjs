// Lobby artwork only. These IDs never add dealers to a published room or grant
// launch access; the registered catalog remains the authority for every choice.
const assets = '/admin/_assets/lobby/';
// Portrait clips are decorative identity media, never a blackjack/roulette
// gameplay bank. The selected published room supplies the game and dealer ID.
export const dealerPortraits = [
  { id: 'astrid', name: 'Astrid', image: `${assets}images/dealers/astrid.jpg`, clips: [`${assets}videos/dealers/astrid-look.mp4`] },
  { id: 'marten', name: 'Mårten', image: `${assets}images/dealers/marten.jpg`, clips: [`${assets}videos/dealers/marten-look.mp4`] },
  { id: 'dragge', name: 'Dragge', image: `${assets}images/dealers/dragge.jpg`, clips: [`${assets}videos/dealers/dragge-shirt.mp4`] },
  { id: 'anna', name: 'Anna', image: `${assets}images/dealers/anna.png`, clips: [`${assets}videos/dealers/anna.mp4`] },
];
export const portraitBackdrop = `${assets}images/lobby/room-salongen.png`;

// Dragge is registered as `dragan` since the Kevin import
// (apps/studio/lib/dealer-import-kevin-source.json). The alias is by exact ID only.
const artworkAliases = Object.freeze({ dragan: 'dragge' });

// Match an exact registered ID, never an approximate display name.
export function portraitFor(dealer) {
  const id = Object.hasOwn(artworkAliases, dealer.id) ? artworkAliases[dealer.id] : dealer.id;
  return dealerPortraits.find(portrait => portrait.id === id);
}

/**
 * Published dealers first, in publication order. Portraits the room does not
 * publish follow as locked teasers, so step 3 is never empty before a room is
 * chosen. Teasers are never available and never produce a launch link.
 */
export function dealerCards(availableDealers = []) {
  const shown = new Set(availableDealers.map(portraitFor).filter(Boolean));
  return [
    ...availableDealers.map(dealer => ({ ...dealer, available: true })),
    ...dealerPortraits.filter(portrait => !shown.has(portrait))
      .map(portrait => ({ id: portrait.id, name: portrait.name, available: false })),
  ];
}
