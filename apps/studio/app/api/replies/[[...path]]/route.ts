import {nativeStudioAdminEnabled, nativeStudioErrorResponse} from '@/lib/studio-native-runtime.mjs';
import {handleNativeStudioReplies} from '@/lib/studio-replies-api.mjs';
export const runtime = 'nodejs';
const handle = (request: Request) => nativeStudioAdminEnabled() ? handleNativeStudioReplies(request) : nativeStudioErrorResponse({statusCode:503});
export const GET = handle;
export const HEAD = handle;
export const PATCH = handle;
