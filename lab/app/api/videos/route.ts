import { loadVideoRegistry } from '@/lib/video-registry.mjs';
import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { assertLocalRequest(request); return jsonResponse(await loadVideoRegistry()); }
  catch (error) { return errorResponse(error); }
}
