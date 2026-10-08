// Adapter from the shared Astrid planner to Jakob's pinned Lissabon catalogue.
// Classification only: this module never chooses cards, outcomes or another clip.
export const CATALOG_COMMIT='d321e3f565c67c6c6fdec80f92508a017298c383';
export function catalogEventForStep(step){
 if(step.kind==='reveal')return 'reveal.dealer';
 if(step.kind==='turn')return 'turn.player';
 if(step.kind==='deal')return step.seat==='dealer'?'deal.dealer':Number(step.seat)<=2?'deal.player.left':Number(step.seat)<=5?'deal.player.centre':'deal.player.right';
 const event=step.clip?.event??step.event;
 return ({goodluck:'speak.goodluck',insurance:'speak.insurance',double:'speak.double',blackjack:'settle.blackjack',dealerbust:'settle.dealerBust',win:'settle.win',push:'settle.push',lose:'settle.other',placebets:'idle.ready'})[event]??(event?'speak.other':null);
}
export function runtimeClipsForEvent(id,media=[]){
 return media.filter(m=>{if(m.category!=='gameplay')return false;
 if(id==='idle.ready')return m.binding==='idle presentation'||m.event==='placebets';
 const seat=/^deal_pos([1-7]|dealer)$/.exec(m.id)?.[1];
 const step=m.id==='deal_flip'?{kind:'reveal'}:m.id==='deal_hole'?{kind:'deal',seat:'dealer'}:seat?{kind:'deal',seat}:m.event?{kind:'speech',event:m.event}:{};
 return catalogEventForStep(step)===id;});
}
export function evidenceForEvent(id,data){
 return (data.events??[]).filter(e=>e.type==='presentation.plan').flatMap(e=>(e.payload.steps??[]).filter(s=>(s.catalogEventId??catalogEventForStep(s))===id).map(s=>({seq:e.seq,roundId:e.round_id,at:s.startAt,clipId:s.clip?.id??null,shoeDraw:s.shoeDraw??null,recorded:Boolean(s.catalogEventId),status:'scheduled'})));
}
