import { assertLocalRequest, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
export async function GET(request: Request) {
  try { assertLocalRequest(request); return jsonResponse({ ok: true, service: 'croupier-next-studio', localOnly: true }); }
  catch (error) { return errorResponse(error); }
}
