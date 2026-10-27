import {withPackagePresentation} from '../../packages/presentation/server/presentation-package.mjs';
import {defaultPresentationLane} from '../../packages/presentation/contracts/studio-model.mjs';
import {cloudPresentationFixture} from '../../apps/studio/test/fixtures/cloud-presentation.mjs';

// One published operator package for chat over HTTP on PostgreSQL. installStudioRuntime
// (engine-qa.mjs) writes it with the Studio repository and the operator store; the
// engine's real published chat resolver then checks operator, room, package revision,
// dealer and presentation ownership on every /chat, memory and observation request.
const dealers=['astrid','marten','nora'],operatorId='http-chat-fixture',slug='http-chat-fixture',revision=1;
const cloud=cloudPresentationFixture({lanes:dealers.map(id=>({...defaultPresentationLane(id),id:'chat-'+id,label:id+' HTTP fixture'}))});
export const publishedChatStudio=Object.freeze({
  project:cloud.project,
  administration:{rooms:dealers.map(id=>({schemaVersion:2,id:'room-'+id,name:id+' room',operatorId,presentationLaneId:'chat-'+id,gameLaneId:'adapter-'+id,state:'live'})),
    gameLane:'adapter-astrid',gameLanes:dealers.map(id=>({schemaVersion:1,id:'adapter-'+id,label:id,renderer:'portrait-video',dealer:id,mediaCollection:id+'-presentation'}))},
  operator:{id:operatorId,slug,name:'HTTP chat fixture',revision,games:['blackjack'],
    lanes:cloud.presentation.lanes.map(lane=>lane.id),tables:dealers.map(id=>'room-'+id),branding:withPackagePresentation({},cloud.presentation)},
});
export function publishedChatContext(dealerId){
  return dealers.includes(dealerId)?{operatorSlug:slug,roomId:'room-'+dealerId,packageRevision:revision,dealerId}:undefined;
}
export function withPublishedChatContext(value){
  if(!value||typeof value!=='object'||Object.hasOwn(value,'presentationContext'))return value;
  const presentationContext=publishedChatContext(value.dealer);
  return presentationContext?{...value,presentationContext}:value;
}
export function withPublishedChatQuery(path){
  const url=new URL(path,'http://fixture.invalid');
  if(!['/api/chat/memory','/api/dealer/observation','/api/astrid/observation'].includes(url.pathname)||url.searchParams.has('presentationContext'))return path;
  const count=url.searchParams.getAll('dealer').length;
  const dealer=url.pathname==='/api/astrid/observation'&&count===0?'astrid':count===1?url.searchParams.get('dealer'):null;
  const context=publishedChatContext(dealer);
  if(!context)return path;
  url.searchParams.set('presentationContext',JSON.stringify(context));return url.pathname+url.search;
}
