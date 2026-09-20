import { loadVideoRegistry } from '@/lib/video-registry.mjs';
import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
import { uploadVideo } from '@/lib/video-uploads.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { assertLocalRequest(request); return jsonResponse(await loadVideoRegistry()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try { return jsonResponse(await uploadVideo(request), 201); }
  catch (error) { return errorResponse(error); }
}
