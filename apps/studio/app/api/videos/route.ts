import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
import { nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioMedia } from '@/lib/studio-media-api.mjs';
import { studioRenderPersistence, assertRenderStudioWritable } from '@/lib/studio-render-persistence.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  try { assertLocalRequest(request);return jsonResponse(await (await studioRenderPersistence()).videoRegistry()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  try { assertLocalRequest(request);assertRenderStudioWritable(); }
  catch (error) { return errorResponse(error); }
}
