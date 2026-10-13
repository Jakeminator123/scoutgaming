import { serveAdminWorkspaceData } from '@/lib/admin-workspace-data.mjs';
import { normalizeNativeStudioRequest } from '@/lib/studio-native-request.mjs';
import { assertNativeStudioRequest, nativeStudioAdminConfiguration, studioNativeRuntime, nativeStudioErrorResponse } from '@/lib/studio-native-runtime.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const config = nativeStudioAdminConfiguration();
    const normalized = normalizeNativeStudioRequest(request, config);
    assertNativeStudioRequest(normalized, config);
    return await serveAdminWorkspaceData(normalized, {
      authorize: async (current: Request) => {
        const session = await (await studioNativeRuntime()).authorize(current);
        if (!['admin', 'superadmin'].includes(session.role)) throw Object.assign(new Error('studio_request_rejected'), {statusCode: 403});
      },
      runtime: studioNativeRuntime,
      connectedLane: process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane',
    });
  } catch (error) { return nativeStudioErrorResponse(error); }
}
