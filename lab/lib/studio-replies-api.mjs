import {canonicalStudioJson, validateActor, validateStudioScope} from '../../web/storage/studio-contract.mjs';
import {isDealerId} from '../../packages/presentation/contracts/dealer-identity.mjs';
import {validateReplyCategories} from '../../web/public/speech-reply-library.mjs';
import {assertNativeStudioRequest, nativeStudioErrorResponse, studioNativeRuntime} from './studio-native-runtime.mjs';
import {createSpeechReplyLibrary} from '../../web/speech-reply-library.mjs';
import {normalizeNativeStudioRequest} from './studio-native-request.mjs';
import {readStudioDocumentJson} from './studio-document-api.mjs';
import {isReplyCursor, parseStudioRepliesRequest} from './studio-replies-query.mjs';

const fail=(code='studio_replies_unavailable',statusCode=503)=>{throw Object.assign(new Error(code),{code,statusCode});};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
const json=value=>Response.json(value,{headers});
const errors=new Map([
  ['studio_replies_invalid_request',400],['reply_library_invalid_identity',400],['reply_library_invalid_categories',400],
  ['reply_library_invalid_cursor',400],['reply_library_invalid_revision',400],['reply_library_invalid_media',400],
  ['reply_library_not_found',404],['reply_library_revision_conflict',409],['reply_library_corrupt',409],
  ['reply_library_unavailable',503],['studio_replies_unavailable',503],
]);
export function studioRepliesErrorResponse(error) {
  const status=errors.get(error?.code);
  return status?Response.json({error:error.code,code:error.code},{status,headers}):nativeStudioErrorResponse(error);
}
// The HTTP boundary deliberately projects only the documented public metadata.
// Storage paths, Blob URLs, ETags and provider tokens never become UI fields.
function publicItem(value,dealerId,id) {
  if(!value||value.dealerId!==dealerId||id&&value.id!==id
    ||typeof value.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.id)
    ||!Number.isSafeInteger(value.revision)||value.revision<1||value.reviewStatus!=='pending'
    ||!['exactText','language','createdAt','profileRevision'].every(key=>typeof value[key]==='string'))fail();
  let categories;try{categories=validateReplyCategories(value.categories);}catch{fail();}
  const media={};
  for(const kind of ['audio','video']){
    const record=value.media?.[kind];
    if(record?.available!==true||!/^[a-f0-9]{64}$/.test(record.sha256)||!Number.isSafeInteger(record.size)||record.size<1
      ||record.contentType!==(kind==='audio'?'audio/wav':'video/mp4'))fail();
    media[kind]={available:true,sha256:record.sha256,contentType:record.contentType,size:record.size};
  }
  return {id:value.id,dealerId,exactText:value.exactText,language:value.language,createdAt:value.createdAt,
    profileRevision:value.profileRevision,revision:value.revision,categories,reviewStatus:value.reviewStatus,media};
}
async function privateMedia(response,method,refresh) {
  try {
    if(!(response instanceof Response)||![200,206,304,416].includes(response.status))fail();
    await refresh();
    const safeHeaders=new Headers(headers);
    for(const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']){
      const value=response.headers.get(name);if(value!==null)safeHeaders.set(name,value);
    }
    if(method==='HEAD')await response.body?.cancel();
    return new Response(method==='HEAD'?null:response.body,{status:response.status,headers:safeHeaders});
  } catch(error){await response?.body?.cancel().catch(()=>{});throw error;}
}

// Trusted server dependencies only. The library is constructed with the same
// immutable workspace scope as this API; caller query/body values cannot scope it.
export function createStudioRepliesApi({replyLibrary,authorize,config}={}) {
  if(typeof authorize!=='function'||!config||!['/api/admin','/studio/api/admin'].includes(config.apiBase)
    ||!['list','get','categorize','media'].every(key=>typeof replyLibrary?.[key]==='function'))fail();
  const scope=validateStudioScope(config.scope),base=config.apiBase==='/api/admin'?'/api/replies':'/studio/api/replies';
  config=Object.freeze({...config,scope,allowedOrigins:Object.freeze([...config.allowedOrigins]),publicHosts:Object.freeze([...config.publicHosts])});
  async function principalFor(request){
    const session=await authorize(request);
    if(!session||!['admin','superadmin'].includes(session.role))fail('studio_request_rejected',403);
    try {
      if(canonicalStudioJson(validateStudioScope(session.scope))!==canonicalStudioJson(scope))fail('studio_request_rejected',403);
      return {user:validateActor(session.user),role:session.role};
    }catch{fail('studio_request_rejected',403);}
  }
  return Object.freeze({async handle(request){
    try {
      request=normalizeNativeStudioRequest(request,config);assertNativeStudioRequest(request,config);
      const url=new URL(request.url);
      if(url.pathname!==base&&!url.pathname.startsWith(base+'/'))fail('reply_library_not_found',404);
      const route=parseStudioRepliesRequest(request.method,url),principal=await principalFor(request);
      const refresh=async()=>{
        const current=await principalFor(request);
        if(current.user!==principal.user||current.role!==principal.role)fail('studio_request_rejected',403);
        return true;
      };
      if(route.kind==='categorize'){
        if(request.headers.get('origin')!==url.origin||!['same-origin','none'].includes(request.headers.get('sec-fetch-site')))fail('studio_request_rejected',403);
        const body=await readStudioDocumentJson(request);
        if(Object.keys(body).sort().join(',')!=='categories,dealerId,expectedRevision'||!isDealerId(body.dealerId)
          ||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)fail('studio_replies_invalid_request',400);
        const categories=validateReplyCategories(body.categories);
        await refresh();
        const item=await replyLibrary.categorize({dealerId:body.dealerId,id:route.id,categories,expectedRevision:body.expectedRevision,stillAuthorized:refresh});
        await refresh();
        return json({item:publicItem(item,body.dealerId,route.id)});
      }
      if(route.kind==='media')return await privateMedia(await replyLibrary.media({dealerId:route.dealerId,id:route.id,kind:route.mediaKind,request}),request.method,refresh);
      if(route.kind==='item'){
        const item=await replyLibrary.get({dealerId:route.dealerId,id:route.id});await refresh();
        return json({item:publicItem(item,route.dealerId,route.id)});
      }
      const {kind,...query}=route,page=await replyLibrary.list(query);await refresh();
      if(!Array.isArray(page?.items)||page.items.length>50||page.nextCursor!==null&&!isReplyCursor(page.nextCursor))fail();
      return json({items:page.items.map(item=>publicItem(item,route.dealerId)),nextCursor:page.nextCursor});
    }catch(error){return studioRepliesErrorResponse(error);}
  }});
}

export async function handleNativeStudioReplies(request) {
  try {
    const native=await studioNativeRuntime();
    const replyLibrary=createSpeechReplyLibrary({...native.config.scope,env:process.env,repository:native.replyRepository});
    return await createStudioRepliesApi({...native,replyLibrary}).handle(request);
  }catch(error){return studioRepliesErrorResponse(error);}
}
