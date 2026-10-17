import { loadCloudZones, saveCloudZones } from '@/lib/zone-cloud-store.mjs';
import { jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { return jsonResponse(await loadCloudZones(request)); }
  catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request) {
  try { return jsonResponse(await saveCloudZones(request)); }
  catch (error) { return errorResponse(error); }
}
