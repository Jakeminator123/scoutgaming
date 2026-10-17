import { zoneReferenceResponse } from '@/lib/zone-reference.mjs';
import {nativeStudioAdminEnabled,studioNativeRuntime,nativeStudioErrorResponse} from '@/lib/studio-native-runtime.mjs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const native=nativeStudioAdminEnabled()?await studioNativeRuntime():null;
    return await zoneReferenceResponse(request,native?{repository:native.repository}:{});
  }catch(error){return nativeStudioErrorResponse(error);}
}
