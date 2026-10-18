// Resolve visual card placement against the authoritative round. Filmed events
// carry draw identities and absolute boxes, never card values or live indexes.
export function movingDealCard(round,event){
  const dealer=event.to==='dealer';
  const liveIndex=dealer?null:round.live().findIndex(h=>h.box===event.box);
  const hand=dealer?round.dealer:round.live()[liveIndex]?.cards;
  if(!Array.isArray(hand)||(!dealer&&liveIndex<0))throw Error('moving_deal_hand_unavailable');
  const card=event.faceDown?null:hand.find(c=>c.shoeDraw===event.shoeDraw);
  if(!event.faceDown&&!card)throw Error('moving_deal_card_unavailable');
  return {card,liveIndex,visibleCards:hand.filter(c=>c.shoeDraw<=event.shoeDraw)};
}
