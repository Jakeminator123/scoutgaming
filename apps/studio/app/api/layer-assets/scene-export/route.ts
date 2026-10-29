import {nativeStudioAdminEnabled, nativeStudioErrorResponse} from '@/lib/studio-native-runtime.mjs';
import {handleSceneExportRequest} from '@/lib/scene-export-api.mjs';
export const runtime = 'nodejs';
// Exportera miljöbild: reads up to two images from private Blob, renders one still with sharp and stores it.
export const maxDuration = 60;
const handle = (request: Request) => nativeStudioAdminEnabled() ? handleSceneExportRequest(request) : nativeStudioErrorResponse({statusCode:503});
export const POST = handle;
