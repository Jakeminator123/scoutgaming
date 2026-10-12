import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { authorizeUiPage } from '../../../lib/ui-server';
import { errorResponse } from '../../../lib/http-guard.mjs';
import { serveDesignPreview, designPreviewHeaders } from '../../../lib/design-preview.mjs';
import { serveDesignCatalog } from '../../../lib/design-preview-catalog.mjs';
import { studioNativeRuntime, nativeStudioErrorResponse } from '../../../lib/studio-native-runtime.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function respond(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await context.params).path ?? [];
    if (path.join('/') === '_data/catalog') return await serveDesignCatalog(request, {
      authorize: authorizeUiPage, readCatalog: async () => (await studioNativeRuntime()).readDesignCatalog(),
    });
    return await serveDesignPreview(request, path, { authorize: authorizeUiPage });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const response = new URL(request.url).pathname.endsWith('/admin/_data/catalog') ? nativeStudioErrorResponse(error) : errorResponse(error);
    for (const [name, value] of Object.entries(designPreviewHeaders)) response.headers.set(name, value);
    return response;
  }
}
export { respond as GET, respond as HEAD };
