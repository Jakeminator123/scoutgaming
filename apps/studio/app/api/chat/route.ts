import { studioChat } from '@/lib/studio-server.mjs';
import { readLocalJson, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
let active = 0;
export async function POST(request: Request) {
  if (active >= 2) return jsonResponse({ error: 'Två chattsvar pågår. Försök igen strax.' }, 429);
  active++;
  try { return jsonResponse(await studioChat(await readLocalJson(request))); }
  catch (error) { return errorResponse(error); }
  finally { active--; }
}
