import {assertMediaAlpha} from './media-alpha.mjs';
import {assertNativeMediaReadiness} from './native-media-readiness.mjs';
import {DEFAULT_DEALER_COMPOSITING} from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import { canonicalStudioJson, StudioStorageError, validateActor, validateMediaId, validateRevision, validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';
import { assertNativeStudioRequest, nativeStudioErrorResponse, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { readStudioDocumentJson } from './studio-document-api.mjs';
import { requireSavedVideoDealer } from '../../../packages/studio-registry/server/video-dealer-registration.mjs';
import {checkPermanentMediaDeletion} from './studio-media-deletion.mjs';
import {validateVideoMetadata} from '../../../packages/presentation/contracts/video-intake.mjs';

const fail = (code, statusCode = 503) => { throw new StudioStorageError(code, statusCode); };
const json = value => Response.json(value, { headers: {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'} });
function writeMetadata(value) {
  try { return validateVideoMetadata(value,{forWrite:true}); }
  catch (error) { fail(error.code==='dealer_background_required'?'studio_dealer_background_required':'studio_invalid_media',422); }
}
export function createStudioMediaApi({repository, authorize, config, videoRegistry, videoResponse, uploads, mediaDeletion, inspectMediaTiming, mutationTransaction, baseOverride} = {}) {
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
      if (baseOverride === undefined && path === `${base}/measure-timing` && request.method === 'POST') {
        if (request.headers.get('origin') !== new URL(request.url).origin
          || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected',403);
        const body = await readStudioDocumentJson(request);
        if (Object.keys(body).sort().join(',') !== 'expectedRevision,id,sha256'
          || typeof body.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(body.sha256)) fail('studio_invalid_request',400);
        validateMediaId(body.id); validateRevision(body.expectedRevision);
        if (typeof inspectMediaTiming !== 'function' || typeof repository?.getMedia !== 'function'
          || typeof repository?.saveMediaTiming !== 'function' || typeof repository?.transaction !== 'function') fail('studio_media_registry_unavailable');
        if (typeof mutationTransaction !== 'function') fail('studio_mutation_transaction_required');
        if (canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(scope)) fail('studio_request_rejected',403);
        const checkedSource = async () => {
          const record = await repository.getMedia(body.id);
          if (!record) fail('studio_media_missing',404);
          if (record.retainedBank || record.classification.familyId) fail('studio_retained_media_immutable',409);
          if (record.deletion) fail('studio_media_deletion_pending',409);
          if (record.classification.archived) fail('studio_media_archived',409);
          if (record.revision !== body.expectedRevision || record.sha256 !== body.sha256) fail('studio_conflict',409);
          if (record.contentType !== 'video/mp4') fail('studio_media_timing_unsupported',422);
          await requireSavedVideoDealer(repository,record.classification.dealerId);
          return record;
        };
        const source = await checkedSource(), sourceIdentity = canonicalStudioJson(source);
        if (request.signal.aborted) fail('studio_media_inspection_cancelled',408);
        // Verified Blob reads and decoding must finish before either SQL lock.
        // The caller supplies only identity/CAS; the server owns this receipt.
        const mediaTiming = await inspectMediaTiming(structuredClone(source),{signal:request.signal});
        if (request.signal.aborted) fail('studio_media_inspection_cancelled',408);
        await refresh();
        const presentationMutation = {metadata:source.classification,mediaTiming};
        const saved = await mutationTransaction(async () => {
          await refresh();
          return repository.transaction(async () => {
            if (request.signal.aborted) fail('studio_media_inspection_cancelled',408);
            const current = await checkedSource();
            if (canonicalStudioJson(current) !== sourceIdentity) fail('studio_conflict',409);
            if (request.signal.aborted) fail('studio_media_inspection_cancelled',408);
            return repository.saveMediaTiming(body.id,{sha256:body.sha256,expectedRevision:body.expectedRevision,mediaTiming,actor});
          },{presentationMutation});
        },{presentationMutation});
        return json({media:saved});
      }
      if (baseOverride === undefined && path === `${base}/speech-review` && request.method === 'POST') {
        if (request.headers.get('origin') !== new URL(request.url).origin
          || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected',403);
        const body = await readStudioDocumentJson(request);
        if (Object.keys(body).sort().join(',') !== 'dealerId,expectedIdentity,id,language,lineId,sha256,verdict'
          || typeof body.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(body.sha256) || !['approved','rejected',null].includes(body.verdict)
          || ![body.dealerId,body.lineId,body.language].every(value=>typeof value==='string'&&value.length>0&&value.length<=100)) fail('studio_invalid_request',400);
        validateMediaId(body.id);
        if (typeof repository?.getMedia !== 'function' || typeof repository?.reviewRecordedSpeech !== 'function'
          || typeof repository?.transaction !== 'function' || typeof videoRegistry !== 'function') fail('studio_media_registry_unavailable');
        if (typeof mutationTransaction !== 'function') fail('studio_mutation_transaction_required');
        if (canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(scope)) fail('studio_request_rejected',403);
        // The take is addressed by its slot as well as its UUID, so a stale tab
        // cannot review a file that has since moved to another dealer or line.
        const take = async () => {
          const record = await repository.getMedia(body.id);
          if (!record) fail('studio_media_missing',404);
          if (record.sha256 !== body.sha256) fail('studio_conflict',409);
          const speech = record.classification.recordedSpeech;
          if (!speech || record.classification.dealerId !== body.dealerId || speech.dealerId !== body.dealerId
            || speech.lineId !== body.lineId || speech.language !== body.language) fail('studio_speech_take_missing',404);
          return record;
        };
        const presentationMutation = {metadata:(await take()).classification};
        await refresh();
        const saved = await mutationTransaction(async () => {
          await refresh();
          return repository.transaction(async () => {
            const current = await take();
            await requireSavedVideoDealer(repository,current.classification.dealerId);
            return repository.reviewRecordedSpeech(body.id,{sha256:body.sha256,expectedRevision:current.revision,
              expectedIdentity:body.expectedIdentity,verdict:body.verdict,actor});
          },{presentationMutation});
        },{presentationMutation});
        // A verdict records what a person saw and heard. It is not a lip-sync
        // measurement and does not publish a package or room by itself.
        return json({review:saved.classification.recordedSpeech.review,attestation:'human-av-review',inventory:await videoRegistry()});
      }
      if (baseOverride === undefined && [`${base}/delete-check`,`${base}/delete`].includes(path) && request.method === 'POST') {
        if (request.headers.get('origin') !== new URL(request.url).origin || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected',403);
        const body=await readStudioDocumentJson(request);await refresh();
        if(path===`${base}/delete-check`)return json(mediaDeletion?await mediaDeletion.check(body):await checkPermanentMediaDeletion(repository,body));
        if(!mediaDeletion)fail('studio_media_delete_coverage_incomplete',503);
        await mediaDeletion.remove(body,{stillAuthorized:async()=>{await refresh();return actor;}});
        const saved=await repository.readDocument('project');
        if(!saved)fail('studio_document_missing');
        return json({project:saved.value,inventory:await videoRegistry()});
      }
      if (baseOverride === undefined && path === `${base}/archive` && request.method === 'POST') {
        if (request.headers.get('origin') !== new URL(request.url).origin
          || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected',403);
        const body=await readStudioDocumentJson(request);
        if(Object.keys(body).sort().join(',')!=='archived,id,previous,sha256'||typeof body.archived!=='boolean')fail('studio_invalid_request',400);
        validateMediaId(body.id);
        if(typeof mutationTransaction!=='function'||typeof repository?.findMediaReferences!=='function')fail('studio_mutation_transaction_required');
        const proposedMetadata={...body.previous,archived:body.archived};
        const presentationMutation={metadata:body.archived?proposedMetadata:writeMetadata(proposedMetadata)};
        await mutationTransaction(async()=>{
          await refresh();
          await repository.transaction(async()=>{
            const current=await repository.getMedia(body.id);
            if(!current||current.retainedBank)fail('studio_retained_media_immutable',409);
            if(current.deletion)fail('studio_media_deletion_pending',409);
            if(!body.archived)await requireSavedVideoDealer(repository,current.classification.dealerId);
            if(current.sha256!==body.sha256||canonicalStudioJson(body.previous)!==canonicalStudioJson(current.classification))fail('studio_conflict',409);
            const usage=await repository.findMediaReferences(body.id);
            if(body.archived&&usage.references.some(row=>!row.historical))fail('studio_media_in_use',409);
            const metadata={...current.classification,archived:body.archived};
            await repository.classifyMedia(body.id,{sha256:body.sha256,expectedRevision:current.revision,metadata:body.archived?metadata:writeMetadata(metadata),actor});
          },{presentationMutation});
        },{presentationMutation});
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
        const proposedMetadata={...body.metadata,...(body.metadata?.mediaType==='audio'?{}:{compositing:body.metadata?.compositing??DEFAULT_DEALER_COMPOSITING})};
        await assertNativeMediaReadiness(repository,proposedMetadata);
        if(body.metadata?.compositing?.mode==='alpha'){
          const source=await repository.getMedia(body.id);
          if(source?.retainedBank)fail('studio_retained_media_immutable',409);
          if(!source||source.sha256!==body.sha256)fail('studio_conflict',409);
          writeMetadata(body.metadata);
          if(source.classification.compositing?.mode!=='alpha'){
            if(typeof videoResponse!=='function')fail('studio_media_registry_unavailable');
            const response=await videoResponse(body.id,new Request(request.url));
            if(!response.ok)fail('studio_media_bytes_unavailable',503);
            const bytes=Buffer.from(await response.arrayBuffer());
            if(bytes.length!==source.size)fail('studio_invalid_media_format',415);
            await assertMediaAlpha(bytes,source.contentType);
          }
        }
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
            await repository.classifyMedia(body.id,{sha256:body.sha256,expectedRevision:current.revision,metadata:writeMetadata(proposedMetadata),actor});
          }, {presentationMutation:{metadata:proposedMetadata}});
        }, {presentationMutation:{metadata:proposedMetadata}});
        return json(await videoRegistry());
      }
      if (request.method === 'POST' && path === base) fail('studio_media_upload_not_ready');
      const id = path.startsWith(`${base}/`) ? path.slice(base.length+1) : null;
      if (id && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) && ['GET','HEAD'].includes(request.method)) {
        if (typeof videoResponse !== 'function') fail('studio_media_registry_unavailable');
        return await videoResponse(id,request);
      }
      fail('studio_media_unknown',404);
    } catch (error) {
      if(error?.code==='studio_media_alpha_required')return Response.json({code:error.code,error:'Filen saknar verifierbar alfa. Välj en frilagd PNG eller VP9-WebM; svart bakgrund är inte genomskinlig.'},{status:422,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
      return nativeStudioErrorResponse(error);
    }
  }});
}
export async function handleNativeStudioMedia(request) {
  try {return await createStudioMediaApi(await studioNativeRuntime()).handle(request);}
  catch (error) {return nativeStudioErrorResponse(error);}
}
