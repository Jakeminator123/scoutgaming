import { studioStore } from '@/lib/studio-server.mjs';
import { legacyClipControls } from '@/lib/legacy-clip-inventory.mjs';
import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
import { nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioClipControls } from '@/lib/studio-clip-controls-api.mjs';
import { studioRenderPersistence } from '@/lib/studio-render-persistence.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioClipControls(request);
  try {
    assertLocalRequest(request);
    const shared = await studioRenderPersistence();
    return jsonResponse(shared ? await shared.legacyControls(await shared.projectStore.load()) : await legacyClipControls(await studioStore().load()));
  } catch (error) { return errorResponse(error); }
}
