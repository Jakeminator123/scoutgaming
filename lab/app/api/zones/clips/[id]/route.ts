import { streamZoneClip } from '@/lib/zone-cloud-store.mjs';
import { errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await streamZoneClip(request, (await params).id); }
  catch (error) { return errorResponse(error); }
}
export const HEAD = GET;
