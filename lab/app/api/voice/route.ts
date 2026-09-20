import { voicePreviewEndpoint } from '@/lib/voice-preview.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return voicePreviewEndpoint(request); }
export async function POST(request: Request) { return voicePreviewEndpoint(request); }
