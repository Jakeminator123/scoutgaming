import {clipSlots,currentClipId} from './connected-studio.mjs';
import {registeredFilmedProfile} from '../../../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {NATIVE_ROOM_SPEECH_SLOTS} from '../../../../../packages/presentation/contracts/native-room-game-budget.mjs';

// What a dealer needs before publication (native-room-game-material.mjs:115-122): the whole deal bank,
// idle and the ten speech slots. Counted from the project's lines[] and the media register, per slot.
const bound=(project,inventory,dealerId,slot)=>Boolean(currentClipId(project,dealerId,slot,undefined,inventory));
export function dealerCoverage(project,inventory,dealerId){
  const slots=clipSlots(project,inventory,dealerId,'blackjack').filter(slot=>!slot.planned&&!slot.intakeOnly&&!slot.localOnly);
  const count=rows=>({bound:rows.filter(slot=>bound(project,inventory,dealerId,slot)).length,total:rows.length});
  const deal=count(slots.filter(slot=>/^(?:deal|reveal)\./.test(slot.eventId)));
  const speech=count(slots.filter(slot=>slot.sourceType==='speak'&&NATIVE_ROOM_SPEECH_SLOTS.includes(slot.situation)));
  const idle=count(slots.filter(slot=>slot.eventId==='idle.ready'));
  const optional=count(slots.filter(slot=>slot.sourceType==='speak'&&!NATIVE_ROOM_SPEECH_SLOTS.includes(slot.situation)||slot.eventId==='transition.shoe'));
  const complete=deal.total>0&&deal.bound===deal.total&&idle.total>0&&idle.bound===idle.total&&speech.total>0&&speech.bound===speech.total;
  const anyClip=slots.some(slot=>bound(project,inventory,dealerId,slot));
  return {deal,speech,idle,optional,complete,anyClip,speechProfile:project.dealers.find(row=>row.id===dealerId)?.speechProfile??null};
}
/** The menu's counters, from the catalog Admin already reads: dealers whose clips are missing (Översikt's
 *  "Klipp saknas") and spelbord that are not archived but cannot be played. Keyed by menu href. */
export function adminMenuCounts(workspace){
  if(!workspace)return {};
  const dealers=workspace.project.dealers.filter(dealer=>!dealerCoverage(workspace.project,workspace.inventory,dealer.id).complete).length;
  const rooms=(workspace.catalog.administration?.rooms??[]).filter(room=>room.state!=='archived'&&room.playable!==true).length;
  return {'/admin/dealers':dealers,'/admin/companies':rooms};
}
/** A still for the dealer's card: the bound idle clip (its first second), else null for initials. */
export function dealerStill(project,inventory,dealerId){
  const slot=clipSlots(project,inventory,dealerId,'blackjack').find(row=>row.eventId==='idle.ready'&&!row.planned);
  const id=slot?currentClipId(project,dealerId,slot,undefined,inventory):'';
  const video=id?inventory.videos.find(row=>row.id===id&&row.available!==false):undefined;
  return video?.previewUrl?{url:video.previewUrl,image:/^image\//.test(video.contentType??''),label:video.label}:null;
}
/** Scene templates that allow the dealer (lanes[].layers.dealer.allowed). */
export function dealerTemplates(project,dealerId){
  return (project.lanes??[]).filter(lane=>lane.layers.dealer.allowed.includes(dealerId)).map(lane=>({id:lane.id,label:lane.label,isDefault:lane.layers.dealer.default===dealerId}));
}
/** Rooms and companies that use the dealer, from the registered catalog. */
export function dealerUses(catalog,dealerId){
  const rooms=catalog.administration.rooms.filter(room=>room.state!=='archived'&&room.dealerIds.includes(dealerId));
  const operatorIds=[...new Set(rooms.map(room=>room.operatorId))];
  return {rooms,operators:catalog.administration.operators.filter(operator=>operatorIds.includes(operator.id))};
}
// Without its own filmed profile a dealer uses PAOW's landings (registry.mjs: filmedProfileOrPaow).
export const dealerLandingsNote=dealerId=>registeredFilmedProfile(dealerId)?null:"Ärver PAOW:s landningar";
