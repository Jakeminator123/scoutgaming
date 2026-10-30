import {canonicalStudioJson,StudioStorageError,validateActor,validateStudioScope} from '../../../packages/studio-registry/server/document-contract.mjs';
import {assertNativeStudioRequest,nativeStudioErrorResponse,studioNativeRuntime} from './studio-native-runtime.mjs';
import {normalizeNativeStudioRequest} from './studio-native-request.mjs';
import {readStudioDocumentJson} from './studio-document-api.mjs';
import {changeDealerLifecycle,checkDealerArchive} from './dealer-lifecycle.mjs';
import {changeDealerVoice} from './dealer-voice.mjs';
import {readDealerFilmedProfile,changeDealerFilmedProfile} from './dealer-filmed-profile.mjs';
const fail=(code,status=403)=>{throw new StudioStorageError(code,status);};
export function createStudioDealerApi({repository,mutationTransaction,videoRegistry,mediaDeletion,authorize,config,gamePolicy}={}){
 const prefix=config?.apiBase==='/api/admin'?'/api':'/studio/api';
 return {async handle(request){try{
  request=normalizeNativeStudioRequest(request,config);assertNativeStudioRequest(request,config);
  const action=new URL(request.url).pathname;
  const filmed=action.match(new RegExp(`^${prefix}/dealers/([a-z0-9-]{1,40})/filmed-profile$`))?.[1];
  if(filmed)return await filmedProfile(request,filmed);
  if(!['archive','archive-check','delete','delete-check','voice'].some(name=>action===`${prefix}/dealers/${name}`)||request.method!=='POST')fail('studio_dealer_unknown',404);
  if(request.headers.get('origin')!==new URL(request.url).origin||!['same-origin','none'].includes(request.headers.get('sec-fetch-site')))fail('studio_request_rejected');
  return await post(request,action);
 }catch(error){return nativeStudioErrorResponse(error);}}};
 function staff(request){
  const principal=async()=>{const session=await authorize(request);if(!session||!['admin','superadmin'].includes(session.role)||canonicalStudioJson(validateStudioScope(session.scope))!==canonicalStudioJson(config.scope))fail('studio_request_rejected');return {actor:validateActor(session.user),role:session.role};};
  return {principal,stillAuthorized:async original=>{const current=await principal();if(current.actor!==original.actor||current.role!==original.role)fail('studio_request_rejected');return current.actor;}};
 }
 // Admin › Dealers › Landningar: GET reads; PUT/DELETE are same-origin writes like the other dealer actions.
 async function filmedProfile(request,dealerId){
  try{
   if(!['GET','PUT','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, PUT, DELETE'}});
   const origin=request.headers.get('origin');
   if(request.method==='GET'?origin!==null&&origin!==new URL(request.url).origin:origin!==new URL(request.url).origin||!['same-origin','none'].includes(request.headers.get('sec-fetch-site')))fail('studio_request_rejected');
   const gate=staff(request),original=await gate.principal(),headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
   if(request.method==='GET')return Response.json(await readDealerFilmedProfile({repository,dealerId}),{headers});
   const body=await readStudioDocumentJson(request);
   return Response.json({project:await changeDealerFilmedProfile({repository,gamePolicy,mutationTransaction,stillAuthorized:()=>gate.stillAuthorized(original),dealerId,body,remove:request.method==='DELETE'})},{headers});
  }catch(error){
   // The copy's mismatch and candidate lists are product data the Landningar tab shows.
   if(error?.filmedProfileDetails&&[409,422].includes(error.statusCode))return Response.json({error:error.code,code:error.code,...error.filmedProfileDetails},{status:error.statusCode,headers:{'Cache-Control':'private, no-store'}});
   throw error;
  }
 }
 async function post(request,action){
  const gate=staff(request),original=await gate.principal(),stillAuthorized=()=>gate.stillAuthorized(original);
  const body=await readStudioDocumentJson(request);
  if(action===`${prefix}/dealers/voice`)return Response.json({project:await changeDealerVoice({repository,gamePolicy,mutationTransaction,stillAuthorized,body})},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  if(action===`${prefix}/dealers/archive-check`)return Response.json(await checkDealerArchive({repository,body}),{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  if(action!==`${prefix}/dealers/archive`){
   if(!mediaDeletion)fail('studio_media_delete_coverage_incomplete',503);
   if(action===`${prefix}/dealers/delete-check`)return Response.json(await mediaDeletion.checkDealer(body),{headers:{'Cache-Control':'private, no-store'}});
   const project=await mediaDeletion.removeDealer(body,{stillAuthorized});
   return Response.json({project,inventory:await videoRegistry()},{headers:{'Cache-Control':'private, no-store'}});
  }
  const project=await changeDealerLifecycle({repository,mutationTransaction,stillAuthorized,body});
  return Response.json({project,inventory:await videoRegistry()},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
}
export async function handleNativeStudioDealer(request){try{return await createStudioDealerApi(await studioNativeRuntime()).handle(request);}catch(error){return nativeStudioErrorResponse(error);}}
