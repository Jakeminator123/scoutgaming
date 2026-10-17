import {getVideoResponse} from './video-registry.mjs';
// The classifier owns the alpha decision; this app port only resolves exact bytes.
export function readLocalAlphaMedia(id,options) {
  return getVideoResponse(id,new Request('http://localhost/media'),options);
}
