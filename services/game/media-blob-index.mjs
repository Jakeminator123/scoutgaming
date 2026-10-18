import {createMediaBlobIndex} from '../../packages/studio-registry/server/media-blob-index.mjs';
import {repositoryRoot,readMediaLayout} from '../../tools/media-layout.mjs';
import {readLocalMediaBlobIndex} from '../../tools/media-blob-index-reader.mjs';
import {getPrivateMedia} from './blob-media.mjs';
export {validateMediaBlobIndex} from '../../packages/studio-registry/server/media-blob-index.mjs';
export const {readMediaBlobIndex,mediaBlobStorage,isMediaBlobIndexConfigured,verifiedMediaBlobStorage,getIndexedMediaBlobResponse,getPublicMediaBlobResponse}=createMediaBlobIndex({repositoryRoot,getPrivateMedia,readLocalIndex:readLocalMediaBlobIndex,readMediaLayout});
