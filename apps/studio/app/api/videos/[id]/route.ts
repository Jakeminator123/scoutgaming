import { handleNativeStudioMedia } from '@/lib/studio-media-api.mjs';

export const runtime = 'nodejs';

export async function GET(request: Request) { return handleNativeStudioMedia(request); }
export async function HEAD(request: Request) { return handleNativeStudioMedia(request); }
