import { canonicalStudioJson, validateStudioScope, StudioStorageError } from '../../web/storage/studio-contract.mjs';
import { assertNativeStudioRequest, nativeStudioErrorResponse, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';

export function createStudioClipControlsApi({config,authorize,gamePolicy,legacyControls} = {}) {
  const fail = (code,statusCode = 503) => {throw new StudioStorageError(code,statusCode);};
  const scope = validateStudioScope(config?.scope);
  if (!['/api/admin','/studio/api/admin'].includes(config?.apiBase) || typeof authorize !== 'function') fail('studio_invalid_configuration');
  const path = config.apiBase === '/api/admin' ? '/api/clip-controls' : '/studio/api/clip-controls';
  return Object.freeze({async handle(request) {
    try {
      request = normalizeNativeStudioRequest(request,config);
      assertNativeStudioRequest(request,config);
      if (new URL(request.url).pathname !== path) fail('studio_document_unknown',404);
      if (request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'private, no-store'}});
      const session = await authorize(request);
      if (!session || !['admin','superadmin'].includes(session.role)
        || canonicalStudioJson(validateStudioScope(session.scope)) !== canonicalStudioJson(scope)) fail('studio_request_rejected',403);
      if (typeof gamePolicy?.readSaved !== 'function' || typeof legacyControls !== 'function') fail('studio_media_registry_unavailable');
      const saved = await gamePolicy.readSaved();
      return Response.json(await legacyControls(saved.project),{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    } catch(error) {return nativeStudioErrorResponse(error);}
  }});
}
export async function handleNativeStudioClipControls(request) {
  try {return await createStudioClipControlsApi(await studioNativeRuntime()).handle(request);}
  catch(error) {return nativeStudioErrorResponse(error);}
}
