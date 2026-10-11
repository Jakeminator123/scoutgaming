import {operatorPublicView} from './player-operator.mjs';
import {validatePublicOperatorRooms} from '../../../web/public/operator-rooms-contract.mjs';
import {readChoices,writeChoices} from '../../../web/public/player-choices.mjs';
import {isOperatorSlug} from '../../../web/public/game-lanes.mjs';

export async function loadRoomCatalogue(slug,{fetchImpl=fetch,signal}={}) {
  if(!isOperatorSlug(slug))return {status:'not-found'};
  try {
    const response=await fetchImpl('/api/operators/'+encodeURIComponent(slug)+'/rooms',{
      headers:{accept:'application/json'},cache:'no-store',redirect:'error',signal,
    });
    if(response.status===404)return {status:'not-found'};
    if(!response.ok)return {status:'unavailable'};
    const text=await response.text();
    if(text.length>256000)return {status:'unavailable'};
    return {status:'ready',catalog:validatePublicOperatorRooms(JSON.parse(text),{operatorSlug:slug})};
  } catch {return {status:'unavailable'};}
}

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
  const path=room.playUrl+'&dealer='+encodeURIComponent(choices.dealer);
  return {choices,href:directPlay?path:'/player-login?returnTo='+encodeURIComponent(path)};
}

// The engine validates these stored preferences against this room's live package
// again. They cannot grant a dealer or asset. Dealer also travels in the URL.
export function rememberRoomSelection(storage,operator,selection) {
  writeChoices(storage,operator,selection);
  const stored=readChoices(storage,operator);
  return ['tableAsset','background'].every(key=>!selection[key]||stored[key]===selection[key]);
}

export async function loadOperatorCatalogue({fetchImpl=fetch,signal}={}) {
  try {
    const response=await fetchImpl('/api/operators',{
      headers:{accept:'application/json'},cache:'no-store',redirect:'error',signal,
    });
    if(!response.ok)return {status:'unavailable'};
    const text=await response.text();
    if(text.length>256000)return {status:'unavailable'};
    const data=JSON.parse(text);
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).join(',')!=='operators'
      ||!Array.isArray(data.operators)||data.operators.length>1000)return {status:'unavailable'};
    const operators=[],seen=new Set();
    for(const row of data.operators){
      const operator=operatorPublicView(row,row?.slug);
      if(!operator||seen.has(operator.slug))return {status:'unavailable'};
      seen.add(operator.slug);operators.push(operator);
    }
    return {status:'ready',operators};
  } catch {return {status:'unavailable'};}
}

// Legacy demo links land in the same lobby; forward only one valid operator.
export function demoLobbyPath(params={}) {
  return typeof params.operator==='string'&&isOperatorSlug(params.operator)
    ? '/play?'+new URLSearchParams({operator:params.operator}).toString() : '/play';
}
