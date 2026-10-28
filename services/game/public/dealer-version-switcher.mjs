import {studioPreviewFromDocument} from './studio-preview-client.mjs';
import {isActiveDealerId,validatePublicRegisteredDealers} from '../../../packages/presentation/contracts/dealer-identity.mjs';
import {gameChoicesFromDocument} from '../../../packages/presentation/contracts/game-selection.mjs';
import {isGameLaneId} from '../../../packages/presentation/contracts/game-lane-id.mjs';
import {approvedGameQuery} from '../../../packages/navigation/game-entry.mjs';

// Version is retained for callers, but only the current document's player exists.
export function dealerVersionPath(dealer, _version, observerSearch='') {
  const dataset=globalThis.document?.documentElement?.dataset;
  const registry=validatePublicRegisteredDealers(JSON.parse(dataset?.gameRegisteredDealers??'[]'));
  if(!isActiveDealerId(dealer)||(dataset?.gamePresentation??'local')!=='local'||!registry.some(row=>row.id===dealer))throw Error('Dealer is not registered');
  if(!isGameLaneId(dataset?.gameLane))throw Error('No configured game lane');
  if(dataset.gameChoices!==undefined){
    const choices=gameChoicesFromDocument(dataset.gameChoices,{registeredDealerIds:registry.map(row=>row.id)});
    if(!choices.dealers.includes(dealer))throw Error('Dealer is not available in this room');
  }
  const preview=studioPreviewFromDocument(dataset,globalThis.location?.pathname??'/');
  if(preview)return '/studio-preview/'+preview.sessionId+'?'+new URLSearchParams({dealer});
  const query=new URLSearchParams(observerSearch);
  query.set('dealer',dealer);query.set('lane',dataset.gameLane);query.set('presentation',dataset.gamePresentation);
  for(const [name,key] of [['operator','gameOperator'],['table','gameRoomId']]){
    if(dataset[key])query.set(name,dataset[key]);else query.delete(name);
  }
  const approved=approvedGameQuery(query,{origin:globalThis.location?.origin,includeLaunch:false});
  approved.delete('game');
  // The public game start names the game; the engine's blackjack document stays behind it.
  return dataset.gamePath==='/blackjack' ? '/game?'+new URLSearchParams([['game','blackjack'],...approved]) : '/?'+approved;
}
