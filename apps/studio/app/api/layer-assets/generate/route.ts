import {nativeStudioAdminEnabled, nativeStudioErrorResponse} from '@/lib/studio-native-runtime.mjs';
import {handleAiBackgroundRequest} from '@/lib/ai-background-api.mjs';
export const runtime = 'nodejs';
// The model reasons before the image tool renders; the provider deadline is 240 s.
export const maxDuration = 300;
const handle = (request: Request) => nativeStudioAdminEnabled() ? handleAiBackgroundRequest(request) : nativeStudioErrorResponse({statusCode:503});
export const GET = handle;
export const POST = handle;
