import { createStudioMediaApi } from './studio-media-api.mjs';
import { studioNativeRuntime, nativeStudioErrorResponse } from './studio-native-runtime.mjs';
import { getPrivateMedia } from './cloud-media-store.mjs';
import { validateLayerAsset } from '../../web/presentation-layers.mjs';

// Reuse the native media endpoint's session, scope, origin, bounded body and
// re-authorization checks. No unauthenticated path can expose the private library.
export function createLayerAssetApi(runtime, {privateMedia = getPrivateMedia} = {}) {
  const base = runtime.config.apiBase === '/api/admin' ? '/api' : '/studio/api';
  const media = createStudioMediaApi({...runtime, uploads:runtime.layerUploads,
    videoRegistry: async () => ({assets:(await runtime.repository.readDocument('project'))?.value.layerAssets ?? []}),
    videoResponse: async (id, request) => {
      const asset = (await runtime.repository.readDocument('project'))?.value.layerAssets?.find(row => row.id === id);
      if (!asset) return new Response(null,{status:404});
      const {pathname,sha256,size,contentType} = validateLayerAsset(asset);
      return privateMedia({provider:'vercel-blob',pathname,sha256,size,contentType},request);
    }, baseOverride:`${base}/layer-assets`});
  return media;
}
export async function handleNativeLayerAssets(request) {
  try {return await createLayerAssetApi(await studioNativeRuntime()).handle(request);}
  catch (error) {return nativeStudioErrorResponse(error);}
}
