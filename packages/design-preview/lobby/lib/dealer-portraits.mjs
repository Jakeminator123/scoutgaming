// Lobby artwork only. These IDs never add dealers to a published room or grant
// launch access; the registered catalog remains the authority for every choice.
const assets = '/admin/_assets/lobby/';
export const dealerPortraits = [
  { id: 'astrid', name: 'Astrid', image: `${assets}images/dealers/astrid.jpg`, clips: [`${assets}videos/dealers/astrid-look.mp4`] },
  { id: 'marten', name: 'Mårten', image: `${assets}images/dealers/marten.jpg`, clips: [`${assets}videos/dealers/marten-look.mp4`] },
  { id: 'paow', name: 'Paow', image: `${assets}images/dealers/paow.jpg`, clips: [`${assets}videos/dealers/paow-hair.mp4`] },
  { id: 'dragge', name: 'Dragge', image: `${assets}images/dealers/dragge.jpg`, clips: [`${assets}videos/dealers/dragge-shirt.mp4`] },
];
export const portraitBackdrop = `${assets}images/lobby/room-salongen.png`;

// PAOW is published as paow-v2 in the current public catalog. This explicit
// artwork alias preserves that registered ID in selection and launch URLs.
const artworkAliases = { 'paow-v2': 'paow' };

// Match an exact registered ID, never an approximate display name.
export function portraitFor(dealer) {
  return dealerPortraits.find(portrait => portrait.id === (artworkAliases[dealer.id] ?? dealer.id));
}

export function dealerCards(availableDealers = []) {
  return [
    ...dealerPortraits.flatMap(portrait => {
      const registered = availableDealers.filter(dealer => portraitFor(dealer) === portrait);
      return registered.length
        ? registered.map(dealer => ({ ...dealer, available: true }))
        : [{ id: portrait.id, name: portrait.name, available: false }];
    }),
    ...availableDealers.filter(dealer => !portraitFor(dealer)).map(dealer => ({ ...dealer, available: true })),
  ];
}
