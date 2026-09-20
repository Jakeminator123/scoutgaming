import { loadVideoRegistry } from '@/lib/video-registry.mjs';
import { classifyVideo } from '@/lib/video-classifications.mjs';
import { readLocalJson, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await readLocalJson(request);
    await classifyVideo(body, await loadVideoRegistry());
    return jsonResponse(await loadVideoRegistry());
  } catch (error) { return errorResponse(error); }
}
