import {createBlobMediaStore} from '../packages/studio-registry/server/blob-reader.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export {MEDIA_MIME,mediaBlobPath,privateContentTypeMatches,isCloudMediaConfigured,validatePrivateMedia} from '../packages/studio-registry/server/private-media-contract.mjs';
const mediaStore=createBlobMediaStore({clientFactory:()=>import('@vercel/blob'),defaultCacheDir:join(tmpdir(),'croupier-private-media')});
export const {getPrivateMedia,withVerifiedPrivateMediaFile,putPrivateMedia,deletePrivateMedia}=mediaStore;
