import { loadVideoRegistry } from '@/lib/video-registry.mjs';
import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
import { uploadVideo } from '@/lib/video-uploads.mjs';
import { nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioMedia } from '@/lib/studio-media-api.mjs';
import { studioRenderPersistence, assertRenderStudioWritable } from '@/lib/studio-render-persistence.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  try { assertLocalRequest(request);const shared = await studioRenderPersistence();return jsonResponse(await (shared ? shared.videoRegistry() : loadVideoRegistry())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  try { assertLocalRequest(request);assertRenderStudioWritable();return jsonResponse(await uploadVideo(request), 201); }
  catch (error) { return errorResponse(error); }
}
