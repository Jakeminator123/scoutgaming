// Staging lifecycle contract, not connected to public gameplay or a media clock.
import {bindAstridSequence} from '../sequence-binding.mjs';
export async function createAstridSingleSeat({delivery,ledger,target,landingCalibrations=[],slotBindings,surface,onLand=()=>{},onFallback=()=>{},signal}){
 if(!surface||typeof surface.render!=='function'||typeof surface.dispose!=='function')throw Error('Explicit renderer surface required');
 if(ledger?.deliveries?.length!==1||!['box0','box1'].includes(target?.targetId)||ledger.deliveries[0].targetId!==target.targetId)throw Error('Only exact registered box0 or box1 candidate supported');
 let state='preparing',epoch=0,queue=Promise.resolve(),last=-1,landed=false,disposed=false,binding;
 // Only safe server-visible fields are retained, including fallback records.
 const safe={cardId:delivery.cardId,seatId:delivery.seatId,targetId:delivery.targetId,faceDown:delivery.faceDown,...(!delivery.faceDown?{card:{r:delivery.card?.r,s:delivery.card?.s}}:{})};
 function dispose(){if(!disposed){disposed=true;surface.dispose();}}
 function cancel(reason='cancelled'){
  if(['cancelled','failed','complete'].includes(state))return;
  state=reason==='render-failed'?'failed':'cancelled';epoch++;signal?.removeEventListener('abort',aborted);
  try{dispose();}finally{onFallback({reason,landed,delivery:structuredClone(safe),policy:'Preserve issued server card; no synthetic dealer motion or landing event'});}
 }
 const aborted=()=>cancel('aborted');signal?.addEventListener('abort',aborted,{once:true});
 if(signal?.aborted)cancel('aborted');
 try{binding=await bindAstridSequence({deliveries:[delivery],ledger,targets:[target],landingCalibrations,slotBindings});}catch(error){signal?.removeEventListener('abort',aborted);dispose();throw error;}
 if(state==='preparing')state='ready';
 return Object.freeze({
  get state(){return state;},get landed(){return landed;},
  cancel,resize(){cancel('resize-requires-target-revalidation');},hidden(){cancel('hidden');},
  // Caller supplies the selected ledger frame. render must acknowledge actual
  // render success; Promise resolution is NOT native compositor timing proof.
  present(frame){const token=epoch;
   const work=queue.then(async()=>{
    if(token!==epoch||!['ready','playing'].includes(state))return {ignored:true};
    const plan=binding.present(frame);state='playing';
    try{await surface.render(plan);}catch(error){if(token===epoch)cancel('render-failed');throw error;}
    if(token!==epoch)return {ignored:true};last=frame;
    for(const event of plan.newLandings)if(!landed){landed=true;onLand(event);}
    return plan;
   });queue=work.catch(()=>{});return work;
  },
  async ended(){await queue;if(!['ready','playing'].includes(state))return {state,landed};
   if(!landed||last!==binding.frameCount-1){cancel('ended-before-verified-final-frame');return {state,landed};}
   state='complete';signal?.removeEventListener('abort',aborted);dispose();return {state,landed};
  }
 });
}
