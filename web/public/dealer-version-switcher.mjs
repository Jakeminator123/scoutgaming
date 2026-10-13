import {studioPreviewFromDocument} from './studio-preview-client.mjs';
import {isActiveDealerId,validatePublicRegisteredDealers} from './dealer-identity.mjs';
import {gameChoicesFromDocument,isGameLaneId} from './game-lanes.mjs';
import {approvedGameQuery} from './game-entry-contract.mjs';

// Version is retained for callers, but only the current document's player exists.
export function dealerVersionPath(dealer, _version, observerSearch='') {
  const dataset=globalThis.document?.documentElement?.dataset;
  const registry=validatePublicRegisteredDealers(JSON.parse(dataset?.gameRegisteredDealers??'[]'));
  const layered=dataset?.gamePresentation==='layered'&&dataset.gameLane==='layer-preview'&&dealer==='dragge';
  if(!isActiveDealerId(dealer)||dataset?.gamePresentation==='layered'&&!layered||!registry.some(row=>row.id===dealer)&&!layered)throw Error('Dealer is not registered');
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
  const path=dataset.gamePath==='/blackjack'?'/blackjack':'/';
  return path+'?'+approvedGameQuery(query,{origin:globalThis.location?.origin,includeLaunch:false});
}
