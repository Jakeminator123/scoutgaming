import { getVideoResponse } from '@/lib/video-registry.mjs';
import { assertLocalRequest, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try { assertLocalRequest(request); const { id } = await context.params; return await getVideoResponse(id, request); }
  catch (error) { return errorResponse(error); }
}
export const HEAD = GET;
