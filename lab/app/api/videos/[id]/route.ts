import { getLabVideoResponse } from '@/lib/video-registry.mjs';
import { errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try { const { id } = await context.params; return await getLabVideoResponse(id, request); }
  catch (error) { return errorResponse(error); }
}
export const HEAD = GET;
