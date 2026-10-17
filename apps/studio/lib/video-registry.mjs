import {studioRoots} from './studio-roots.mjs';
import { resolve } from 'node:path';
import {createVideoRegistry} from '../../../packages/studio-registry/server/registry-core.mjs';
import {labUrl} from './lab-url.mjs';
import {readUploads,uploadDirectory,readClassifications} from './video-local-readers.mjs';
import {getPrivateMedia} from './cloud-media-store.mjs';
import * as mediaBlobIndex from './media-blob-index.mjs';
import {assertLocalRequest} from './http-guard.mjs';
import {StudioError} from '../../../packages/shared/studio-error.mjs';
export {exactHttpsOrigin} from '../../../packages/studio-registry/server/registry-core.mjs';
function localRegistry() {
  const repositoryRoot=studioRoots().repositoryRoot;
  return createVideoRegistry({repositoryRoot,previewUrl:id=>labUrl('/api/videos/'+id),uploadDirectory,readUploads,readClassifications,getPrivateMedia,mediaBlobIndex});
}
export function loadVideoRegistry(options) { return localRegistry().loadVideoRegistry(options); }
export function getVideoResponse(id,request,options) { return localRegistry().getVideoResponse(id,request,options); }
export async function rescanVideoRegistry() {
  throw new StudioError('Den lokala dealerbanken är avvecklad. Lägg till klipp i klippbiblioteket.', 410);
}
/** Only allowlisted UUIDs resolve to media; no URLs, arbitrary paths, or symlinks. */
export async function getLabVideoResponse(id, request, options = {}) {
  assertLocalRequest(request);
  // The authenticated gateway has already checked Host, Origin and its private
  // header. Next still supplies a loopback Request.url to the internal handler.
  return getVideoResponse(id, request, { ...options, trustedProxyOrigin: process.env.LAB_PUBLIC_URL });
}
