import { voicePreviewResponse } from '@/lib/voice-preview.mjs';
import { errorResponse } from '@/lib/http-guard.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await voicePreviewResponse(request, (await params).id); }
  catch (error) { return errorResponse(error); }
}
export const HEAD = GET;
