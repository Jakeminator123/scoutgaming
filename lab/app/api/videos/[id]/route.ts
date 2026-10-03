import { getLabVideoResponse } from '@/lib/video-registry.mjs';
import { assertLocalRequest, errorResponse } from '@/lib/http-guard.mjs';
import { nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioMedia } from '@/lib/studio-media-api.mjs';
import { studioRenderPersistence } from '@/lib/studio-render-persistence.mjs';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  try { assertLocalRequest(request);const { id } = await context.params;const shared = await studioRenderPersistence();return await (shared ? shared.videoResponse(id,request) : getLabVideoResponse(id, request)); }
  catch (error) { return errorResponse(error); }
}
export const HEAD = GET;
