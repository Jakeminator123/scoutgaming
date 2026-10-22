import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import { authorizeUiPage } from '../../../lib/ui-server';
import { errorResponse } from '../../../lib/http-guard.mjs';
import { serveDesignPreview, designPreviewHeaders, designPreviewAuthRedirect } from '../../../lib/design-preview.mjs';
import { serveDesignCatalog } from '../../../lib/design-preview-catalog.mjs';
import { studioNativeRuntime, nativeStudioErrorResponse, nativeStudioAdminConfiguration } from '../../../lib/studio-native-runtime.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function respond(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path ?? [];
  try {
    if (path.join('/') === '_data/catalog') return await serveDesignCatalog(request, {
      authorize: authorizeUiPage, readCatalog: async () => (await studioNativeRuntime()).readDesignCatalog(),
    });
    return await serveDesignPreview(request, path, { authorize: authorizeUiPage });
  } catch (error) {
    if (isRedirectError(error)) {
      const response = designPreviewAuthRedirect(getURLFromRedirectError(error), {
        publicOrigin: nativeStudioAdminConfiguration()?.allowedOrigins[0],
        resource: path[0] === '_data' || path[0] === '_assets',
      });
      if (response) return response;
      throw error;
    }
    const response = path[0]==='_data' ? nativeStudioErrorResponse(error) : errorResponse(error);
    for (const [name, value] of Object.entries(designPreviewHeaders)) response.headers.set(name, value);
    return response;
  }
}
export { respond as GET, respond as HEAD };
