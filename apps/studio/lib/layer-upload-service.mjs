import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalStudioJson, StudioStorageError, validateActor, validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';
import { isCloudMediaConfigured, validatePrivateMedia } from './cloud-media-store.mjs';
import { inspectLayerMedia } from './layer-media-inspection.mjs';
import { validateLayerAsset, layerAssetPath, LAYER_ASSET_TYPES, MAX_LAYER_ASSET_BYTES } from '../../../packages/presentation/contracts/presentation-layers.mjs';

const fail = (code, statusCode = 503) => {throw new StudioStorageError(code,statusCode);};
const exact = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const TTL = 15 * 60 * 1000;

/** Direct private Blob upload followed by explicit authenticated, verified commit.
 * No state is written to disk, apart from disposable verified Blob scratch.
 * Neither an uploaded object nor its declared client hash is a committed record.
 */
export function createLayerUploadService({repository,scope,ticketKey,env = process.env,options = {},
  clientToken = async args => (await import('@vercel/blob/client')).generateClientTokenFromReadWriteToken(args),
  inspectMedia = inspectLayerMedia, now = Date.now,
} = {}) {
  scope = validateStudioScope(scope);
  if (!repository?.saveDocument || !repository?.readDocument
    || canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(scope)
    || !(ticketKey instanceof Uint8Array) || ticketKey.byteLength < 32) fail('studio_upload_configuration_invalid');
  const key = Buffer.from(ticketKey), checkedEnv = Object.freeze({...env});
  const mediaOptions = {...options,env:checkedEnv,cacheDir:options.cacheDir ?? join(tmpdir(),'croupier-private-media')};
  function configured() {if (!isCloudMediaConfigured(checkedEnv)) fail('studio_media_storage_unavailable');}
  async function ready(record) {
    if(record.game===undefined)return;
    if(typeof repository.withMutationContext!=='function')fail('studio_presentation_runtime_update_required');
    await repository.withMutationContext(()=>{}, {kind:'project',value:{layerAssets:[record]}});
  }
  const sign = data => {
    const encoded = Buffer.from(canonicalStudioJson(data)).toString('base64url');
    return `${encoded}.${createHmac('sha256',key).update(`studio-layer-upload-v1\0${encoded}`).digest('base64url')}`;
  };
  function grant(ticket,actor) {
    if (typeof ticket !== 'string' || ticket.length > 16000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket)) fail('studio_upload_grant_invalid',403);
    const [payload,signature] = ticket.split('.'), bytes = Buffer.from(signature,'base64url');
    const expected = createHmac('sha256',key).update(`studio-layer-upload-v1\0${payload}`).digest();
    if (bytes.length !== expected.length || !timingSafeEqual(bytes,expected) || bytes.toString('base64url') !== signature) fail('studio_upload_grant_invalid',403);
    let data; try {data = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));} catch {fail('studio_upload_grant_invalid',403);}
    if (!exact(data,['v','actor','scope','record','expiresAt']) || data.v !== 1 || data.actor !== actor
      || canonicalStudioJson(data.scope) !== canonicalStudioJson(scope) || !Number.isSafeInteger(data.expiresAt)
      || data.expiresAt <= now() || data.expiresAt > now()+TTL) fail('studio_upload_grant_invalid',403);
    const record = validateLayerAsset(data.record);
    return record;
  }
  return Object.freeze({
    async prepare(body,{actor} = {}) {
      configured(); actor = validateActor(actor);
      if (!exact(body,['operation','sha256','size','contentType','role','label','width','height',...(Object.hasOwn(body??{},'game')?['game']:[])]) || body.operation !== 'prepare') fail('studio_invalid_request',400);
      if (!LAYER_ASSET_TYPES[body.contentType] || !Number.isSafeInteger(body.size)
        || body.size < 16 || body.size > MAX_LAYER_ASSET_BYTES || !/^[a-f0-9]{64}$/.test(body.sha256)) fail('studio_invalid_media',422);
      const id = randomUUID();
      const draft = {schemaVersion:1,id,sha256:body.sha256,size:body.size,contentType:body.contentType,
        role:body.role,label:body.label,width:body.width,height:body.height,...(Object.hasOwn(body,'game')?{game:body.game}:{})};
      const record = validateLayerAsset({...draft,pathname:layerAssetPath(draft)});
      await ready(record);
      const expiresAt = now()+TTL;
      // Exact immutable path, bounded MIME/bytes/time, no overwrite. This short
      // client capability cannot authorize reads, deletes or another pathname.
      const token = await clientToken({token:checkedEnv.BLOB_READ_WRITE_TOKEN,pathname:record.pathname,
        allowedContentTypes:[record.contentType],maximumSizeInBytes:record.size,validUntil:expiresAt,
        addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60});
      if (typeof token !== 'string' || !token) fail('studio_upload_configuration_invalid');
      return {id,pathname:record.pathname,clientToken:token,ticket:sign({v:1,actor,scope,record,expiresAt}),expiresAt};
    },
    async commit(body,{actor,request,stillAuthorized,mutationTransaction} = {}) {
      configured(); actor = validateActor(actor);
      if (!exact(body,['operation','ticket']) || body.operation !== 'commit' || !(request instanceof Request)) fail('studio_invalid_request',400);
      if (typeof mutationTransaction !== 'function') fail('studio_mutation_transaction_required');
      const record = grant(body.ticket,actor), storage = validatePrivateMedia({provider:'vercel-blob',
        pathname:record.pathname,sha256:record.sha256,size:record.size,contentType:record.contentType});
      await ready(record);
      // Parse actual format/dimensions from the fully hashed open descriptor.
      // Inspection, including worker shutdown, finishes before either SQL lock.
      const inspected=await inspectMedia(storage,{...mediaOptions,signal:request.signal});
      if(inspected.contentType!==record.contentType)fail('studio_invalid_media_format',415);
      if(inspected.width!==record.width||inspected.height!==record.height)fail('studio_media_dimensions_mismatch',422);
      // Capture the real project and exact verified grant before either SQL lock.
      // The native gate must cover this write without fetching under a lock.
      const captured = await repository.readDocument('project');
      if (!captured) fail('studio_document_missing',404);
      const capturedAssets = captured.value.layerAssets ?? [];
      const capturedExisting = capturedAssets.find(asset => asset.id === record.id);
      if (capturedExisting && canonicalStudioJson(capturedExisting) !== canonicalStudioJson(record)) fail('studio_conflict',409);
      const presentationMutation = {kind:'project',value:{...captured.value,
        layerAssets:capturedExisting ? capturedAssets : [...capturedAssets,record]}};
      return mutationTransaction(async () => {
        if (typeof stillAuthorized !== 'function' || await stillAuthorized() !== true) fail('studio_request_rejected',403);
        return repository.transaction(async () => {
          const saved = await repository.readDocument('project');
          if (!saved) fail('studio_document_missing',404);
          const assets = saved.value.layerAssets ?? [];
          const existing = assets.find(asset => asset.id === record.id);
          if (existing) {
            if (canonicalStudioJson(existing) !== canonicalStudioJson(record)) fail('studio_conflict',409);
            return {id:record.id,duplicate:true,project:saved.value};
          }
          if (saved.revision !== captured.revision) fail('studio_conflict',409);
          const next = await repository.saveDocument('project',{expectedRevision:saved.revision,
            value:{...saved.value,layerAssets:[...assets,record]},actor});
          return {id:record.id,duplicate:false,project:next.value};
        }, {presentationMutation});
      }, {presentationMutation});
    },
  });
}
