import {studioRoots} from './studio-roots.mjs';
import {createNeonVideoRegistry as createRegistryReader} from '../../../packages/studio-registry/server/registry-reader.mjs';
import {createVideoRegistry} from '../../../packages/studio-registry/server/registry-core.mjs';
import {createMediaBlobIndex} from '../../../packages/studio-registry/server/media-blob-index.mjs';
import {getPrivateMedia} from './cloud-media-store.mjs';
import {labUrl} from './lab-url.mjs';
export function createNeonVideoRegistry({repository,scope,env=process.env,options={}}={}) {
  const repositoryRoot=options.repositoryRoot??(studioRoots().repositoryRoot);
  const mediaBlobIndex=createMediaBlobIndex({repositoryRoot,getPrivateMedia});
  const reader=createVideoRegistry({repositoryRoot,previewUrl:id=>labUrl('/api/videos/'+id),uploadDirectory:()=>null,
    readUploads:async()=>{throw new Error('Explicit cloud registry records required.');},readClassifications:async()=>[],getPrivateMedia,mediaBlobIndex});
  return createRegistryReader({repository,scope,env,options:{...options,repositoryRoot},reader,getPrivateMedia});
}
