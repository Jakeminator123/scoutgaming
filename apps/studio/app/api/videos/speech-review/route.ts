import {nativeStudioAdminEnabled} from '@/lib/studio-native-runtime.mjs';
import {handleNativeStudioMedia} from '@/lib/studio-media-api.mjs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeStudioMedia(request);
  return Response.json({error: 'studio_native_media_required'}, {status: 503});
}
