// Test harness only: the shared registry core over Studio's local readers.
// The product reads Neon (lib/neon-video-registry.mjs) and the game service
// uses services/game/storage/video-registry.mjs.
import {studioRoots} from '../../lib/studio-roots.mjs';
import { resolve } from 'node:path';
import {createVideoRegistry} from '../../../../packages/studio-registry/server/registry-core.mjs';
import {labUrl} from '../../lib/lab-url.mjs';
import {readUploads,uploadDirectory,readClassifications} from '../../lib/video-local-readers.mjs';
import {getPrivateMedia} from '../../lib/cloud-media-store.mjs';
import * as mediaBlobIndex from '../../lib/media-blob-index.mjs';
import {assertLocalRequest} from '../../lib/http-guard.mjs';
export {exactHttpsOrigin} from '../../../../packages/studio-registry/server/registry-core.mjs';
function localRegistry() {
  const repositoryRoot=studioRoots().repositoryRoot;
  return createVideoRegistry({repositoryRoot,previewUrl:id=>labUrl('/api/videos/'+id),uploadDirectory,readUploads,readClassifications,getPrivateMedia,mediaBlobIndex});
}
export function loadVideoRegistry(options) { return localRegistry().loadVideoRegistry(options); }
export function getVideoResponse(id,request,options) { return localRegistry().getVideoResponse(id,request,options); }
/** Only allowlisted UUIDs resolve to media; no URLs, arbitrary paths, or symlinks. */
export async function getLabVideoResponse(id, request, options = {}) {
  assertLocalRequest(request);
  // The authenticated gateway has already checked Host, Origin and its private
  // header. Next still supplies a loopback Request.url to the internal handler.
  return getVideoResponse(id, request, { ...options, trustedProxyOrigin: process.env.LAB_PUBLIC_URL });
}
