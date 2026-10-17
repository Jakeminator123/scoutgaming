import { nativeStudioAdminEnabled, nativeStudioErrorResponse } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioMedia } from '@/lib/studio-media-api.mjs';
export const runtime='nodejs';
export async function POST(request:Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  return nativeStudioErrorResponse({statusCode:503});
}
