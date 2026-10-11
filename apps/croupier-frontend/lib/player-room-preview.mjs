import {isOperatorSlug,isGameLaneId} from '../../../web/public/game-lanes.mjs';
import {validatePublicOperatorPreview} from '../../../web/public/operator-preview-contract.mjs';
// Exact IDs only. Portraits never add dealers to a room or authorize media.
const portraits=Object.freeze(Object.fromEntries(['astrid','amira','vera','mei','paow','dragge','marten'].map(id=>[id,'/images/lobby/'+id+'-portrait.jpg'])));
export function dealerPortrait(id){return Object.hasOwn(portraits,id)?portraits[id]:null;}
export async function loadRoomPreview(catalog,room,dealerId,{fetchImpl=globalThis.fetch,signal}={}){
 if(!isOperatorSlug(catalog?.operator?.slug)||!isGameLaneId(room?.id)||!Number.isSafeInteger(catalog.packageRevision)||catalog.packageRevision<1||!room.dealers.some(dealer=>dealer.id===dealerId))return {status:'unavailable'};
 const expected={operatorSlug:catalog.operator.slug,roomId:room.id,packageRevision:catalog.packageRevision,dealerId};
 try{
  const query=new URLSearchParams({dealer:dealerId,revision:String(catalog.packageRevision)});
  const response=await fetchImpl('/api/operators/'+expected.operatorSlug+'/rooms/'+room.id+'/preview?'+query,{signal,cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
  if(response.status===409)return {status:'changed'};
  if(!response.ok)return {status:'unavailable'};
  const preview=validatePublicOperatorPreview(await response.json(),expected),allowed=room.dealers.find(dealer=>dealer.id===dealerId);
  // A preview cannot widen the current catalogue, even if both replies are valid.
  if(preview.independentLayers!==allowed.independentLayers||preview.media.tables.some(item=>!allowed.table.allowed.some(row=>row.id===item.id))||preview.media.backgrounds.some(item=>!allowed.background.allowed.some(row=>row.id===item.id)))return {status:'unavailable'};
  return {status:'ready',preview};
 }catch{return {status:'unavailable'};}
}
