import {readChoices,writeChoices} from '../presentation/runtime/player-choices.mjs';
import {gameStartPath} from '../navigation/game-entry.mjs';

export function roomSelection(room,preferred={}) {
  const dealer=room.dealers.find(row=>row.id===preferred.dealer)
    ??room.dealers.find(row=>row.id===room.dealerDefault);
  if(!dealer)return null;
  const result={dealer:dealer.id};
  if(dealer.independentLayers)for(const [key,layer] of [['tableAsset',dealer.table],['background',dealer.background]]) {
    if(!layer.enabled)continue;
    const value=layer.allowed.find(row=>row.id===preferred[key])?.id??layer.default;
    if(value&&layer.allowed.some(row=>row.id===value))result[key]=value;
  }
  return result;
}

export function roomLaunch(catalog,roomId,preferred,{directPlay=true}={}) {
  const room=catalog.rooms.find(row=>row.id===roomId);
  if(!room)return null;
  const choices=roomSelection(room,preferred);
  if(!choices||choices.dealer!==preferred?.dealer)return null;
  const path=gameStartPath({game:room.game??'blackjack',operator:catalog.operator.slug,table:room.id,dealer:choices.dealer});
  return {choices,href:directPlay?path:'/player-login?returnTo='+encodeURIComponent(path)};
}

// The engine validates these stored preferences against this room's live package
// again. They cannot grant a dealer or asset. Dealer also travels in the URL.
export function rememberRoomSelection(storage,operator,selection) {
  writeChoices(storage,operator,selection);
  const stored=readChoices(storage,operator);
  return ['tableAsset','background'].every(key=>stored[key]===selection[key]);
}


export const readRoomSelection = (storage, operator) => readChoices(storage, operator);
