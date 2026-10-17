import {nativeStudioAdminEnabled, nativeStudioErrorResponse} from '@/lib/studio-native-runtime.mjs';
import {handleNativeLayerAssets} from '@/lib/layer-asset-api.mjs';
export const runtime = 'nodejs';
const handle = (request: Request) => nativeStudioAdminEnabled() ? handleNativeLayerAssets(request) : nativeStudioErrorResponse({statusCode:503});
export const GET = handle;
export const HEAD = handle;
export const POST = handle;
