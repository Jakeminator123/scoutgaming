import { assertLocalRequest, jsonResponse, errorResponse } from '../../../lib/http-guard.mjs';
import { loadOriginalMediaCatalog } from '../../../lib/original-media-server.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { assertLocalRequest(request); return jsonResponse(await loadOriginalMediaCatalog()); }
  catch (error) { return errorResponse(error); }
}
