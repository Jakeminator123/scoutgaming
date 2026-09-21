import { errorResponse } from '../../../../lib/http-guard.mjs';
import { getOriginalMediaResponse } from '../../../../lib/original-media-server.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try { return await getOriginalMediaResponse((await context.params).path, request); }
  catch (error) { return errorResponse(error); }
}
export const HEAD = GET;
