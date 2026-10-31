import {handleNativeStudioReplies} from '@/lib/studio-replies-api.mjs';

export const runtime = 'nodejs';

export async function GET(request: Request) { return handleNativeStudioReplies(request); }
export async function HEAD(request: Request) { return handleNativeStudioReplies(request); }
export async function PATCH(request: Request) { return handleNativeStudioReplies(request); }
