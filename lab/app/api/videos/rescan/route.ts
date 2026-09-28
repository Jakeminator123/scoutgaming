import { rescanVideoRegistry } from '@/lib/video-registry.mjs';
import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    return jsonResponse(await rescanVideoRegistry());
  } catch (error) { return errorResponse(error); }
}
