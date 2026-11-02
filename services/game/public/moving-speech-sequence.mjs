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

export function createMovingDealPlayback({state,$,boxContainer,dealCardTo,updateBadge}) {
function finishMovingDealStep(owned){
  const step=owned.sequence?.steps[owned.stepIndex];if(!step)return;
  if(owned.lastFrame<step.end-2)throw Error('moving_deal_card_frame_missing');
  state.localCards?.finish(owned.token,step.event.shoeDraw,true);
  const event=step.event,{card,liveIndex,visibleCards}=movingDealCard(state.round,event);
  const container=event.to==='dealer'?$('#dealer-cards'):boxContainer(liveIndex);
  dealCardTo(container,card,{faceDown:event.faceDown,shoeDraw:event.shoeDraw,motion:{localCompleted:true}});
  if(visibleCards?.length)updateBadge(container,visibleCards);
}
function movingDealFrame(owned,sequence,k){
  if(owned!==state.activeDealSpeech||owned.version!==state.tableVersion||sequence.version!==state.tableVersion||k<owned.lastFrame||k-owned.lastFrame>2)throw Error('stale_moving_deal_frame');
  const index=sequence.steps.findIndex(step=>k>=step.first&&k<step.end);
  if(index!==owned.stepIndex){
    if(index!==owned.stepIndex+1)throw Error('moving_deal_step_skipped');
    finishMovingDealStep(owned);owned.stepIndex=index;
    owned.token=state.localCards?.begin(sequence.steps[index].video,sequence.steps[index].event);
  }
  owned.lastFrame=k;
  state.localCards?.frame(owned.token,sequence.frames[k].frame/24);
}
function movingDealEnd(owned){
  if(owned.completed)return;
  if(owned.stepIndex!==owned.sequence.steps.length-1)throw Error('moving_deal_incomplete');
  finishMovingDealStep(owned);owned.completed=true;
}

  return {movingDealFrame,movingDealEnd};
}
