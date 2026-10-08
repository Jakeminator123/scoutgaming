import {createHash} from 'node:crypto';
import {GAME_SPEECH} from './media-registry.mjs';
export function integrationIndex(media){
 const nodes=[
  {id:'table',kind:'authority',source:'server/shared-table.mjs',description:'Owns seats, deadlines and round progression'},
  {id:'engine',kind:'authority',source:'vendor/croupier/shoe-game.mjs',description:'Owns shoe, cards, legal actions and results'},
  {id:'presentation',kind:'planner',source:'server/shared-table.mjs',description:'Orders exact clips; AI never changes deal timing'},
  {id:'playback',kind:'renderer',source:'public/shared-table.js',description:'Scheduled presentation is not proof of playback'},
  {id:'openclaw',kind:'speech-selector',source:'server/openclaw.mjs',description:'Selects reviewed speech only; no game tools'},
  {id:'speech-bank',kind:'policy',source:'server/dealer-policy.mjs',description:'Reviewed exact text; synthesized through existing Cartesia and RunPod pipeline'},
  {id:'wallet',kind:'authority',source:'server/transactions.mjs',description:'Server-calculated stakes, returns and net'},
  ...GAME_SPEECH.map(id=>({id:'event:'+id,kind:'event',event:id})),
  ...media.map(m=>({id:'clip:'+m.id,kind:'clip',clipId:m.id,url:m.url,category:m.category,event:m.event??null,available:m.available??null})),
 ];
 const edges=[['table','engine'],['engine','presentation'],['engine','wallet'],['presentation','playback'],['openclaw','speech-bank'],['speech-bank','playback']].map(([from,to])=>({from,to,relation:'owns-flow'}));
 for(const m of media.filter(m=>m.category==='gameplay')){
  edges.push({from:m.event&&GAME_SPEECH.includes(m.event)?'event:'+m.event:'presentation',to:'clip:'+m.id,relation:'allowed-media'});
 }
 for(const id of GAME_SPEECH)edges.push({from:'presentation',to:'event:'+id,relation:'engine-derived'});
 const data={schema:1,provenance:{repository:'scout-gg/croupier',jakobCommit:'d321e3f565c67c6c6fdec80f92508a017298c383',patterns:['separate speech role','revision-bound choices','event → decision → playback']},nodes,edges};
 return {...data,revision:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}
export function eventEvidence(audit){
 return [...(audit.activity??[]),...(audit.events??[])].sort((a,b)=>a.seq-b.seq).slice(-200).map(e=>({
  id:e.seq,parent:e.parent,roundId:e.round_id,type:e.type,at:e.at,hash:e.hash,
  ...(e.type==='presentation.speech_choice'?{decision:e.payload.decision,responseId:e.payload.responseId,requestId:e.payload.requestId}:{}),
  ...(e.type==='presentation.plan'?{planId:e.payload.planId,status:'scheduled',clips:(e.payload.steps??[]).filter(s=>s.clip).map(s=>({id:s.clip.id,startAt:s.startAt,endAt:s.endAt}))}:{}),
 }));
}
