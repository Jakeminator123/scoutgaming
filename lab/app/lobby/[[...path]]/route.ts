import { servePublicLobby, designPreviewHeaders } from '../../../lib/design-preview.mjs';
import { errorResponse } from '../../../lib/http-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function respond(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try {
    return await servePublicLobby(request, (await context.params).path ?? []);
  } catch (error) {
    const response = errorResponse(error);
    for (const [name, value] of Object.entries(designPreviewHeaders)) response.headers.set(name, value);
    return response;
  }
}
export { respond as GET, respond as HEAD };
