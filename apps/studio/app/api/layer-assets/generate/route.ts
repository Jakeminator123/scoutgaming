import {handleAiBackgroundRequest} from '@/lib/ai-background-api.mjs';

// The model reasons before the image tool renders; the provider deadline is 240 s.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) { return handleAiBackgroundRequest(request); }
export async function POST(request: Request) { return handleAiBackgroundRequest(request); }
