import {approvedGameQuery} from '../../packages/navigation/game-entry.mjs';
import {requestedOperator} from '../../packages/navigation/operator-entry.mjs';
import {isOperatorSlug} from '../../packages/navigation/operator-slug.mjs';

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

// A partner launch is a blackjack start. A key bound to a company (docs/plans/NYCKEL-BOLAG.md)
// always lands at that company: the engine passes its slug as `operator`, after checking any
// ?operator= against the signed claims. A launch without a company and without ?operator=
// lands in the lobby (L1): a dealer, lane or table without a company is never a game. Older
// launch URLs still carry dealer=astrid.
export function launchGameStart(input,{origin,operator} = {}) {
  const source = new URLSearchParams(input instanceof URLSearchParams ? input : new URLSearchParams(input));
  if (operator !== undefined && operator !== null) {
    if (!isOperatorSlug(operator)) throw new TypeError('Invalid launch operator');
    source.set('operator', operator);
  }
  if (requestedOperator(source) === undefined) for (const key of ['dealer','presentation','lane','table','rehearsal']) source.delete(key);
  return publicGameStart(source,{origin,games:['blackjack']});
}
