import { generatedSpeechMediaResponse } from '@/lib/generated-speech-server.mjs';
import { errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  try { return await generatedSpeechMediaResponse(request, await params); }
  catch (error) { return errorResponse(error); }
}
export const HEAD = GET;
