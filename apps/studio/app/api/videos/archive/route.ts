import {handleNativeStudioMedia} from '@/lib/studio-media-api.mjs';

export const runtime='nodejs';

export async function POST(request: Request) { return handleNativeStudioMedia(request); }
