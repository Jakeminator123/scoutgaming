import { studioStore } from '@/lib/studio-server.mjs';
import { legacyClipControls } from '@/lib/legacy-clip-inventory.mjs';
import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return jsonResponse(await legacyClipControls(await studioStore().load()));
  } catch (error) { return errorResponse(error); }
}
