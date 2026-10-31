import {handleNativeStudioDealer} from '@/lib/studio-dealer-api.mjs';

export const runtime='nodejs';

export async function POST(request: Request) { return handleNativeStudioDealer(request); }
