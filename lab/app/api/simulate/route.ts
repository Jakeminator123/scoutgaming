import { simulateStudio } from '@/lib/studio-server.mjs';
import { readLocalJson, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
let active = 0;
export async function POST(request: Request) {
  if (active >= 4) return jsonResponse({ error: 'Fyra simuleringar pågår. Försök igen strax.' }, 429);
  active++;
  try { return jsonResponse(await simulateStudio(await readLocalJson(request))); }
  catch (error) { return errorResponse(error); }
  finally { active--; }
}
