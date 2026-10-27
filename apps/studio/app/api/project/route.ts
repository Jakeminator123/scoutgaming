import { studioStore, connectionStatus } from '@/lib/studio-server.mjs';
import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
import { nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioDocument } from '@/lib/studio-document-api.mjs';
import { assertRenderStudioWritable } from '@/lib/studio-render-persistence.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioDocument(request);
  try { assertLocalRequest(request); return jsonResponse({ project: await studioStore().load(), status: connectionStatus() }); }
  catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioDocument(request);
  try {
    assertLocalRequest(request);
    assertRenderStudioWritable();
  }
  catch (error) { return errorResponse(error); }
}
