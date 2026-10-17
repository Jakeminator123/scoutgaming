import {canonicalStudioJson,StudioStorageError,validateActor,validateStudioScope} from '../../../packages/studio-registry/server/document-contract.mjs';
import {assertNativeStudioRequest,nativeStudioErrorResponse,studioNativeRuntime} from './studio-native-runtime.mjs';
import {normalizeNativeStudioRequest} from './studio-native-request.mjs';
import {readStudioDocumentJson} from './studio-document-api.mjs';
import {changeDealerLifecycle,checkDealerArchive} from './dealer-lifecycle.mjs';
const fail=(code,status=403)=>{throw new StudioStorageError(code,status);};
export function createStudioDealerApi({repository,mutationTransaction,videoRegistry,mediaDeletion,authorize,config}={}){
 return {async handle(request){try{
  request=normalizeNativeStudioRequest(request,config);assertNativeStudioRequest(request,config);
  const prefix=config.apiBase==='/api/admin'?'/api':'/studio/api';
  const action=new URL(request.url).pathname;
  if(!['archive','archive-check','delete','delete-check'].some(name=>action===`${prefix}/dealers/${name}`)||request.method!=='POST')fail('studio_dealer_unknown',404);
  if(request.headers.get('origin')!==new URL(request.url).origin||!['same-origin','none'].includes(request.headers.get('sec-fetch-site')))fail('studio_request_rejected');
  const principal=async()=>{const session=await authorize(request);if(!session||!['admin','superadmin'].includes(session.role)||canonicalStudioJson(validateStudioScope(session.scope))!==canonicalStudioJson(config.scope))fail('studio_request_rejected');return {actor:validateActor(session.user),role:session.role};};
  const original=await principal();
  const stillAuthorized=async()=>{const current=await principal();if(current.actor!==original.actor||current.role!==original.role)fail('studio_request_rejected');return current.actor;};
  const body=await readStudioDocumentJson(request);
  if(action===`${prefix}/dealers/archive-check`)return Response.json(await checkDealerArchive({repository,body}),{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  if(action!==`${prefix}/dealers/archive`){
   if(!mediaDeletion)fail('studio_media_delete_coverage_incomplete',503);
   if(action===`${prefix}/dealers/delete-check`)return Response.json(await mediaDeletion.checkDealer(body),{headers:{'Cache-Control':'private, no-store'}});
   const project=await mediaDeletion.removeDealer(body,{stillAuthorized});
   return Response.json({project,inventory:await videoRegistry()},{headers:{'Cache-Control':'private, no-store'}});
  }
  const project=await changeDealerLifecycle({repository,mutationTransaction,stillAuthorized,body});
  return Response.json({project,inventory:await videoRegistry()},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return nativeStudioErrorResponse(error);}}};
}
export async function handleNativeStudioDealer(request){try{return await createStudioDealerApi(await studioNativeRuntime()).handle(request);}catch(error){return nativeStudioErrorResponse(error);}}
