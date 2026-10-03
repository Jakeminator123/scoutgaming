import { loadVideoRegistry } from '@/lib/video-registry.mjs';
import { classifyVideo } from '@/lib/video-classifications.mjs';
import { assertLocalRequest, readLocalJson, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
import { nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioMedia } from '@/lib/studio-media-api.mjs';
import { assertRenderStudioWritable } from '@/lib/studio-render-persistence.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  try {
    assertLocalRequest(request);assertRenderStudioWritable();
    const body = await readLocalJson(request);
    await classifyVideo(body, await loadVideoRegistry());
    return jsonResponse(await loadVideoRegistry());
  } catch (error) { return errorResponse(error); }
}
