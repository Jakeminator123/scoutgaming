import { zoneReferenceResponse } from '@/lib/zone-reference.mjs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return zoneReferenceResponse(request);
}
