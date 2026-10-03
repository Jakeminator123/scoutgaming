import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalStudioJson, StudioStorageError, validateActor, validateStudioScope, validateStudioMedia } from '../../web/storage/studio-contract.mjs';
import { getPrivateMedia, isCloudMediaConfigured, mediaBlobPath, validatePrivateMedia } from './cloud-media-store.mjs';
import { MAX_VIDEO_BYTES } from './video-intake.mjs';

const fail = (code, statusCode = 503) => {throw new StudioStorageError(code,statusCode);};
const exact = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const TTL = 15 * 60 * 1000;

/** Direct private Blob upload followed by explicit authenticated, verified commit.
 * No state is written to disk, apart from disposable verified Blob scratch.
 * Neither an uploaded object nor its declared client hash is a committed record.
 */
export function createStudioUploadService({repository,scope,ticketKey,env = process.env,options = {},
  clientToken = async args => (await import('@vercel/blob/client')).generateClientTokenFromReadWriteToken(args),
  privateMedia = getPrivateMedia, now = Date.now,
} = {}) {
  scope = validateStudioScope(scope);
  if (!repository?.registerMedia || !repository?.getMedia
    || canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(scope)
    || !(ticketKey instanceof Uint8Array) || ticketKey.byteLength < 32) fail('studio_upload_configuration_invalid');
  const key = Buffer.from(ticketKey), checkedEnv = Object.freeze({...env});
  const mediaOptions = {...options,env:checkedEnv,cacheDir:options.cacheDir ?? join(tmpdir(),'croupier-private-media')};
  function configured() {if (!isCloudMediaConfigured(checkedEnv)) fail('studio_media_storage_unavailable');}
  const sign = data => {
    const encoded = Buffer.from(canonicalStudioJson(data)).toString('base64url');
    return `${encoded}.${createHmac('sha256',key).update(`studio-upload-v1\0${encoded}`).digest('base64url')}`;
  };
  function grant(ticket,actor) {
    if (typeof ticket !== 'string' || ticket.length > 16000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket)) fail('studio_upload_grant_invalid',403);
    const [payload,signature] = ticket.split('.'), bytes = Buffer.from(signature,'base64url');
    const expected = createHmac('sha256',key).update(`studio-upload-v1\0${payload}`).digest();
    if (bytes.length !== expected.length || !timingSafeEqual(bytes,expected) || bytes.toString('base64url') !== signature) fail('studio_upload_grant_invalid',403);
    let data; try {data = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));} catch {fail('studio_upload_grant_invalid',403);}
    if (!exact(data,['v','actor','scope','record','expiresAt']) || data.v !== 1 || data.actor !== actor
      || canonicalStudioJson(data.scope) !== canonicalStudioJson(scope) || !Number.isSafeInteger(data.expiresAt)
      || data.expiresAt <= now() || data.expiresAt > now()+TTL) fail('studio_upload_grant_invalid',403);
    return validateStudioMedia(data.record);
  }
  return Object.freeze({
    async prepare(body,{actor} = {}) {
      configured(); actor = validateActor(actor);
      if (!exact(body,['operation','sha256','size','contentType','classification']) || body.operation !== 'prepare') fail('studio_invalid_request',400);
      if (!['video/mp4','video/webm'].includes(body.contentType) || !Number.isSafeInteger(body.size)
        || body.size < 16 || body.size > MAX_VIDEO_BYTES || !/^[a-f0-9]{64}$/.test(body.sha256)) fail('studio_invalid_media',422);
      const id = randomUUID();
      const record = validateStudioMedia({id,sha256:body.sha256,size:body.size,contentType:body.contentType,
        classification:body.classification,pathname:mediaBlobPath(`dealers/${body.classification?.dealerId}/review/uploads`,id,body.sha256,body.contentType.slice(6))});
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
      // getPrivateMedia hashes every newly fetched complete object, validates
      // exact private URL/type/size and serves this prefix from the same bytes.
      const response = await privateMedia(storage,new Request(request.url,{headers:{Range:'bytes=0-31'}}),mediaOptions);
      if (!response.ok) {await response.body?.cancel();fail('studio_upload_bytes_unavailable',503);}
      const header = Buffer.from(await response.arrayBuffer());
      const validHeader = record.contentType === 'video/mp4' ? header.length >= 16 && header.toString('ascii',4,8) === 'ftyp'
        : header.length >= 16 && header.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
      if (!validHeader) fail('studio_invalid_media_format',415);
      return mutationTransaction(async () => {
        if (typeof stillAuthorized !== 'function' || await stillAuthorized() !== true) fail('studio_request_rejected',403);
        const existing = await repository.getMedia(record.id);
        if (existing) {
          if (['sha256','size','contentType','pathname'].some(field => existing[field] !== record[field])) fail('studio_conflict',409);
          return {id:record.id,duplicate:true};
        }
        const result = await repository.registerMedia(record,{actor});
        // On DB/commit ambiguity preserve immutable bytes for explicit retry.
        // Never delete a potentially referenced object merely because a response failed.
        return {id:record.id,duplicate:result.duplicate};
      });
    },
  });
}
