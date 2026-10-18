import {createRegisteredChatContext as realCreateRegisteredChatContext,createPublishedChatResolver} from '../../services/game/registered-chat-context.mjs';
import {readPackagePresentation,withPackagePresentation} from '../../packages/presentation/server/presentation-package.mjs';
import {defaultPresentationLane} from '../../packages/presentation/contracts/studio-model.mjs';
import {cloudPresentationFixture} from '../../apps/studio/test/fixtures/cloud-presentation.mjs';
export {createPublishedChatResolver,cancelPlayerChats} from '../../services/game/registered-chat-context.mjs';

// Explicit data for child-process HTTP tests. The real frozen resolver still
// checks operator, room, publication revision, dealer and playback ownership.
const dealers=['astrid','marten','nora'],operatorId='http-chat-fixture',slug='http-chat-fixture',revision=7;
const cloud=cloudPresentationFixture({lanes:dealers.map(id=>({...defaultPresentationLane(id),id:'chat-'+id,label:id+' HTTP fixture'}))});
const snapshot={operator:{id:operatorId,slug,status:'active'},package:{operatorId,revision,games:['blackjack'],
  lanes:cloud.presentation.lanes.map(lane=>lane.id),tables:dealers.map(id=>'room-'+id),branding:withPackagePresentation({},cloud.presentation)},
  administration:{rooms:dealers.map(id=>({schemaVersion:2,id:'room-'+id,name:id+' room',operatorId,presentationLaneId:'chat-'+id,gameLaneId:'adapter-'+id,state:'live'})),
    gameLanes:dealers.map(id=>({schemaVersion:1,id:'adapter-'+id,label:id,renderer:'portrait-video',dealer:id,mediaCollection:id+'-presentation'}))}};
const resolvePublishedContext=createPublishedChatResolver({
  readCurrentContext:async requestedSlug=>requestedSlug===slug?structuredClone(snapshot):null,
  readPresentation:readPackagePresentation,
});

// This export replaces exactly one server import through the test preload.
// A configured production resolver must never be replaced with fixture data.
export function createRegisteredChatContext(options={}){
  if(options.resolvePublishedContext!==null)throw Error('HTTP fixture requires the isolated offline server');
  return realCreateRegisteredChatContext({resolvePublishedContext});
}
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