import {nativeStudioAdminEnabled} from '@/lib/studio-native-runtime.mjs';
import {handleNativeStudioDealer} from '@/lib/studio-dealer-api.mjs';
export const runtime='nodejs';
export async function POST(request:Request){
 if(nativeStudioAdminEnabled())return handleNativeStudioDealer(request);
 return Response.json({error:'studio_cloud_lifecycle_required'},{status:503});
}
