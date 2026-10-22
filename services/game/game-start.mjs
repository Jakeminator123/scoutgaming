import {approvedGameQuery} from '../../packages/navigation/game-entry.mjs';

// The engine sends players to the one public game start, /game, and names the
// game. Its /blackjack and /play/roulette documents stay behind that address.
// Absent `game` means blackjack; an unknown or repeated value is no game.
// Launch credentials never survive into the address.
export function publicGameStart(input,{origin,games = ['blackjack','roulette']} = {}) {
  const source = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  const requested = source.getAll('game');
  const game = requested.length ? requested.length === 1 && requested[0] : 'blackjack';
  if (!games.includes(game)) return null;
  const query = approvedGameQuery(source,{origin,includeLaunch:false});
  query.delete('game');
  return '/game?'+new URLSearchParams([['game',game],...query]);
}
