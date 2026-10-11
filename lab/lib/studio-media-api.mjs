import { canonicalStudioJson, StudioStorageError, validateActor, validateMediaId, validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { assertNativeStudioRequest, nativeStudioErrorResponse, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { readStudioDocumentJson } from './studio-document-api.mjs';
import { requireSavedVideoDealer } from './video-dealer-registration.mjs';

const fail = (code, statusCode = 503) => { throw new StudioStorageError(code, statusCode); };
const json = value => Response.json(value, { headers: {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'} });
export function createStudioMediaApi({repository, authorize, config, videoRegistry, videoResponse, uploads, mutationTransaction, baseOverride} = {}) {
  if (typeof authorize !== 'function' || !config || !['/api/admin','/studio/api/admin'].includes(config.apiBase)) fail('studio_invalid_configuration');
  const scope = validateStudioScope(config.scope), prefix = config.apiBase === '/api/admin' ? '/api' : '/studio/api';
  if (baseOverride !== undefined && baseOverride !== `${prefix}/layer-assets`) fail('studio_invalid_configuration');
  const base = baseOverride ?? `${prefix}/videos`;
  async function principalFor(request) {
    const session = await authorize(request);
    if (!session || !['admin','superadmin'].includes(session.role)
      || canonicalStudioJson(validateStudioScope(session.scope)) !== canonicalStudioJson(scope)) fail('studio_request_rejected',403);
    return Object.freeze({user:validateActor(session.user),role:session.role});
  }
  return Object.freeze({async handle(request) {
    try {
      request = normalizeNativeStudioRequest(request,config);
      assertNativeStudioRequest(request,config);
      const path = new URL(request.url).pathname;
      if (path !== base && !path.startsWith(`${base}/`)) fail('studio_media_unknown',404);
      const principal = await principalFor(request),actor = principal.user;
      const refresh = async () => {
        const current = await principalFor(request);
        if (current.user !== principal.user || current.role !== principal.role) fail('studio_request_rejected',403);
        return true;
      };
      const legacyRefresh = path === `${base}/rescan` && request.method === 'POST';
      // Older Studio tabs still POST /rescan for imported inventories. In the
      // native runtime this is a fresh registry read, with no disk import/write.
      if (legacyRefresh && (request.headers.get('origin') !== new URL(request.url).origin
        || !['same-origin','none'].includes(request.headers.get('sec-fetch-site')))) fail('studio_request_rejected',403);
      if (path === base && request.method === 'GET' || legacyRefresh) {
        if (typeof videoRegistry !== 'function') fail('studio_media_registry_unavailable');
        return json({...await videoRegistry(),...(uploads ? {uploadMode:'private-client-blob'} : {})});
      }
      if (path === `${base}/upload` && request.method === 'POST') {
        if (request.headers.get('origin') !== new URL(request.url).origin
          || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected',403);
        if (!uploads) fail('studio_media_upload_not_ready');
        const body=await readStudioDocumentJson(request);
        await refresh();
        if (body.operation === 'prepare') return json(await uploads.prepare(body,{actor}));
        if (body.operation === 'commit') {
          if (typeof mutationTransaction !== 'function') fail('studio_mutation_transaction_required');
          return json(await uploads.commit(body,{actor,request,stillAuthorized:refresh,mutationTransaction}));
        }
        fail('studio_invalid_request',400);
      }
      if (baseOverride === undefined && path === `${base}/archive` && request.method === 'POST') {
        if (request.headers.get('origin') !== new URL(request.url).origin
          || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected',403);
        const body=await readStudioDocumentJson(request);
        if(Object.keys(body).sort().join(',')!=='archived,id,previous,sha256'||typeof body.archived!=='boolean')fail('studio_invalid_request',400);
        validateMediaId(body.id);
        if(typeof mutationTransaction!=='function'||typeof repository?.findMediaReferences!=='function')fail('studio_mutation_transaction_required');
        await mutationTransaction(async()=>{
          await refresh();
          await repository.transaction(async()=>{
            const current=await repository.getMedia(body.id);
            if(!current||current.retainedBank)fail('studio_retained_media_immutable',409);
            if(current.sha256!==body.sha256||canonicalStudioJson(body.previous)!==canonicalStudioJson(current.classification))fail('studio_conflict',409);
            const usage=await repository.findMediaReferences(body.id);
            if(body.archived&&usage.references.some(row=>!row.historical))fail('studio_media_in_use',409);
            await repository.classifyMedia(body.id,{sha256:body.sha256,expectedRevision:current.revision,metadata:{...current.classification,archived:body.archived},actor});
          });
        });
        return json(await videoRegistry());
      }
      if (baseOverride === undefined && path === `${base}/classify` && request.method === 'POST') {
        if (request.headers.get('origin') !== new URL(request.url).origin
          || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected',403);
        const body = await readStudioDocumentJson(request);
        if (Object.keys(body).sort().join(',') !== 'id,metadata,previous,sha256') fail('studio_invalid_request',400);
        validateMediaId(body.id);
        if (typeof repository?.transaction !== 'function' || typeof videoRegistry !== 'function') fail('studio_media_registry_unavailable');
        if (typeof mutationTransaction !== 'function') fail('studio_mutation_transaction_required');
        await mutationTransaction(async () => {
          await refresh();
          return repository.transaction(async () => {
            const current = await repository.getMedia(body.id);
            if (current?.retainedBank) fail('studio_retained_media_immutable',409);
            // Immutable bank clips have no editable review record. New Neon review
            // uploads are classified with prior metadata + exact bytes + row CAS.
            if (!current || current.sha256 !== body.sha256 || current.classification.familyId
              || canonicalStudioJson(body.previous) !== canonicalStudioJson(current.classification)) fail('studio_conflict',409);
            if (Boolean(body.metadata?.archived) !== Boolean(current.classification.archived)) fail('studio_invalid_request',400);
            await requireSavedVideoDealer(repository,body.metadata?.dealerId);
            await repository.classifyMedia(body.id,{sha256:body.sha256,expectedRevision:current.revision,metadata:body.metadata,actor});
          }, {presentationMutation:{metadata:body.metadata}});
        }, {presentationMutation:{metadata:body.metadata}});
        return json(await videoRegistry());
      }
      if (request.method === 'POST' && path === base) fail('studio_media_upload_not_ready');
      const id = path.startsWith(`${base}/`) ? path.slice(base.length+1) : null;
      if (id && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) && ['GET','HEAD'].includes(request.method)) {
        if (typeof videoResponse !== 'function') fail('studio_media_registry_unavailable');
        return await videoResponse(id,request);
      }
      fail('studio_media_unknown',404);
    } catch (error) {return nativeStudioErrorResponse(error);}
  }});
}
export async function handleNativeStudioMedia(request) {
  try {return await createStudioMediaApi(await studioNativeRuntime()).handle(request);}
  catch (error) {return nativeStudioErrorResponse(error);}
}
