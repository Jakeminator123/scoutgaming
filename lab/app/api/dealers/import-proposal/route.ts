import { nativeStudioAdminEnabled, nativeStudioErrorResponse } from '@/lib/studio-native-runtime.mjs';
import { handleNativeDealerImport } from '@/lib/dealer-import-api.mjs';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeDealerImport(request);
  return nativeStudioErrorResponse({ statusCode: 503 });
}
export async function POST(request: Request) {
  if (nativeStudioAdminEnabled()) return handleNativeDealerImport(request);
  return nativeStudioErrorResponse({ statusCode: 503 });
}
