// Historical variants can still carry these serialized clip IDs. The video-binding
// validator reads their shape; no retired policy is expanded or applied to playback.
export const LEGACY_VARIANT_DEALERS = Object.freeze(['vera', 'amira', 'mei']);
const CLIP_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

export function isLegacyClipReference(id) {
  return typeof id === 'string' && CLIP_ID.test(id) && !id.includes('..') && !id.includes('\\') && !id.startsWith('/') && !id.includes('://') && !/^[A-Za-z]:\//.test(id);
}
