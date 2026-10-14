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


// Match an exact registered ID, never an approximate display name.
export function portraitFor(dealer) {
  return dealerPortraits.find(portrait => portrait.id === dealer.id);
}

export function dealerCards(availableDealers = []) {
  return availableDealers.map(dealer => ({ ...dealer, available: true }));
}
