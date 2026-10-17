import { uploadZoneClip } from '@/lib/zone-cloud-store.mjs';
import { jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { return jsonResponse(await uploadZoneClip(request), 201); }
  catch (error) { return errorResponse(error); }
}
