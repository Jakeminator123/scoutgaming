import {createBlobMediaStore} from '../../packages/studio-registry/server/blob-reader.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export {MEDIA_MIME,mediaBlobPath,privateContentTypeMatches,isCloudMediaConfigured,validatePrivateMedia} from '../../packages/studio-registry/server/private-media-contract.mjs';
const mediaStore=createBlobMediaStore({clientFactory:()=>import('@vercel/blob'),defaultCacheDir:join(tmpdir(),'croupier-private-media')});
export const {getPrivateMedia,withVerifiedPrivateMediaFile,putPrivateMedia,deletePrivateMedia}=mediaStore;
import {validateStudioMedia} from '../../packages/studio-registry/server/storage-contract.mjs';
import {validatePrivateMedia} from '../../packages/studio-registry/server/private-media-contract.mjs';
/** Only a durable server-authorized pending tombstone may reach this method.
 * Metadata is committed BEFORE this provider call; on failure it stays pending. */
export async function purgeManagedMedia(record, options = {}) {
  const {revision,updatedAt,...value}=record;
  const checked=validateStudioMedia(value);
  if(checked.retainedBank || checked.deletion?.state!=='pending')throw Error('studio_media_deletion_pending');
  const storage=validatePrivateMedia({provider:'vercel-blob',pathname:checked.pathname,sha256:checked.sha256,size:checked.size,contentType:checked.contentType});
  return mediaStore.deleteManagedMediaObject(storage,options);
}
